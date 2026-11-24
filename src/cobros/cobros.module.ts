import { Module } from '@nestjs/common';
import { CobrosController } from './cobros.controller';
import { CobrosService } from './cobros.service';

/**
 * Cobros simulados del uso de suelo (HU-36).
 *
 * El cobro se crea dentro de la transacción de emisión del permiso
 * (`PermisosModule`); este módulo expone la consulta, el pago simulado y
 * el recibo del comerciante.
 */
@Module({
  controllers: [CobrosController],
  providers: [CobrosService],
})
export class CobrosModule {}
