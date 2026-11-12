import { Module } from '@nestjs/common';
import { EspaciosController } from './espacios.controller';
import { EspaciosService } from './espacios.service';
import { GestorEspaciosController } from './gestor-espacios.controller';
import { GestorEspaciosService } from './gestor-espacios.service';

/**
 * Módulo de espacios temporales.
 *
 * - `EspaciosController`: consulta del comerciante (HU-09).
 * - `GestorEspaciosController`: catálogo, bloqueos y estados (HU-15).
 *
 * `PrismaModule` es global y los guards de autenticación/autorización se
 * aplican desde `AppModule`.
 */
@Module({
  controllers: [EspaciosController, GestorEspaciosController],
  providers: [EspaciosService, GestorEspaciosService],
})
export class EspaciosModule {}
