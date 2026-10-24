import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CorreoModule } from './correo/correo.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import {
  PrismaExceptionFilter,
} from './common/filters/prisma-exception.filter';

@Module({
  imports: [
    // Carga el .env y expone ConfigService de forma global (SMTP, TTL...).
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CorreoModule,
    UsuariosModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Filtro global: traduce errores de Prisma/PostgreSQL a respuestas HTTP.
    // Al usar APP_FILTER aplica a todos los módulos sin importar nada.
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
