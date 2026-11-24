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
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
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
  ActualizarParticipanteFeriaDto,
  CrearParticipanteFeriaDto,
  EnviarListadoParticipantesResponseDto,
  ListadoParticipantesFeriaDto,
  ParticipanteFeriaDto,
} from './dto/participantes.dto';
import { ParticipantesService } from './participantes.service';

/**
 * Participantes de una feria (HU-23).
 *
 * Solo el organizador dueño gestiona la lista mientras la feria está aprobada
 * y el listado final no se ha enviado.
 */
@ApiTags('ferias')
@ApiBearerAuth()
@Controller('ferias')
export class ParticipantesController {
  constructor(private readonly participantes: ParticipantesService) {}

  @ApiOperation({
    summary: 'Listar los participantes de una feria propia',
    description:
      'Devuelve el cupo aprobado, los productos permitidos por la zona, los participantes activos y el estado del listado final.',
  })
  @ApiParam({ name: 'id', example: '1' })
  @ApiOkResponse({ type: ListadoParticipantesFeriaDto })
  @ApiBadRequestResponse({ description: 'Identificador inválido' })
  @ApiNotFoundResponse({
    description: 'La feria no existe o no pertenece al organizador',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es organizador' })
  @Roles('organizador')
  @Get(':id/participantes')
  listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ): Promise<ListadoParticipantesFeriaDto> {
    return this.participantes.listar(usuario.id, id);
  }

  @ApiOperation({
    summary: 'Registrar un participante',
    description:
      'Valida que la feria esté aprobada, que el listado no se haya enviado, que haya cupo y que los productos estén permitidos en la zona.',
  })
  @ApiParam({ name: 'id', example: '1' })
  @ApiCreatedResponse({ type: ParticipanteFeriaDto })
  @ApiBadRequestResponse({
    description: 'Datos inválidos o productos no permitidos',
  })
  @ApiConflictResponse({
    description: 'Feria no aprobada, listado enviado, cupo lleno o documento duplicado',
  })
  @ApiNotFoundResponse({ description: 'La feria no existe o no te pertenece' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es organizador' })
  @Roles('organizador')
  @Post(':id/participantes')
  crear(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body() dto: CrearParticipanteFeriaDto,
  ): Promise<ParticipanteFeriaDto> {
    return this.participantes.crear(usuario.id, id, dto);
  }

  @ApiOperation({
    summary: 'Enviar el listado final de participantes',
    description:
      'Exige al menos un participante activo y bloquea nuevas altas, ediciones o bajas.',
  })
  @ApiParam({ name: 'id', example: '1' })
  @ApiOkResponse({ type: EnviarListadoParticipantesResponseDto })
  @ApiBadRequestResponse({ description: 'El listado no tiene participantes' })
  @ApiConflictResponse({
    description: 'La feria no está aprobada o el listado ya fue enviado',
  })
  @ApiNotFoundResponse({ description: 'La feria no existe o no te pertenece' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es organizador' })
  @Roles('organizador')
  @Post(':id/participantes/enviar')
  @HttpCode(HttpStatus.OK)
  enviar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ): Promise<EnviarListadoParticipantesResponseDto> {
    return this.participantes.enviar(usuario.id, id);
  }

  @ApiOperation({
    summary: 'Editar un participante',
    description:
      'Permite cambiar nombre, documento y productos mientras el listado final no se haya enviado.',
  })
  @ApiParam({ name: 'id', example: '1' })
  @ApiParam({ name: 'participanteId', example: '1' })
  @ApiOkResponse({ type: ParticipanteFeriaDto })
  @ApiBadRequestResponse({
    description: 'Datos inválidos o productos no permitidos',
  })
  @ApiConflictResponse({
    description: 'Feria no aprobada, listado enviado o documento duplicado',
  })
  @ApiNotFoundResponse({ description: 'La feria o el participante no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es organizador' })
  @Roles('organizador')
  @Patch(':id/participantes/:participanteId')
  actualizar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Param('participanteId') participanteId: string,
    @Body() dto: ActualizarParticipanteFeriaDto,
  ): Promise<ParticipanteFeriaDto> {
    return this.participantes.actualizar(
      usuario.id,
      id,
      participanteId,
      dto,
    );
  }

  @ApiOperation({
    summary: 'Retirar un participante',
    description:
      'Baja lógica: deja de aparecer en la lista y libera cupo, pero se conserva para trazabilidad.',
  })
  @ApiParam({ name: 'id', example: '1' })
  @ApiParam({ name: 'participanteId', example: '1' })
  @ApiNoContentResponse({ description: 'Participante retirado' })
  @ApiConflictResponse({
    description: 'Feria no aprobada o listado enviado',
  })
  @ApiNotFoundResponse({ description: 'La feria o el participante no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es organizador' })
  @Roles('organizador')
  @Delete(':id/participantes/:participanteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Param('participanteId') participanteId: string,
  ): Promise<void> {
    return this.participantes.eliminar(usuario.id, id, participanteId);
  }
}
