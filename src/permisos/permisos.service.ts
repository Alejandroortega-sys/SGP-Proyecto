import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fijarActorAuditoria } from '../common/auditoria';
import { etiquetaEstadoSolicitud } from '../common/estados-solicitud';
import { parseIdBigint } from '../common/parse-id';
import { Prisma, type estado_permiso } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { construirCarnePdf } from './carne';
import {
  CobroPermisoDto,
  EmitirPermisoDto,
  EmitirPermisoResponseDto,
  CambiarEstadoPermisoDto,
  CambiarEstadoPermisoResponseDto,
  ListarMisPermisosQueryDto,
  ListarMisPermisosResponseDto,
  ListarPermisosGestorQueryDto,
  ListarPermisosGestorResponseDto,
  type MiPermisoDto,
  MiPermisoDetalleDto,
  type PermisoListadoDto,
  PermisoGestorDetalleDto,
  RenovarPermisoResponseDto,
  TrazabilidadPermisoResponseDto,
  VerificacionQrResponseDto,
} from './dto/permisos.dto';

/**
 * Formatea una fecha como `AAAA-MM-DD`.
 *
 * Prisma/pg devuelve las columnas `DATE` como `Date` a la medianoche UTC:
 * se extraen los componentes **UTC** (misma convención que `aFechaISO` de
 * `revision-solicitudes.service.ts`, que ya usa `toISOString()`). Usar
 * componentes locales desplazaría la fecha un día en zonas horarias con
 * desfase negativo.
 */
export function fechaISO(valor: Date): string {
  return valor.toISOString().slice(0, 10);
}

/** Fecha de hoy (UTC) como `AAAA-MM-DD`, coherente con `fechaISO`. */
export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Une nombre y apellido para mostrar al titular. */
function nombreCompleto(nombre: string, apellido: string | null): string {
  return apellido ? `${nombre} ${apellido}` : nombre;
}

/** Formato del token QR generado por la BD: 24 bytes en hex (48 caracteres). */
const PATRON_QR_TOKEN = /^[0-9a-f]{48}$/;

/** Fila de la solicitud sobre la que se emite un permiso (HU-31). */
interface FilaSolicitudEmision {
  id: bigint;
  numero_radicado: string;
  estado: string;
  comerciante_id: bigint;
  espacio_id: bigint | null;
  actividad: string;
  espacio_nombre: string | null;
  zona_id: bigint | null;
  titular_nombre: string;
  titular_apellido: string | null;
}

/** Permiso recién insertado; número y token los generó la BD. */
interface FilaPermisoEmitido {
  id: bigint;
  numero: string;
  qr_token: string;
  categoria_autorizada: string;
  fecha_inicio: Date;
  fecha_fin: Date;
  estado: estado_permiso;
  emitido_en: Date;
}

/** Permiso propio consultable por el comerciante (HU-32). */
interface FilaPermisoRenovable {
  id: bigint;
  numero: string;
  estado: estado_permiso;
  titular_id: bigint;
  solicitud_id: bigint;
  espacio_id: bigint | null;
  categoria_autorizada: string;
  fecha_inicio: Date;
  fecha_fin: Date;
}

/** Solicitud de renovación recién radicada (HU-34). */
interface FilaSolicitudRenovada {
  id: bigint;
  numero_radicado: string;
  fecha_inicio: Date;
  fecha_fin: Date;
}

/** Datos mínimos de la verificación pública (HU-33). */
interface FilaVerificacionQr {
  id: bigint;
  numero: string;
  estado: estado_permiso;
  fecha_inicio: Date;
  fecha_fin: Date;
  categoria_autorizada: string;
  titular: string;
}

/** Columnas del listado y detalle del gestor (HU-37). */
const SELECT_PERMISO_GESTOR = {
  id: true,
  numero: true,
  solicitud_id: true,
  titular_id: true,
  espacio_id: true,
  categoria_autorizada: true,
  fecha_inicio: true,
  fecha_fin: true,
  estado: true,
  qr_token: true,
  emitido_por: true,
  emitido_en: true,
  renovado_desde: true,
  solicitudes: { select: { numero_radicado: true } },
  comerciantes: {
    select: {
      usuarios: { select: { id: true, nombre: true, apellido: true } },
    },
  },
  espacios_temporales: { select: { id: true, nombre: true } },
  gestores: {
    select: {
      usuarios_gestores_usuario_idTousuarios: {
        select: { id: true, nombre: true, apellido: true },
      },
    },
  },
  permisos: { select: { id: true, numero: true } },
  other_permisos: {
    select: {
      id: true,
      numero: true,
      fecha_inicio: true,
      fecha_fin: true,
      estado: true,
    },
  },
  cobros: { select: { id: true, valor: true, estado: true, pagado_en: true } },
} satisfies Prisma.permisosSelect;

type FilaPermisoGestor = Prisma.permisosGetPayload<{
  select: typeof SELECT_PERMISO_GESTOR;
}>;

/** Columnas del listado «mis permisos» del comerciante (HU-32). */
const SELECT_MI_PERMISO = {
  id: true,
  numero: true,
  categoria_autorizada: true,
  fecha_inicio: true,
  fecha_fin: true,
  estado: true,
  qr_token: true,
  emitido_en: true,
  renovado_desde: true,
  espacios_temporales: { select: { nombre: true } },
  permisos: { select: { numero: true } },
  comerciantes: {
    select: {
      usuarios: { select: { id: true, nombre: true, apellido: true } },
    },
  },
} satisfies Prisma.permisosSelect;

type FilaMiPermiso = Prisma.permisosGetPayload<{
  select: typeof SELECT_MI_PERMISO;
}>;

/**
 * Permisos digitales con QR (HU-31 a HU-37).
 *
 * Reglas de oro (AGENTS §6): el número, el token QR y la fecha de emisión
 * los genera la BD y **nunca** se envían en el `INSERT`; la trazabilidad la
 * escribe el trigger `fn_permiso_trazabilidad` (no se inserta a mano en
 * `permiso_eventos`); suspender o revocar exige `app.motivo` dentro de la
 * transacción. El pago es siempre simulado (HU-36).
 */
@Injectable()
export class PermisosService {
  private readonly logger = new Logger(PermisosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Emite el permiso digital de una solicitud aprobada (HU-31).
   *
   * La emisión es un `INSERT` en `permisos` dentro de una transacción que
   * fija `app.actor_id`: el número (`PER-AAAA-#####`), el `qr_token` y
   * `emitido_en` los genera la BD. También crea el cobro pendiente si hay
   * tarifa vigente (HU-36) y la notificación al titular (CA3).
   */
  async emitir(
    usuario: UsuarioAutenticado,
    dto: EmitirPermisoDto,
  ): Promise<EmitirPermisoResponseDto> {
    const gestorId = parseIdBigint(usuario.id);
    const solicitudId = parseIdBigint(dto.solicitudId);
    const renovadoDesde = dto.renovadoDesde
      ? parseIdBigint(dto.renovadoDesde)
      : null;

    return this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, gestorId);

      const filas = await tx.$queryRaw<FilaSolicitudEmision[]>`
        SELECT s.id, s.numero_radicado, s.estado, s.comerciante_id, s.espacio_id,
               s.actividad, e.nombre AS espacio_nombre, e.zona_id,
               u.nombre AS titular_nombre, u.apellido AS titular_apellido
          FROM solicitudes s
          JOIN comerciantes c ON c.usuario_id = s.comerciante_id
          JOIN usuarios u ON u.id = c.usuario_id
          LEFT JOIN espacios_temporales e ON e.id = s.espacio_id
         WHERE s.id = ${solicitudId}
         FOR UPDATE OF s`;
      const solicitud = filas[0];
      if (!solicitud) {
        throw new NotFoundException('La solicitud no existe');
      }
      if (solicitud.estado !== 'aprobada') {
        throw new UnprocessableEntityException(
          `La solicitud ${solicitud.numero_radicado} está en estado ` +
            `«${etiquetaEstadoSolicitud(
              solicitud.estado as Parameters<typeof etiquetaEstadoSolicitud>[0],
            )}»; solo se emiten permisos de solicitudes aprobadas.`,
        );
      }
      if (solicitud.espacio_id === null) {
        throw new UnprocessableEntityException(
          'La solicitud aprobada no tiene espacio asignado: no se puede emitir el permiso.',
        );
      }

      const existente = await tx.permisos.findUnique({
        where: { solicitud_id: solicitudId },
        select: { numero: true },
      });
      if (existente) {
        throw new ConflictException(
          `La solicitud ${solicitud.numero_radicado} ya tiene el permiso ` +
            `${existente.numero} asociado.`,
        );
      }

      let origen: { id: string; numero: string } | null = null;
      if (renovadoDesde !== null) {
        const origenes = await tx.$queryRaw<
          { id: bigint; numero: string; titular_id: bigint }[]
        >`
          SELECT id, numero, titular_id FROM permisos WHERE id = ${renovadoDesde}`;
        const permisoOrigen = origenes[0];
        if (!permisoOrigen) {
          throw new NotFoundException(
            'El permiso de origen de la renovación no existe',
          );
        }
        if (permisoOrigen.titular_id !== solicitud.comerciante_id) {
          throw new UnprocessableEntityException(
            'El permiso de origen de la renovación pertenece a otro titular.',
          );
        }
        origen = {
          id: permisoOrigen.id.toString(),
          numero: permisoOrigen.numero,
        };
      }

      const emitidos = await tx.$queryRaw<FilaPermisoEmitido[]>`
        INSERT INTO permisos (solicitud_id, titular_id, espacio_id, ubicacion,
                               categoria_autorizada, fecha_inicio, fecha_fin,
                               emitido_por, renovado_desde)
        SELECT s.id, s.comerciante_id, s.espacio_id, e.ubicacion,
               s.actividad, s.fecha_inicio, s.fecha_fin,
               ${gestorId}, ${renovadoDesde}
          FROM solicitudes s
          JOIN espacios_temporales e ON e.id = s.espacio_id
         WHERE s.id = ${solicitudId}
        RETURNING id, numero, qr_token, categoria_autorizada,
                  fecha_inicio, fecha_fin, estado, emitido_en`;
      const permiso = emitidos[0];

      const cobro = await this.crearCobroSiHayTarifa(
        tx,
        permiso.id,
        solicitud.actividad,
        solicitud.zona_id,
      );

      await tx.notificaciones.create({
        data: {
          usuario_id: solicitud.comerciante_id,
          solicitud_id: solicitudId,
          tipo: 'permiso_emitido',
          asunto: `Carné digital ${permiso.numero} disponible`.slice(0, 200),
          cuerpo:
            `Su permiso ${permiso.numero} para ` +
            `«${solicitud.espacio_nombre ?? 'el espacio asignado'}» fue emitido. ` +
            'Descargue su carné con el código QR desde la sección «Mis permisos».',
          canal: 'app',
          leida: false,
        },
        select: { id: true },
      });

      return {
        id: permiso.id.toString(),
        numero: permiso.numero,
        solicitudId: solicitudId.toString(),
        titular: {
          id: solicitud.comerciante_id.toString(),
          nombre: nombreCompleto(
            solicitud.titular_nombre,
            solicitud.titular_apellido,
          ),
        },
        espacio: {
          id: solicitud.espacio_id.toString(),
          nombre: solicitud.espacio_nombre ?? '',
        },
        categoria: permiso.categoria_autorizada,
        fechaInicio: fechaISO(permiso.fecha_inicio),
        fechaFin: fechaISO(permiso.fecha_fin),
        estado: permiso.estado,
        qrToken: permiso.qr_token,
        emitidoEn: permiso.emitido_en,
        renovadoDesde: origen,
        cobro,
        mensaje: `Permiso ${permiso.numero} emitido y carné disponible para el titular.`,
      };
    });
  }

  /**
   * Crea el cobro pendiente del permiso con la tarifa vigente (HU-36, D11).
   *
   * Busca primero la tarifa específica de la zona para la actividad y, si
   * no existe, la general (`zona` nula, actividad «General»). Sin tarifa
   * aplicable no se crea cobro.
   */
  private async crearCobroSiHayTarifa(
    tx: Prisma.TransactionClient,
    permisoId: bigint,
    actividad: string,
    zonaId: bigint | null,
  ): Promise<CobroPermisoDto | null> {
    const tarifas = await tx.$queryRaw<{ id: bigint; valor: Prisma.Decimal }[]>`
      SELECT id, valor
        FROM tarifas
       WHERE vigente_desde <= CURRENT_DATE
         AND (
           (tipo_actividad = ${actividad} AND zona_id = ${zonaId})
           OR (tipo_actividad = 'General' AND zona_id IS NULL)
         )
       ORDER BY (zona_id IS NOT NULL) DESC, vigente_desde DESC, id DESC
       LIMIT 1`;
    const tarifa = tarifas[0];
    if (!tarifa) {
      return null;
    }

    const creados = await tx.$queryRaw<
      { id: bigint; valor: Prisma.Decimal; estado: string }[]
    >`
      INSERT INTO cobros (permiso_id, tarifa_id, valor)
      VALUES (${permisoId}, ${tarifa.id}, ${tarifa.valor.toString()})
      RETURNING id, valor, estado`;
    const cobro = creados[0];

    return {
      id: cobro.id.toString(),
      valor: cobro.valor.toString(),
      estado: cobro.estado,
      pagadoEn: null,
    };
  }

  /**
   * Lista los permisos para el panel del gestor (HU-37).
   *
   * Búsqueda parcial por número, titular o espacio con Prisma
   * parametrizado (nunca `$queryRawUnsafe`) y filtros por estado y rango
   * de fechas de vigencia.
   */
  async listar(
    dto: ListarPermisosGestorQueryDto,
  ): Promise<ListarPermisosGestorResponseDto> {
    const pagina = dto.pagina ?? 1;
    const limite = dto.limite ?? 20;
    const q = dto.q?.trim();
    const where: Prisma.permisosWhereInput = {
      ...(dto.estado ? { estado: dto.estado } : {}),
      ...(dto.desde
        ? { fecha_fin: { gte: new Date(`${dto.desde}T00:00:00.000Z`) } }
        : {}),
      ...(dto.hasta
        ? { fecha_inicio: { lte: new Date(`${dto.hasta}T00:00:00.000Z`) } }
        : {}),
      ...(q
        ? {
            OR: [
              { numero: { contains: q, mode: 'insensitive' } },
              {
                comerciantes: {
                  usuarios: {
                    OR: [
                      { nombre: { contains: q, mode: 'insensitive' } },
                      { apellido: { contains: q, mode: 'insensitive' } },
                    ],
                  },
                },
              },
              {
                espacios_temporales: {
                  nombre: { contains: q, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const [filas, total] = await Promise.all([
      this.prisma.permisos.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: [{ emitido_en: 'desc' }, { id: 'desc' }],
        select: SELECT_PERMISO_GESTOR,
      }),
      this.prisma.permisos.count({ where }),
    ]);

    return {
      datos: filas.map((fila) => this.mapearListadoGestor(fila)),
      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas: total === 0 ? 0 : Math.ceil(total / limite),
      },
    };
  }

  /** Detalle de un permiso para el gestor (con cobro y renovaciones). */
  async detalle(idPermiso: string): Promise<PermisoGestorDetalleDto> {
    const id = parseIdBigint(idPermiso);
    const fila = await this.prisma.permisos.findUnique({
      where: { id },
      select: SELECT_PERMISO_GESTOR,
    });
    if (!fila) {
      throw new NotFoundException('El permiso no existe');
    }
    return this.mapearDetalleGestor(fila);
  }

  /**
   * Suspende, reactiva o revoca un permiso indicando el motivo (HU-35).
   *
   * El historial lo escribe el trigger `fn_permiso_trazabilidad` a partir
   * de `app.actor_id` y `app.motivo`; el backend solo valida la
   * transición y notifica al titular.
   */
  async cambiarEstado(
    usuario: UsuarioAutenticado,
    idPermiso: string,
    dto: CambiarEstadoPermisoDto,
  ): Promise<CambiarEstadoPermisoResponseDto> {
    const permisoId = parseIdBigint(idPermiso);
    const gestorId = parseIdBigint(usuario.id);
    const estadoNuevo = dto.estado;
    const motivo = dto.motivo?.trim() || null;

    if (estadoNuevo !== 'vigente' && !motivo) {
      throw new UnprocessableEntityException(
        `Suspender o revocar un permiso exige un motivo (estado destino «${estadoNuevo}»).`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, gestorId);

      const filas = await tx.$queryRaw<
        {
          id: bigint;
          numero: string;
          estado: estado_permiso;
          titular_id: bigint;
          titular_nombre: string;
          titular_apellido: string | null;
        }[]
      >`
        SELECT p.id, p.numero, p.estado, p.titular_id,
               u.nombre AS titular_nombre, u.apellido AS titular_apellido
          FROM permisos p
          JOIN usuarios u ON u.id = p.titular_id
         WHERE p.id = ${permisoId}
         FOR UPDATE OF p`;
      const permiso = filas[0];
      if (!permiso) {
        throw new NotFoundException('El permiso no existe');
      }

      const estadoAnterior = permiso.estado;
      if (estadoAnterior === estadoNuevo) {
        throw new UnprocessableEntityException(
          `El permiso ${permiso.numero} ya está en estado «${estadoAnterior}».`,
        );
      }
      if (estadoAnterior === 'revocado' || estadoAnterior === 'vencido') {
        throw new UnprocessableEntityException(
          `El permiso ${permiso.numero} está «${estadoAnterior}» y es un estado final: no admite cambios.`,
        );
      }
      if (estadoNuevo === 'vigente' && estadoAnterior !== 'suspendido') {
        throw new UnprocessableEntityException(
          'Solo se puede reactivar un permiso suspendido (estado destino «vigente»).',
        );
      }
      if (estadoNuevo === 'suspendido' && estadoAnterior !== 'vigente') {
        throw new UnprocessableEntityException(
          'Solo se puede suspender un permiso vigente.',
        );
      }
      if (
        estadoNuevo === 'revocado' &&
        estadoAnterior !== 'vigente' &&
        estadoAnterior !== 'suspendido'
      ) {
        throw new UnprocessableEntityException(
          'Solo se puede revocar un permiso vigente o suspendido.',
        );
      }

      // El trigger exige el motivo vía variable de sesión para suspender o
      // revocar; se fija antes del UPDATE, dentro de la transacción.
      await tx.$executeRaw`
        SELECT set_config('app.motivo', ${motivo ?? ''}, true)`;

      await tx.permisos.update({
        where: { id: permisoId },
        data: { estado: estadoNuevo },
        select: { id: true },
      });

      const tipo =
        estadoNuevo === 'suspendido'
          ? 'permiso_suspendido'
          : estadoNuevo === 'vigente'
            ? 'permiso_reactivado'
            : 'permiso_revocado';
      const etiqueta =
        estadoNuevo === 'suspendido'
          ? 'suspendido'
          : estadoNuevo === 'vigente'
            ? 'reactivado'
            : 'revocado';

      await tx.notificaciones.create({
        data: {
          usuario_id: permiso.titular_id,
          tipo,
          asunto: `Permiso ${permiso.numero} ${etiqueta}`.slice(0, 200),
          cuerpo:
            `Su permiso ${permiso.numero} fue ${etiqueta} por la gestión ` +
            `municipal${motivo ? `. Motivo: ${motivo}` : ''}.`,
          canal: 'app',
          leida: false,
        },
        select: { id: true },
      });

      return {
        id: permiso.id.toString(),
        numero: permiso.numero,
        estadoAnterior,
        estado: estadoNuevo,
        motivo,
        mensaje: `Permiso ${etiqueta} y comerciante notificado.`,
      };
    });
  }

  /**
   * Historial completo del permiso (HU-37): eventos del trigger y
   * verificaciones ciudadanas por QR (HU-33).
   */
  async trazabilidad(
    idPermiso: string,
  ): Promise<TrazabilidadPermisoResponseDto> {
    const id = parseIdBigint(idPermiso);
    const fila = await this.prisma.permisos.findUnique({
      where: { id },
      select: SELECT_PERMISO_GESTOR,
    });
    if (!fila) {
      throw new NotFoundException('El permiso no existe');
    }

    const [eventos, totalVerificaciones, ultima] = await Promise.all([
      this.prisma.permiso_eventos.findMany({
        where: { permiso_id: id },
        orderBy: [{ creado_en: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          evento: true,
          motivo: true,
          creado_en: true,
          usuarios: { select: { id: true, nombre: true, apellido: true } },
        },
      }),
      this.prisma.verificaciones_qr.count({
        where: { qr_token: fila.qr_token },
      }),
      this.prisma.verificaciones_qr.findFirst({
        where: { qr_token: fila.qr_token },
        orderBy: { creado_en: 'desc' },
        select: { creado_en: true },
      }),
    ]);

    return {
      permiso: {
        id: fila.id.toString(),
        numero: fila.numero,
        titularNombre: nombreCompleto(
          fila.comerciantes.usuarios.nombre,
          fila.comerciantes.usuarios.apellido,
        ),
        espacioNombre: fila.espacios_temporales?.nombre ?? null,
        categoria: fila.categoria_autorizada,
        fechaInicio: fechaISO(fila.fecha_inicio),
        fechaFin: fechaISO(fila.fecha_fin),
        estado: fila.estado,
      },
      eventos: eventos.map((evento) => ({
        id: evento.id.toString(),
        evento: evento.evento,
        motivo: evento.motivo,
        actorId: evento.usuarios?.id.toString() ?? null,
        actorNombre: evento.usuarios
          ? nombreCompleto(evento.usuarios.nombre, evento.usuarios.apellido)
          : null,
        creadoEn: evento.creado_en,
      })),
      verificaciones: {
        total: totalVerificaciones,
        ultima: ultima?.creado_en ?? null,
      },
    };
  }

  /** Lista los permisos del comerciante autenticado (HU-32). */
  async listarMios(
    usuario: UsuarioAutenticado,
    dto: ListarMisPermisosQueryDto,
  ): Promise<ListarMisPermisosResponseDto> {
    const usuarioId = parseIdBigint(usuario.id);
    const pagina = dto.pagina ?? 1;
    const limite = dto.limite ?? 20;
    const where: Prisma.permisosWhereInput = { titular_id: usuarioId };

    const [filas, total] = await Promise.all([
      this.prisma.permisos.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: [{ emitido_en: 'desc' }, { id: 'desc' }],
        select: SELECT_MI_PERMISO,
      }),
      this.prisma.permisos.count({ where }),
    ]);

    return {
      datos: filas.map((fila) => this.mapearMiPermiso(fila)),
      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas: total === 0 ? 0 : Math.ceil(total / limite),
      },
    };
  }

  /** Detalle del permiso propio con los datos del carné (HU-32, IDOR). */
  async detalleMio(
    usuario: UsuarioAutenticado,
    idPermiso: string,
  ): Promise<MiPermisoDetalleDto> {
    const usuarioId = parseIdBigint(usuario.id);
    const id = parseIdBigint(idPermiso);

    const fila = await this.prisma.permisos.findFirst({
      where: { id, titular_id: usuarioId },
      select: SELECT_MI_PERMISO,
    });
    if (!fila) {
      throw new NotFoundException(
        'El permiso no existe o no pertenece a su cuenta',
      );
    }
    return this.mapearMiPermisoDetalle(fila);
  }

  /** Genera el PDF del carné del permiso propio (HU-32, CA2). */
  async carneMio(
    usuario: UsuarioAutenticado,
    idPermiso: string,
  ): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    const datos = await this.detalleMio(usuario, idPermiso);
    const buffer = await construirCarnePdf({
      numero: datos.numero,
      titular: datos.titularNombre,
      categoria: datos.categoria,
      espacio: datos.espacioNombre,
      fechaInicio: datos.fechaInicio,
      fechaFin: datos.fechaFin,
      estado: datos.estado,
      urlVerificacion: datos.urlVerificacion,
    });
    return { buffer, nombreArchivo: `carne-${datos.numero}.pdf` };
  }

  /**
   * Radica la solicitud simplificada de renovación (HU-34, decisión D2).
   *
   * La renovación no extiende el permiso actual: precarga una solicitud
   * nueva con el mismo espacio, actividad y horario, cuya vigencia empieza
   * el día siguiente al vencimiento del permiso. La solicitud sigue el
   * flujo normal de revisión y, al aprobarse, el gestor emite el permiso
   * nuevo enlazado con `renovado_desde`.
   */
  async renovar(
    usuario: UsuarioAutenticado,
    idPermiso: string,
  ): Promise<RenovarPermisoResponseDto> {
    const usuarioId = parseIdBigint(usuario.id);
    const permisoId = parseIdBigint(idPermiso);

    return this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, usuarioId);

      const filas = await tx.$queryRaw<FilaPermisoRenovable[]>`
        SELECT p.id, p.numero, p.estado, p.titular_id, p.solicitud_id,
               p.espacio_id, p.categoria_autorizada, p.fecha_inicio, p.fecha_fin
          FROM permisos p
         WHERE p.id = ${permisoId} AND p.titular_id = ${usuarioId}
         FOR UPDATE OF p`;
      const permiso = filas[0];
      if (!permiso) {
        throw new NotFoundException(
          'El permiso no existe o no pertenece a su cuenta',
        );
      }

      const hoy = hoyISO();
      const vencidoPorFecha = fechaISO(permiso.fecha_fin) < hoy;
      if (permiso.estado === 'revocado') {
        throw new UnprocessableEntityException(
          `El permiso ${permiso.numero} fue revocado: debe radicar una nueva solicitud.`,
        );
      }
      if (permiso.estado === 'suspendido') {
        throw new UnprocessableEntityException(
          `El permiso ${permiso.numero} está suspendido: no se puede renovar en este estado.`,
        );
      }
      if (permiso.estado === 'vencido' || vencidoPorFecha) {
        throw new UnprocessableEntityException(
          `Su permiso ${permiso.numero} ya venció: debe radicar una nueva solicitud.`,
        );
      }

      const enCurso = await tx.solicitudes.count({
        where: {
          comerciante_id: usuarioId,
          espacio_id: permiso.espacio_id,
          estado: { in: ['radicada', 'en_revision'] },
        },
      });
      if (enCurso > 0) {
        throw new ConflictException(
          'Ya tiene una solicitud radicada o en revisión para ese espacio: ' +
            'espere su resolución antes de renovar.',
        );
      }

      const creadas = await tx.$queryRaw<FilaSolicitudRenovada[]>`
        INSERT INTO solicitudes (comerciante_id, espacio_id, ubicacion_solicitada,
                                 actividad, fecha_inicio, fecha_fin,
                                 hora_inicio, hora_fin, estado, radicada_en)
        SELECT p.titular_id, p.espacio_id, s.ubicacion_solicitada,
               p.categoria_autorizada,
               p.fecha_fin + 1,
               p.fecha_fin + 1 + (p.fecha_fin - p.fecha_inicio),
               s.hora_inicio, s.hora_fin, 'radicada', now()
          FROM permisos p
          JOIN solicitudes s ON s.id = p.solicitud_id
         WHERE p.id = ${permisoId}
        RETURNING id, numero_radicado, fecha_inicio, fecha_fin`;
      const solicitud = creadas[0];

      await tx.solicitud_historial.create({
        data: {
          solicitud_id: solicitud.id,
          estado_anterior: null,
          estado_nuevo: 'radicada',
          actor_id: usuarioId,
          observacion:
            `Renovación del permiso ${permiso.numero}: solicitud radicada ` +
            'con los datos precargados del permiso.',
        },
        select: { id: true },
      });

      return {
        permisoId: permiso.id.toString(),
        permisoNumero: permiso.numero,
        solicitudId: solicitud.id.toString(),
        numeroRadicado: solicitud.numero_radicado,
        fechaInicio: fechaISO(solicitud.fecha_inicio),
        fechaFin: fechaISO(solicitud.fecha_fin),
        mensaje:
          `Solicitud ${solicitud.numero_radicado} radicada con sus datos ` +
          'precargados. Un gestor la revisará y, al aprobarla, se emitirá el ' +
          'permiso nuevo que reemplaza a este.',
      };
    });
  }

  /**
   * Verificación pública por QR (HU-33, AGENTS §9.5).
   *
   * Sin autenticación y con datos mínimos: validez, estado, vigencia,
   * categoría y nombre del titular. «Vigente» exige estado `vigente` y
   * fecha dentro de la vigencia (D3); un permiso vigente con vigencia
   * vencida se reporta como «vencido». Cada consulta se registra en
   * `verificaciones_qr` (sin datos personales del consultante).
   */
  async verificar(
    qrToken: string,
    ip: string | null,
  ): Promise<VerificacionQrResponseDto> {
    const token = (qrToken ?? '').toLowerCase();

    if (!PATRON_QR_TOKEN.test(token)) {
      await this.registrarVerificacion(token.slice(0, 64), 'no_encontrado', ip);
      throw new NotFoundException('Permiso no encontrado');
    }

    const filas = await this.prisma.$queryRaw<FilaVerificacionQr[]>`
      SELECT p.id, p.numero, p.estado, p.fecha_inicio, p.fecha_fin,
             p.categoria_autorizada,
             btrim(u.nombre || ' ' || coalesce(u.apellido, '')) AS titular
        FROM permisos p
        JOIN comerciantes c ON c.usuario_id = p.titular_id
        JOIN usuarios u ON u.id = c.usuario_id
       WHERE p.qr_token = ${token}
       LIMIT 1`;
    const permiso = filas[0];

    if (!permiso) {
      await this.registrarVerificacion(token, 'no_encontrado', ip);
      throw new NotFoundException('Permiso no encontrado');
    }

    const hoy = hoyISO();
    const vigentePorFecha =
      hoy >= fechaISO(permiso.fecha_inicio) &&
      hoy <= fechaISO(permiso.fecha_fin);
    const valido = permiso.estado === 'vigente' && vigentePorFecha;
    const estado: estado_permiso = valido
      ? 'vigente'
      : permiso.estado === 'vigente'
        ? 'vencido'
        : permiso.estado;

    await this.registrarVerificacion(
      token,
      valido ? 'valido' : 'no_vigente',
      ip,
    );

    return {
      valido,
      estado,
      vigenciaInicio: fechaISO(permiso.fecha_inicio),
      vigenciaFin: fechaISO(permiso.fecha_fin),
      categoria: permiso.categoria_autorizada,
      titular: permiso.titular,
    };
  }

  /**
   * Registra una consulta pública en `verificaciones_qr`.
   *
   * Es best-effort: el registro no debe impedir la respuesta al ciudadano.
   */
  private async registrarVerificacion(
    qrToken: string,
    resultado: 'valido' | 'no_vigente' | 'no_encontrado',
    ip: string | null,
  ): Promise<void> {
    try {
      await this.prisma.verificaciones_qr.create({
        data: { qr_token: qrToken, resultado, ip },
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo registrar la verificación del QR: ${String(error)}`,
      );
    }
  }

  /** URL pública que codifica el QR del carné (decisión de contenido del QR). */
  private urlVerificacion(qrToken: string): string {
    const base = (
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001'
    )
      .trim()
      .replace(/\/+$/, '');
    return `${base}/verificar/${qrToken}`;
  }

  private mapearListadoGestor(fila: FilaPermisoGestor): PermisoListadoDto {
    return {
      id: fila.id.toString(),
      numero: fila.numero,
      titularNombre: nombreCompleto(
        fila.comerciantes.usuarios.nombre,
        fila.comerciantes.usuarios.apellido,
      ),
      espacioNombre: fila.espacios_temporales?.nombre ?? null,
      categoria: fila.categoria_autorizada,
      fechaInicio: fechaISO(fila.fecha_inicio),
      fechaFin: fechaISO(fila.fecha_fin),
      estado: fila.estado,
      emitidoEn: fila.emitido_en,
      renovadoDesdeNumero: fila.permisos?.numero ?? null,
    };
  }

  private mapearDetalleGestor(
    fila: FilaPermisoGestor,
  ): PermisoGestorDetalleDto {
    const emitidoPorUsuario =
      fila.gestores.usuarios_gestores_usuario_idTousuarios;
    return {
      id: fila.id.toString(),
      numero: fila.numero,
      solicitudId: fila.solicitud_id.toString(),
      solicitudNumero: fila.solicitudes.numero_radicado,
      titular: {
        id: fila.comerciantes.usuarios.id.toString(),
        nombre: nombreCompleto(
          fila.comerciantes.usuarios.nombre,
          fila.comerciantes.usuarios.apellido,
        ),
      },
      espacio: fila.espacios_temporales
        ? {
            id: fila.espacios_temporales.id.toString(),
            nombre: fila.espacios_temporales.nombre,
          }
        : null,
      categoria: fila.categoria_autorizada,
      fechaInicio: fechaISO(fila.fecha_inicio),
      fechaFin: fechaISO(fila.fecha_fin),
      estado: fila.estado,
      qrToken: fila.qr_token,
      emitidoPor: {
        id: emitidoPorUsuario.id.toString(),
        nombre: nombreCompleto(
          emitidoPorUsuario.nombre,
          emitidoPorUsuario.apellido,
        ),
      },
      emitidoEn: fila.emitido_en,
      renovadoDesde: fila.permisos
        ? {
            id: fila.renovado_desde?.toString() ?? '',
            numero: fila.permisos.numero,
          }
        : null,
      renovaciones: fila.other_permisos.map((renovacion) => ({
        id: renovacion.id.toString(),
        numero: renovacion.numero,
        fechaInicio: fechaISO(renovacion.fecha_inicio),
        fechaFin: fechaISO(renovacion.fecha_fin),
        estado: renovacion.estado,
      })),
      cobro: fila.cobros
        ? {
            id: fila.cobros.id.toString(),
            valor: fila.cobros.valor.toString(),
            estado: fila.cobros.estado,
            pagadoEn: fila.cobros.pagado_en,
          }
        : null,
    };
  }

  private mapearMiPermiso(fila: FilaMiPermiso): MiPermisoDto {
    return {
      id: fila.id.toString(),
      numero: fila.numero,
      estado: fila.estado,
      categoria: fila.categoria_autorizada,
      espacioNombre: fila.espacios_temporales?.nombre ?? null,
      fechaInicio: fechaISO(fila.fecha_inicio),
      fechaFin: fechaISO(fila.fecha_fin),
      emitidoEn: fila.emitido_en,
      renovadoDesdeNumero: fila.permisos?.numero ?? null,
    };
  }

  private mapearMiPermisoDetalle(fila: FilaMiPermiso): MiPermisoDetalleDto {
    return {
      id: fila.id.toString(),
      numero: fila.numero,
      estado: fila.estado,
      titularNombre: nombreCompleto(
        fila.comerciantes.usuarios.nombre,
        fila.comerciantes.usuarios.apellido,
      ),
      categoria: fila.categoria_autorizada,
      espacioNombre: fila.espacios_temporales?.nombre ?? null,
      fechaInicio: fechaISO(fila.fecha_inicio),
      fechaFin: fechaISO(fila.fecha_fin),
      emitidoEn: fila.emitido_en,
      qrToken: fila.qr_token,
      urlVerificacion: this.urlVerificacion(fila.qr_token),
    };
  }
}
