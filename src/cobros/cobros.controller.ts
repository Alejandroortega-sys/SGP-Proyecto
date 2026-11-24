import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import {
  ListarMisCobrosQueryDto,
  ListarMisCobrosResponseDto,
  PagarCobroResponseDto,
} from './dto/cobros.dto';
import { CobrosService } from './cobros.service';

/**
 * Cobros del uso de suelo del comerciante (HU-36).
 *
 * El pago es SIEMPRE simulado (AGENTS §9.12): no hay pasarela ni datos de
 * tarjeta; confirmar el pago basta para pasar el cobro a «pagado» y
 * habilitar el recibo. Todo se filtra por el titular del JWT (IDOR).
 */
@ApiTags('cobros')
@ApiBearerAuth()
@Roles('comerciante')
@Controller('cobros')
export class CobrosController {
  constructor(private readonly cobros: CobrosService) {}

  @ApiOperation({
    summary: 'Mis cobros de uso de suelo',
    description:
      'Lista los cobros de los permisos del comercio autenticado con su ' +
      'valor (NUMERIC como string), estado (pendiente | pagado | anulado) ' +
      'y la URL del recibo cuando ya se pagó. Paginación estándar.',
  })
  @ApiOkResponse({ type: ListarMisCobrosResponseDto })
  @ApiBadRequestResponse({ description: 'Paginación inválida' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es comerciante' })
  @Get('mios')
  listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query() dto: ListarMisCobrosQueryDto,
  ): Promise<ListarMisCobrosResponseDto> {
    return this.cobros.listar(usuario, dto);
  }

  @ApiOperation({
    summary: 'Confirmar el pago simulado de un cobro',
    description:
      'Registra el pago SIMULADO del cobro pendiente: pasa a «pagado», ' +
      'estampa la fecha y habilita el recibo descargable. No se integra ' +
      'ninguna pasarela ni se piden datos de tarjeta. Solo el titular del ' +
      'permiso puede pagarlo; un cobro ya pagado responde 409.',
  })
  @ApiParam({ name: 'id', example: '1' })
  @ApiOkResponse({ type: PagarCobroResponseDto })
  @ApiBadRequestResponse({ description: 'Identificador inválido' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es comerciante' })
  @ApiNotFoundResponse({
    description: 'El cobro no existe o no pertenece a su cuenta',
  })
  @ApiConflictResponse({ description: 'El cobro ya está pagado' })
  @ApiUnprocessableEntityResponse({
    description: 'El cobro está anulado o no está pendiente',
  })
  @HttpCode(HttpStatus.OK)
  @Post('mios/:id/pago')
  pagar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ): Promise<PagarCobroResponseDto> {
    return this.cobros.pagar(usuario, id);
  }

  @ApiOperation({
    summary: 'Descargar el recibo del pago simulado en PDF',
    description:
      'Genera el recibo en PDF del cobro pagado, con el aviso visible de ' +
      'que el pago es simulado. Solo el titular del permiso puede ' +
      'descargarlo y solo tras registrar el pago.',
  })
  @ApiParam({ name: 'id', example: '1' })
  @ApiOkResponse({
    description: 'Archivo PDF adjunto (Content-Disposition).',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiBadRequestResponse({ description: 'Identificador inválido' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es comerciante' })
  @ApiNotFoundResponse({
    description: 'El cobro no existe o no pertenece a su cuenta',
  })
  @ApiUnprocessableEntityResponse({
    description: 'El recibo requiere que el cobro esté pagado',
  })
  @Get('mios/:id/recibo')
  async recibo(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<StreamableFile> {
    const { buffer, nombreArchivo } = await this.cobros.reciboMio(usuario, id);
    respuesta.status(HttpStatus.OK);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${nombreArchivo}"`,
    });
  }
}
