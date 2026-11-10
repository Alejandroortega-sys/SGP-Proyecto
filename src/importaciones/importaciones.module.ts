import { Module } from '@nestjs/common';
import { ModulosModule } from '../modulos/modulos.module';
import { ZonasModule } from '../zonas/zonas.module';
import { AlmacenPrevisualizaciones } from './almacen-previsualizaciones';
import { ImportacionesController } from './importaciones.controller';
import { ImportacionesService } from './importaciones.service';

/** Importación masiva de zonas GeoJSON y módulos CSV (HU-14). */
@Module({
  imports: [ZonasModule, ModulosModule],
  controllers: [ImportacionesController],
  providers: [ImportacionesService, AlmacenPrevisualizaciones],
})
export class ImportacionesModule {}
