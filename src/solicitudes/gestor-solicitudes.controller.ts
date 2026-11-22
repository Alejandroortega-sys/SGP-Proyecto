import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import {
  CambiarEstadoSolicitudDto,
  CambiarEstadoSolicitudResponseDto,
} from './dto/estado-solicitud.dto';
import { SolicitudesService } from './solicitudes.service';

/**
 * Cambios de estado de solicitudes desde el panel del gestor (HU-18).
 *
 * El alcance es el mínimo necesario para disparar las notificaciones de
 * seguimiento del comerciante. La revisión documental y la asignación de
 * espacio de HU-19/HU-20 se apoyarán en este mismo servicio.
 */
@ApiTags('gestor')
@ApiBearerAuth()
@Roles('gestor')
@Controller('gestor/solicitudes')
export class GestorSolicitudesController {
  constructor(private readonly solicitudes: SolicitudesService) {}

  @ApiOperation({
    summary: 'Cambiar el estado de una solicitud',
    description:
      'Aplica una transición válida de la máquina de estados, registra el historial, crea la notificación del comerciante y envía el correo de aviso. Devuelve el error 400 si falta la observación de devolución o el motivo de rechazo.',
  })
  @ApiParam({ name: 'id', example: '12' })
  @ApiOkResponse({ type: CambiarEstadoSolicitudResponseDto })
  @ApiBadRequestResponse({
    description: 'Estado, observación o motivo inválidos',
  })
  @ApiConflictResponse({
    description: 'Transición no permitida o solicitud en estado final',
  })
  @ApiNotFoundResponse({ description: 'La solicitud no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Patch(':id/estado')
  @HttpCode(HttpStatus.OK)
  cambiarEstado(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body() dto: CambiarEstadoSolicitudDto,
  ): Promise<CambiarEstadoSolicitudResponseDto> {
    return this.solicitudes.cambiarEstado(usuario, id, dto);
  }
}
