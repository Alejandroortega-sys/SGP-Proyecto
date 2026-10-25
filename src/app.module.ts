import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PerfilGestorGuard } from './auth/guards/perfil-gestor.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { GestorModule } from './gestor/gestor.module';
import { PanelModule } from './panel/panel.module';
import { PerfilModule } from './perfil/perfil.module';
import { PrismaModule } from './prisma/prisma.module';
import { CorreoModule } from './correo/correo.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

@Module({
  imports: [
    // Carga el .env y expone ConfigService de forma global (SMTP, TTL, JWT...).
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CorreoModule,
    AuthModule,
    UsuariosModule,
    PanelModule,
    PerfilModule,
    GestorModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guards globales: el orden importa. Primero se valida el JWT (que
    // adjunta request.usuario), después el rol y por último el perfil de
    // gestor cuando el endpoint lo exige.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Distingue entre perfiles de gestor (revisor/administrador) cuando el
    // endpoint declara @PerfilGestor(...).
    { provide: APP_GUARD, useClass: PerfilGestorGuard },
    // Filtro global: traduce errores de Prisma/PostgreSQL a respuestas HTTP.
    // Al usar APP_FILTER aplica a todos los módulos sin importar nada.
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
