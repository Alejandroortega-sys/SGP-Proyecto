import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { fechaISO } from './permisos.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Días antes del vencimiento en los que se avisa al titular (HU-34-CA1:
 * «mi permiso vence en 15 días … veo un aviso»).
 */
export const DIAS_AVISO_VENCIMIENTO = 15;

/**
 * Avisos de vencimiento de permisos (HU-34, tarea 1230).
 *
 * Un cron diario notifica a los titulares de permisos vigentes que vencen
 * en los próximos 15 días. La notificación es una fila en `notificaciones`
 * (AGENTS §11.11) y el proceso es **idempotente por día**: la segunda
 * ejecución del mismo día no vuelve a avisar por el mismo permiso
 * (se enlaza con `notificaciones.solicitud_id`, que referencia la misma
 * solicitud del permiso).
 */
@Injectable()
export class AvisosVencimientoService {
  private readonly logger = new Logger(AvisosVencimientoService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Ejecución programada: todos los días a las 6:00 a. m. */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async avisarDiario(): Promise<void> {
    try {
      const creadas = await this.generarAvisos(new Date());
      if (creadas > 0) {
        this.logger.log(`Avisos de vencimiento creados: ${creadas}`);
      }
    } catch (error) {
      this.logger.error(
        `No se pudieron generar los avisos de vencimiento: ${String(error)}`,
      );
    }
  }

  /**
   * Genera los avisos de vencimiento para la fecha indicada.
   *
   * Un único `INSERT ... SELECT` con `NOT EXISTS` garantiza la
   * idempotencia por día y devuelve las filas creadas.
   *
   * @returns Cantidad de avisos nuevos creados.
   */
  async generarAvisos(hoy: Date): Promise<number> {
    const hoyISO = fechaISO(hoy);
    const creadas = await this.prisma.$queryRaw<{ id: bigint }[]>`
      INSERT INTO notificaciones
        (usuario_id, solicitud_id, tipo, asunto, cuerpo, canal, leida)
      SELECT p.titular_id, p.solicitud_id, 'aviso_vencimiento',
             'Su permiso ' || p.numero || ' vence pronto',
             'Su permiso ' || p.numero || ' vence el ' ||
               to_char(p.fecha_fin, 'DD/MM/YYYY') ||
               '. Renuévelo desde «Mis permisos» antes del vencimiento ' ||
               'para conservar su puesto con una solicitud simplificada.',
             'app', false
        FROM permisos p
       WHERE p.estado = 'vigente'
         AND p.fecha_fin >= ${hoyISO}::date
         AND p.fecha_fin <= (${hoyISO}::date + ${DIAS_AVISO_VENCIMIENTO})
         AND NOT EXISTS (
              SELECT 1
                FROM notificaciones n
               WHERE n.solicitud_id = p.solicitud_id
                 AND n.tipo = 'aviso_vencimiento'
                 AND n.creada_en >= ${hoyISO}::date
                 AND n.creada_en < (${hoyISO}::date + 1)
         )
      RETURNING id`;
    return creadas.length;
  }
}
