import { Module } from '@nestjs/common';
import { CorreoModule } from '../correo/correo.module';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';

/**
 * Bandeja de notificaciones internas y servicio de avisos por cambio de estado.
 *
 * `PrismaModule` es global; la autenticación y la autorización por rol las
 * aplican los guards globales de `AppModule`. El servicio restringe cada
 * consulta al `usuario_id` del JWT y expone métodos transaccionales para que
 * los módulos de trámites creen la notificación junto con su cambio de estado.
 */
@Module({
  imports: [CorreoModule],
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
