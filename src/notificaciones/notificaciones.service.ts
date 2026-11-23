import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { parseIdBigint } from '../common/parse-id';
import {
  etiquetaEstadoSolicitud,
  tipoNotificacionSolicitud,
} from '../common/estados-solicitud';
import {
  CorreoService,
  type DatosCambioEstadoSolicitud,
} from '../correo/correo.service';
import { Prisma, type estado_solicitud } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ListarNotificacionesQueryDto,
  ListarNotificacionesResponseDto,
  NotificacionResponseDto,
  TodasLeidasResponseDto,
} from './dto/notificaciones.dto';

/** Columnas que se exponen al frontend. */
const SELECT_NOTIFICACION = {
  id: true,
  solicitud_id: true,
  feria_id: true,
  tipo: true,
  asunto: true,
  cuerpo: true,
  canal: true,
  leida: true,
  creada_en: true,
} satisfies Prisma.notificacionesSelect;

type FilaNotificacion = Prisma.notificacionesGetPayload<{
  select: typeof SELECT_NOTIFICACION;
}>;

/** Datos de la notificación interna de un cambio de estado. */
export interface DatosNotificacionCambioEstado {
  solicitudId: bigint;
  numeroRadicado: string;
  usuarioId: bigint;
  estadoAnterior: estado_solicitud;
  estadoNuevo: estado_solicitud;
  espacio?: string | null;
  observacion?: string | null;
  motivoRechazo?: string | null;
}

/** Resultado best-effort del envío de correo de un cambio de estado. */
export interface ResultadoCorreoCambioEstado {
  correoEnviado: boolean;
  mensajeCorreo: string | null;
}

/** Datos de un aviso interno genérico, como la radicación de una feria. */
export interface DatosAvisoFeria {
  usuarioId: bigint;
  feriaId: bigint;
  tipo: string;
  asunto: string;
  cuerpo: string;
}

/**
 * Bandeja de notificaciones del usuario y avisos por cambio de estado.
 *
 * La consulta y el marcado de lectura siempre usan el `usuario_id` del JWT.
 * Los módulos de trámites usan `crearCambioEstadoSolicitud` dentro de su
 * transacción y `enviarCorreoCambioEstadoSolicitud` después del commit.
 */
@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
  ) {}

  /** Lista las notificaciones del usuario con paginación y filtro de lectura. */
  async listar(
    idUsuario: string,
    dto: ListarNotificacionesQueryDto,
  ): Promise<ListarNotificacionesResponseDto> {
    const usuarioId = parseIdBigint(idUsuario);
    const pagina = dto.pagina ?? 1;
    const limite = dto.limite ?? 20;

    const where: Prisma.notificacionesWhereInput = {
      usuario_id: usuarioId,
      ...(dto.leida !== undefined ? { leida: dto.leida } : {}),
    };

    const [filas, total, noLeidas] = await Promise.all([
      this.prisma.notificaciones.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: [{ creada_en: 'desc' }, { id: 'desc' }],
        select: SELECT_NOTIFICACION,
      }),
      this.prisma.notificaciones.count({ where }),
      this.prisma.notificaciones.count({
        where: { usuario_id: usuarioId, leida: false },
      }),
    ]);

    return {
      datos: filas.map((fila) => this.mapear(fila)),
      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas: total === 0 ? 0 : Math.ceil(total / limite),
      },
      noLeidas,
    };
  }

  /**
   * Crea la notificación interna de un cambio de estado.
   *
   * Debe llamarse dentro de la misma transacción que actualiza la solicitud y
   * escribe el historial, para que ambos queden consistentes.
   *
   * @returns Identificador de la notificación creada.
   */
  async crearCambioEstadoSolicitud(
    tx: Prisma.TransactionClient,
    datos: DatosNotificacionCambioEstado,
  ): Promise<string> {
    const etiquetaAnterior = etiquetaEstadoSolicitud(datos.estadoAnterior);
    const etiquetaNueva = etiquetaEstadoSolicitud(datos.estadoNuevo);
    const detalle = datos.motivoRechazo
      ? ` Motivo del rechazo: ${datos.motivoRechazo}`
      : datos.observacion
        ? ` Observación del gestor: ${datos.observacion}`
        : '';
    const espacio = datos.espacio
      ? ` para ${datos.espacio}`
      : ' para el espacio solicitado';

    const creada = await tx.notificaciones.create({
      data: {
        usuario_id: datos.usuarioId,
        solicitud_id: datos.solicitudId,
        tipo: tipoNotificacionSolicitud(datos.estadoNuevo),
        asunto: `Solicitud ${datos.numeroRadicado}: ${etiquetaNueva}`.slice(
          0,
          200,
        ),
        cuerpo:
          `Tu solicitud ${datos.numeroRadicado}${espacio} cambió de ` +
          `«${etiquetaAnterior}» a «${etiquetaNueva}».${detalle}`,
        canal: 'app',
        leida: false,
      },
      select: { id: true },
    });

    return creada.id.toString();
  }

  /**
   * Crea una notificación interna para un evento que no es una solicitud.
   *
   * Debe llamarse dentro de la transacción que crea el evento para que ambos
   * queden consistentes.
   */
  async crearAvisoFeria(
    tx: Prisma.TransactionClient,
    datos: DatosAvisoFeria,
  ): Promise<string> {
    const creada = await tx.notificaciones.create({
      data: {
        usuario_id: datos.usuarioId,
        feria_id: datos.feriaId,
        tipo: datos.tipo,
        asunto: datos.asunto.slice(0, 200),
        cuerpo: datos.cuerpo,
        canal: 'app',
        leida: false,
      },
      select: { id: true },
    });

    return creada.id.toString();
  }

  /**
   * Envía el correo de un cambio de estado.
   *
   * Es best-effort: el estado y la notificación interna ya están guardados.
   * Un fallo de SMTP se registra y se informa, pero no revierte la transición.
   */
  async enviarCorreoCambioEstadoSolicitud(
    destinatario: { correo: string; nombre: string },
    datos: DatosNotificacionCambioEstado,
  ): Promise<ResultadoCorreoCambioEstado> {
    try {
      await this.correo.enviarCambioEstadoSolicitud(
        destinatario.correo,
        destinatario.nombre,
        {
          solicitudId: datos.solicitudId.toString(),
          numeroRadicado: datos.numeroRadicado,
          estadoAnterior: datos.estadoAnterior,
          estadoNuevo: datos.estadoNuevo,
          espacio: datos.espacio ?? null,
          observacion: datos.observacion ?? null,
          motivoRechazo: datos.motivoRechazo ?? null,
        } satisfies DatosCambioEstadoSolicitud,
      );

      return { correoEnviado: true, mensajeCorreo: null };
    } catch (error) {
      this.logger.error(
        `No se pudo enviar el correo del cambio de estado de ` +
          `${datos.numeroRadicado} a ${destinatario.correo}: ${String(error)}`,
      );
      return {
        correoEnviado: false,
        mensajeCorreo:
          'El cambio de estado quedó guardado, pero no pudimos enviar el correo de aviso.',
      };
    }
  }

  /**
   * Marca una notificación propia como leída o no leída.
   *
   * @throws NotFoundException si la notificación no existe o pertenece a otro
   *   usuario (no se revela cuál de las dos cosas ocurre).
   */
  async marcarLeida(
    idNotificacion: string,
    idUsuario: string,
    leida: boolean,
  ): Promise<NotificacionResponseDto> {
    const id = parseIdBigint(idNotificacion);
    const usuarioId = parseIdBigint(idUsuario);

    const existente = await this.prisma.notificaciones.findFirst({
      where: { id, usuario_id: usuarioId },
      select: { id: true },
    });
    if (!existente) {
      throw new NotFoundException('La notificación solicitada no existe');
    }

    const actualizada = await this.prisma.notificaciones.update({
      where: { id },
      data: { leida },
      select: SELECT_NOTIFICACION,
    });

    return this.mapear(actualizada);
  }

  /** Marca todas las notificaciones no leídas del usuario como leídas. */
  async marcarTodasLeidas(idUsuario: string): Promise<TodasLeidasResponseDto> {
    const usuarioId = parseIdBigint(idUsuario);
    const resultado = await this.prisma.notificaciones.updateMany({
      where: { usuario_id: usuarioId, leida: false },
      data: { leida: true },
    });

    return {
      actualizadas: resultado.count,
      mensaje:
        resultado.count === 0
          ? 'No tenías notificaciones pendientes por leer.'
          : 'Notificaciones marcadas como leídas.',
    };
  }

  /** Convierte la fila de Prisma en el DTO de respuesta. */
  private mapear(fila: FilaNotificacion): NotificacionResponseDto {
    return {
      id: fila.id.toString(),
      solicitudId: fila.solicitud_id?.toString() ?? null,
      feriaId: fila.feria_id?.toString() ?? null,
      tipo: fila.tipo,
      asunto: fila.asunto,
      cuerpo: fila.cuerpo,
      canal: fila.canal,
      leida: fila.leida,
      creadaEn: fila.creada_en,
    };
  }
}
