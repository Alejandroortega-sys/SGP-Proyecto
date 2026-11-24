import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import {
  CambiarEstadoPermisoDto,
  CambiarEstadoPermisoResponseDto,
  EmitirPermisoDto,
  EmitirPermisoResponseDto,
  ListarPermisosGestorQueryDto,
  ListarPermisosGestorResponseDto,
  PermisoGestorDetalleDto,
  TrazabilidadPermisoResponseDto,
} from './dto/permisos.dto';
import { PermisosService } from './permisos.service';

/**
 * Permisos digitales desde el panel del gestor (HU-31, HU-35 y HU-37).
 *
 * La emisión es manual sobre solicitudes aprobadas (decisión D1). La
 * auditoría del ciclo de vida la escribe el trigger de la BD; aquí solo se
 * leen `permiso_eventos` para la trazabilidad.
 */
@ApiTags('gestor')
@ApiBearerAuth()
@Roles('gestor')
@Controller('gestor/permisos')
export class GestorPermisosController {
  constructor(private readonly permisos: PermisosService) {}

  @ApiOperation({
    summary: 'Emitir el permiso digital de una solicitud aprobada',
    description:
      'Crea el permiso con número consecutivo y token QR únicos generados ' +
      'por la base de datos (nunca se envían en la petición). Valida que la ' +
      'solicitud exista y esté aprobada, con espacio asignado y sin permiso ' +
      'previo; la restricción de exclusión de la BD impide asignar el mismo ' +
      'espacio en fechas solapadas (409). Si hay tarifa vigente, crea el ' +
      'cobro pendiente del permiso (HU-36) y notifica al titular el carné ' +
      'disponible. `renovadoDesde` enlaza el permiso nuevo con el anterior ' +
      'cuando la solicitud aprobada es una renovación (HU-34).',
  })
  @ApiParam({
    name: 'solicitudId',
    example: '12',
    description: 'Identificador de la solicitud aprobada.',
  })
  @ApiCreatedResponse({
    type: EmitirPermisoResponseDto,
    description: 'Permiso emitido con número, QR y datos del carné.',
  })
  @ApiBadRequestResponse({ description: 'Cuerpo inválido (DTO)' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @ApiNotFoundResponse({
    description: 'La solicitud (o el permiso de origen) no existe',
  })
  @ApiConflictResponse({
    description:
      'La solicitud ya tiene permiso o el espacio ya está asignado en esas fechas',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'La solicitud no está aprobada o no tiene espacio asignado; el permiso ' +
      'de origen pertenece a otro titular',
  })
  @Post()
  emitir(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: EmitirPermisoDto,
  ): Promise<EmitirPermisoResponseDto> {
    return this.permisos.emitir(usuario, dto);
  }

  @ApiOperation({
    summary: 'Listar permisos con búsqueda y filtros',
    description:
      'Búsqueda parcial por número de permiso, nombre del titular o nombre ' +
      'del espacio (sin distinguir mayúsculas) y filtros por estado y rango ' +
      'de fechas de vigencia (permisos cuya vigencia cruza el rango). ' +
      'Paginación estándar ?pagina=1&limite=20.',
  })
  @ApiOkResponse({ type: ListarPermisosGestorResponseDto })
  @ApiBadRequestResponse({ description: 'Filtros o paginación inválidos' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Get()
  listar(
    @Query() dto: ListarPermisosGestorQueryDto,
  ): Promise<ListarPermisosGestorResponseDto> {
    return this.permisos.listar(dto);
  }

  @ApiOperation({
    summary: 'Trazabilidad de un permiso',
    description:
      'Devuelve el permiso, su ciclo de vida completo en orden cronológico ' +
      '(emisión, suspensiones, reactivaciones y revocaciones con motivo, ' +
      'autor y fecha, escritos por el trigger de la BD) y el conteo de ' +
      'verificaciones ciudadanas por QR con la fecha de la última.',
  })
  @ApiParam({ name: 'id', example: '8' })
  @ApiOkResponse({ type: TrazabilidadPermisoResponseDto })
  @ApiBadRequestResponse({ description: 'Identificador inválido' })
  @ApiNotFoundResponse({ description: 'El permiso no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Get(':id/trazabilidad')
  trazabilidad(
    @Param('id') id: string,
  ): Promise<TrazabilidadPermisoResponseDto> {
    return this.permisos.trazabilidad(id);
  }

  @ApiOperation({
    summary: 'Detalle de un permiso',
    description:
      'Datos completos del permiso, el permiso del que nace por renovación, ' +
      'las renovaciones emitidas a partir de él y el estado de su cobro.',
  })
  @ApiParam({ name: 'id', example: '8' })
  @ApiOkResponse({ type: PermisoGestorDetalleDto })
  @ApiBadRequestResponse({ description: 'Identificador inválido' })
  @ApiNotFoundResponse({ description: 'El permiso no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Get(':id')
  detalle(@Param('id') id: string): Promise<PermisoGestorDetalleDto> {
    return this.permisos.detalle(id);
  }

  @ApiOperation({
    summary: 'Suspender, reactivar o revocar un permiso',
    description:
      'Cambia el estado del permiso con motivo obligatorio para suspender o ' +
      'revocar (lo valida el DTO y lo exige el trigger de la BD vía ' +
      'app.motivo). Solo se admite reactivar («vigente») un permiso ' +
      'suspendido; revocado y vencido son finales. El historial queda en ' +
      'permiso_eventos y el titular recibe una notificación. El cambio se ' +
      'refleja de inmediato en la verificación pública del QR.',
  })
  @ApiParam({ name: 'id', example: '8' })
  @ApiOkResponse({ type: CambiarEstadoPermisoResponseDto })
  @ApiBadRequestResponse({ description: 'Cuerpo inválido (DTO)' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @ApiNotFoundResponse({ description: 'El permiso no existe' })
  @ApiUnprocessableEntityResponse({
    description:
      'Falta el motivo o la transición no está permitida por el estado actual',
  })
  @Patch(':id/estado')
  cambiarEstado(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body() dto: CambiarEstadoPermisoDto,
  ): Promise<CambiarEstadoPermisoResponseDto> {
    return this.permisos.cambiarEstado(usuario, id, dto);
  }
}
