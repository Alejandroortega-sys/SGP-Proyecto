import { Module } from '@nestjs/common';
import { ModulosController } from './modulos.controller';
import { ModulosService } from './modulos.service';

/** Censo de módulos y puestos de comercio formal e informal (HU-13). */
@Module({
  controllers: [ModulosController],
  providers: [ModulosService],
})
export class ModulosModule {}
