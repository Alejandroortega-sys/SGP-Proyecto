import { Module } from '@nestjs/common';
import { PanelController } from './panel.controller';
import { PanelService } from './panel.service';

/**
 * Panel administrativo del gestor municipal.
 *
 * No importa `PrismaModule` (es global, ver docs/uso_db.md §1) ni `AuthModule`
 * porque la autenticación y la autorización por rol la hacen los guards
 * globales declarados como `APP_GUARD` en `AppModule`; aquí solo se declara
 * el `@Roles('gestor')` del controlador.
 */
@Module({
  controllers: [PanelController],
  providers: [PanelService],
})
export class PanelModule {}
