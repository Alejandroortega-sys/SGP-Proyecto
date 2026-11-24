import { Controller, Get, Param } from '@nestjs/common';
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
import { ListadoParticipantesGestorDto } from './dto/participantes.dto';
import { ParticipantesService } from './participantes.service';

/**
 * Consulta del listado final de participantes por parte del gestor (HU-23).
 *
 * El listado solo está disponible después de que el organizador lo envía.
 */
@ApiTags('gestor')
@ApiBearerAuth()
@Controller('gestor/ferias')
export class GestorParticipantesController {
  constructor(private readonly participantes: ParticipantesService) {}

  @ApiOperation({
    summary: 'Consultar el listado final de participantes de una feria',
    description:
      'Devuelve los participantes y sus productos. Responde 409 si el organizador todavía no envió el listado final.',
  })
  @ApiParam({ name: 'id', example: '1' })
  @ApiOkResponse({ type: ListadoParticipantesGestorDto })
  @ApiBadRequestResponse({ description: 'Identificador inválido' })
  @ApiNotFoundResponse({ description: 'La feria no existe' })
  @ApiConflictResponse({
    description: 'El organizador todavía no envió el listado final',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Roles('gestor')
  @Get(':id/participantes')
  listar(@Param('id') id: string): Promise<ListadoParticipantesGestorDto> {
    return this.participantes.listarGestor(id);
  }
}
