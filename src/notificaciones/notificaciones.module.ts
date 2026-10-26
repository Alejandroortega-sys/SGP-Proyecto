import { Module } from '@nestjs/common';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';

/**
 * Bandeja de notificaciones internas del usuario autenticado.
 *
 * `PrismaModule` es global; la autenticación y la autorización por rol las
 * aplican los guards globales de `AppModule`. El servicio restringe cada
 * consulta al `usuario_id` del JWT.
 */
@Module({
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
})
export class NotificacionesModule {}
