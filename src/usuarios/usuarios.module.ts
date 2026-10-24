import { Module } from '@nestjs/common';
import { CorreoModule } from '../correo/correo.module';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

/**
 * Registro y activación de comerciantes (HU-01).
 *
 * No requiere importar PrismaModule: PrismaService es global.
 */
@Module({
  imports: [CorreoModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
})
export class UsuariosModule {}
