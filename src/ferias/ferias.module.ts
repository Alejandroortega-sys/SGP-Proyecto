import { Module } from '@nestjs/common';
import { CorreoModule } from '../correo/correo.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { FeriasController } from './ferias.controller';
import { FeriasService } from './ferias.service';

/**
 * Solicitud de espacio para ferias agroecológicas (HU-21).
 *
 * `PrismaModule` es global. La autenticación y los roles se aplican con los
 * guards globales de `AppModule`.
 */
@Module({
  imports: [CorreoModule, NotificacionesModule],
  controllers: [FeriasController],
  providers: [FeriasService],
})
export class FeriasModule {}
