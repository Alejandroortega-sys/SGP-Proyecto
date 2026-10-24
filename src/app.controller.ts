import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './auth/decorators/public.decorator';
import { AppService } from './app.service';

/**
 * Controlador de verificación de la API.
 *
 * Sirve como patrón de referencia para documentar los endpoints nuevos:
 * `@ApiTags` agrupa en Swagger, `@ApiOperation` describe la operación.
 * Ver docs/swagger.md para la guía completa.
 */
@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({ summary: 'Verifica que la API esté en línea' })
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
