import { Module } from '@nestjs/common';
import { CorreoModule } from '../correo/correo.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { FeriasController } from './ferias.controller';
import { FeriasService } from './ferias.service';
import { GestorFeriasController } from './gestor-ferias.controller';
import { GestorFeriasService } from './gestor-ferias.service';
import { GestorParticipantesController } from './gestor-participantes.controller';
import { ParticipantesController } from './participantes.controller';
import { ParticipantesService } from './participantes.service';

/**
 * Solicitud de espacio para ferias agroecológicas (HU-21).
 *
 * `PrismaModule` es global. La autenticación y los roles se aplican con los
 * guards globales de `AppModule`.
 */
@Module({
  imports: [CorreoModule, NotificacionesModule],
  controllers: [
    FeriasController,
    GestorFeriasController,
    ParticipantesController,
    GestorParticipantesController,
  ],
  providers: [FeriasService, GestorFeriasService, ParticipantesService],
})
export class FeriasModule {}
