import { Module } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AvisosVencimientoService } from './avisos-vencimiento.service';
import { GestorPermisosController } from './gestor-permisos.controller';
import { PermisosController } from './permisos.controller';
import { PermisosService } from './permisos.service';
import { VerificacionesController } from './verificaciones.controller';

/**
 * Permisos digitales con código QR (HU-31 a HU-37).
 *
 * - Emisión manual desde solicitudes aprobadas (`POST /gestor/permisos`).
 * - Verificación pública con rate limit (`GET /verificaciones/:qrToken`).
 * - Carné del comerciante con QR y PDF (`/permisos/mios...`).
 * - Suspensión, reactivación y revocación con motivo (HU-35).
 * - Búsqueda y trazabilidad para el gestor (HU-37).
 * - Avisos de vencimiento diarios (HU-34).
 *
 * `ThrottlerGuard` se registra aquí para que se instancie al arrancar y
 * sus hooks de ciclo de vida se ejecuten (patrón de `AuthModule`); se
 * aplica solo en la ruta pública con `@UseGuards(ThrottlerGuard)`.
 */
@Module({
  controllers: [
    GestorPermisosController,
    PermisosController,
    VerificacionesController,
  ],
  providers: [PermisosService, AvisosVencimientoService, ThrottlerGuard],
})
export class PermisosModule {}
