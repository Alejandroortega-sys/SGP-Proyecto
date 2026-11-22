import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
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
import {
  LiberarRevisionResponseDto,
  ListarSolicitudesRevisionQueryDto,
  ListarSolicitudesRevisionResponseDto,
  OpcionesRevisionSolicitudesResponseDto,
  RenovarRevisionResponseDto,
  RespuestaVerificarRequisitoDto,
  SolicitudRevisionDetalleDto,
  TomarRevisionResponseDto,
  VerificarRequisitoRevisionDto,
} from './dto/revision-solicitudes.dto';
import { RevisionSolicitudesService } from './revision-solicitudes.service';
import { SolicitudesService } from './solicitudes.service';

/**
 * Revisión documental y cambio de estado de solicitudes desde el panel del
 * gestor (HU-18 y HU-19).
 *
 * La revisión concurrente se controla con un bloqueo por solicitud. La bandeja
 * y el visor permiten verificar cada requisito y devolver la solicitud para
 * corrección; la aprobación y la asignación de espacio pertenecen a HU-20.
 */
@ApiTags('gestor')
@ApiBearerAuth()
@Roles('gestor')
@Controller('gestor/solicitudes')
export class GestorSolicitudesController {
  constructor(
    private readonly solicitudes: SolicitudesService,
    private readonly revision: RevisionSolicitudesService,
  ) {}

  @ApiOperation({
    summary: 'Bandeja de revisión de solicitudes',
    description:
      'Lista las solicitudes para revisión. Sin filtro de estado devuelve las radicadas y en revisión, ordenadas por antigüedad. Admite filtros por estado, sector y actividad permitida del espacio.',
  })
  @ApiOkResponse({ type: ListarSolicitudesRevisionResponseDto })
  @ApiBadRequestResponse({ description: 'Filtros o paginación inválidos' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Get()
  listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query() dto: ListarSolicitudesRevisionQueryDto,
  ): Promise<ListarSolicitudesRevisionResponseDto> {
    return this.revision.listar(usuario, dto);
  }

  @ApiOperation({
    summary: 'Opciones de filtros de la bandeja',
    description:
      'Devuelve los sectores y las actividades permitidas presentes en las solicitudes.',
  })
  @ApiOkResponse({ type: OpcionesRevisionSolicitudesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Get('opciones')
  opciones(): Promise<OpcionesRevisionSolicitudesResponseDto> {
    return this.revision.opciones();
  }

  @ApiOperation({
    summary: 'Detalle de una solicitud para revisión',
    description:
      'Devuelve la solicitud, el comerciante, el historial, el bloqueo activo y la lista de verificación de requisitos. La lectura está permitida aunque otro gestor tenga el bloqueo.',
  })
  @ApiParam({ name: 'id', example: '12' })
  @ApiOkResponse({ type: SolicitudRevisionDetalleDto })
  @ApiBadRequestResponse({ description: 'Identificador inválido' })
  @ApiNotFoundResponse({ description: 'La solicitud no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Get(':id')
  detalle(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ): Promise<SolicitudRevisionDetalleDto> {
    return this.revision.detalle(usuario, id);
  }

  @ApiOperation({
    summary: 'Tomar el bloqueo de revisión',
    description:
      'Crea o renueva el bloqueo del gestor autenticado. Si la solicitud está radicada, la pasa a en revisión, registra historial y notifica al comerciante. Si otro gestor tiene un bloqueo vigente responde 409.',
  })
  @ApiParam({ name: 'id', example: '12' })
  @ApiOkResponse({ type: TomarRevisionResponseDto })
  @ApiBadRequestResponse({ description: 'Identificador inválido' })
  @ApiConflictResponse({
    description: 'La solicitud no admite revisión o está bloqueada por otro gestor',
  })
  @ApiNotFoundResponse({ description: 'La solicitud no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Post(':id/revision')
  @HttpCode(HttpStatus.OK)
  tomarRevision(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ): Promise<TomarRevisionResponseDto> {
    return this.revision.tomarRevision(usuario, id);
  }

  @ApiOperation({
    summary: 'Renovar el bloqueo de revisión',
    description:
      'Extiende la expiración del bloqueo del gestor autenticado. Responde 409 si el bloqueo expiró o pertenece a otro gestor.',
  })
  @ApiParam({ name: 'id', example: '12' })
  @ApiOkResponse({ type: RenovarRevisionResponseDto })
  @ApiConflictResponse({
    description: 'El bloqueo expiró o pertenece a otro gestor',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Patch(':id/revision')
  renovarRevision(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ): Promise<RenovarRevisionResponseDto> {
    return this.revision.renovarRevision(usuario, id);
  }

  @ApiOperation({
    summary: 'Liberar el bloqueo de revisión',
    description:
      'Libera el bloqueo del gestor autenticado sin cambiar el estado de la solicitud.',
  })
  @ApiParam({ name: 'id', example: '12' })
  @ApiOkResponse({ type: LiberarRevisionResponseDto })
  @ApiConflictResponse({
    description: 'El bloqueo pertenece a otro gestor',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Delete(':id/revision')
  liberarRevision(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Query('token') token?: string,
  ): Promise<LiberarRevisionResponseDto> {
    return this.revision.liberarRevision(usuario, id, token);
  }

  @ApiOperation({
    summary: 'Verificar un requisito documental',
    description:
      'Marca el documento vigente del requisito como Cumple o No cumple. «No cumple» exige observación. Solo puede hacerlo el gestor que posee el bloqueo y con la solicitud en revisión.',
  })
  @ApiParam({ name: 'id', example: '12' })
  @ApiParam({ name: 'requisitoId', example: '1' })
  @ApiOkResponse({ type: RespuestaVerificarRequisitoDto })
  @ApiBadRequestResponse({
    description: 'Verificación u observación inválida',
  })
  @ApiConflictResponse({
    description:
      'La solicitud no está en revisión, no tiene bloqueo propio o el requisito no tiene documento',
  })
  @ApiNotFoundResponse({ description: 'La solicitud no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Patch(':id/requisitos/:requisitoId/verificacion')
  verificarRequisito(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Param('requisitoId') requisitoId: string,
    @Body() dto: VerificarRequisitoRevisionDto,
  ): Promise<RespuestaVerificarRequisitoDto> {
    return this.revision.verificarRequisito(
      usuario,
      id,
      requisitoId,
      dto,
    );
  }

  @ApiOperation({
    summary: 'Cambiar el estado de una solicitud',
    description:
      'Aplica una transición válida de la máquina de estados, registra el historial, crea la notificación del comerciante y envía el correo de aviso. Si otro gestor tiene un bloqueo de revisión vigente, la operación se rechaza. Devuelve 400 si falta la observación de devolución o el motivo de rechazo.',
  })
  @ApiParam({ name: 'id', example: '12' })
  @ApiOkResponse({ type: CambiarEstadoSolicitudResponseDto })
  @ApiBadRequestResponse({
    description: 'Estado, observación o motivo inválidos',
  })
  @ApiConflictResponse({
    description:
      'Transición no permitida, solicitud en estado final o bloqueo de otro gestor',
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
