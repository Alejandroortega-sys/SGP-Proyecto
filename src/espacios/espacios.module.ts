import { Module } from '@nestjs/common';
import { EspaciosController } from './espacios.controller';
import { EspaciosService } from './espacios.service';

/**
 * Módulo de consulta de espacios temporales (HU-09).
 *
 * `PrismaModule` es global y los guards de autenticación/autorización se
 * aplican desde `AppModule`. El módulo solo expone lectura.
 */
@Module({
  controllers: [EspaciosController],
  providers: [EspaciosService],
})
export class EspaciosModule {}
