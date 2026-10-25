import { Module } from '@nestjs/common';
import { CorreoModule } from '../correo/correo.module';
import { PerfilController } from './perfil.controller';
import { PerfilService } from './perfil.service';

/**
 * Perfil del comerciante autenticado (HU-04).
 *
 * No importa `PrismaModule` (global) ni `AuthModule`: la autenticación y el
 * rol la aplican los guards globales (`APP_GUARD` en `AppModule`), aquí solo
 * se declara el `@Roles('comerciante')` del controlador. Sí importa
 * `CorreoModule` para el aviso del cambio de contraseña.
 */
@Module({
  imports: [CorreoModule],
  controllers: [PerfilController],
  providers: [PerfilService],
})
export class PerfilModule {}
