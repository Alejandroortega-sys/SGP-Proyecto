import { Controller, Get, Ip, Param, UseGuards } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { VerificacionQrResponseDto } from './dto/permisos.dto';
import { PermisosService } from './permisos.service';

/**
 * Límite por defecto de la verificación pública: 30 peticiones por IP.
 *
 * El endpoint no exige sesión y responde datos mínimos (AGENTS §9.5), pero
 * sigue siendo consultable por bots: se limita por IP igual que el login y
 * el mapa público.
 */
export const LIMITE_VERIFICACIONES = 30;

/** Ventana del rate limit de la verificación: 1 minuto. */
export const VENTANA_VERIFICACIONES_MS = 60_000;

/**
 * Verificación pública de permisos por QR (HU-33).
 *
 * Sin `JwtAuthGuard` (endpoint `@Public()`) y con rate limit por IP.
 * Responde validez, estado, vigencia, categoría y nombre del titular
 * comercial; jamás documento, contacto, dirección ni el motivo interno del
 * gestor (decisión D7). Cada consulta se registra en `verificaciones_qr`.
 */
@ApiTags('verificaciones')
@Controller('verificaciones')
export class VerificacionesController {
  constructor(private readonly permisos: PermisosService) {}

  @ApiOperation({
    summary: 'Verificar la legalidad de un puesto por el código QR',
    description:
      'Consulta pública sin sesión. «Válido» exige estado vigente y fecha ' +
      'dentro de la vigencia; un permiso suspendido, revocado o con vigencia ' +
      'vencida responde «no vigente» con su estado. Un token inexistente o ' +
      'mal formado responde 404 «Permiso no encontrado». Sin datos ' +
      'sensibles del titular (AGENTS §9.5).',
  })
  @ApiParam({
    name: 'qrToken',
    example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934c',
    description: 'Token hex de 48 caracteres impreso en el QR del carné.',
  })
  @ApiOkResponse({
    type: VerificacionQrResponseDto,
    description: 'Resultado de la verificación (válido o no vigente).',
  })
  @ApiNotFoundResponse({ description: 'Permiso no encontrado' })
  @ApiTooManyRequestsResponse({
    description: 'Se superó el límite de verificaciones por IP',
  })
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: LIMITE_VERIFICACIONES,
      ttl: VENTANA_VERIFICACIONES_MS,
    },
  })
  @Get(':qrToken')
  verificar(
    @Param('qrToken') qrToken: string,
    @Ip() ip: string,
  ): Promise<VerificacionQrResponseDto> {
    return this.permisos.verificar(qrToken, ip ?? null);
  }
}
