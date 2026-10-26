import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import {
  ActualizarNotificacionDto,
  ListarNotificacionesQueryDto,
  ListarNotificacionesResponseDto,
  NotificacionResponseDto,
  TodasLeidasResponseDto,
} from './dto/notificaciones.dto';
import { NotificacionesService } from './notificaciones.service';

/**
 * Bandeja de notificaciones del usuario autenticado.
 *
 * Todos los roles activos pueden consultar sus propias notificaciones. El
 * servicio ignora cualquier identificador de usuario que no venga del JWT.
 */
@ApiTags('notificaciones')
@ApiBearerAuth()
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificaciones: NotificacionesService) {}

  /**
   * Lista las notificaciones del usuario autenticado.
   */
  @ApiOperation({
    summary: 'Listar mis notificaciones',
    description:
      'Devuelve las notificaciones del usuario autenticado, de la más ' +
      'reciente a la más antigua, con paginación y filtro por estado de ' +
      'lectura. Incluye el total de notificaciones no leídas.',
  })
  @ApiOkResponse({ type: ListarNotificacionesResponseDto })
  @ApiBadRequestResponse({ description: 'Parámetros de consulta inválidos' })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @Get()
  listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query() dto: ListarNotificacionesQueryDto,
  ): Promise<ListarNotificacionesResponseDto> {
    return this.notificaciones.listar(usuario.id, dto);
  }

  /**
   * Marca todas las notificaciones no leídas como leídas.
   */
  @ApiOperation({
    summary: 'Marcar todas mis notificaciones como leídas',
    description:
      'Marca como leídas todas las notificaciones pendientes del usuario ' +
      'autenticado. Devuelve cuántas se actualizaron.',
  })
  @ApiOkResponse({ type: TodasLeidasResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @Patch('leer-todas')
  @HttpCode(HttpStatus.OK)
  leerTodas(
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<TodasLeidasResponseDto> {
    return this.notificaciones.marcarTodasLeidas(usuario.id);
  }

  /**
   * Marca una notificación propia como leída o no leída.
   */
  @ApiOperation({
    summary: 'Actualizar el estado de lectura de una notificación',
    description:
      'Marca como leída (por defecto) o no leída una notificación del ' +
      'usuario autenticado. Una notificación de otro usuario responde 404.',
  })
  @ApiOkResponse({ type: NotificacionResponseDto })
  @ApiBadRequestResponse({ description: 'Identificador o cuerpo inválidos' })
  @ApiNotFoundResponse({ description: 'La notificación no existe' })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @Patch(':id/leida')
  @HttpCode(HttpStatus.OK)
  actualizarLeida(
    @Param('id') id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: ActualizarNotificacionDto,
  ): Promise<NotificacionResponseDto> {
    return this.notificaciones.marcarLeida(
      id,
      usuario.id,
      dto.leida ?? true,
    );
  }
}
