import { Module } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CorreoModule } from '../correo/correo.module';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

/**
 * Registro, activación y recuperación de contraseña de los usuarios.
 *
 * No requiere importar PrismaModule: PrismaService es global. Tampoco
 * importa ThrottlerModule: se registra en AuthModule y es `@Global`, así
 * que el guard de rate limit de los endpoints de contraseña resuelve sus
 * dependencias; declararlo aquí garantiza su instanciación y ciclo de vida
 * en este módulo.
 */
@Module({
  imports: [CorreoModule],
  controllers: [UsuariosController],
  providers: [UsuariosService, ThrottlerGuard],
})
export class UsuariosModule {}
