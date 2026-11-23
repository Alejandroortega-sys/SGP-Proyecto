import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { fijarActorAuditoria } from '../common/auditoria';
import { parseIdBigint } from '../common/parse-id';
import {
  Prisma,
  type estado_feria,
  type tipo_zona,
} from '../generated/prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { PrismaService } from '../prisma/prisma.service';
import { buscarTodosLosConflictos, sugerirFechasLibres } from './agenda';
import {
  AgendaFeriaGestorResponseDto,
  AgendaFeriasQueryDto,
  AprobarFeriaResponseDto,
  CancelarFeriaResponseDto,
  ConflictoAgendaFeriaDto,
  CrucesFeriaQueryDto,
  CrucesFeriaResponseDto,
  FeriaGestorDetalleDto,
  FeriaGestorListadoDto,
  ListarFeriasGestorQueryDto,
  ListarFeriasGestorResponseDto,
  MoverFeriaDto,
  MoverFeriaResponseDto,
  EventoAgendaFeriaDto,
  ZonaFeriaGestorDto,
} from './dto/gestor-ferias.dto';
import {
  ESTADOS_FERIA_ACTIVA,
  puedeAprobarFeria,
  puedeCancelarFeria,
  puedeMoverFeria,
  validarFechasFeria,
  validarMotivoCancelacion,
  validarPuestosContraAforo,
} from './reglas';

interface FilaEvento {
  id: bigint | string;
  numero_radicado: string;
  nombre: string;
  tipo_feria: string;
  estado: estado_feria;
  fecha_inicio: string | Date;
  fecha_fin: string | Date;
  numero_puestos: number;
  radicada_en: Date;
  aprobada_en: Date | null;
  cancelada_en: Date | null;
  actualizado_en: Date;
  motivo_cancelacion: string | null;
  zona_id: bigint | string;
  zona_nombre: string;
  zona_tipo: tipo_zona;
  zona_activa: boolean;
  zona_aforo_maximo: number | null;
  zona_horario_inicio: string | null;
  zona_horario_fin: string | null;
  organizador_id: bigint | string;
  organizador_nombre: string;
  organizador_apellido: string | null;
  organizador_correo: string;
  organizacion: string;
  nit: string;
  aprobada_por: string | null;
}

interface FilaZona {
  id: bigint | string;
  nombre: string;
  tipo: tipo_zona;
  activa: boolean;
  aforo_maximo: number | null;
  horario_inicio: string | null;
  horario_fin: string | null;
}

interface FilaConflicto {
  tipo: 'feria' | 'espacio' | 'permiso' | 'solicitud' | 'bloqueo';
  feria_id: bigint | string | null;
  feria_nombre: string | null;
  espacio_id: bigint | string | null;
  espacio_nombre: string | null;
  referencia: string | null;
  fecha_inicio: string | Date;
  fecha_fin: string | Date;
  detalle: string | null;
}

interface FilaFeriaBloqueada {
  id: bigint | string;
  numero_radicado: string;
  nombre: string;
  estado: estado_feria;
  organizador_id: bigint | string;
  zona_id: bigint | string;
  zona_nombre: string;
  fecha_inicio: string | Date;
  fecha_fin: string | Date;
  numero_puestos: number;
  correo: string;
  nombre_organizador: string;
}

interface OpcionesEventos {
  id?: bigint;
  zonaId?: bigint | null;
  estados?: readonly estado_feria[];
  estado?: estado_feria;
  desde?: string;
  hasta?: string;
  busqueda?: string;
  pagina?: number;
  limite?: number;
}

/** Columnas y joins comunes para leer una feria desde la perspectiva del gestor. */
const CAMPOS_EVENTO = Prisma.sql`
  f.id,
  f.numero_radicado,
  f.nombre,
  f.tipo_feria,
  f.estado,
  f.fecha_inicio,
  f.fecha_fin,
  f.numero_puestos,
  f.radicada_en,
  f.aprobada_en,
  f.cancelada_en,
  f.actualizado_en,
  f.motivo_cancelacion,
  z.id AS zona_id,
  z.nombre AS zona_nombre,
  z.tipo AS zona_tipo,
  z.activa AS zona_activa,
  z.aforo_maximo AS zona_aforo_maximo,
  to_char(z.horario_inicio, 'HH24:MI') AS zona_horario_inicio,
  to_char(z.horario_fin, 'HH24:MI') AS zona_horario_fin,
  u.id AS organizador_id,
  u.nombre AS organizador_nombre,
  u.apellido AS organizador_apellido,
  u.correo AS organizador_correo,
  o.nombre_organizacion AS organizacion,
  o.nit,
  ug.nombre AS aprobada_por
`;

const JOINS_EVENTO = Prisma.sql`
  FROM ferias f
  JOIN zonas z ON z.id = f.zona_id
  JOIN organizadores o ON o.usuario_id = f.organizador_id
  JOIN usuarios u ON u.id = o.usuario_id
  LEFT JOIN usuarios ug ON ug.id = f.revisor_id
`;

/**
 * Administración del calendario de ferias y eventos (HU-22).
 *
 * La agenda se consulta por rango de fechas y zona. Aprobar y cancelar son
 * operaciones atómicas: la feria, sus bloqueos de espacios y el aviso interno
 * se guardan en la misma transacción. El correo se envía después del commit.
 */
@Injectable()
export class GestorFeriasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /** Listado administrativo con filtros y paginación. */
  async listar(
    dto: ListarFeriasGestorQueryDto,
  ): Promise<ListarFeriasGestorResponseDto> {
    const pagina = dto.pagina ?? 1;
    const limite = dto.limite ?? 20;
    const opciones: OpcionesEventos = {
      estado: dto.estado,
      zonaId: dto.zonaId ? parseIdBigint(dto.zonaId) : null,
      desde: dto.desde,
      hasta: dto.hasta,
      busqueda: dto.busqueda?.trim(),
      pagina,
      limite,
    };

    if (dto.desde && dto.hasta && dto.hasta < dto.desde) {
      throw new BadRequestException(
        'La fecha final debe ser igual o posterior a la inicial',
      );
    }

    const [filas, total] = await Promise.all([
      this.consultarEventos(opciones, this.prisma),
      this.contarEventos(opciones, this.prisma),
    ]);

    return {
      datos: filas.map((fila) => this.aListado(fila)),
      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas: total === 0 ? 0 : Math.ceil(total / limite),
      },
    };
  }

  /** Agenda del calendario mensual o semanal. */
  async agenda(
    dto: AgendaFeriasQueryDto,
  ): Promise<AgendaFeriaGestorResponseDto> {
    if (dto.hasta < dto.desde) {
      throw new BadRequestException(
        'La fecha final de la agenda debe ser igual o posterior a la inicial',
      );
    }

    const zonaId = dto.zonaId ? parseIdBigint(dto.zonaId) : null;
    const estados = dto.incluirTodos ? undefined : ESTADOS_FERIA_ACTIVA;
    const [zonas, filas] = await Promise.all([
      this.consultarZonas(),
      this.consultarEventos(
        {
          desde: dto.desde,
          hasta: dto.hasta,
          zonaId,
          estados,
        },
        this.prisma,
      ),
    ]);

    const eventos = filas.map((fila) => this.aEvento(fila));
    const cruces: ConflictoAgendaFeriaDto[] = [];
    const conCruces = new Set<string>();

    const activos = eventos.filter(
      (evento) =>
        evento.estado === 'radicada' || evento.estado === 'aprobada',
    );
    for (let indice = 0; indice < activos.length; indice += 1) {
      for (let otro = indice + 1; otro < activos.length; otro += 1) {
        const a = activos[indice];
        const b = activos[otro];
        if (a.zona.id !== b.zona.id) continue;
        if (
          buscarTodosLosConflictos(
            { fechaInicio: a.fechaInicio, fechaFin: a.fechaFin },
            [{ fechaInicio: b.fechaInicio, fechaFin: b.fechaFin }],
          ).length === 0
        ) {
          continue;
        }

        conCruces.add(a.id);
        conCruces.add(b.id);
        cruces.push({
          tipo: 'feria',
          feriaId: b.id,
          feriaNombre: b.nombre,
          espacioId: null,
          espacioNombre: null,
          referencia: b.numeroRadicado,
          fechaInicio: b.fechaInicio,
          fechaFin: b.fechaFin,
          mensaje: `Las ferias «${a.nombre}» y «${b.nombre}» se cruzan en la zona ${b.zona.nombre}.`,
        });
      }
    }

    for (const evento of eventos) {
      if (evento.estado !== 'aprobada') continue;
      const conflictosEspacios = await this.consultarConflictosEspacios(
        this.prisma,
        {
          feriaId: parseIdBigint(evento.id),
          zonaId: parseIdBigint(evento.zona.id),
          fechaInicio: evento.fechaInicio,
          fechaFin: evento.fechaFin,
        },
      );
      if (conflictosEspacios.length === 0) continue;
      conCruces.add(evento.id);
      cruces.push(...conflictosEspacios);
    }

    for (const evento of eventos) {
      if (conCruces.has(evento.id)) evento.tieneCruces = true;
    }

    return {
      desde: dto.desde,
      hasta: dto.hasta,
      zonaId: zonaId?.toString() ?? null,
      zonas,
      eventos,
      cruces,
      resumen: this.resumen(eventos),
    };
  }

  /** Detalle administrativo de una feria. */
  async detalle(id: string): Promise<FeriaGestorDetalleDto> {
    const feriaId = parseIdBigint(id);
    const filas = await this.consultarEventos(
      { id: feriaId },
      this.prisma,
    );
    const fila = filas[0];
    if (!fila) {
      throw new NotFoundException('La feria no existe');
    }

    const [productos, documentos, bloqueos] = await Promise.all([
      this.prisma.feria_productos.findMany({
        where: { feria_id: feriaId },
        select: { productos: { select: { id: true, nombre: true } } },
      }),
      this.prisma.feria_documentos.findMany({
        where: { feria_id: feriaId },
        orderBy: { cargado_en: 'asc' },
        select: {
          id: true,
          tipo_documento: true,
          nombre_original: true,
          mime_type: true,
          tamano_bytes: true,
          cargado_en: true,
        },
      }),
      this.prisma.espacio_bloqueos.findMany({
        where: { feria_id: feriaId },
        orderBy: { espacio_id: 'asc' },
        select: {
          espacio_id: true,
          espacios_temporales: { select: { nombre: true } },
        },
      }),
    ]);

    const base = this.aListado(fila);
    return Object.assign({}, base, {
      aprobadaPor: fila.aprobada_por,
      productos: productos
        .map((item) => ({
          id: item.productos.id.toString(),
          nombre: item.productos.nombre,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
      documentos: documentos.map((documento) => ({
        id: documento.id.toString(),
        tipoDocumento: documento.tipo_documento,
        nombreOriginal: documento.nombre_original,
        mimeType: documento.mime_type,
        tamanoBytes: documento.tamano_bytes,
        cargadoEn: documento.cargado_en,
        url: `/ferias/${base.id}/documentos/${documento.id.toString()}/archivo`,
      })),
      espaciosBloqueados: bloqueos.map((bloqueo) => ({
        id: bloqueo.espacio_id.toString(),
        nombre: bloqueo.espacios_temporales.nombre,
      })),
    });
  }

  /**
   * Vista previa de cruces para aprobar o mover.
   *
   * Para una feria aprobada, o cuando `paraAprobacion` es true, también se
   * revisan los espacios individuales de la zona.
   */
  async cruces(
    id: string,
    dto: CrucesFeriaQueryDto,
  ): Promise<CrucesFeriaResponseDto> {
    const feriaId = parseIdBigint(id);
    const feria = await this.obtenerFeria(feriaId);
    const zonaId = dto.zonaId
      ? parseIdBigint(dto.zonaId)
      : aBigInt(feria.zona_id);
    const errores = validarFechasFeria(dto.fechaInicio, dto.fechaFin);
    if (errores.length > 0) {
      throw new BadRequestException(errores);
    }

    const zona = await this.obtenerZona(zonaId);
    if (!zona.activa || zona.aforoMaximo === null || zona.aforoMaximo <= 0) {
      return {
        disponible: false,
        conflictos: [
          {
            tipo: 'feria',
            feriaId: null,
            feriaNombre: null,
            espacioId: null,
            espacioNombre: null,
            referencia: null,
            fechaInicio: dto.fechaInicio,
            fechaFin: dto.fechaFin,
            mensaje: 'La zona no está activa para ferias.',
          },
        ],
        sugerencias: [],
      };
    }

    const erroresAforo = validarPuestosContraAforo(
      feria.numero_puestos,
      zona.aforoMaximo,
    );
    if (erroresAforo) {
      return {
        disponible: false,
        conflictos: [
          {
            tipo: 'feria',
            feriaId: null,
            feriaNombre: null,
            espacioId: null,
            espacioNombre: null,
            referencia: null,
            fechaInicio: dto.fechaInicio,
            fechaFin: dto.fechaFin,
            mensaje: erroresAforo,
          },
        ],
        sugerencias: [],
      };
    }

    const conflictosFeria = await this.consultarConflictosFeria(
      this.prisma,
      zonaId,
      dto.fechaInicio,
      dto.fechaFin,
      feriaId,
    );
    const incluirEspacios =
      feria.estado === 'aprobada' || dto.paraAprobacion === true;
    const conflictosEspacios = incluirEspacios
      ? await this.consultarConflictosEspacios(this.prisma, {
          feriaId,
          zonaId,
          fechaInicio: dto.fechaInicio,
          fechaFin: dto.fechaFin,
        })
      : [];
    const conflictos = [...conflictosFeria, ...conflictosEspacios];

    const sugerencias =
      conflictos.length > 0
        ? this.sugerirFechas(
            dto.fechaInicio,
            dto.fechaFin,
            conflictos,
          )
        : [];

    return {
      disponible: conflictos.length === 0,
      conflictos,
      sugerencias,
    };
  }

  /** Aprueba una feria y bloquea todos los espacios de su zona. */
  async aprobar(
    usuario: UsuarioAutenticado,
    id: string,
  ): Promise<AprobarFeriaResponseDto> {
    const feriaId = parseIdBigint(id);
    const gestorId = parseIdBigint(usuario.id);

    const resultado = await this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, gestorId);
      const feria = await this.bloquearFeria(tx, feriaId);

      if (!puedeAprobarFeria(feria.estado)) {
        throw new ConflictException(
          `La feria está en estado «${feria.estado}» y no se puede aprobar.`,
        );
      }

      const fechaInicio = this.aFechaISO(feria.fecha_inicio);
      const fechaFin = this.aFechaISO(feria.fecha_fin);
      const erroresFechas = validarFechasFeria(fechaInicio, fechaFin);
      if (erroresFechas.length > 0) {
        throw new BadRequestException(erroresFechas);
      }

      const zona = await this.obtenerZona(aBigInt(feria.zona_id));
      if (!zona.activa) {
        throw new ConflictException(
          'La zona de la feria no está activa. Reactívala antes de aprobar.',
        );
      }
      const errorAforo = validarPuestosContraAforo(
        feria.numero_puestos,
        zona.aforoMaximo,
      );
      if (errorAforo) {
        throw new BadRequestException(errorAforo);
      }

      await this.bloquearZona(tx, aBigInt(feria.zona_id));
      const conflictosFeria = await this.consultarConflictosFeria(
        tx,
        aBigInt(feria.zona_id),
        fechaInicio,
        fechaFin,
        feriaId,
      );
      if (conflictosFeria.length > 0) {
        throw new ConflictException({
          message: conflictosFeria[0].mensaje,
          conflictos: conflictosFeria,
        });
      }

      const espacios = await this.bloquearEspacios(
        tx,
        aBigInt(feria.zona_id),
      );
      const conflictosEspacios =
        espacios.length > 0
          ? await this.consultarConflictosEspacios(tx, {
              feriaId,
              zonaId: aBigInt(feria.zona_id),
              fechaInicio,
              fechaFin,
            })
          : [];
      if (conflictosEspacios.length > 0) {
        throw new ConflictException({
          message: conflictosEspacios[0].mensaje,
          conflictos: conflictosEspacios,
        });
      }

      const aprobadaEn = new Date();
      await tx.ferias.update({
        where: { id: feriaId },
        data: {
          estado: 'aprobada',
          revisor_id: gestorId,
          aprobada_en: aprobadaEn,
          motivo_cancelacion: null,
        },
      });

      if (espacios.length > 0) {
        await tx.$executeRaw`
          INSERT INTO espacio_bloqueos (
            espacio_id,
            fecha_inicio,
            fecha_fin,
            motivo,
            creado_por,
            feria_id
          )
          SELECT
            e.id,
            ${fechaInicio}::date,
            ${fechaFin}::date,
            left(
              'Feria ' || ${feria.numero_radicado} || ' — ' || ${feria.nombre},
              300
            ),
            ${gestorId},
            ${feriaId}
          FROM espacios_temporales e
          WHERE e.id IN (${Prisma.join(espacios.map((espacio) => espacio.id))})
        `;
      }

      await this.notificaciones.crearAvisoFeria(tx, {
        usuarioId: aBigInt(feria.organizador_id),
        feriaId,
        tipo: 'feria_aprobada',
        asunto: `Feria ${feria.numero_radicado}: aprobada`.slice(0, 200),
        cuerpo:
          `Tu feria «${feria.nombre}» fue aprobada para ${feria.zona_nombre} ` +
          `del ${fechaInicio} al ${fechaFin}. Los espacios de la zona quedaron ` +
          'reservados para la feria.',
      });

      return {
        feria,
        fechaInicio,
        fechaFin,
        aprobadaEn,
        espacios,
      };
    });

    const correo = await this.notificaciones.enviarCorreoFeria(
      {
        correo: resultado.feria.correo,
        nombre: resultado.feria.nombre_organizador,
      },
      {
        feriaId: feriaId.toString(),
        numeroRadicado: resultado.feria.numero_radicado,
        nombreFeria: resultado.feria.nombre,
        zona: resultado.feria.zona_nombre,
        fechaInicio: resultado.fechaInicio,
        fechaFin: resultado.fechaFin,
        accion: 'aprobada',
        motivo: null,
      },
    );

    return {
      id: feriaId.toString(),
      numeroRadicado: resultado.feria.numero_radicado,
      estadoAnterior: 'radicada',
      estado: 'aprobada',
      aprobadaEn: resultado.aprobadaEn,
      espaciosBloqueados: resultado.espacios.map((espacio) => ({
        id: espacio.id.toString(),
        nombre: espacio.nombre,
      })),
      correoEnviado: correo.correoEnviado,
      mensajeCorreo: correo.mensajeCorreo,
      mensaje: 'Feria aprobada y espacios bloqueados.',
    };
  }

  /** Cancela una feria y libera los bloqueos que había creado. */
  async cancelar(
    usuario: UsuarioAutenticado,
    id: string,
    motivo: string,
  ): Promise<CancelarFeriaResponseDto> {
    const feriaId = parseIdBigint(id);
    const gestorId = parseIdBigint(usuario.id);
    const errorMotivo = validarMotivoCancelacion(motivo);
    if (errorMotivo) {
      throw new BadRequestException(errorMotivo);
    }
    const motivoLimpio = motivo.trim();

    const resultado = await this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, gestorId);
      const feria = await this.bloquearFeria(tx, feriaId);

      if (!puedeCancelarFeria(feria.estado)) {
        throw new ConflictException(
          `La feria está en estado «${feria.estado}» y no se puede cancelar.`,
        );
      }

      const canceladaEn = new Date();
      await tx.ferias.update({
        where: { id: feriaId },
        data: {
          estado: 'cancelada',
          motivo_cancelacion: motivoLimpio,
          cancelada_en: canceladaEn,
          cancelada_por: gestorId,
        },
      });

      const liberados = await tx.$executeRaw`
        DELETE FROM espacio_bloqueos WHERE feria_id = ${feriaId}
      `;

      await this.notificaciones.crearAvisoFeria(tx, {
        usuarioId: aBigInt(feria.organizador_id),
        feriaId,
        tipo: 'feria_cancelada',
        asunto: `Feria ${feria.numero_radicado}: cancelada`.slice(0, 200),
        cuerpo:
          `Tu feria «${feria.nombre}» en ${feria.zona_nombre} fue cancelada. ` +
          `Motivo: ${motivoLimpio}`,
      });

      return {
        feria,
        canceladaEn,
        liberados,
      };
    });

    const correo = await this.notificaciones.enviarCorreoFeria(
      {
        correo: resultado.feria.correo,
        nombre: resultado.feria.nombre_organizador,
      },
      {
        feriaId: feriaId.toString(),
        numeroRadicado: resultado.feria.numero_radicado,
        nombreFeria: resultado.feria.nombre,
        zona: resultado.feria.zona_nombre,
        fechaInicio: this.aFechaISO(resultado.feria.fecha_inicio),
        fechaFin: this.aFechaISO(resultado.feria.fecha_fin),
        accion: 'cancelada',
        motivo: motivoLimpio,
      },
    );

    return {
      id: feriaId.toString(),
      numeroRadicado: resultado.feria.numero_radicado,
      estadoAnterior: resultado.feria.estado,
      estado: 'cancelada',
      motivoCancelacion: motivoLimpio,
      canceladaEn: resultado.canceladaEn,
      espaciosLiberados: resultado.liberados,
      correoEnviado: correo.correoEnviado,
      mensajeCorreo: correo.mensajeCorreo,
      mensaje: 'Feria cancelada y espacios liberados.',
    };
  }

  /** Mueve una feria de zona o de fechas y reubica sus bloqueos. */
  async mover(
    usuario: UsuarioAutenticado,
    id: string,
    dto: MoverFeriaDto,
  ): Promise<MoverFeriaResponseDto> {
    const feriaId = parseIdBigint(id);
    const gestorId = parseIdBigint(usuario.id);
    const zonaDestinoId = parseIdBigint(dto.zonaId);
    const erroresFechas = validarFechasFeria(
      dto.fechaInicio,
      dto.fechaFin,
    );
    if (erroresFechas.length > 0) {
      throw new BadRequestException(erroresFechas);
    }
    const motivo = dto.motivo?.trim() || null;

    const resultado = await this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, gestorId);
      const feria = await this.bloquearFeria(tx, feriaId);

      if (!puedeMoverFeria(feria.estado)) {
        throw new ConflictException(
          `La feria está en estado «${feria.estado}» y no se puede mover.`,
        );
      }

      const zona = await this.obtenerZona(zonaDestinoId);
      if (!zona.activa) {
        throw new ConflictException(
          'La zona de destino no está activa. Elige otra zona.',
        );
      }
      const errorAforo = validarPuestosContraAforo(
        feria.numero_puestos,
        zona.aforoMaximo,
      );
      if (errorAforo) {
        throw new BadRequestException(errorAforo);
      }

      await this.bloquearZona(tx, zonaDestinoId);
      const conflictosFeria = await this.consultarConflictosFeria(
        tx,
        zonaDestinoId,
        dto.fechaInicio,
        dto.fechaFin,
        feriaId,
      );
      if (conflictosFeria.length > 0) {
        throw new ConflictException({
          message: conflictosFeria[0].mensaje,
          conflictos: conflictosFeria,
        });
      }

      const estabaAprobada = feria.estado === 'aprobada';
      let espacios: { id: bigint; nombre: string }[] = [];
      if (estabaAprobada) {
        espacios = await this.bloquearEspacios(tx, zonaDestinoId);
        const conflictosEspacios =
          espacios.length > 0
            ? await this.consultarConflictosEspacios(tx, {
                feriaId,
                zonaId: zonaDestinoId,
                fechaInicio: dto.fechaInicio,
                fechaFin: dto.fechaFin,
              })
            : [];
        if (conflictosEspacios.length > 0) {
          throw new ConflictException({
            message: conflictosEspacios[0].mensaje,
            conflictos: conflictosEspacios,
          });
        }
      }

      const fechaInicioAnterior = this.aFechaISO(feria.fecha_inicio);
      const fechaFinAnterior = this.aFechaISO(feria.fecha_fin);
      const zonaAnteriorId = aBigInt(feria.zona_id);
      const zonaAnteriorNombre = feria.zona_nombre;

      await tx.ferias.update({
        where: { id: feriaId },
        data: {
          zona_id: zonaDestinoId,
          fecha_inicio: new Date(`${dto.fechaInicio}T00:00:00.000Z`),
          fecha_fin: new Date(`${dto.fechaFin}T00:00:00.000Z`),
        },
      });

      if (estabaAprobada) {
        await tx.$executeRaw`
          DELETE FROM espacio_bloqueos WHERE feria_id = ${feriaId}
        `;
        if (espacios.length > 0) {
          await tx.$executeRaw`
            INSERT INTO espacio_bloqueos (
              espacio_id,
              fecha_inicio,
              fecha_fin,
              motivo,
              creado_por,
              feria_id
            )
            SELECT
              e.id,
              ${dto.fechaInicio}::date,
              ${dto.fechaFin}::date,
              left(
                'Feria ' || ${feria.numero_radicado} || ' — ' || ${feria.nombre},
                300
              ),
              ${gestorId},
              ${feriaId}
            FROM espacios_temporales e
            WHERE e.id IN (${Prisma.join(
              espacios.map((espacio) => espacio.id),
            )})
          `;
        }
      }

      await this.notificaciones.crearAvisoFeria(tx, {
        usuarioId: aBigInt(feria.organizador_id),
        feriaId,
        tipo: 'feria_movida',
        asunto: `Feria ${feria.numero_radicado}: cambio de fechas`.slice(
          0,
          200,
        ),
        cuerpo:
          `Tu feria «${feria.nombre}» cambió de ${fechaInicioAnterior}–` +
          `${fechaFinAnterior} en ${zonaAnteriorNombre} a ` +
          `${dto.fechaInicio}–${dto.fechaFin} en ${zona.nombre}.` +
          (motivo ? ` Motivo: ${motivo}` : ''),
      });

      return {
        feria,
        fechaInicioAnterior,
        fechaFinAnterior,
        zonaAnteriorId,
        zonaAnteriorNombre,
        zona,
        espacios,
      };
    });

    const correo = await this.notificaciones.enviarCorreoFeria(
      {
        correo: resultado.feria.correo,
        nombre: resultado.feria.nombre_organizador,
      },
      {
        feriaId: feriaId.toString(),
        numeroRadicado: resultado.feria.numero_radicado,
        nombreFeria: resultado.feria.nombre,
        zona: resultado.zona.nombre,
        fechaInicio: dto.fechaInicio,
        fechaFin: dto.fechaFin,
        accion: 'movida',
        motivo,
        fechaInicioAnterior: resultado.fechaInicioAnterior,
        fechaFinAnterior: resultado.fechaFinAnterior,
        zonaAnterior: resultado.zonaAnteriorNombre,
      },
    );

    return {
      id: feriaId.toString(),
      numeroRadicado: resultado.feria.numero_radicado,
      estado: resultado.feria.estado,
      fechaInicioAnterior: resultado.fechaInicioAnterior,
      fechaFinAnterior: resultado.fechaFinAnterior,
      zonaAnteriorId: resultado.zonaAnteriorId.toString(),
      zonaAnteriorNombre: resultado.zonaAnteriorNombre,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      zona: resultado.zona,
      espaciosBloqueados: resultado.espacios.map((espacio) => ({
        id: espacio.id.toString(),
        nombre: espacio.nombre,
      })),
      correoEnviado: correo.correoEnviado,
      mensajeCorreo: correo.mensajeCorreo,
      mensaje: 'Feria movida correctamente.',
    };
  }

  /** Consulta las ferias con filtros administrativos. */
  private consultarEventos(
    opciones: OpcionesEventos,
    cliente: Prisma.TransactionClient | PrismaService,
  ): Promise<FilaEvento[]> {
    const where = this.construirWhere(opciones);
    const paginacion = opciones.limite
      ? Prisma.sql`
          LIMIT ${opciones.limite}
          OFFSET ${((opciones.pagina ?? 1) - 1) * opciones.limite}
        `
      : Prisma.empty;

    return cliente.$queryRaw<FilaEvento[]>(Prisma.sql`
      SELECT ${CAMPOS_EVENTO}
      ${JOINS_EVENTO}
      ${where}
      ORDER BY f.fecha_inicio ASC, f.id ASC
      ${paginacion}
    `);
  }

  /** Cuenta las ferias con los mismos filtros del listado. */
  private async contarEventos(
    opciones: OpcionesEventos,
    cliente: Prisma.TransactionClient | PrismaService,
  ): Promise<number> {
    const where = this.construirWhere(opciones);
    const filas = await cliente.$queryRaw<Array<{ total: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      ${JOINS_EVENTO}
      ${where}
    `);
    return filas[0]?.total ?? 0;
  }

  /** Construye el WHERE compartido por listado, conteo y agenda. */
  private construirWhere(opciones: OpcionesEventos): Prisma.Sql {
    const condiciones: Prisma.Sql[] = [];
    if (opciones.id) condiciones.push(Prisma.sql`f.id = ${opciones.id}`);
    if (opciones.estado) {
      condiciones.push(Prisma.sql`f.estado = ${opciones.estado}`);
    }
    if (opciones.estados && opciones.estados.length > 0) {
      condiciones.push(
        Prisma.sql`f.estado IN (${Prisma.join(opciones.estados)})`,
      );
    }
    if (opciones.zonaId) {
      condiciones.push(Prisma.sql`f.zona_id = ${opciones.zonaId}`);
    }
    if (opciones.desde && opciones.hasta) {
      condiciones.push(
        Prisma.sql`daterange(f.fecha_inicio, f.fecha_fin, '[]')
          && daterange(${opciones.desde}::date, ${opciones.hasta}::date, '[]')`,
      );
    } else if (opciones.desde) {
      condiciones.push(Prisma.sql`f.fecha_fin >= ${opciones.desde}::date`);
    } else if (opciones.hasta) {
      condiciones.push(Prisma.sql`f.fecha_inicio <= ${opciones.hasta}::date`);
    }
    if (opciones.busqueda) {
      const patron = `%${opciones.busqueda}%`;
      condiciones.push(
        Prisma.sql`(
          f.nombre ILIKE ${patron}
          OR f.numero_radicado ILIKE ${patron}
          OR o.nombre_organizacion ILIKE ${patron}
        )`,
      );
    }

    return condiciones.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(condiciones, ' AND ')}`
      : Prisma.empty;
  }

  /** Ferias activas que se cruzan con el rango solicitado. */
  private async consultarConflictosFeria(
    cliente: Prisma.TransactionClient | PrismaService,
    zonaId: bigint,
    fechaInicio: string,
    fechaFin: string,
    excluirFeriaId?: bigint,
  ): Promise<ConflictoAgendaFeriaDto[]> {
    const exclusion = excluirFeriaId
      ? Prisma.sql`AND f.id <> ${excluirFeriaId}`
      : Prisma.empty;
    const filas = await cliente.$queryRaw<FilaConflicto[]>(Prisma.sql`
      SELECT
        'feria'::text AS tipo,
        f.id AS feria_id,
        f.nombre AS feria_nombre,
        NULL::bigint AS espacio_id,
        NULL::text AS espacio_nombre,
        f.numero_radicado AS referencia,
        f.fecha_inicio,
        f.fecha_fin,
        NULL::text AS detalle
      FROM ferias f
      WHERE f.zona_id = ${zonaId}
        AND f.estado IN (${Prisma.join(ESTADOS_FERIA_ACTIVA)})
        AND daterange(f.fecha_inicio, f.fecha_fin, '[]')
            && daterange(${fechaInicio}::date, ${fechaFin}::date, '[]')
        ${exclusion}
      ORDER BY f.fecha_inicio ASC
    `);

    return filas.map((fila) => ({
      tipo: 'feria',
      feriaId: fila.feria_id?.toString() ?? null,
      feriaNombre: fila.feria_nombre,
      espacioId: null,
      espacioNombre: null,
      referencia: fila.referencia,
      fechaInicio: this.aFechaISO(fila.fecha_inicio),
      fechaFin: this.aFechaISO(fila.fecha_fin),
      mensaje:
        `La zona ya está ocupada por la feria «${fila.feria_nombre ?? 'sin nombre'}» ` +
        `(${fila.referencia ?? 'sin radicado'}) del ` +
        `${this.aFechaISO(fila.fecha_inicio)} al ${this.aFechaISO(fila.fecha_fin)}.`,
    }));
  }

  /** Conflictos de los espacios de la zona con el rango de la feria. */
  private async consultarConflictosEspacios(
    cliente: Prisma.TransactionClient | PrismaService,
    datos: {
      feriaId: bigint;
      zonaId: bigint;
      fechaInicio: string;
      fechaFin: string;
    },
  ): Promise<ConflictoAgendaFeriaDto[]> {
    const filas = await cliente.$queryRaw<FilaConflicto[]>(Prisma.sql`
      SELECT
        'bloqueo'::text AS tipo,
        b.feria_id,
        f2.nombre AS feria_nombre,
        e.id AS espacio_id,
        e.nombre AS espacio_nombre,
        COALESCE(f2.numero_radicado, b.motivo) AS referencia,
        b.fecha_inicio,
        b.fecha_fin,
        b.motivo AS detalle
      FROM espacio_bloqueos b
      JOIN espacios_temporales e ON e.id = b.espacio_id
      LEFT JOIN ferias f2 ON f2.id = b.feria_id
      WHERE e.zona_id = ${datos.zonaId}
        AND b.feria_id IS DISTINCT FROM ${datos.feriaId}
        AND daterange(b.fecha_inicio, b.fecha_fin, '[]')
            && daterange(${datos.fechaInicio}::date, ${datos.fechaFin}::date, '[]')

      UNION ALL

      SELECT
        'permiso'::text AS tipo,
        NULL::bigint AS feria_id,
        NULL::text AS feria_nombre,
        e.id AS espacio_id,
        e.nombre AS espacio_nombre,
        p.numero AS referencia,
        p.fecha_inicio,
        p.fecha_fin,
        NULL::text AS detalle
      FROM permisos p
      JOIN espacios_temporales e ON e.id = p.espacio_id
      WHERE e.zona_id = ${datos.zonaId}
        AND p.estado = 'vigente'
        AND daterange(p.fecha_inicio, p.fecha_fin, '[]')
            && daterange(${datos.fechaInicio}::date, ${datos.fechaFin}::date, '[]')

      UNION ALL

      SELECT
        'solicitud'::text AS tipo,
        NULL::bigint AS feria_id,
        NULL::text AS feria_nombre,
        e.id AS espacio_id,
        e.nombre AS espacio_nombre,
        s.numero_radicado AS referencia,
        s.fecha_inicio,
        s.fecha_fin,
        NULL::text AS detalle
      FROM solicitudes s
      JOIN espacios_temporales e ON e.id = s.espacio_id
      WHERE e.zona_id = ${datos.zonaId}
        AND s.estado = 'aprobada'
        AND daterange(s.fecha_inicio, s.fecha_fin, '[]')
            && daterange(${datos.fechaInicio}::date, ${datos.fechaFin}::date, '[]')

      UNION ALL

      SELECT
        'espacio'::text AS tipo,
        NULL::bigint AS feria_id,
        NULL::text AS feria_nombre,
        e.id AS espacio_id,
        e.nombre AS espacio_nombre,
        'Asignación manual'::text AS referencia,
        ${datos.fechaInicio}::date AS fecha_inicio,
        ${datos.fechaFin}::date AS fecha_fin,
        'El espacio tiene una asignación manual activa.'::text AS detalle
      FROM espacios_temporales e
      WHERE e.zona_id = ${datos.zonaId}
        AND e.asignacion_manual = true

      ORDER BY fecha_inicio ASC, espacio_nombre ASC
    `);

    return filas.map((fila) => ({
      tipo: fila.tipo,
      feriaId: fila.feria_id?.toString() ?? null,
      feriaNombre: fila.feria_nombre,
      espacioId: fila.espacio_id?.toString() ?? null,
      espacioNombre: fila.espacio_nombre,
      referencia: fila.referencia,
      fechaInicio: this.aFechaISO(fila.fecha_inicio),
      fechaFin: this.aFechaISO(fila.fecha_fin),
      mensaje: this.mensajeConflictoEspacio(fila),
    }));
  }

  private mensajeConflictoEspacio(fila: FilaConflicto): string {
    const espacio = fila.espacio_nombre ?? 'un espacio de la zona';
    const rango = `${this.aFechaISO(fila.fecha_inicio)} al ${this.aFechaISO(
      fila.fecha_fin,
    )}`;

    if (fila.tipo === 'bloqueo') {
      if (fila.feria_nombre) {
        return `El espacio «${espacio}» ya está bloqueado por la feria «${fila.feria_nombre}» (${rango}).`;
      }
      return `El espacio «${espacio}» tiene un bloqueo (${rango}).`;
    }
    if (fila.tipo === 'permiso') {
      return `El espacio «${espacio}» tiene el permiso ${fila.referencia ?? ''} vigente (${rango}).`;
    }
    if (fila.tipo === 'solicitud') {
      return `El espacio «${espacio}» está asignado a la solicitud ${fila.referencia ?? ''} (${rango}).`;
    }
    return `El espacio «${espacio}» tiene una asignación manual activa.`;
  }

  /** Sugerencias de fechas libres usando todos los conflictos detectados. */
  private sugerirFechas(
    fechaInicio: string,
    fechaFin: string,
    conflictos: ConflictoAgendaFeriaDto[],
  ): { fechaInicio: string; fechaFin: string }[] {
    return sugerirFechasLibres(
      { fechaInicio, fechaFin },
      conflictos.map((conflicto) => ({
        fechaInicio: conflicto.fechaInicio,
        fechaFin: conflicto.fechaFin,
      })),
    ).map((sugerencia) => ({
      fechaInicio: sugerencia.fechaInicio,
      fechaFin: sugerencia.fechaFin,
    }));
  }

  /** Bloquea la fila de una feria y devuelve los datos para decidir. */
  private async bloquearFeria(
    tx: Prisma.TransactionClient,
    feriaId: bigint,
  ): Promise<FilaFeriaBloqueada> {
    const filas = await tx.$queryRaw<FilaFeriaBloqueada[]>`
      SELECT
        f.id,
        f.numero_radicado,
        f.nombre,
        f.estado,
        f.organizador_id,
        f.zona_id,
        z.nombre AS zona_nombre,
        f.fecha_inicio,
        f.fecha_fin,
        f.numero_puestos,
        u.correo,
        u.nombre AS nombre_organizador
      FROM ferias f
      JOIN zonas z ON z.id = f.zona_id
      JOIN organizadores o ON o.usuario_id = f.organizador_id
      JOIN usuarios u ON u.id = o.usuario_id
      WHERE f.id = ${feriaId}
      FOR UPDATE OF f
    `;
    const fila = filas[0];
    if (!fila) {
      throw new NotFoundException('La feria no existe');
    }
    return fila;
  }

  /** Obtiene la feria para una vista previa o un detalle. */
  private async obtenerFeria(feriaId: bigint): Promise<FilaEvento> {
    const filas = await this.consultarEventos({ id: feriaId }, this.prisma);
    const fila = filas[0];
    if (!fila) {
      throw new NotFoundException('La feria no existe');
    }
    return fila;
  }

  /** Bloquea la fila de la zona para serializar ferias concurrentes. */
  private async bloquearZona(
    tx: Prisma.TransactionClient,
    zonaId: bigint,
  ): Promise<void> {
    await tx.$queryRaw`SELECT id FROM zonas WHERE id = ${zonaId} FOR UPDATE`;
  }

  /** Bloquea y devuelve todos los espacios de una zona en orden de id. */
  private async bloquearEspacios(
    tx: Prisma.TransactionClient,
    zonaId: bigint,
  ): Promise<{ id: bigint; nombre: string }[]> {
    return tx.$queryRaw<{ id: bigint; nombre: string }[]>`
      SELECT id, nombre
        FROM espacios_temporales
       WHERE zona_id = ${zonaId}
       ORDER BY id ASC
       FOR UPDATE
    `;
  }

  private async obtenerZona(zonaId: bigint): Promise<ZonaFeriaGestorDto> {
    const filas = await this.prisma.$queryRaw<FilaZona[]>`
      SELECT
        z.id,
        z.nombre,
        z.tipo,
        z.activa,
        z.aforo_maximo,
        to_char(z.horario_inicio, 'HH24:MI') AS horario_inicio,
        to_char(z.horario_fin, 'HH24:MI') AS horario_fin
      FROM zonas z
      WHERE z.id = ${zonaId}
    `;
    const zona = filas[0];
    if (!zona) {
      throw new NotFoundException('La zona solicitada no existe');
    }

    return {
      id: zona.id.toString(),
      nombre: zona.nombre,
      tipo: zona.tipo,
      activa: zona.activa,
      aforoMaximo: zona.aforo_maximo,
      horarioInicio: zona.horario_inicio,
      horarioFin: zona.horario_fin,
    };
  }

  private async consultarZonas(): Promise<ZonaFeriaGestorDto[]> {
    const filas = await this.prisma.$queryRaw<FilaZona[]>`
      SELECT
        z.id,
        z.nombre,
        z.tipo,
        z.activa,
        z.aforo_maximo,
        to_char(z.horario_inicio, 'HH24:MI') AS horario_inicio,
        to_char(z.horario_fin, 'HH24:MI') AS horario_fin
      FROM zonas z
      WHERE z.activa = true
      ORDER BY z.nombre ASC
    `;

    return filas.map((zona) => ({
      id: zona.id.toString(),
      nombre: zona.nombre,
      tipo: zona.tipo,
      activa: zona.activa,
      aforoMaximo: zona.aforo_maximo,
      horarioInicio: zona.horario_inicio,
      horarioFin: zona.horario_fin,
    }));
  }

  private aEvento(fila: FilaEvento): EventoAgendaFeriaDto {
    return {
      id: fila.id.toString(),
      numeroRadicado: fila.numero_radicado,
      nombre: fila.nombre,
      tipoFeria: fila.tipo_feria,
      estado: fila.estado,
      fechaInicio: this.aFechaISO(fila.fecha_inicio),
      fechaFin: this.aFechaISO(fila.fecha_fin),
      numeroPuestos: fila.numero_puestos,
      zona: {
        id: fila.zona_id.toString(),
        nombre: fila.zona_nombre,
        tipo: fila.zona_tipo,
        activa: fila.zona_activa,
        aforoMaximo: fila.zona_aforo_maximo,
        horarioInicio: fila.zona_horario_inicio,
        horarioFin: fila.zona_horario_fin,
      },
      organizador: {
        id: fila.organizador_id.toString(),
        nombre: fila.organizador_nombre,
        apellido: fila.organizador_apellido,
        correo: fila.organizador_correo,
        organizacion: fila.organizacion,
        nit: fila.nit,
      },
      tieneCruces: false,
      motivoCancelacion: fila.motivo_cancelacion,
      aprobadaEn: fila.aprobada_en,
      canceladaEn: fila.cancelada_en,
    };
  }

  private aListado(fila: FilaEvento): FeriaGestorListadoDto {
    return Object.assign({}, this.aEvento(fila), {
      radicadaEn: fila.radicada_en,
      actualizadoEn: fila.actualizado_en,
    });
  }

  private resumen(eventos: EventoAgendaFeriaDto[]) {
    return {
      total: eventos.length,
      radicadas: eventos.filter((evento) => evento.estado === 'radicada')
        .length,
      aprobadas: eventos.filter((evento) => evento.estado === 'aprobada')
        .length,
      canceladas: eventos.filter((evento) => evento.estado === 'cancelada')
        .length,
      rechazadas: eventos.filter((evento) => evento.estado === 'rechazada')
        .length,
      realizadas: eventos.filter((evento) => evento.estado === 'realizada')
        .length,
    };
  }

  private aFechaISO(valor: string | Date): string {
    if (valor instanceof Date) return valor.toISOString().slice(0, 10);
    return String(valor).slice(0, 10);
  }
}

function aBigInt(valor: bigint | string): bigint {
  return typeof valor === 'bigint' ? valor : BigInt(valor);
}
