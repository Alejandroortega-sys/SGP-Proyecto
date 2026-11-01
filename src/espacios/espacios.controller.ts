import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  DetalleEspacioQueryDto,
  EspacioDetalleDto,
  ListarEspaciosQueryDto,
  ListarEspaciosResponseDto,
  OpcionesEspaciosResponseDto,
} from './dto/espacios.dto';
import { EspaciosService } from './espacios.service';

/**
 * Consulta de espacios temporales para comerciantes (HU-09).
 *
 * - `GET /espacios`: espacios disponibles para el mapa y la tabla. Con
 *   `incluirNoDisponibles=true` incluye los demás estados para consultar su
 *   ficha sin presentarlos como disponibles.
 * - `GET /espacios/:id`: ficha completa con las restricciones de su zona.
 *
 * Ambos endpoints exigen una cuenta de comerciante activa.
 */
@ApiTags('espacios')
@ApiBearerAuth()
@Roles('comerciante')
@Controller('espacios')
export class EspaciosController {
  constructor(private readonly espacios: EspaciosService) {}

  @ApiOperation({
    summary: 'Listar espacios disponibles',
    description:
      'Devuelve los espacios disponibles con su ubicación GeoJSON y su estado. ' +
      'El estado efectivo cruza bloqueos de fechas, permisos vigentes y ' +
      'solicitudes aprobadas: un espacio ocupado o bloqueado no se devuelve ' +
      'como disponible. Con `incluirNoDisponibles=true` se incluyen todos los ' +
      'estados para consultar su ficha.',
  })
  @ApiOkResponse({ type: ListarEspaciosResponseDto })
  @ApiBadRequestResponse({ description: 'Parámetros de consulta inválidos' })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({ description: 'El rol del usuario no es comerciante' })
  @Get()
  listar(
    @Query() dto: ListarEspaciosQueryDto,
  ): Promise<ListarEspaciosResponseDto> {
    return this.espacios.listar(dto);
  }

  @ApiOperation({
    summary: 'Opciones de filtros de espacios',
    description:
      'Devuelve las listas cerradas de sectores y actividades registradas en ' +
      'el catálogo de espacios. Se usan para construir el panel de filtros y ' +
      'no dependen de los filtros aplicados.',
  })
  @ApiOkResponse({ type: OpcionesEspaciosResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({ description: 'El rol del usuario no es comerciante' })
  @Get('opciones')
  opciones(): Promise<OpcionesEspaciosResponseDto> {
    return this.espacios.opciones();
  }

  @ApiOperation({
    summary: 'Ficha detallada de un espacio',
    description:
      'Devuelve tipo, sector, dimensiones, horario, estado registrado y ' +
      'efectivo, bloqueo u ocupación vigente, y las restricciones de la zona ' +
      '(tipo, horario, aforo y productos permitidos). Funciona también para ' +
      'espacios bloqueados, asignados o en mantenimiento.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador del espacio',
    example: '1',
  })
  @ApiOkResponse({ type: EspacioDetalleDto })
  @ApiBadRequestResponse({ description: 'Identificador o fecha inválidos' })
  @ApiNotFoundResponse({ description: 'El espacio no existe' })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({ description: 'El rol del usuario no es comerciante' })
  @Get(':id')
  detalle(
    @Param('id') id: string,
    @Query() dto: DetalleEspacioQueryDto,
  ): Promise<EspacioDetalleDto> {
    return this.espacios.detalle(id, dto);
  }
}
