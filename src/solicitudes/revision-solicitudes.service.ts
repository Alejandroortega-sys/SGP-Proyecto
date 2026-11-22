import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { fijarActorAuditoria } from '../common/auditoria';
import {
  etiquetaEstadoSolicitud,
  puedeCambiarEstadoSolicitud,
} from '../common/estados-solicitud';
import { parseIdBigint } from '../common/parse-id';
import {
  Prisma,
  type estado_solicitud,
} from '../generated/prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  agruparVersionesDocumento,
} from './documentos';
import {
  calcularProgresoRevision,
  documentosVigentesRevision,
  estadoDocumentoPorVerificacion,
  estadoRequisitoRevision,
  minutosBloqueoRevision,
  puedeTomarRevision,
  puedeVerificarRevision,
  validarObservacionVerificacion,
  type EstadoRequisitoRevision,
  type VerificacionRequisito,
} from './revision';
import {
  BloqueoRevisionDto,
  ComercianteRevisionDto,
  DocumentoRevisionDto,
  LiberarRevisionResponseDto,
  ListarSolicitudesRevisionResponseDto,
  ListarSolicitudesRevisionQueryDto,
  OpcionesRevisionSolicitudesResponseDto,
  RenovarRevisionResponseDto,
  RequisitoRevisionDto,
  RespuestaVerificarRequisitoDto,
  SolicitudRevisionDetalleDto,
  SolicitudRevisionListadoDto,
  TomarRevisionResponseDto,
  VerificarRequisitoRevisionDto,
} from './dto/revision-solicitudes.dto';
import { HistorialSolicitudDto } from './dto/solicitudes.dto';

const SELECT_COMERCIANTE_REVISION = {
  id: true,
  nombre: true,
  apellido: true,
  correo: true,
  documento: true,
  telefono: true,
} satisfies Prisma.usuariosSelect;

const SELECT_DOCUMENTO_REVISION = {
  id: true,
  requisito_id: true,
  tipo_documento: true,
  nombre_original: true,
  mime_type: true,
  tamano_bytes: true,
  estado: true,
  observacion: true,
  cargado_en: true,
  archivo_url: true,
  reemplaza_a: true,
  verificado_en: true,
  usuarios: { select: { id: true, nombre: true, apellido: true } },
} satisfies Prisma.solicitud_documentosSelect;

const SELECT_SOLICITUD_REVISION = {
  id: true,
  numero_radicado: true,
  estado: true,
  actividad: true,
  fecha_inicio: true,
  fecha_fin: true,
  hora_inicio: true,
  hora_fin: true,
  radicada_en: true,
  decidida_en: true,
  motivo_rechazo: true,
  creado_en: true,
  actualizado_en: true,
  comerciantes: {
    select: {
      actividad_comercial: true,
      categoria: true,
      usuarios: { select: SELECT_COMERCIANTE_REVISION },
    },
  },
  espacios_temporales: {
    select: {
      id: true,
      nombre: true,
      sector: true,
      tipo: true,
      actividad_permitida: true,
    },
  },
  solicitud_productos: {
    select: { productos: { select: { id: true, nombre: true } } },
  },
  solicitud_documentos: {
    orderBy: { cargado_en: 'asc' },
    select: SELECT_DOCUMENTO_REVISION,
  },
  solicitud_historial: {
    orderBy: { creado_en: 'asc' },
    select: {
      id: true,
      estado_anterior: true,
      estado_nuevo: true,
      observacion: true,
      creado_en: true,
      usuarios: { select: { id: true, nombre: true, apellido: true } },
    },
  },
} satisfies Prisma.solicitudesSelect;

type FilaSolicitudRevision = Prisma.solicitudesGetPayload<{
  select: typeof SELECT_SOLICITUD_REVISION;
}>;

type FilaDocumentoRevision = Prisma.solicitud_documentosGetPayload<{
  select: typeof SELECT_DOCUMENTO_REVISION;
}>;

interface FilaEstadoParaBloqueo {
  id: bigint | string;
  estado: estado_solicitud;
  numero_radicado: string;
  comerciante_id: bigint | string;
  correo: string;
  nombre: string;
  espacio_nombre: string | null;
  bloqueo_gestor_id: bigint | string | null;
  bloqueo_vigente: boolean | null;
  bloqueo_expira_en: Date | null;
}

interface FilaBloqueoRaw {
  solicitud_id: bigint | string;
  gestor_id: bigint | string;
  token: string;
  iniciada_en: Date;
  ultima_actividad: Date;
  expira_en: Date;
  vigente: boolean;
  nombre: string;
  apellido: string | null;
  perfil: 'revisor' | 'administrador';
}

/** Bloqueo leído con fechas ya convertidas a UTC por PostgreSQL. */
interface FilaBloqueoConsulta {
  solicitud_id: bigint | string;
  gestor_id: bigint | string;
  iniciada_en: string;
  ultima_actividad: string;
  expira_en: string;
  vigente: boolean;
  nombre: string;
  apellido: string | null;
  perfil: 'revisor' | 'administrador';
}

/** Normaliza un BIGINT que puede llegar como string desde `$queryRaw`. */
function aBigInt(valor: bigint | string): bigint {
  return typeof valor === 'bigint' ? valor : BigInt(valor);
}

/** Catálogo mínimo de requisitos documentales. */
interface RequisitoCatalogo {
  id: bigint;
  nombre: string;
  descripcion: string | null;
  obligatorio: boolean;
  tipo_actividad: string | null;
  orden: number;
}

/**
 * Revisión documental de solicitudes por parte del gestor municipal (HU-19).
 *
 * La bandeja y el visor trabajan sobre una lista de requisitos por actividad.
 * Cada requisito con documento vigente puede marcarse como Cumple o No cumple;
 * el avance se guarda en el mismo documento y queda asociado al gestor.
 *
 * El bloqueo de revisión es un lease en `solicitud_revisiones`: una solicitud
 * solo puede ser editada por el gestor que lo posee. Los bloqueos vencidos se
 * ignoran y pueden ser tomados por otro gestor.
 */
@Injectable()
export class RevisionSolicitudesService {
  private readonly logger = new Logger(RevisionSolicitudesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /** Bandeja de revisión con filtros, orden y paginación. */
  async listar(
    usuario: UsuarioAutenticado,
    dto: ListarSolicitudesRevisionQueryDto,
  ): Promise<ListarSolicitudesRevisionResponseDto> {
    const gestorId = parseIdBigint(usuario.id);
    const pagina = dto.pagina ?? 1;
    const limite = dto.limite ?? 20;
    const orden = dto.orden ?? 'antiguedad';

    const where: Prisma.solicitudesWhereInput = {
      estado: dto.estado
        ? dto.estado
        : { in: ['radicada', 'en_revision'] },
      ...(dto.sector
        ? { espacios_temporales: { sector: dto.sector } }
        : {}),
      ...(dto.actividad
        ? { espacios_temporales: { actividad_permitida: dto.actividad } }
        : {}),
    };

    const [filas, total] = await Promise.all([
      this.prisma.solicitudes.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy:
          orden === 'reciente'
            ? [
                { radicada_en: { sort: 'desc', nulls: 'last' } },
                { id: 'desc' },
              ]
            : [
                { radicada_en: { sort: 'asc', nulls: 'last' } },
                { id: 'asc' },
              ],
        select: SELECT_SOLICITUD_REVISION,
      }),
      this.prisma.solicitudes.count({ where }),
    ]);

    const bloqueos = await this.bloqueosActivos(
      filas.map((fila) => fila.id),
      gestorId,
    );

    return {
      datos: filas.map((fila) =>
        this.aListado(
          fila,
          gestorId,
          bloqueos.get(fila.id.toString()) ?? null,
        ),
      ),
      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas: total === 0 ? 0 : Math.ceil(total / limite),
      },
    };
  }

  /** Opciones de sector y actividad para los filtros de la bandeja. */
  async opciones(): Promise<OpcionesRevisionSolicitudesResponseDto> {
    const [sectores, actividades] = await Promise.all([
      this.prisma.solicitudes.findMany({
        where: {
          estado: { not: 'borrador' },
          espacios_temporales: { sector: { not: null } },
        },
        distinct: ['espacio_id'],
        select: { espacios_temporales: { select: { sector: true } } },
      }),
      this.prisma.solicitudes.findMany({
        where: {
          estado: { not: 'borrador' },
          espacios_temporales: { actividad_permitida: { not: null } },
        },
        distinct: ['espacio_id'],
        select: {
          espacios_temporales: { select: { actividad_permitida: true } },
        },
      }),
    ]);

    return {
      sectores: this.ordenarOpciones(
        sectores.map((fila) => fila.espacios_temporales?.sector),
      ),
      actividades: this.ordenarOpciones(
        actividades.map(
          (fila) => fila.espacios_temporales?.actividad_permitida,
        ),
      ),
    };
  }

  /** Detalle de una solicitud para revisión (solo lectura si no hay bloqueo). */
  async detalle(
    usuario: UsuarioAutenticado,
    idSolicitud: string,
  ): Promise<SolicitudRevisionDetalleDto> {
    const gestorId = parseIdBigint(usuario.id);
    const solicitudId = parseIdBigint(idSolicitud);
    const fila = await this.obtenerSolicitud(solicitudId);
    const bloqueo = await this.bloqueoActivo(solicitudId, gestorId);
    return this.aDetalle(fila, gestorId, bloqueo);
  }

  /**
   * Toma el bloqueo de revisión.
   *
   * Si la solicitud está radicada, la pasa a en_revision, registra historial y
   * notifica al comerciante. El correo se envía después del commit.
   */
  async tomarRevision(
    usuario: UsuarioAutenticado,
    idSolicitud: string,
  ): Promise<TomarRevisionResponseDto> {
    const gestorId = parseIdBigint(usuario.id);
    const solicitudId = parseIdBigint(idSolicitud);
    const minutos = minutosBloqueoRevision();

    const resultado = await this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, gestorId);

      const filas = await tx.$queryRaw<FilaEstadoParaBloqueo[]>`
        SELECT
          s.id,
          s.estado,
          s.numero_radicado,
          s.comerciante_id,
          u.correo,
          u.nombre,
          e.nombre AS espacio_nombre,
          r.gestor_id AS bloqueo_gestor_id,
          (r.expira_en > now()) AS bloqueo_vigente,
          r.expira_en AS bloqueo_expira_en
        FROM solicitudes s
        JOIN usuarios u ON u.id = s.comerciante_id
        LEFT JOIN espacios_temporales e ON e.id = s.espacio_id
        LEFT JOIN solicitud_revisiones r ON r.solicitud_id = s.id
        WHERE s.id = ${solicitudId}
        FOR UPDATE OF s
      `;
      const actual = filas[0];
      if (!actual) {
        throw new NotFoundException('La solicitud no existe');
      }

      if (!puedeTomarRevision(actual.estado)) {
        throw new ConflictException(
          `La solicitud está en estado «${etiquetaEstadoSolicitud(
            actual.estado,
          )}» y no admite revisión.`,
        );
      }

      if (
        actual.bloqueo_vigente &&
        actual.bloqueo_gestor_id !== null &&
        aBigInt(actual.bloqueo_gestor_id) !== gestorId
      ) {
        const bloqueo = await this.obtenerBloqueoRaw(tx, solicitudId);
        throw new ConflictException(this.mensajeBloqueoAjeno(bloqueo));
      }

      const comercianteId = aBigInt(actual.comerciante_id);
      let transiciono = false;
      if (actual.estado === 'radicada') {
        if (!puedeCambiarEstadoSolicitud('radicada', 'en_revision')) {
          throw new ConflictException(
            'La solicitud no puede pasar a revisión.',
          );
        }
        await tx.solicitudes.update({
          where: { id: solicitudId },
          data: {
            estado: 'en_revision',
            revisor_id: gestorId,
          },
        });
        await tx.solicitud_historial.create({
          data: {
            solicitud_id: solicitudId,
            estado_anterior: 'radicada',
            estado_nuevo: 'en_revision',
            actor_id: gestorId,
            observacion: 'El gestor inició la revisión de la solicitud.',
          },
        });
        await this.notificaciones.crearCambioEstadoSolicitud(tx, {
          solicitudId,
          numeroRadicado: actual.numero_radicado,
          usuarioId: comercianteId,
          estadoAnterior: 'radicada',
          estadoNuevo: 'en_revision',
          espacio: actual.espacio_nombre,
        });
        transiciono = true;
      } else {
        await tx.solicitudes.update({
          where: { id: solicitudId },
          data: { revisor_id: gestorId },
        });
      }

      const bloqueo = await this.upsertBloqueo(
        tx,
        solicitudId,
        gestorId,
        minutos,
      );

      return {
        actual: { ...actual, comerciante_id: comercianteId },
        bloqueo,
        transiciono,
      };
    });

    let correoEnviado = true;
    let mensajeCorreo: string | null = null;
    if (resultado.transiciono) {
      const correo =
        await this.notificaciones.enviarCorreoCambioEstadoSolicitud(
          {
            correo: resultado.actual.correo,
            nombre: resultado.actual.nombre,
          },
          {
            solicitudId,
            numeroRadicado: resultado.actual.numero_radicado,
            usuarioId: resultado.actual.comerciante_id,
            estadoAnterior: 'radicada',
            estadoNuevo: 'en_revision',
            espacio: resultado.actual.espacio_nombre,
          },
        );
      correoEnviado = correo.correoEnviado;
      mensajeCorreo = correo.mensajeCorreo;
    }

    const detalle = await this.detalle(usuario, idSolicitud);

    return {
      estado: detalle.estado,
      transiciono: resultado.transiciono,
      correoEnviado,
      mensajeCorreo,
      mensaje: resultado.transiciono
        ? 'Revisión iniciada. La solicitud pasó a «En revisión».'
        : 'Revisión tomada. La solicitud ya estaba en «En revisión».',
      bloqueo: detalle.bloqueo ?? this.aBloqueoDesdeRaw(resultado.bloqueo),
      tokenBloqueo: resultado.bloqueo.token,
      detalle,
    };
  }

  /** Renueva el bloqueo de revisión del gestor autenticado. */
  async renovarRevision(
    usuario: UsuarioAutenticado,
    idSolicitud: string,
  ): Promise<RenovarRevisionResponseDto> {
    const gestorId = parseIdBigint(usuario.id);
    const solicitudId = parseIdBigint(idSolicitud);
    const minutos = minutosBloqueoRevision();
    const expiraEn = new Date(Date.now() + minutos * 60_000);

    const filas = await this.prisma.$queryRaw<{ expira_en: Date }[]>`
      UPDATE solicitud_revisiones
         SET ultima_actividad = now(),
             expira_en = ${expiraEn}
       WHERE solicitud_id = ${solicitudId}
         AND gestor_id = ${gestorId}
         AND expira_en > now()
       RETURNING expira_en
    `;

    if (!filas[0]) {
      throw new ConflictException(
        'El bloqueo de revisión expiró o pertenece a otro gestor.',
      );
    }

    return {
      expiraEn,
      mensaje: 'Bloqueo de revisión renovado.',
    };
  }

  /** Libera el bloqueo del gestor autenticado, si lo posee. */
  async liberarRevision(
    usuario: UsuarioAutenticado,
    idSolicitud: string,
    tokenBloqueo?: string,
  ): Promise<LiberarRevisionResponseDto> {
    const gestorId = parseIdBigint(usuario.id);
    const solicitudId = parseIdBigint(idSolicitud);

    const bloqueo = await this.prisma.solicitud_revisiones.findUnique({
      where: { solicitud_id: solicitudId },
      select: {
        gestor_id: true,
        token: true,
        expira_en: true,
      },
    });

    if (!bloqueo) {
      return {
        liberado: false,
        mensaje: 'La solicitud no tenía un bloqueo activo.',
      };
    }

    if (aBigInt(bloqueo.gestor_id) !== gestorId) {
      throw new ConflictException(
        'El bloqueo de revisión pertenece a otro gestor.',
      );
    }

    // El token evita que una pantalla que se recarga o cierra libere el
    // bloqueo que otra pestaña del mismo gestor acaba de tomar.
    if (tokenBloqueo && bloqueo.token !== tokenBloqueo) {
      return {
        liberado: false,
        mensaje:
          'El bloqueo cambió de sesión y no se liberó desde esta pantalla.',
      };
    }

    await this.prisma.solicitud_revisiones.delete({
      where: { solicitud_id: solicitudId },
    });

    return {
      liberado: true,
      mensaje: 'Bloqueo de revisión liberado.',
    };
  }

  /** Verifica un requisito con documento vigente. */
  async verificarRequisito(
    usuario: UsuarioAutenticado,
    idSolicitud: string,
    idRequisito: string,
    dto: VerificarRequisitoRevisionDto,
  ): Promise<RespuestaVerificarRequisitoDto> {
    const gestorId = parseIdBigint(usuario.id);
    const solicitudId = parseIdBigint(idSolicitud);
    const requisitoId = parseIdBigint(idRequisito);
    const verificacion = dto.estado as VerificacionRequisito;
    const observacion = dto.observacion?.trim() || null;

    const errorObservacion = validarObservacionVerificacion(
      verificacion,
      observacion,
    );
    if (errorObservacion) {
      throw new BadRequestException(errorObservacion);
    }

    const minutos = minutosBloqueoRevision();

    await this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, gestorId);

      const estados = await tx.$queryRaw<
        {
          estado: estado_solicitud;
          actividad: string | null;
        }[]
      >`
        SELECT s.estado, e.actividad_permitida AS actividad
          FROM solicitudes s
          LEFT JOIN espacios_temporales e ON e.id = s.espacio_id
         WHERE s.id = ${solicitudId}
         FOR UPDATE OF s
      `;
      const actual = estados[0];
      if (!actual) {
        throw new NotFoundException('La solicitud no existe');
      }
      if (!puedeVerificarRevision(actual.estado)) {
        throw new ConflictException(
          `La solicitud está en estado «${etiquetaEstadoSolicitud(
            actual.estado,
          )}» y no admite verificación.`,
        );
      }

      await this.exigirBloqueoPropio(tx, solicitudId, gestorId);

      const requisito = await tx.requisitos_documentales.findFirst({
        where: {
          id: requisitoId,
          activo: true,
          OR: [
            { tipo_actividad: null },
            ...(actual.actividad
              ? [{ tipo_actividad: actual.actividad }]
              : []),
          ],
        },
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          obligatorio: true,
          tipo_actividad: true,
          orden: true,
        },
      });
      if (!requisito) {
        throw new BadRequestException(
          'El requisito documental no aplica a la actividad de la solicitud',
        );
      }

      const documentos = await tx.solicitud_documentos.findMany({
        where: {
          solicitud_id: solicitudId,
          requisito_id: requisitoId,
        },
        orderBy: { cargado_en: 'asc' },
        select: SELECT_DOCUMENTO_REVISION,
      });
      const { actual: documentoActual } =
        agruparVersionesDocumento(documentos);
      if (!documentoActual) {
        throw new ConflictException(
          'El requisito no tiene un documento vigente para verificar.',
        );
      }

      const estadoDocumento = estadoDocumentoPorVerificacion(verificacion);
      await tx.solicitud_documentos.update({
        where: { id: documentoActual.id },
        data: {
          estado: estadoDocumento,
          observacion: verificacion === 'no_cumple' ? observacion : null,
          verificado_por: gestorId,
          verificado_en: new Date(),
        },
      });

      await this.renovarBloqueo(tx, solicitudId, gestorId, minutos);
    });

    const detalle = await this.detalle(usuario, idSolicitud);
    const requisitoActualizado = detalle.requisitos.find(
      (requisito) => requisito.id === idRequisito,
    );
    if (!requisitoActualizado) {
      throw new Error('No se pudo leer el requisito verificado');
    }

    return {
      mensaje:
        verificacion === 'cumple'
          ? 'Requisito marcado como «Cumple».'
          : 'Requisito marcado como «No cumple».',
      requisito: requisitoActualizado,
      progreso: detalle.progreso,
      expiraEn: detalle.bloqueo?.expiraEn ?? new Date(),
    };
  }

  /** Obtiene una solicitud completa o lanza 404. */
  private async obtenerSolicitud(
    solicitudId: bigint,
  ): Promise<FilaSolicitudRevision> {
    const fila = await this.prisma.solicitudes.findUnique({
      where: { id: solicitudId },
      select: SELECT_SOLICITUD_REVISION,
    });
    if (!fila) {
      throw new NotFoundException('La solicitud no existe');
    }
    return fila;
  }

  /** Lee el bloqueo con nombres para los mensajes de concurrencia. */
  private async obtenerBloqueoRaw(
    tx: Prisma.TransactionClient,
    solicitudId: bigint,
  ): Promise<FilaBloqueoRaw | null> {
    const filas = await tx.$queryRaw<FilaBloqueoRaw[]>`
      SELECT
        r.solicitud_id,
        r.gestor_id,
        r.token,
        r.iniciada_en,
        r.ultima_actividad,
        r.expira_en,
        (r.expira_en > now()) AS vigente,
        u.nombre,
        u.apellido,
        g.perfil::text AS perfil
      FROM solicitud_revisiones r
      JOIN gestores g ON g.usuario_id = r.gestor_id
      JOIN usuarios u ON u.id = r.gestor_id
      WHERE r.solicitud_id = ${solicitudId}
      FOR UPDATE OF r
    `;
    return filas[0] ?? null;
  }

  /** Crea o renueva el bloqueo con la expiración calculada en la base. */
  private async upsertBloqueo(
    tx: Prisma.TransactionClient,
    solicitudId: bigint,
    gestorId: bigint,
    minutos: number,
  ): Promise<FilaBloqueoRaw> {
    const filas = await tx.$queryRaw<FilaBloqueoRaw[]>`
      INSERT INTO solicitud_revisiones (
        solicitud_id,
        gestor_id,
        iniciada_en,
        ultima_actividad,
        expira_en
      )
      VALUES (
        ${solicitudId},
        ${gestorId},
        now(),
        now(),
        now() + make_interval(mins => ${minutos})
      )
      ON CONFLICT (solicitud_id) DO UPDATE
        SET gestor_id = EXCLUDED.gestor_id,
            token = gen_random_uuid(),
            iniciada_en = CASE
              WHEN solicitud_revisiones.gestor_id = EXCLUDED.gestor_id
                THEN solicitud_revisiones.iniciada_en
              ELSE now()
            END,
            ultima_actividad = now(),
            expira_en = EXCLUDED.expira_en
      RETURNING
        solicitud_id,
        gestor_id,
        token,
        iniciada_en,
        ultima_actividad,
        expira_en,
        TRUE AS vigente,
        (SELECT nombre FROM usuarios WHERE id = ${gestorId}) AS nombre,
        (SELECT apellido FROM usuarios WHERE id = ${gestorId}) AS apellido,
        (SELECT perfil::text FROM gestores WHERE usuario_id = ${gestorId}) AS perfil
    `;
    const bloqueo = filas[0];
    if (!bloqueo) {
      throw new Error('No se pudo crear el bloqueo de revisión');
    }
    return bloqueo;
  }

  /** Exige que exista un bloqueo vigente del gestor autenticado. */
  private async exigirBloqueoPropio(
    tx: Prisma.TransactionClient,
    solicitudId: bigint,
    gestorId: bigint,
  ): Promise<void> {
    const bloques = await tx.$queryRaw<
      { gestor_id: bigint; vigente: boolean }[]
    >`
      SELECT gestor_id, (expira_en > now()) AS vigente
        FROM solicitud_revisiones
       WHERE solicitud_id = ${solicitudId}
       FOR UPDATE
    `;
    const bloqueo = bloques[0];
    if (!bloqueo || !bloqueo.vigente) {
      throw new ConflictException(
        'El bloqueo de revisión expiró. Vuelve a tomar la revisión.',
      );
    }
    if (aBigInt(bloqueo.gestor_id) !== gestorId) {
      throw new ConflictException(
        'Otro gestor está revisando esta solicitud.',
      );
    }
  }

  /** Renueva el bloqueo dentro de una transacción. */
  private async renovarBloqueo(
    tx: Prisma.TransactionClient,
    solicitudId: bigint,
    gestorId: bigint,
    minutos: number,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE solicitud_revisiones
         SET ultima_actividad = now(),
             expira_en = now() + make_interval(mins => ${minutos})
       WHERE solicitud_id = ${solicitudId}
         AND gestor_id = ${gestorId}
    `;
  }

  private mensajeBloqueoAjeno(bloqueo: FilaBloqueoRaw | null): string {
    const nombre = bloqueo
      ? `${bloqueo.nombre}${bloqueo.apellido ? ` ${bloqueo.apellido}` : ''}`
      : 'Otro gestor';
    return `${nombre} está revisando esta solicitud. Puedes consultarla en solo lectura.`;
  }

  private ordenarOpciones(valores: (string | null | undefined)[]): string[] {
    return [...new Set(valores.filter((valor): valor is string => Boolean(valor)))]
      .sort((a, b) => a.localeCompare(b, 'es'));
  }

  /** Convierte el resultado crudo del bloqueo al DTO. */
  private aBloqueoDesdeRaw(bloqueo: FilaBloqueoRaw): BloqueoRevisionDto {
    return {
      solicitudId: bloqueo.solicitud_id.toString(),
      gestor: {
        id: bloqueo.gestor_id.toString(),
        nombre: bloqueo.nombre,
        apellido: bloqueo.apellido,
        perfil: bloqueo.perfil,
      },
      iniciadaEn: bloqueo.iniciada_en,
      ultimaActividad: bloqueo.ultima_actividad,
      expiraEn: bloqueo.expira_en,
      esPropio: true,
    };
  }

  private aListado(
    fila: FilaSolicitudRevision,
    gestorId: bigint,
    bloqueo: BloqueoRevisionDto | null,
  ): SolicitudRevisionListadoDto {
    const documentos = documentosVigentesRevision(
      fila.solicitud_documentos,
    ).filter((documento) => documento.requisito_id !== null);
    const requisitosVerificados = documentos.filter(
      (documento) =>
        documento.estado === 'validado' || documento.estado === 'observado',
    ).length;
    const requisitosNoCumplen = documentos.filter(
      (documento) => documento.estado === 'observado',
    ).length;

    return {
      id: fila.id.toString(),
      numeroRadicado: fila.numero_radicado,
      estado: fila.estado,
      actividad: fila.actividad,
      fechaInicio: this.aFechaISO(fila.fecha_inicio),
      fechaFin: this.aFechaISO(fila.fecha_fin),
      horaInicio: this.aHoraISO(fila.hora_inicio),
      horaFin: this.aHoraISO(fila.hora_fin),
      radicadaEn: fila.radicada_en,
      creadoEn: fila.creado_en,
      comerciante: this.aComerciante(fila),
      espacio: fila.espacios_temporales
        ? {
            id: fila.espacios_temporales.id.toString(),
            nombre: fila.espacios_temporales.nombre,
            sector: fila.espacios_temporales.sector,
            tipo: fila.espacios_temporales.tipo,
            actividadPermitida:
              fila.espacios_temporales.actividad_permitida,
          }
        : null,
      documentosCargados: documentos.length,
      requisitosVerificados,
      requisitosNoCumplen,
      bloqueo,
    };
  }

  private async aDetalle(
    fila: FilaSolicitudRevision,
    gestorId: bigint,
    bloqueo: BloqueoRevisionDto | null,
  ): Promise<SolicitudRevisionDetalleDto> {
    const actividad = fila.espacios_temporales?.actividad_permitida ?? null;
    const catalogo = await this.obtenerCatalogo(actividad);
    const requisitos = this.construirRequisitos(fila, catalogo);
    const progreso = calcularProgresoRevision(requisitos);
    const puedeVerificar =
      fila.estado === 'en_revision' &&
      bloqueo !== null &&
      bloqueo.esPropio;

    return {
      // eslint-disable-next-line typescript/no-misused-spread -- el listado es un objeto plano de datos
      ...this.aListado(fila, gestorId, bloqueo),
      decididaEn: fila.decidida_en,
      motivoRechazo: fila.motivo_rechazo,
      actualizadoEn: fila.actualizado_en,
      productos: fila.solicitud_productos.map((relacion) => ({
        id: relacion.productos.id.toString(),
        nombre: relacion.productos.nombre,
      })),
      requisitos,
      otrosDocumentos: this.construirOtrosDocumentos(fila, catalogo),
      historial: fila.solicitud_historial.map((registro) =>
        this.aHistorial(registro),
      ),
      progreso,
      puedeVerificar,
      motivoBloqueo: this.motivoBloqueo(fila.estado, bloqueo),
    };
  }

  /** Catálogo activo de requisitos aplicable a la actividad del espacio. */
  private async obtenerCatalogo(
    actividad: string | null,
  ): Promise<RequisitoCatalogo[]> {
    return this.prisma.requisitos_documentales.findMany({
      where: actividad
        ? {
            activo: true,
            OR: [{ tipo_actividad: null }, { tipo_actividad: actividad }],
          }
        : { activo: true, tipo_actividad: null },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        obligatorio: true,
        tipo_actividad: true,
        orden: true,
      },
    });
  }

  /** Construye la lista de verificación con el documento vigente de cada requisito. */
  private construirRequisitos(
    fila: FilaSolicitudRevision,
    catalogo: readonly RequisitoCatalogo[],
  ): RequisitoRevisionDto[] {
    const solicitudId = fila.id.toString();
    const porRequisito = new Map<string, FilaDocumentoRevision[]>();

    for (const documento of fila.solicitud_documentos) {
      const requisitoId = documento.requisito_id?.toString();
      if (!requisitoId) continue;
      const grupo = porRequisito.get(requisitoId) ?? [];
      grupo.push(documento);
      porRequisito.set(requisitoId, grupo);
    }

    return catalogo.map((requisito) => {
      const grupo = agruparVersionesDocumento(
        porRequisito.get(requisito.id.toString()) ?? [],
      );
      const versiones = grupo.versiones.map((version) =>
        this.aDocumento(
          version.fila,
          version.numeroVersion,
          version.esActual,
          solicitudId,
        ),
      );
      const documentoActual =
        versiones.find((version) => version.esActual) ?? null;

      return {
        id: requisito.id.toString(),
        nombre: requisito.nombre,
        descripcion: requisito.descripcion,
        obligatorio: requisito.obligatorio,
        tipoActividad: requisito.tipo_actividad,
        orden: requisito.orden,
        estado: estadoRequisitoRevision(
          documentoActual?.estado,
          documentoActual !== null,
        ) as EstadoRequisitoRevision,
        documentoActual,
        versiones,
        observacion: documentoActual?.observacion ?? null,
        verificadoEn: documentoActual?.verificadoEn ?? null,
        verificadoPor: documentoActual?.verificadoPor ?? null,
      };
    });
  }

  /** Documentos vigentes que no pertenecen al catálogo actual. */
  private construirOtrosDocumentos(
    fila: FilaSolicitudRevision,
    catalogo: readonly RequisitoCatalogo[],
  ): DocumentoRevisionDto[] {
    const solicitudId = fila.id.toString();
    const idsCatalogo = new Set(
      catalogo.map((requisito) => requisito.id.toString()),
    );
    const noClasificados = documentosVigentesRevision(
      fila.solicitud_documentos,
    ).filter((documento) => {
      const requisitoId = documento.requisito_id?.toString();
      return !requisitoId || !idsCatalogo.has(requisitoId);
    });

    return noClasificados.map((documento) =>
      this.aDocumento(documento, 1, true, solicitudId),
    );
  }

  private aComerciante(
    fila: FilaSolicitudRevision,
  ): ComercianteRevisionDto {
    const usuario = fila.comerciantes.usuarios;
    return {
      id: usuario.id.toString(),
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      correo: usuario.correo,
      documento: usuario.documento,
      telefono: usuario.telefono,
      actividadComercial: fila.comerciantes.actividad_comercial,
      categoria: fila.comerciantes.categoria,
    };
  }

  private async bloqueosActivos(
    ids: readonly bigint[],
    gestorId: bigint,
  ): Promise<Map<string, BloqueoRevisionDto>> {
    if (ids.length === 0) return new Map();

    const filas = await this.prisma.$queryRaw<FilaBloqueoConsulta[]>`
      SELECT
        r.solicitud_id,
        r.gestor_id,
        to_char(r.iniciada_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS iniciada_en,
        to_char(r.ultima_actividad AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS ultima_actividad,
        to_char(r.expira_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS expira_en,
        (r.expira_en > now()) AS vigente,
        u.nombre,
        u.apellido,
        g.perfil::text AS perfil
      FROM solicitud_revisiones r
      JOIN gestores g ON g.usuario_id = r.gestor_id
      JOIN usuarios u ON u.id = r.gestor_id
      WHERE r.solicitud_id IN (${Prisma.join(ids)})
        AND r.expira_en > now()
    `;

    return new Map(
      filas.map((fila) => [
        fila.solicitud_id.toString(),
        this.aBloqueoConsulta(fila, gestorId),
      ]),
    );
  }

  private async bloqueoActivo(
    solicitudId: bigint,
    gestorId: bigint,
  ): Promise<BloqueoRevisionDto | null> {
    const bloqueos = await this.bloqueosActivos([solicitudId], gestorId);
    return bloqueos.get(solicitudId.toString()) ?? null;
  }

  private aBloqueoConsulta(
    bloqueo: FilaBloqueoConsulta,
    gestorId: bigint,
  ): BloqueoRevisionDto {
    return {
      solicitudId: bloqueo.solicitud_id.toString(),
      gestor: {
        id: bloqueo.gestor_id.toString(),
        nombre: bloqueo.nombre,
        apellido: bloqueo.apellido,
        perfil: bloqueo.perfil,
      },
      iniciadaEn: new Date(bloqueo.iniciada_en),
      ultimaActividad: new Date(bloqueo.ultima_actividad),
      expiraEn: new Date(bloqueo.expira_en),
      esPropio: aBigInt(bloqueo.gestor_id) === gestorId,
    };
  }

  private motivoBloqueo(
    estado: estado_solicitud,
    bloqueo: BloqueoRevisionDto | null,
  ): string | null {
    if (estado !== 'en_revision') {
      return `La solicitud está en estado «${etiquetaEstadoSolicitud(
        estado,
      )}» y no admite verificación.`;
    }
    if (!bloqueo) {
      return 'Toma la revisión para verificar los requisitos.';
    }
    if (!bloqueo.esPropio) {
      return `${bloqueo.gestor.nombre}${
        bloqueo.gestor.apellido ? ` ${bloqueo.gestor.apellido}` : ''
      } está revisando esta solicitud. Puedes consultarla en solo lectura.`;
    }
    return null;
  }

  private aHistorial(
    registro: FilaSolicitudRevision['solicitud_historial'][number],
  ): HistorialSolicitudDto {
    return {
      id: registro.id.toString(),
      estadoAnterior: registro.estado_anterior,
      estadoNuevo: registro.estado_nuevo,
      observacion: registro.observacion,
      creadoEn: registro.creado_en,
      actor: registro.usuarios
        ? {
            id: registro.usuarios.id.toString(),
            nombre: registro.usuarios.nombre,
            apellido: registro.usuarios.apellido,
          }
        : null,
    };
  }

  private aDocumento(
    fila: FilaDocumentoRevision,
    numeroVersion: number,
    esActual: boolean,
    solicitudId: string,
  ): DocumentoRevisionDto {
    return {
      id: fila.id.toString(),
      requisitoId: fila.requisito_id?.toString() ?? null,
      tipoDocumento: fila.tipo_documento,
      nombreOriginal: fila.nombre_original,
      mimeType: fila.mime_type,
      tamanoBytes: fila.tamano_bytes,
      estado: fila.estado,
      observacion: fila.observacion,
      cargadoEn: fila.cargado_en,
      numeroVersion,
      reemplazaA: fila.reemplaza_a?.toString() ?? null,
      esActual,
      url: `/solicitudes/${solicitudId}/documentos/${fila.id.toString()}/archivo`,
      verificadoEn: fila.verificado_en,
      verificadoPor: fila.usuarios
        ? {
            id: fila.usuarios.id.toString(),
            nombre: fila.usuarios.nombre,
            apellido: fila.usuarios.apellido,
          }
        : null,
    };
  }

  private aFechaISO(valor: string | Date): string {
    if (valor instanceof Date) return valor.toISOString().slice(0, 10);
    return valor.slice(0, 10);
  }

  private aHoraISO(valor: string | Date): string {
    if (valor instanceof Date) return valor.toISOString().slice(11, 16);
    return valor.slice(0, 5);
  }
}
