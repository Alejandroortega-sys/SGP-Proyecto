import {
  Body,
  Controller,
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
  AgendaFeriaGestorResponseDto,
  AgendaFeriasQueryDto,
  AprobarFeriaResponseDto,
  CancelarFeriaDto,
  CancelarFeriaResponseDto,
  CrucesFeriaQueryDto,
  CrucesFeriaResponseDto,
  FeriaGestorDetalleDto,
  ListarFeriasGestorQueryDto,
  ListarFeriasGestorResponseDto,
  MoverFeriaDto,
  MoverFeriaResponseDto,
} from './dto/gestor-ferias.dto';
import { GestorFeriasService } from './gestor-ferias.service';

/**
 * Calendario y administración de ferias y eventos (HU-22).
 *
 * Acceso para gestores con perfil revisor o administrador. El rol se valida
 * con el guard global; el servicio aplica las reglas de estado, cruces y
 * bloqueo de espacios.
 */
@ApiTags('gestor')
@ApiBearerAuth()
@Controller('gestor/ferias')
export class GestorFeriasController {
  constructor(private readonly ferias: GestorFeriasService) {}

  @ApiOperation({
    summary: 'Listar ferias para administración',
    description:
      'Devuelve ferias con filtros por estado, zona, rango de fechas y búsqueda, con paginación.',
  })
  @ApiOkResponse({ type: ListarFeriasGestorResponseDto })
  @ApiBadRequestResponse({ description: 'Filtros o paginación inválidos' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Roles('gestor')
  @Get()
  listar(
    @Query() dto: ListarFeriasGestorQueryDto,
  ): Promise<ListarFeriasGestorResponseDto> {
    return this.ferias.listar(dto);
  }

  @ApiOperation({
    summary: 'Agenda de ferias por rango de fechas',
    description:
      'Devuelve las ferias que ocupan el rango, las zonas activas, un resumen por estado y los cruces detectados. Por defecto solo incluye ferias radicadas y aprobadas.',
  })
  @ApiOkResponse({ type: AgendaFeriaGestorResponseDto })
  @ApiBadRequestResponse({ description: 'Rango de fechas inválido' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Roles('gestor')
  @Get('agenda')
  agenda(
    @Query() dto: AgendaFeriasQueryDto,
  ): Promise<AgendaFeriaGestorResponseDto> {
    return this.ferias.agenda(dto);
  }

  @ApiOperation({
    summary: 'Consultar cruces antes de aprobar o mover una feria',
    description:
      'Evalúa una zona y un rango de fechas. Para ferias aprobadas, o si se indica paraAprobacion=true, revisa también los espacios individuales y devuelve sugerencias libres.',
  })
  @ApiParam({ name: 'id', example: '12' })
  @ApiOkResponse({ type: CrucesFeriaResponseDto })
  @ApiBadRequestResponse({ description: 'Fechas o zona inválidas' })
  @ApiNotFoundResponse({ description: 'La feria o la zona no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Roles('gestor')
  @Get(':id/cruces')
  cruces(
    @Param('id') id: string,
    @Query() dto: CrucesFeriaQueryDto,
  ): Promise<CrucesFeriaResponseDto> {
    return this.ferias.cruces(id, dto);
  }

  @ApiOperation({
    summary: 'Detalle administrativo de una feria',
    description:
      'Devuelve la feria, su organizador, productos, documentos, fechas de decisión, motivo de cancelación y espacios bloqueados.',
  })
  @ApiParam({ name: 'id', example: '12' })
  @ApiOkResponse({ type: FeriaGestorDetalleDto })
  @ApiBadRequestResponse({ description: 'Identificador inválido' })
  @ApiNotFoundResponse({ description: 'La feria no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Roles('gestor')
  @Get(':id')
  detalle(@Param('id') id: string): Promise<FeriaGestorDetalleDto> {
    return this.ferias.detalle(id);
  }

  @ApiOperation({
    summary: 'Aprobar una feria y bloquear sus espacios',
    description:
      'Cambia la feria de radicada a aprobada y crea un bloqueo por cada espacio de la zona. Si hay cruces o espacios ocupados responde 409 sin modificar datos.',
  })
  @ApiParam({ name: 'id', example: '12' })
  @ApiOkResponse({ type: AprobarFeriaResponseDto })
  @ApiBadRequestResponse({
    description: 'Fechas, aforo o estado inválidos',
  })
  @ApiNotFoundResponse({ description: 'La feria no existe' })
  @ApiConflictResponse({
    description: 'Cruce de agenda, espacio ocupado o estado incompatible',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Roles('gestor')
  @Post(':id/aprobar')
  @HttpCode(HttpStatus.OK)
  aprobar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ): Promise<AprobarFeriaResponseDto> {
    return this.ferias.aprobar(usuario, id);
  }

  @ApiOperation({
    summary: 'Mover una feria de fechas o de zona',
    description:
      'Actualiza la zona y las fechas de una feria radicada o aprobada. Si estaba aprobada, mueve sus bloqueos de espacios en la misma transacción. Responde 409 si hay cruce.',
  })
  @ApiParam({ name: 'id', example: '12' })
  @ApiOkResponse({ type: MoverFeriaResponseDto })
  @ApiBadRequestResponse({ description: 'Fechas, zona o aforo inválidos' })
  @ApiNotFoundResponse({ description: 'La feria o la zona no existe' })
  @ApiConflictResponse({
    description: 'Cruce de agenda o espacio ocupado',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Roles('gestor')
  @Patch(':id/agenda')
  mover(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body() dto: MoverFeriaDto,
  ): Promise<MoverFeriaResponseDto> {
    return this.ferias.mover(usuario, id, dto);
  }

  @ApiOperation({
    summary: 'Cancelar una feria y liberar sus espacios',
    description:
      'Exige un motivo. Cambia la feria a cancelada, elimina los bloqueos que había creado y notifica al organizador.',
  })
  @ApiParam({ name: 'id', example: '12' })
  @ApiOkResponse({ type: CancelarFeriaResponseDto })
  @ApiBadRequestResponse({ description: 'Motivo obligatorio o inválido' })
  @ApiNotFoundResponse({ description: 'La feria no existe' })
  @ApiConflictResponse({ description: 'La feria no se puede cancelar' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Roles('gestor')
  @Post(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  cancelar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body() dto: CancelarFeriaDto,
  ): Promise<CancelarFeriaResponseDto> {
    return this.ferias.cancelar(usuario, id, dto.motivo);
  }
}
