import { Module } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ZonasController } from './zonas.controller';
import { ZonasService } from './zonas.service';

/**
 * Zonas normativas del espacio público.
 *
 * `PrismaModule` es global y los guards de autenticación/autorización se
 * aplican desde `AppModule`. `ThrottlerGuard` se registra aquí para el
 * GeoJSON público (ver `ZonasController`).
 */
@Module({
  controllers: [ZonasController],
  providers: [ZonasService, ThrottlerGuard],
})
export class ZonasModule {}
