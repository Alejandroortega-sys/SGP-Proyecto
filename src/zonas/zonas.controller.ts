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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PerfilGestor } from '../auth/decorators/perfil-gestor.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import {
  ActualizarZonaDto,
  CambiarEstadoZonaDto,
  CrearZonaDto,
  ListarZonasQueryDto,
  ListarZonasResponseDto,
  ZonaDetalleDto,
  ZonaEstadoResponseDto,
  ZonaFeatureCollectionDto,
} from './dto/zonas.dto';
import { ZonasService } from './zonas.service';

/** Límite del GeoJSON público: peticiones por minuto y por IP. */
export const LIMITE_ZONAS_GEOJSON = 60;

/** Ventana del rate limit del GeoJSON público, en milisegundos. */
export const VENTANA_ZONAS_GEOJSON_MS = 60_000;

/**
 * Zonas normativas del espacio público.
 *
 * - `GET /zonas` y `GET /zonas/:id`: gestores (revisor y administrador).
 * - `POST /zonas`, `PATCH /zonas/:id` y `PATCH /zonas/:id/estado`: solo
 *   gestores con perfil `administrador`.
 * - `GET /zonas/geojson`: público, con rate limit por IP.
 *
 * La ruta `geojson` se declara antes de `:id` para que Nest no la interprete
 * como un identificador.
 */
@ApiTags('zonas')
@Controller('zonas')
export class ZonasController {
  constructor(private readonly zonas: ZonasService) {}

  /**
   * Devuelve las zonas activas como FeatureCollection para el mapa público.
   */
  @ApiOperation({
    summary: 'GeoJSON público de zonas activas',
    description:
      'Devuelve un FeatureCollection con las zonas activas. Cada feature ' +
      'incluye id, nombre, tipo, horarios, aforo y nombres de productos ' +
      'permitidos. La geometría se genera con ST_AsGeoJSON. No requiere ' +
      'autenticación y está limitado por IP.',
  })
  @ApiOkResponse({ type: ZonaFeatureCollectionDto })
  @ApiTooManyRequestsResponse({
    description: 'Se superó el límite de peticiones por IP',
  })
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: LIMITE_ZONAS_GEOJSON,
      ttl: VENTANA_ZONAS_GEOJSON_MS,
    },
  })
  @Get('geojson')
  geojson(): Promise<ZonaFeatureCollectionDto> {
    return this.zonas.geojson();
  }

  /**
   * Lista las zonas con filtros y conteos.
   */
  @ApiOperation({
    summary: 'Listar zonas',
    description:
      'Devuelve las zonas con filtros por tipo, estado activo y búsqueda por ' +
      'nombre. Incluye el total de espacios temporales y el total de módulos ' +
      'del censo ubicados dentro del polígono. No devuelve la geometría.',
  })
  @ApiOkResponse({ type: ListarZonasResponseDto })
  @ApiBadRequestResponse({ description: 'Parámetros de consulta inválidos' })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({ description: 'El rol del usuario no es gestor' })
  @ApiBearerAuth()
  @Roles('gestor')
  @Get()
  listar(@Query() dto: ListarZonasQueryDto): Promise<ListarZonasResponseDto> {
    return this.zonas.listar(dto);
  }

  /**
   * Devuelve el detalle de una zona.
   */
  @ApiOperation({
    summary: 'Detalle de una zona',
    description:
      'Devuelve los atributos de la zona, su polígono como GeoJSON y los ' +
      'productos permitidos.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la zona',
    example: '1',
  })
  @ApiOkResponse({ type: ZonaDetalleDto })
  @ApiBadRequestResponse({ description: 'Identificador inválido' })
  @ApiNotFoundResponse({ description: 'La zona no existe' })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({ description: 'El rol del usuario no es gestor' })
  @ApiBearerAuth()
  @Roles('gestor')
  @Get(':id')
  detalle(@Param('id') id: string): Promise<ZonaDetalleDto> {
    return this.zonas.detalle(id);
  }

  /**
   * Crea una zona.
   */
  @ApiOperation({
    summary: 'Crear zona',
    description:
      'Crea una zona normativa con su polígono y, opcionalmente, sus ' +
      'productos permitidos. Solo el gestor administrador puede usar este ' +
      'endpoint. El solape y la validez topológica los valida la BD.',
  })
  @ApiCreatedResponse({ type: ZonaDetalleDto })
  @ApiBadRequestResponse({ description: 'Cuerpo o geometría inválidos' })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({
    description: 'El rol no es gestor o el perfil no es administrador',
  })
  @ApiUnprocessableEntityResponse({
    description: 'La BD rechazó la geometría por solape o topología inválida',
  })
  @ApiBearerAuth()
  @Roles('gestor')
  @PerfilGestor('administrador')
  @Post()
  crear(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CrearZonaDto,
  ): Promise<ZonaDetalleDto> {
    return this.zonas.crear(usuario.id, dto);
  }

  /**
   * Activa o desactiva una zona.
   */
  @ApiOperation({
    summary: 'Activar o desactivar una zona',
    description:
      'Cambia el estado lógico de la zona. Solo el gestor administrador ' +
      'puede usar este endpoint. La operación es idempotente.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la zona',
    example: '1',
  })
  @ApiOkResponse({ type: ZonaEstadoResponseDto })
  @ApiBadRequestResponse({ description: 'Identificador o cuerpo inválidos' })
  @ApiNotFoundResponse({ description: 'La zona no existe' })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({
    description: 'El rol no es gestor o el perfil no es administrador',
  })
  @ApiBearerAuth()
  @Roles('gestor')
  @PerfilGestor('administrador')
  @Patch(':id/estado')
  @HttpCode(HttpStatus.OK)
  cambiarEstado(
    @Param('id') id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CambiarEstadoZonaDto,
  ): Promise<ZonaEstadoResponseDto> {
    return this.zonas.cambiarEstado(id, usuario.id, dto);
  }

  /**
   * Edita los campos de una zona.
   */
  @ApiOperation({
    summary: 'Editar zona',
    description:
      'Actualiza los campos enviados de la zona (al menos uno). Si se envía ' +
      'productosPermitidos, reemplaza la lista completa. Solo el gestor ' +
      'administrador puede usar este endpoint.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la zona',
    example: '1',
  })
  @ApiOkResponse({ type: ZonaDetalleDto })
  @ApiBadRequestResponse({
    description: 'Identificador, cuerpo o geometría inválidos',
  })
  @ApiNotFoundResponse({ description: 'La zona no existe' })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({
    description: 'El rol no es gestor o el perfil no es administrador',
  })
  @ApiUnprocessableEntityResponse({
    description: 'La BD rechazó la geometría por solape o topología inválida',
  })
  @ApiBearerAuth()
  @Roles('gestor')
  @PerfilGestor('administrador')
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  actualizar(
    @Param('id') id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: ActualizarZonaDto,
  ): Promise<ZonaDetalleDto> {
    return this.zonas.actualizar(id, usuario.id, dto);
  }
}
