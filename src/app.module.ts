import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import {
  PrismaExceptionFilter,
} from './common/filters/prisma-exception.filter';

@Module({
  imports: [PrismaModule],
  controllers: [AppController],
  providers: [
    AppService,
    // Filtro global: traduce errores de Prisma/PostgreSQL a respuestas HTTP.
    // Al usar APP_FILTER aplica a todos los módulos sin importar nada.
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
