import { Module } from '@nestjs/common';
import { CorreoModule } from '../correo/correo.module';
import { GestorController } from './gestor.controller';
import { GestorService } from './gestor.service';

/**
 * Administración de cuentas del gestor municipal.
 *
 * Importa `CorreoModule` para enviar la contraseña temporal de los gestores
 * recién creados. `PrismaModule` es global. La autenticación y la autorización
 * por rol/perfil las aplican los guards globales declarados en `AppModule`.
 */
@Module({
  imports: [CorreoModule],
  controllers: [GestorController],
  providers: [GestorService],
})
export class GestorModule {}
