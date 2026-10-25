import { Module } from '@nestjs/common';
import { GestorOrganizacionesController } from './gestor-organizaciones.controller';
import { OrganizadoresController } from './organizadores.controller';
import { OrganizadoresService } from './organizadores.service';

/**
 * Registro y mantenimiento de las organizaciones de feria.
 *
 * Incluye los endpoints del organizador (`/organizadores`) y los del gestor
 * municipal (`/gestor/organizaciones`). `PrismaModule` es global; la
 * autenticación y la autorización las aplican los guards globales de
 * `AppModule`.
 */
@Module({
  controllers: [OrganizadoresController, GestorOrganizacionesController],
  providers: [OrganizadoresService],
})
export class OrganizadoresModule {}
