import { Module } from '@nestjs/common';
import { CorreoModule } from '../correo/correo.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { GestorSolicitudesController } from './gestor-solicitudes.controller';
import { RevisionSolicitudesService } from './revision-solicitudes.service';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';

/**
 * Radicación, seguimiento y resolución de solicitudes de uso temporal.
 *
 * - `SolicitudesController`: radicación, documentos y seguimiento del
 *   comerciante (HU-16 a HU-18).
 * - `GestorSolicitudesController`: transiciones de estado del gestor (HU-18).
 *
 * `PrismaModule` es global; la autenticación y los roles los aplican los
 * guards globales de `AppModule`.
 */
@Module({
  imports: [CorreoModule, NotificacionesModule],
  controllers: [SolicitudesController, GestorSolicitudesController],
  providers: [SolicitudesService, RevisionSolicitudesService],
})
export class SolicitudesModule {}
