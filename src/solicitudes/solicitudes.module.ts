import { Module } from '@nestjs/common';
import { CorreoModule } from '../correo/correo.module';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';

/**
 * Radicación de solicitudes de uso temporal del espacio público (HU-16).
 *
 * `PrismaModule` y `CorreoModule` son globales; la autenticación y los roles
 * los aplican los guards globales de `AppModule`.
 */
@Module({
  imports: [CorreoModule],
  controllers: [SolicitudesController],
  providers: [SolicitudesService],
})
export class SolicitudesModule {}
