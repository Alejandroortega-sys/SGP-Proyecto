import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { access } from 'node:fs/promises';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { fijarActorAuditoria } from '../common/auditoria';
import {
  ESTADOS_CAMBIO_GESTOR,
  esEstadoFinalSolicitud,
  etiquetaEstadoSolicitud,
  puedeCambiarEstadoSolicitud,
} from '../common/estados-solicitud';
import { parseIdBigint } from '../common/parse-id';
import { CorreoService } from '../correo/correo.service';
import {
  Prisma,
  type estado_espacio,
  type estado_solicitud,
  type tipo_espacio,
} from '../generated/prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CambiarEstadoSolicitudDto,
  CambiarEstadoSolicitudResponseDto,
} from './dto/estado-solicitud.dto';
import {
  agruparVersionesDocumento,
  eliminarDocumentoSolicitud,
  estadoRequisitoDocumental,
  guardarDocumentoSolicitud,
  limiteBytesDocumento,
  maxDocumentos,
  mimePorRuta,
  nombreArchivoSeguro,
  puedeCargarDocumentos,
  resolverRutaDocumento,
  validarDocumento,
  type ArchivoDocumento,
  type DocumentoValidado,
} from './documentos';
import {
  CargarDocumentoSolicitudFormDto,
  ConsultarDisponibilidadQueryDto,
  DocumentoMetaDto,
  DocumentoSolicitudDto,
  DocumentoVersionSolicitudDto,
  ESTADOS_DUPLICADO,
  ListarMisSolicitudesQueryDto,
  ListarSolicitudesResponseDto,
  RadicarSolicitudDatosDto,
  RadicarSolicitudFormDto,
  RadicarSolicitudResponseDto,
  RequisitoDocumentalDto,
  RequisitoEstadoSolicitudDto,
  RequisitosSolicitudDetalleResponseDto,
  RequisitosSolicitudQueryDto,
  RequisitosSolicitudResponseDto,
  RespuestaCargaDocumentoSolicitudDto,
  DisponibilidadSolicitudDto,
  SolicitudListadoDto,
  SolicitudTemporalDetalleDto,
} from './dto/solicitudes.dto';
import {
  documentosFaltantes,
  formatearRangoFechas,
  validarFechasRadicacion,
  validarHorarioPermitido,
  validarHorasRadicacion,
} from './reglas';

interface FilaEspacioSolicitud {
  id: bigint | string;
  nombre: string;
  estado: estado_espacio;
  sector: string | null;
  tipo: tipo_espacio;
  actividad_permitida: string | null;
  horario_inicio: string | null;
  horario_fin: string | null;
  zona_id: bigint | string | null;
  zona_nombre: string | null;
  zona_activa: boolean | null;
  zona_horario_inicio: string | null;
  zona_horario_fin: string | null;
  zona_productos: string[] | null;
}

interface FilaBloqueo {
  fecha_inicio: string | Date;
  fecha_fin: string | Date;
  motivo: string | null;
}

interface FilaPermiso {
  numero: string;
  fecha_inicio: string | Date;
  fecha_fin: string | Date;
}

interface FilaSolicitudAprobada {
  numero_radicado: string;
  fecha_inicio: string | Date;
  fecha_fin: string | Date;
}

interface FilaDuplicado {
  id: bigint | string;
  numero_radicado: string;
}

interface FilaInsercion {
  id: bigint;
  numero_radicado: string;
}

interface EvaluacionDisponibilidad {
  espacio: FilaEspacioSolicitud;
  disponible: boolean;
  motivo: string | null;
}

interface DocumentoParaGuardar {
  meta: DocumentoMetaDto;
  requisito: RequisitoDocumentalDto;
  archivo: ArchivoDocumento;
  validado: DocumentoValidado;
}

const SELECT_SOLICITUD = {
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
    select: {
      productos: { select: { id: true, nombre: true } },
    },
  },
  solicitud_documentos: {
    orderBy: { cargado_en: 'asc' },
    select: {
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
    },
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

type FilaSolicitud = Prisma.solicitudesGetPayload<{
  select: typeof SELECT_SOLICITUD;
}>;

const SELECT_DOCUMENTO_VERSION = {
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
} satisfies Prisma.solicitud_documentosSelect;

type FilaDocumentoVersion = Prisma.solicitud_documentosGetPayload<{
  select: typeof SELECT_DOCUMENTO_VERSION;
}>;

interface FilaSolicitudDocumentos {
  id: bigint;
  numero_radicado: string;
  estado: estado_solicitud;
  espacios_temporales: {
    nombre: string;
    actividad_permitida: string | null;
  } | null;
}

/** Fila bloqueada para cambiar el estado de una solicitud. */
interface FilaEstadoSolicitud {
  id: bigint | string;
  numero_radicado: string;
  estado: estado_solicitud;
  comerciante_id: bigint | string;
  correo: string;
  nombre: string;
  espacio_nombre: string | null;
  bloqueo_gestor_id: bigint | string | null;
}

/**
 * Radicación de solicitudes de uso temporal del espacio público (HU-16).
 *
 * El borrador vive solo en el navegador: al radicar se crea una fila completa
 * en estado `radicada`. La operación valida fechas, horario, disponibilidad,
 * duplicados, productos y documentos antes de escribir en la base.
 */
@Injectable()
export class SolicitudesService {
  private readonly logger = new Logger(SolicitudesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /** Lista las solicitudes radicadas del comerciante autenticado. */
  async listarMias(
    idUsuario: string,
    dto: ListarMisSolicitudesQueryDto,
  ): Promise<ListarSolicitudesResponseDto> {
    const usuarioId = parseIdBigint(idUsuario);
    const pagina = dto.pagina ?? 1;
    const limite = dto.limite ?? 20;

    if (dto.estado === 'borrador') {
      return {
        datos: [],
        paginacion: { pagina, limite, total: 0, totalPaginas: 0 },
      };
    }

    const where: Prisma.solicitudesWhereInput = {
      comerciante_id: usuarioId,
      estado: dto.estado ?? { not: 'borrador' },
    };

    const [filas, total] = await Promise.all([
      this.prisma.solicitudes.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: [{ radicada_en: 'desc' }, { creado_en: 'desc' }],
        select: SELECT_SOLICITUD,
      }),
      this.prisma.solicitudes.count({ where }),
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

  /** Devuelve el detalle de una solicitud propia ya radicada. */
  async detalle(
    idUsuario: string,
    idSolicitud: string,
  ): Promise<SolicitudTemporalDetalleDto> {
    const usuarioId = parseIdBigint(idUsuario);
    const id = parseIdBigint(idSolicitud);

    const fila = await this.prisma.solicitudes.findFirst({
      where: {
        id,
        comerciante_id: usuarioId,
        estado: { not: 'borrador' },
      },
      select: SELECT_SOLICITUD,
    });

    if (!fila) {
      throw new NotFoundException('La solicitud no existe o no te pertenece');
    }

    return this.aDetalle(fila);
  }

  /**
   * Cambia el estado de una solicitud desde el panel del gestor (HU-18).
   *
   * Solo cubre el inicio de la revisión y la devolución para corrección. La
   * aprobación y el rechazo se resuelven en `ResolucionSolicitudesService`
   * porque asignan el espacio en la misma transacción (HU-20).
   */
  async cambiarEstado(
    usuario: UsuarioAutenticado,
    idSolicitud: string,
    dto: CambiarEstadoSolicitudDto,
  ): Promise<CambiarEstadoSolicitudResponseDto> {
    const solicitudId = parseIdBigint(idSolicitud);
    const gestorId = parseIdBigint(usuario.id);
    const observacion = dto.observacion?.trim() || null;

    if (!ESTADOS_CAMBIO_GESTOR.includes(dto.estado)) {
      throw new BadRequestException(
        'La aprobación y el rechazo se realizan con el endpoint de resolución.',
      );
    }

    if (dto.estado === 'devuelta' && !observacion) {
      throw new BadRequestException(
        'Para devolver la solicitud debes escribir una observación.',
      );
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, gestorId);

      const filas = await tx.$queryRaw<FilaEstadoSolicitud[]>`
        SELECT
          s.id,
          s.numero_radicado,
          s.estado,
          s.comerciante_id,
          u.correo,
          u.nombre,
          e.nombre AS espacio_nombre,
          (
            SELECT r.gestor_id
              FROM solicitud_revisiones r
             WHERE r.solicitud_id = s.id
               AND r.expira_en > now()
          ) AS bloqueo_gestor_id
        FROM solicitudes s
        JOIN usuarios u ON u.id = s.comerciante_id
        LEFT JOIN espacios_temporales e ON e.id = s.espacio_id
        WHERE s.id = ${solicitudId}
        FOR UPDATE OF s
      `;
      const actual = filas[0];
      if (!actual) {
        throw new NotFoundException('La solicitud no existe');
      }

      if (
        actual.bloqueo_gestor_id !== null &&
        actual.bloqueo_gestor_id !== undefined &&
        BigInt(actual.bloqueo_gestor_id.toString()) !== gestorId
      ) {
        throw new ConflictException(
          'Otro gestor está revisando esta solicitud. No puedes cambiar su estado mientras el bloqueo esté vigente.',
        );
      }

      if (!puedeCambiarEstadoSolicitud(actual.estado, dto.estado)) {
        const motivo = esEstadoFinalSolicitud(actual.estado)
          ? `La solicitud está en estado «${etiquetaEstadoSolicitud(actual.estado)}» y ya no admite cambios.`
          : `No se puede pasar de «${etiquetaEstadoSolicitud(actual.estado)}» a «${etiquetaEstadoSolicitud(dto.estado)}».`;
        throw new ConflictException(motivo);
      }

      const observacionHistorial =
        observacion ?? this.observacionPorDefectoEstado(dto.estado);

      const actualizada = await tx.solicitudes.update({
        where: { id: solicitudId },
        data: {
          estado: dto.estado,
          revisor_id: gestorId,
        },
        select: {
          id: true,
          numero_radicado: true,
          estado: true,
          motivo_rechazo: true,
          decidida_en: true,
          actualizado_en: true,
        },
      });

      await tx.solicitud_historial.create({
        data: {
          solicitud_id: solicitudId,
          estado_anterior: actual.estado,
          estado_nuevo: dto.estado,
          actor_id: gestorId,
          observacion: observacionHistorial,
        },
      });

      // Al devolver la solicitud el bloqueo del gestor deja de tener sentido.
      // Si la transición es a en_revision se conserva, porque puede venir de un
      // gestor que ya tomó la revisión.
      if (dto.estado !== 'en_revision') {
        await tx.$executeRaw`
          DELETE FROM solicitud_revisiones WHERE solicitud_id = ${solicitudId}
        `;
      }

      const comercianteId = BigInt(actual.comerciante_id.toString());

      await this.notificaciones.crearCambioEstadoSolicitud(tx, {
        solicitudId,
        numeroRadicado: actual.numero_radicado,
        usuarioId: comercianteId,
        estadoAnterior: actual.estado,
        estadoNuevo: dto.estado,
        espacio: actual.espacio_nombre,
        observacion,
      });

      return {
        actual: { ...actual, comerciante_id: comercianteId },
        actualizada,
        observacionHistorial,
        estadoAnterior: actual.estado,
      };
    });

    const correo = await this.notificaciones.enviarCorreoCambioEstadoSolicitud(
      {
        correo: resultado.actual.correo,
        nombre: resultado.actual.nombre,
      },
      {
        solicitudId,
        numeroRadicado: resultado.actual.numero_radicado,
        usuarioId: resultado.actual.comerciante_id,
        estadoAnterior: resultado.estadoAnterior,
        estadoNuevo: dto.estado,
        espacio: resultado.actual.espacio_nombre,
        observacion,
      },
    );

    return {
      id: resultado.actualizada.id.toString(),
      numeroRadicado: resultado.actualizada.numero_radicado,
      estadoAnterior: resultado.estadoAnterior,
      estado: resultado.actualizada.estado,
      observacion: resultado.observacionHistorial,
      motivoRechazo: resultado.actualizada.motivo_rechazo,
      decididaEn: resultado.actualizada.decidida_en,
      actualizadoEn: resultado.actualizada.actualizado_en,
      correoEnviado: correo.correoEnviado,
      mensajeCorreo: correo.mensajeCorreo,
      mensaje: `Solicitud actualizada a «${etiquetaEstadoSolicitud(dto.estado)}».`,
    };
  }

  /** Texto de historial cuando el gestor no escribió una observación. */
  private observacionPorDefectoEstado(estado: estado_solicitud): string {
    switch (estado) {
      case 'en_revision':
        return 'El gestor inició la revisión de la solicitud.';
      case 'aprobada':
        return 'El gestor aprobó la solicitud.';
      case 'devuelta':
        return 'El gestor devolvió la solicitud para corrección.';
      case 'rechazada':
        return 'El gestor rechazó la solicitud.';
      default:
        return `La solicitud cambió al estado «${etiquetaEstadoSolicitud(estado)}».`;
    }
  }

  /**
   * Catálogo de requisitos documentales para una actividad.
   *
   * Los requisitos globales (`tipo_actividad = NULL`) aplican a todas las
   * actividades; los específicos solo a la actividad permitida del espacio.
   */
  async requisitos(
    dto: RequisitosSolicitudQueryDto = {},
  ): Promise<RequisitosSolicitudResponseDto> {
    const actividad = dto.actividad?.trim() || null;
    const where: Prisma.requisitos_documentalesWhereInput = actividad
      ? {
          activo: true,
          OR: [{ tipo_actividad: null }, { tipo_actividad: actividad }],
        }
      : { activo: true, tipo_actividad: null };

    const filas = await this.prisma.requisitos_documentales.findMany({
      where,
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

    return {
      actividad,
      requisitos: filas.map((fila) => ({
        id: fila.id.toString(),
        nombre: fila.nombre,
        descripcion: fila.descripcion,
        obligatorio: fila.obligatorio,
        tipoActividad: fila.tipo_actividad,
        orden: fila.orden,
      })),
    };
  }

  /**
   * Lista los requisitos documentales de una solicitud con su estado.
   *
   * Devuelve la versión vigente de cada requisito y todas sus versiones para
   * que el comerciante pueda revisar el historial sin exponer archivos
   * públicos.
   */
  async listarRequisitosSolicitud(
    idUsuario: string,
    idSolicitud: string,
  ): Promise<RequisitosSolicitudDetalleResponseDto> {
    const solicitud = await this.obtenerSolicitudDocumentos(
      idUsuario,
      idSolicitud,
    );
    const requisitos = await this.obtenerRequisitos(
      solicitud.espacios_temporales?.actividad_permitida ?? null,
    );
    const documentos = await this.prisma.solicitud_documentos.findMany({
      where: { solicitud_id: solicitud.id },
      orderBy: { cargado_en: 'asc' },
      select: SELECT_DOCUMENTO_VERSION,
    });

    return this.construirRequisitosSolicitud(solicitud, requisitos, documentos);
  }

  /**
   * Carga o reemplaza el documento de un requisito.
   *
   * Cada reemplazo crea una fila nueva con `reemplaza_a` apuntando a la
   * versión anterior. En estado `devuelta`, la solicitud vuelve a
   * `en_revision` cuando ya no quedan requisitos observados sin corregir.
   */
  async cargarDocumentoSolicitud(
    usuario: UsuarioAutenticado,
    idSolicitud: string,
    dto: CargarDocumentoSolicitudFormDto,
    archivo: Express.Multer.File | undefined,
  ): Promise<RespuestaCargaDocumentoSolicitudDto> {
    const usuarioId = parseIdBigint(usuario.id);
    const solicitudId = parseIdBigint(idSolicitud);

    if (!archivo) {
      throw new BadRequestException(
        'Adjunta un archivo para el requisito seleccionado',
      );
    }

    const validado = validarDocumento(
      {
        buffer: archivo.buffer,
        mimetype: archivo.mimetype,
        size: archivo.size,
        originalname: archivo.originalname,
      },
      limiteBytesDocumento(),
    );

    const solicitud = await this.obtenerSolicitudDocumentos(
      usuario.id,
      idSolicitud,
    );
    if (!puedeCargarDocumentos(solicitud.estado)) {
      throw new ConflictException(
        this.motivoBloqueoDocumentos(solicitud.estado),
      );
    }

    const requisitos = await this.obtenerRequisitos(
      solicitud.espacios_temporales?.actividad_permitida ?? null,
    );
    const requisito = requisitos.find((item) => item.id === dto.requisitoId);
    if (!requisito) {
      throw new BadRequestException(
        'El requisito documental no aplica a la actividad de la solicitud',
      );
    }

    let rutaGuardada: string | null = null;
    let reemplazo = false;
    let volvioARevision = false;
    let observacionRevision: string | null = null;

    try {
      await this.prisma.$transaction(async (tx) => {
        await fijarActorAuditoria(tx, usuarioId);

        // Bloquea la solicitud para que dos cargas simultáneas no creen dos
        // versiones vigentes del mismo requisito.
        const bloqueo = await tx.$queryRaw<
          { estado: estado_solicitud }[]
        >`SELECT estado FROM solicitudes WHERE id = ${solicitudId} FOR UPDATE`;
        const estadoActual = bloqueo[0]?.estado;
        if (!estadoActual) {
          throw new NotFoundException('La solicitud no existe');
        }
        if (!puedeCargarDocumentos(estadoActual)) {
          throw new ConflictException(
            this.motivoBloqueoDocumentos(estadoActual),
          );
        }

        const documentos = await tx.solicitud_documentos.findMany({
          where: { solicitud_id: solicitudId },
          orderBy: { cargado_en: 'asc' },
          select: SELECT_DOCUMENTO_VERSION,
        });
        const delRequisito = documentos.filter(
          (documento) => documento.requisito_id?.toString() === requisito.id,
        );
        const { actual } = agruparVersionesDocumento(delRequisito);
        reemplazo = actual !== null;

        rutaGuardada = await guardarDocumentoSolicitud(
          {
            buffer: archivo.buffer,
            mimetype: archivo.mimetype,
            size: archivo.size,
            originalname: archivo.originalname,
          },
          validado,
          solicitudId,
        );

        const nuevo = await tx.solicitud_documentos.create({
          data: {
            solicitud_id: solicitudId,
            requisito_id: parseIdBigint(requisito.id),
            tipo_documento: requisito.nombre,
            archivo_url: rutaGuardada,
            estado: 'pendiente',
            nombre_original: nombreArchivoSeguro(
              archivo.originalname ?? requisito.nombre,
            ),
            mime_type: validado.mimetype,
            tamano_bytes: validado.bytes,
            reemplaza_a: actual ? BigInt(actual.id) : null,
          },
        });

        const observados = this.documentosObservadosPorRequisito(
          requisitos,
          documentos,
        );
        if (estadoActual === 'devuelta' && observados.size > 0) {
          const despues: FilaDocumentoVersion[] = [...documentos, nuevo];
          const todosCorregidos = [...observados.entries()].every(
            ([requisitoId, documentoObservadoId]) => {
              const grupo = agruparVersionesDocumento(
                despues.filter(
                  (documento) =>
                    documento.requisito_id?.toString() === requisitoId,
                ),
              );
              return (
                grupo.actual !== null &&
                grupo.actual.id.toString() !== documentoObservadoId
              );
            },
          );

          if (todosCorregidos) {
            await tx.$executeRaw`
              UPDATE solicitudes
                 SET estado = 'en_revision'
               WHERE id = ${solicitudId}
            `;
            observacionRevision =
              'El comerciante corrigió los documentos observados y la solicitud vuelve a revisión.';
            await tx.solicitud_historial.create({
              data: {
                solicitud_id: solicitudId,
                estado_anterior: 'devuelta',
                estado_nuevo: 'en_revision',
                actor_id: usuarioId,
                observacion: observacionRevision,
              },
            });
            await this.notificaciones.crearCambioEstadoSolicitud(tx, {
              solicitudId,
              numeroRadicado: solicitud.numero_radicado,
              usuarioId,
              estadoAnterior: 'devuelta',
              estadoNuevo: 'en_revision',
              espacio: solicitud.espacios_temporales?.nombre ?? null,
              observacion: observacionRevision,
            });
            volvioARevision = true;
          }
        }
      });
    } catch (error) {
      if (rutaGuardada) {
        await eliminarDocumentoSolicitud(rutaGuardada);
      }
      throw error;
    }

    const actualizada = await this.listarRequisitosSolicitud(
      usuario.id,
      idSolicitud,
    );
    const requisitoActualizado = actualizada.requisitos.find(
      (item) => item.id === requisito.id,
    );
    if (!requisitoActualizado) {
      throw new Error('No se pudo leer el requisito actualizado');
    }

    const correo = volvioARevision
      ? await this.notificaciones.enviarCorreoCambioEstadoSolicitud(
          { correo: usuario.correo, nombre: usuario.nombre },
          {
            solicitudId,
            numeroRadicado: solicitud.numero_radicado,
            usuarioId,
            estadoAnterior: 'devuelta',
            estadoNuevo: 'en_revision',
            espacio: solicitud.espacios_temporales?.nombre ?? null,
            observacion: observacionRevision,
          },
        )
      : { correoEnviado: true, mensajeCorreo: null };

    return {
      mensaje: reemplazo
        ? 'Documento reemplazado correctamente.'
        : 'Documento cargado correctamente.',
      estadoSolicitud: actualizada.estado,
      volvioARevision,
      requisito: requisitoActualizado,
      faltantes: actualizada.faltantes,
      correoEnviado: correo.correoEnviado,
      mensajeCorreo: correo.mensajeCorreo,
    };
  }

  /**
   * Consulta la disponibilidad de un espacio para el rango solicitado.
   *
   * Se usa desde el formulario para avisar antes de radicar. La radicación
   * repite la validación dentro de la transacción.
   */
  async consultarDisponibilidad(
    idUsuario: string,
    dto: ConsultarDisponibilidadQueryDto,
  ): Promise<DisponibilidadSolicitudDto> {
    const usuarioId = parseIdBigint(idUsuario);
    const evaluacion = await this.evaluarDisponibilidad(usuarioId, {
      espacioId: dto.espacioId,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      horaInicio: dto.horaInicio,
      horaFin: dto.horaFin,
    });

    return {
      disponible: evaluacion.disponible,
      motivo: evaluacion.motivo,
      espacio: {
        id: evaluacion.espacio.id.toString(),
        nombre: evaluacion.espacio.nombre,
      },
    };
  }

  /**
   * Radica una solicitud completa.
   *
   * @throws BadRequestException si el formulario o los documentos no son válidos.
   * @throws ConflictException si el espacio no está disponible o hay duplicados.
   */
  async radicar(
    usuario: UsuarioAutenticado,
    form: RadicarSolicitudFormDto,
    archivos: Express.Multer.File[] = [],
  ): Promise<RadicarSolicitudResponseDto> {
    const usuarioId = parseIdBigint(usuario.id);
    const datos = await this.parsearDatos(form.datos);
    const metas = this.parsearMetadatos(form.documentosMeta);
    const listaArchivos = archivos ?? [];

    if (listaArchivos.length > maxDocumentos()) {
      throw new BadRequestException(
        `Puedes adjuntar como máximo ${maxDocumentos()} documentos`,
      );
    }
    if (metas.length !== listaArchivos.length) {
      throw new BadRequestException(
        'La cantidad de documentos no coincide con la información enviada',
      );
    }

    const evaluacion = await this.evaluarDisponibilidad(usuarioId, datos);
    if (!evaluacion.disponible) {
      throw new ConflictException(evaluacion.motivo);
    }

    const requisitos = await this.obtenerRequisitos(
      evaluacion.espacio.actividad_permitida,
    );
    const documentos = this.validarDocumentos(requisitos, metas, listaArchivos);
    const productos = await this.validarProductos(
      datos.productoIds,
      evaluacion.espacio.zona_productos ?? [],
    );

    const rutasGuardadas: string[] = [];
    let insercion: FilaInsercion;

    try {
      insercion = await this.prisma.$transaction(async (tx) => {
        await fijarActorAuditoria(tx, usuarioId);

        const filas = await tx.$queryRaw<FilaInsercion[]>`
          INSERT INTO solicitudes (
            comerciante_id,
            espacio_id,
            ubicacion_solicitada,
            actividad,
            fecha_inicio,
            fecha_fin,
            hora_inicio,
            hora_fin,
            estado,
            radicada_en
          )
          VALUES (
            ${usuarioId},
            ${parseIdBigint(datos.espacioId)},
            (
              SELECT ubicacion
                FROM espacios_temporales
               WHERE id = ${parseIdBigint(datos.espacioId)}
            ),
            ${datos.actividad},
            ${datos.fechaInicio}::date,
            ${datos.fechaFin}::date,
            ${datos.horaInicio}::time,
            ${datos.horaFin}::time,
            'radicada',
            now()
          )
          RETURNING id, numero_radicado
        `;

        const fila = filas[0];
        if (!fila) {
          throw new Error('No se pudo crear la solicitud');
        }

        if (productos.length > 0) {
          await tx.solicitud_productos.createMany({
            data: productos.map((producto) => ({
              solicitud_id: fila.id,
              producto_id: producto.id,
            })),
          });
        }

        for (const documento of documentos) {
          const ruta = await guardarDocumentoSolicitud(
            documento.archivo,
            documento.validado,
            fila.id,
          );
          rutasGuardadas.push(ruta);

          await tx.solicitud_documentos.create({
            data: {
              solicitud_id: fila.id,
              requisito_id: parseIdBigint(documento.requisito.id),
              tipo_documento: documento.requisito.nombre,
              archivo_url: ruta,
              estado: 'pendiente',
              nombre_original: nombreArchivoSeguro(
                documento.meta.nombreOriginal,
              ),
              mime_type: documento.validado.mimetype,
              tamano_bytes: documento.validado.bytes,
            },
          });
        }

        await tx.solicitud_historial.create({
          data: {
            solicitud_id: fila.id,
            estado_anterior: 'borrador',
            estado_nuevo: 'radicada',
            actor_id: usuarioId,
            observacion: 'Solicitud radicada por el comerciante.',
          },
        });

        await this.notificaciones.crearCambioEstadoSolicitud(tx, {
          solicitudId: fila.id,
          numeroRadicado: fila.numero_radicado,
          usuarioId,
          estadoAnterior: 'borrador',
          estadoNuevo: 'radicada',
          espacio: evaluacion.espacio.nombre,
        });

        return fila;
      });
    } catch (error) {
      await Promise.all(
        rutasGuardadas.map((ruta) => eliminarDocumentoSolicitud(ruta)),
      );
      throw error;
    }

    let correoEnviado = true;
    let mensajeCorreo: string | null = null;

    try {
      await this.correo.enviarConfirmacionRadicacion(
        usuario.correo,
        usuario.nombre,
        {
          numeroRadicado: insercion.numero_radicado,
          espacio: evaluacion.espacio.nombre,
          actividad: datos.actividad,
          productos: productos.map((producto) => producto.nombre),
          fechaInicio: datos.fechaInicio,
          fechaFin: datos.fechaFin,
          horaInicio: datos.horaInicio,
          horaFin: datos.horaFin,
          documentos: documentos.map((documento) => documento.requisito.nombre),
        },
      );
    } catch (error) {
      correoEnviado = false;
      mensajeCorreo =
        'La solicitud quedó radicada, pero no pudimos enviar el correo de confirmación.';
      this.logger.error(
        `No se pudo enviar la confirmación de ${insercion.numero_radicado}: ${String(error)}`,
      );
    }

    return {
      id: insercion.id.toString(),
      numeroRadicado: insercion.numero_radicado,
      estado: 'radicada',
      mensaje: 'Solicitud radicada correctamente.',
      correoEnviado,
      mensajeCorreo,
    };
  }

  /**
   * Devuelve la información necesaria para descargar un documento.
   *
   * Un comerciante solo puede descargar documentos de sus solicitudes; un
   * gestor puede descargar los de cualquier solicitud.
   */
  async descargarDocumento(
    usuario: UsuarioAutenticado,
    idSolicitud: string,
    idDocumento: string,
  ): Promise<{ ruta: string; nombreOriginal: string; mimeType: string }> {
    const solicitudId = parseIdBigint(idSolicitud);
    const documentoId = parseIdBigint(idDocumento);

    const where: Prisma.solicitud_documentosWhereInput = {
      id: documentoId,
      solicitud_id: solicitudId,
    };
    if (usuario.rol === 'comerciante') {
      where.solicitudes = {
        comerciante_id: parseIdBigint(usuario.id),
      };
    }

    const documento = await this.prisma.solicitud_documentos.findFirst({
      where,
      select: {
        archivo_url: true,
        nombre_original: true,
        mime_type: true,
      },
    });

    if (!documento) {
      throw new NotFoundException('El documento no existe o no tienes acceso');
    }

    const ruta = resolverRutaDocumento(documento.archivo_url);
    try {
      await access(ruta);
    } catch {
      throw new NotFoundException(
        'El archivo del documento no está disponible',
      );
    }

    return {
      ruta,
      nombreOriginal: nombreArchivoSeguro(documento.nombre_original),
      mimeType: documento.mime_type ?? mimePorRuta(documento.archivo_url),
    };
  }

  /** Parsea y valida el JSON de datos del formulario. */
  private async parsearDatos(datos: string): Promise<RadicarSolicitudDatosDto> {
    let crudo: unknown;
    try {
      crudo = JSON.parse(datos) as unknown;
    } catch {
      throw new BadRequestException(
        'El campo «datos» no contiene un JSON válido',
      );
    }

    const dto = plainToInstance(RadicarSolicitudDatosDto, crudo);
    const errores = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errores.length > 0) {
      const mensajes = errores.flatMap((error) =>
        Object.values(error.constraints ?? {}),
      );
      throw new BadRequestException(mensajes);
    }

    return dto;
  }

  /** Parsea y valida la lista de metadatos de documentos. */
  private parsearMetadatos(texto: string | undefined): DocumentoMetaDto[] {
    if (!texto?.trim()) return [];

    let crudo: unknown;
    try {
      crudo = JSON.parse(texto) as unknown;
    } catch {
      throw new BadRequestException(
        'El campo «documentosMeta» no contiene un JSON válido',
      );
    }

    if (!Array.isArray(crudo)) {
      throw new BadRequestException(
        'El campo «documentosMeta» debe ser una lista',
      );
    }

    return crudo.map((item, indice) => {
      if (typeof item !== 'object' || item === null) {
        throw new BadRequestException(
          `El metadato del documento ${indice + 1} no es válido`,
        );
      }
      const registro = item as Record<string, unknown>;
      const requisitoId = registro.requisitoId;
      const nombreOriginal = registro.nombreOriginal;

      if (typeof requisitoId !== 'string' || !/^\d+$/.test(requisitoId)) {
        throw new BadRequestException(
          `El requisito del documento ${indice + 1} no es válido`,
        );
      }
      if (
        typeof nombreOriginal !== 'string' ||
        nombreOriginal.trim().length === 0 ||
        nombreOriginal.length > 255
      ) {
        throw new BadRequestException(
          `El nombre del documento ${indice + 1} no es válido`,
        );
      }

      return { requisitoId, nombreOriginal: nombreOriginal.trim() };
    });
  }

  /** Obtiene los requisitos activos que aplican a una actividad. */
  private async obtenerRequisitos(
    actividad: string | null,
  ): Promise<RequisitoDocumentalDto[]> {
    const where: Prisma.requisitos_documentalesWhereInput = actividad
      ? {
          activo: true,
          OR: [{ tipo_actividad: null }, { tipo_actividad: actividad }],
        }
      : { activo: true, tipo_actividad: null };

    const filas = await this.prisma.requisitos_documentales.findMany({
      where,
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

    return filas.map((fila) => ({
      id: fila.id.toString(),
      nombre: fila.nombre,
      descripcion: fila.descripcion,
      obligatorio: fila.obligatorio,
      tipoActividad: fila.tipo_actividad,
      orden: fila.orden,
    }));
  }

  /** Valida que cada archivo corresponda a un requisito y que estén los obligatorios. */
  private validarDocumentos(
    requisitos: RequisitoDocumentalDto[],
    metas: DocumentoMetaDto[],
    archivos: Express.Multer.File[],
  ): DocumentoParaGuardar[] {
    const porId = new Map(
      requisitos.map((requisito) => [requisito.id, requisito]),
    );
    const vistos = new Set<string>();

    for (const meta of metas) {
      if (!porId.has(meta.requisitoId)) {
        throw new BadRequestException(
          'Uno de los documentos no corresponde a un requisito de la actividad',
        );
      }
      if (vistos.has(meta.requisitoId)) {
        throw new BadRequestException(
          'No se puede adjuntar más de un archivo para el mismo requisito',
        );
      }
      vistos.add(meta.requisitoId);
    }

    const faltantes = documentosFaltantes(requisitos, metas);
    if (faltantes.length > 0) {
      throw new BadRequestException(
        `Faltan documentos obligatorios: ${faltantes.join(', ')}`,
      );
    }

    return metas.map((meta, indice) => {
      const requisito = porId.get(meta.requisitoId);
      const archivo = archivos[indice];
      if (!requisito || !archivo) {
        throw new BadRequestException(
          'La información de los documentos no es válida',
        );
      }

      return {
        meta,
        requisito,
        archivo: {
          buffer: archivo.buffer,
          mimetype: archivo.mimetype,
          size: archivo.size,
          originalname: archivo.originalname,
        },
        validado: validarDocumento(
          {
            buffer: archivo.buffer,
            mimetype: archivo.mimetype,
            size: archivo.size,
            originalname: archivo.originalname,
          },
          limiteBytesDocumento(),
        ),
      };
    });
  }

  /** Valida que los productos existan, estén activos y sean permitidos por la zona. */
  private async validarProductos(
    ids: string[],
    productosZona: string[],
  ): Promise<{ id: bigint; nombre: string }[]> {
    const identificadores = ids.map((id) => parseIdBigint(id));
    const productos = await this.prisma.productos.findMany({
      where: { id: { in: identificadores }, activo: true },
      select: { id: true, nombre: true },
    });

    if (productos.length !== identificadores.length) {
      throw new BadRequestException(
        'Uno o más productos no existen o están inactivos',
      );
    }

    if (productosZona.length > 0) {
      const permitidos = new Set(productosZona);
      const noPermitidos = productos
        .filter((producto) => !permitidos.has(producto.nombre))
        .map((producto) => producto.nombre);

      if (noPermitidos.length > 0) {
        throw new BadRequestException(
          `Los siguientes productos no están permitidos en la zona: ${noPermitidos.join(', ')}`,
        );
      }
    }

    return productos;
  }

  /**
   * Evalúa fechas, horario, estado del espacio, bloqueos, permisos, solicitudes
   * aprobadas y duplicados del comerciante.
   */
  private async evaluarDisponibilidad(
    usuarioId: bigint,
    datos: Pick<
      RadicarSolicitudDatosDto,
      'espacioId' | 'fechaInicio' | 'fechaFin' | 'horaInicio' | 'horaFin'
    >,
  ): Promise<EvaluacionDisponibilidad> {
    const erroresFechas = validarFechasRadicacion(
      datos.fechaInicio,
      datos.fechaFin,
    );
    if (erroresFechas.length > 0) {
      throw new BadRequestException(erroresFechas);
    }

    const erroresHoras = validarHorasRadicacion(
      datos.horaInicio,
      datos.horaFin,
    );
    if (erroresHoras.length > 0) {
      throw new BadRequestException(erroresHoras);
    }

    const espacioId = parseIdBigint(datos.espacioId);
    const [espacio] = await this.prisma.$queryRaw<FilaEspacioSolicitud[]>`
      SELECT
        e.id,
        e.nombre,
        e.estado,
        e.sector,
        e.tipo,
        e.actividad_permitida,
        to_char(e.horario_inicio, 'HH24:MI') AS horario_inicio,
        to_char(e.horario_fin, 'HH24:MI') AS horario_fin,
        z.id AS zona_id,
        z.nombre AS zona_nombre,
        z.activa AS zona_activa,
        to_char(z.horario_inicio, 'HH24:MI') AS zona_horario_inicio,
        to_char(z.horario_fin, 'HH24:MI') AS zona_horario_fin,
        COALESCE(
          (
            SELECT jsonb_agg(p.nombre ORDER BY p.nombre)
              FROM zona_productos zp
              JOIN productos p ON p.id = zp.producto_id
             WHERE zp.zona_id = z.id
               AND p.activo = true
          ),
          '[]'::jsonb
        ) AS zona_productos
      FROM espacios_temporales e
      LEFT JOIN zonas z ON z.id = e.zona_id
      WHERE e.id = ${espacioId}
    `;

    if (!espacio) {
      throw new NotFoundException('El espacio solicitado no existe');
    }

    if (espacio.estado === 'mantenimiento') {
      return {
        espacio,
        disponible: false,
        motivo: 'El espacio está en mantenimiento.',
      };
    }

    if (espacio.estado !== 'disponible') {
      return {
        espacio,
        disponible: false,
        motivo: `El espacio no está disponible (estado ${espacio.estado}).`,
      };
    }

    if (
      espacio.zona_id !== null &&
      espacio.zona_nombre !== null &&
      espacio.zona_activa === false
    ) {
      return {
        espacio,
        disponible: false,
        motivo: `La zona ${espacio.zona_nombre} está inactiva y no admite solicitudes.`,
      };
    }

    const horario = this.horarioEfectivo(espacio);
    const errorHorario = validarHorarioPermitido(
      horario,
      datos.horaInicio,
      datos.horaFin,
    );
    if (errorHorario) {
      return { espacio, disponible: false, motivo: errorHorario };
    }

    const bloqueos = await this.prisma.$queryRaw<FilaBloqueo[]>`
      SELECT fecha_inicio, fecha_fin, motivo
        FROM espacio_bloqueos
       WHERE espacio_id = ${espacioId}
         AND daterange(fecha_inicio, fecha_fin, '[]')
             && daterange(${datos.fechaInicio}::date, ${datos.fechaFin}::date, '[]')
       ORDER BY fecha_inicio ASC
       LIMIT 1
    `;
    if (bloqueos.length > 0) {
      const bloqueo = bloqueos[0];
      return {
        espacio,
        disponible: false,
        motivo: `El espacio tiene un bloqueo ${formatearRangoFechas(
          this.aFechaISO(bloqueo.fecha_inicio),
          this.aFechaISO(bloqueo.fecha_fin),
        )}${bloqueo.motivo ? `: ${bloqueo.motivo}` : '.'}`,
      };
    }

    const permisos = await this.prisma.$queryRaw<FilaPermiso[]>`
      SELECT p.numero, p.fecha_inicio, p.fecha_fin
        FROM permisos p
        JOIN solicitudes s ON s.id = p.solicitud_id
       WHERE p.espacio_id = ${espacioId}
         AND p.estado = 'vigente'
         AND daterange(p.fecha_inicio, p.fecha_fin, '[]')
             && daterange(${datos.fechaInicio}::date, ${datos.fechaFin}::date, '[]')
         AND ${datos.horaInicio}::time < s.hora_fin
         AND ${datos.horaFin}::time > s.hora_inicio
       LIMIT 1
    `;
    if (permisos.length > 0) {
      const permiso = permisos[0];
      return {
        espacio,
        disponible: false,
        motivo: `El espacio está ocupado por el permiso ${permiso.numero} ${formatearRangoFechas(
          this.aFechaISO(permiso.fecha_inicio),
          this.aFechaISO(permiso.fecha_fin),
        )}.`,
      };
    }

    const aprobadas = await this.prisma.$queryRaw<FilaSolicitudAprobada[]>`
      SELECT numero_radicado, fecha_inicio, fecha_fin
        FROM solicitudes
       WHERE espacio_id = ${espacioId}
         AND estado = 'aprobada'
         AND daterange(fecha_inicio, fecha_fin, '[]')
             && daterange(${datos.fechaInicio}::date, ${datos.fechaFin}::date, '[]')
         AND ${datos.horaInicio}::time < hora_fin
         AND ${datos.horaFin}::time > hora_inicio
       LIMIT 1
    `;
    if (aprobadas.length > 0) {
      const solicitud = aprobadas[0];
      return {
        espacio,
        disponible: false,
        motivo: `El espacio está asignado a la solicitud aprobada ${solicitud.numero_radicado} ${formatearRangoFechas(
          this.aFechaISO(solicitud.fecha_inicio),
          this.aFechaISO(solicitud.fecha_fin),
        )}.`,
      };
    }

    const duplicados = await this.prisma.$queryRaw<FilaDuplicado[]>`
      SELECT id, numero_radicado
        FROM solicitudes
       WHERE comerciante_id = ${usuarioId}
         AND espacio_id = ${espacioId}
         AND estado IN (${Prisma.join(ESTADOS_DUPLICADO)})
         AND daterange(fecha_inicio, fecha_fin, '[]')
             && daterange(${datos.fechaInicio}::date, ${datos.fechaFin}::date, '[]')
       LIMIT 1
    `;
    if (duplicados.length > 0) {
      const duplicado = duplicados[0];
      return {
        espacio,
        disponible: false,
        motivo: `Ya tienes una solicitud activa para este espacio y esas fechas (radicado ${duplicado.numero_radicado}).`,
      };
    }

    return { espacio, disponible: true, motivo: null };
  }

  /** Horario propio del espacio o, si no tiene, el de su zona. */
  private horarioEfectivo(espacio: FilaEspacioSolicitud) {
    if (espacio.horario_inicio && espacio.horario_fin) {
      return { inicio: espacio.horario_inicio, fin: espacio.horario_fin };
    }
    return {
      inicio: espacio.zona_horario_inicio,
      fin: espacio.zona_horario_fin,
    };
  }

  /** Obtiene una solicitud propia con los datos que necesita documentos. */
  private async obtenerSolicitudDocumentos(
    idUsuario: string,
    idSolicitud: string,
  ): Promise<FilaSolicitudDocumentos> {
    const usuarioId = parseIdBigint(idUsuario);
    const id = parseIdBigint(idSolicitud);

    const solicitud = await this.prisma.solicitudes.findFirst({
      where: {
        id,
        comerciante_id: usuarioId,
        estado: { not: 'borrador' },
      },
      select: {
        id: true,
        numero_radicado: true,
        estado: true,
        espacios_temporales: {
          select: { nombre: true, actividad_permitida: true },
        },
      },
    });

    if (!solicitud) {
      throw new NotFoundException('La solicitud no existe o no te pertenece');
    }

    return solicitud;
  }

  /** Mensaje de bloqueo cuando el estado no admite cambios de documentos. */
  private motivoBloqueoDocumentos(estado: estado_solicitud): string {
    return `La solicitud está en estado «${etiquetaEstadoSolicitud(estado)}» y no admite cambios en sus documentos.`;
  }

  /**
   * Describe qué requisitos tenían un documento observado antes de la carga.
   *
   * Se usa para saber si, tras corregir un documento, ya no queda ningún
   * requisito observado pendiente.
   */
  private documentosObservadosPorRequisito(
    requisitos: readonly RequisitoDocumentalDto[],
    documentos: readonly FilaDocumentoVersion[],
  ): Map<string, string> {
    const observados = new Map<string, string>();

    for (const requisito of requisitos) {
      const grupo = agruparVersionesDocumento(
        documentos.filter(
          (documento) => documento.requisito_id?.toString() === requisito.id,
        ),
      );
      if (grupo.actual?.estado === 'observado') {
        observados.set(requisito.id, grupo.actual.id.toString());
      }
    }

    return observados;
  }

  /** Construye la respuesta con requisitos, versiones y faltantes. */
  private construirRequisitosSolicitud(
    solicitud: FilaSolicitudDocumentos,
    requisitos: readonly RequisitoDocumentalDto[],
    documentos: readonly FilaDocumentoVersion[],
  ): RequisitosSolicitudDetalleResponseDto {
    const solicitudId = solicitud.id.toString();
    const idsRequisitos = new Set(requisitos.map((requisito) => requisito.id));
    const porRequisito = new Map<string, FilaDocumentoVersion[]>();

    for (const documento of documentos) {
      const requisitoId = documento.requisito_id?.toString();
      if (!requisitoId || !idsRequisitos.has(requisitoId)) continue;
      const grupo = porRequisito.get(requisitoId) ?? [];
      grupo.push(documento);
      porRequisito.set(requisitoId, grupo);
    }

    const requisitosEstado: RequisitoEstadoSolicitudDto[] = requisitos.map(
      (requisito) => {
        const grupo = agruparVersionesDocumento(
          porRequisito.get(requisito.id) ?? [],
        );
        const versiones = grupo.versiones.map((version) =>
          this.aDocumentoVersion(
            version.fila,
            version.numeroVersion,
            version.esActual,
            solicitudId,
          ),
        );
        const documentoActual =
          versiones.find((version) => version.esActual) ?? null;

        return {
          id: requisito.id,
          nombre: requisito.nombre,
          descripcion: requisito.descripcion,
          obligatorio: requisito.obligatorio,
          tipoActividad: requisito.tipoActividad,
          orden: requisito.orden,
          estado: estadoRequisitoDocumental(
            documentoActual?.estado,
            documentoActual !== null,
          ),
          documentoActual,
          versiones,
        };
      },
    );

    const faltantes = requisitosEstado
      .filter(
        (requisito) => requisito.obligatorio && requisito.estado === 'faltante',
      )
      .map((requisito) => requisito.nombre);

    const noClasificados = documentos.filter((documento) => {
      const requisitoId = documento.requisito_id?.toString();
      return !requisitoId || !idsRequisitos.has(requisitoId);
    });
    const gruposOtros = new Map<string, FilaDocumentoVersion[]>();
    for (const documento of noClasificados) {
      const clave = documento.tipo_documento;
      const grupo = gruposOtros.get(clave) ?? [];
      grupo.push(documento);
      gruposOtros.set(clave, grupo);
    }
    const otrosDocumentos = [...gruposOtros.values()]
      .map((grupo) => agruparVersionesDocumento(grupo).actual)
      .filter(
        (documento): documento is FilaDocumentoVersion => documento !== null,
      )
      .sort((a, b) => {
        const fechaA =
          a.cargado_en instanceof Date
            ? a.cargado_en.getTime()
            : new Date(a.cargado_en).getTime();
        const fechaB =
          b.cargado_en instanceof Date
            ? b.cargado_en.getTime()
            : new Date(b.cargado_en).getTime();
        return fechaB - fechaA;
      })
      .map((documento) => this.aDocumentoSolicitud(documento, solicitudId));

    return {
      solicitudId,
      numeroRadicado: solicitud.numero_radicado,
      estado: solicitud.estado,
      actividad: solicitud.espacios_temporales?.actividad_permitida ?? null,
      puedeCargar: puedeCargarDocumentos(solicitud.estado),
      motivoBloqueo: puedeCargarDocumentos(solicitud.estado)
        ? null
        : this.motivoBloqueoDocumentos(solicitud.estado),
      faltantes,
      requisitos: requisitosEstado,
      otrosDocumentos,
    };
  }

  /** Convierte una fila de documento al DTO con número de versión. */
  private aDocumentoVersion(
    fila: FilaDocumentoVersion,
    numeroVersion: number,
    esActual: boolean,
    solicitudId: string,
  ): DocumentoVersionSolicitudDto {
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
    };
  }

  /** Convierte una fila de documento al DTO básico del detalle. */
  private aDocumentoSolicitud(
    fila: FilaDocumentoVersion,
    solicitudId: string,
  ): DocumentoSolicitudDto {
    return {
      id: fila.id.toString(),
      tipoDocumento: fila.tipo_documento,
      nombreOriginal: fila.nombre_original,
      mimeType: fila.mime_type,
      tamanoBytes: fila.tamano_bytes,
      estado: fila.estado,
      observacion: fila.observacion,
      cargadoEn: fila.cargado_en,
      url: `/solicitudes/${solicitudId}/documentos/${fila.id.toString()}/archivo`,
    };
  }

  /** Deja solo la versión vigente de cada documento. */
  private documentosVigentes<
    T extends { id: bigint; reemplaza_a: bigint | null },
  >(filas: readonly T[]): T[] {
    const reemplazados = new Set(
      filas
        .map((fila) => fila.reemplaza_a?.toString())
        .filter((id): id is string => Boolean(id)),
    );
    return filas.filter((fila) => !reemplazados.has(fila.id.toString()));
  }

  /** Convierte una fila de Prisma al DTO del listado. */
  private aListado(fila: FilaSolicitud): SolicitudListadoDto {
    return {
      id: fila.id.toString(),
      numeroRadicado: fila.numero_radicado,
      estado: fila.estado as estado_solicitud,
      actividad: fila.actividad,
      fechaInicio: this.aFechaISO(fila.fecha_inicio),
      fechaFin: this.aFechaISO(fila.fecha_fin),
      horaInicio: this.aHoraISO(fila.hora_inicio),
      horaFin: this.aHoraISO(fila.hora_fin),
      radicadaEn: fila.radicada_en,
      creadoEn: fila.creado_en,
      espacio: fila.espacios_temporales
        ? {
            id: fila.espacios_temporales.id.toString(),
            nombre: fila.espacios_temporales.nombre,
            sector: fila.espacios_temporales.sector,
            tipo: fila.espacios_temporales.tipo,
            actividadPermitida: fila.espacios_temporales.actividad_permitida,
          }
        : null,
      productos: fila.solicitud_productos.map((relacion) => ({
        id: relacion.productos.id.toString(),
        nombre: relacion.productos.nombre,
      })),
      documentos: this.documentosVigentes(fila.solicitud_documentos).map(
        (documento) => this.aDocumentoSolicitud(documento, fila.id.toString()),
      ),
    };
  }

  /** Convierte una fila de Prisma al DTO de detalle. */
  private aDetalle(fila: FilaSolicitud): SolicitudTemporalDetalleDto {
    const resolucion = [...fila.solicitud_historial]
      .reverse()
      .find(
        (registro) =>
          registro.estado_nuevo === 'aprobada' ||
          registro.estado_nuevo === 'rechazada',
      );
    const dictamen =
      resolucion?.estado_nuevo === 'aprobada' ? resolucion.observacion : null;
    const resueltaPor = resolucion?.usuarios
      ? {
          id: resolucion.usuarios.id.toString(),
          nombre: resolucion.usuarios.nombre,
          apellido: resolucion.usuarios.apellido,
        }
      : null;
    const asignacion =
      fila.estado === 'aprobada' && fila.espacios_temporales
        ? {
            espacioId: fila.espacios_temporales.id.toString(),
            espacioNombre: fila.espacios_temporales.nombre,
            fechaInicio: this.aFechaISO(fila.fecha_inicio),
            fechaFin: this.aFechaISO(fila.fecha_fin),
            horaInicio: this.aHoraISO(fila.hora_inicio),
            horaFin: this.aHoraISO(fila.hora_fin),
          }
        : null;

    return {
      // eslint-disable-next-line typescript/no-misused-spread -- el DTO de listado es un objeto plano de datos
      ...this.aListado(fila),
      decididaEn: fila.decidida_en,
      motivoRechazo: fila.motivo_rechazo,
      dictamen,
      resueltaPor,
      asignacion,
      actualizadoEn: fila.actualizado_en,
      historial: fila.solicitud_historial.map((registro) => ({
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
      })),
    };
  }

  /** Convierte una fecha de Prisma o PostgreSQL a `YYYY-MM-DD`. */
  private aFechaISO(valor: string | Date): string {
    if (valor instanceof Date) return valor.toISOString().slice(0, 10);
    return valor.slice(0, 10);
  }

  /** Convierte una hora de Prisma o PostgreSQL a `HH:MM`. */
  private aHoraISO(valor: string | Date): string {
    if (valor instanceof Date) return valor.toISOString().slice(11, 16);
    return valor.slice(0, 5);
  }
}
