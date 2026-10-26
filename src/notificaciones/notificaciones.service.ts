import { Injectable, NotFoundException } from '@nestjs/common';
import { parseIdBigint } from '../common/parse-id';
import { Prisma } from '../generated/prisma/client';
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

/**
 * Bandeja de notificaciones del usuario autenticado.
 *
 * La tabla `notificaciones` ya existe y el resto del backend escribe en ella.
 * Este servicio solo permite consultar y marcar como leídas las notificaciones
 * propias: el `usuario_id` siempre sale del JWT y nunca de un parámetro.
 */
@Injectable()
export class NotificacionesService {
  constructor(private readonly prisma: PrismaService) {}

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
      tipo: fila.tipo,
      asunto: fila.asunto,
      cuerpo: fila.cuerpo,
      canal: fila.canal,
      leida: fila.leida,
      creadaEn: fila.creada_en,
    };
  }
}
