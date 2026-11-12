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
  ActualizarBloqueoDto,
  ActualizarEspacioDto,
  BloqueoEspacioGestorDto,
  CambiarEstadoEspacioDto,
  CrearBloqueoDto,
  CrearEspacioDto,
  DetalleEspacioGestorQueryDto,
  EspacioAsignacionResponseDto,
  EspacioEstadoResponseDto,
  EspacioGestorDetalleDto,
  HistorialEspacioQueryDto,
  HistorialEspacioResponseDto,
  ListarBloqueosResponseDto,
  ListarEspaciosGestorQueryDto,
  ListarEspaciosGestorResponseDto,
  MovimientoEspacioDto,
  OpcionesEspaciosGestorResponseDto,
  ZonaContenedoraEspacioResponseDto,
  ZonaEspacioQueryDto,
} from './dto/gestor-espacios.dto';
import { GestorEspaciosService } from './gestor-espacios.service';

/**
 * Administración del catálogo de espacios temporales y sus bloqueos (HU-15).
 *
 * La consulta pública/comerciante sigue en `/espacios`; esta ruta es exclusiva
 * de gestores con perfil revisor o administrador.
 */
@ApiTags('gestor-espacios')
@ApiBearerAuth()
@Roles('gestor')
@Controller('gestor/espacios')
export class GestorEspaciosController {
  constructor(private readonly espacios: GestorEspaciosService) {}

  @ApiOperation({
    summary: 'Opciones de filtros del catálogo de espacios',
    description:
      'Devuelve los tipos, estados, zonas activas y sectores registrados para construir los filtros del catálogo.',
  })
  @ApiOkResponse({ type: OpcionesEspaciosGestorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Get('opciones')
  opciones(): Promise<OpcionesEspaciosGestorResponseDto> {
    return this.espacios.opciones();
  }

  @ApiOperation({
    summary: 'Listar espacios temporales',
    description:
      'Lista el catálogo con filtros por búsqueda, tipo, estado, sector, zona y asignación manual. El estado efectivo se calcula para la fecha consultada.',
  })
  @ApiOkResponse({ type: ListarEspaciosGestorResponseDto })
  @ApiBadRequestResponse({ description: 'Parámetros de consulta inválidos' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Get()
  listar(
    @Query() dto: ListarEspaciosGestorQueryDto,
  ): Promise<ListarEspaciosGestorResponseDto> {
    return this.espacios.listar(dto);
  }

  @ApiOperation({
    summary: 'Consultar la zona activa que contiene un punto',
    description:
      'Devuelve la zona activa que contiene las coordenadas y el nombre sugerido para el sector. Se usa en el formulario antes de guardar.',
  })
  @ApiOkResponse({ type: ZonaContenedoraEspacioResponseDto })
  @ApiBadRequestResponse({ description: 'Coordenadas inválidas' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Get('zona-contenedora')
  zonaContenedora(
    @Query() dto: ZonaEspacioQueryDto,
  ): Promise<ZonaContenedoraEspacioResponseDto> {
    return this.espacios.zonaContenedora(dto.lat, dto.lng);
  }

  @ApiOperation({
    summary: 'Listar bloqueos de un espacio',
    description:
      'Devuelve todos los bloqueos del espacio, ordenados del más reciente al más antiguo.',
  })
  @ApiParam({ name: 'id', example: '7' })
  @ApiOkResponse({ type: ListarBloqueosResponseDto })
  @ApiBadRequestResponse({ description: 'Identificador inválido' })
  @ApiNotFoundResponse({ description: 'El espacio no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Get(':id/bloqueos')
  listarBloqueos(
    @Param('id') id: string,
  ): Promise<ListarBloqueosResponseDto> {
    return this.espacios.listarBloqueos(id);
  }

  @ApiOperation({
    summary: 'Historial de auditoría de un espacio',
    description:
      'Devuelve los eventos del espacio y de sus bloqueos, con actor y fecha. Incluye el alta, ediciones, cambios de estado y bloqueos.',
  })
  @ApiParam({ name: 'id', example: '7' })
  @ApiOkResponse({ type: HistorialEspacioResponseDto })
  @ApiBadRequestResponse({ description: 'Identificador o paginación inválidos' })
  @ApiNotFoundResponse({ description: 'El espacio no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Get(':id/historial')
  historial(
    @Param('id') id: string,
    @Query() dto: HistorialEspacioQueryDto,
  ): Promise<HistorialEspacioResponseDto> {
    return this.espacios.historial(id, dto.pagina ?? 1, dto.limite ?? 20);
  }

  @ApiOperation({
    summary: 'Ficha de un espacio temporal',
    description:
      'Devuelve los datos del espacio, su zona, los bloqueos y el estado efectivo para la fecha consultada.',
  })
  @ApiParam({ name: 'id', example: '7' })
  @ApiOkResponse({ type: EspacioGestorDetalleDto })
  @ApiBadRequestResponse({ description: 'Identificador o fecha inválidos' })
  @ApiNotFoundResponse({ description: 'El espacio no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Get(':id')
  detalle(
    @Param('id') id: string,
    @Query() dto: DetalleEspacioGestorQueryDto,
  ): Promise<EspacioGestorDetalleDto> {
    return this.espacios.detalle(id, dto);
  }

  @ApiOperation({
    summary: 'Crear un espacio temporal',
    description:
      'Crea un espacio con punto, tipo, dimensiones, horario y estado inicial. La zona se detecta automáticamente desde el punto.',
  })
  @ApiCreatedResponse({ type: EspacioGestorDetalleDto })
  @ApiBadRequestResponse({ description: 'Datos o geometría inválidos' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Post()
  crear(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CrearEspacioDto,
  ): Promise<EspacioGestorDetalleDto> {
    return this.espacios.crear(usuario.id, dto);
  }

  @ApiOperation({
    summary: 'Cambiar el estado manual de un espacio',
    description:
      'Permite fijar disponible o mantenimiento. Bloqueado y asignado se derivan de bloqueos, permisos, solicitudes y asignaciones manuales.',
  })
  @ApiParam({ name: 'id', example: '7' })
  @ApiOkResponse({ type: EspacioEstadoResponseDto })
  @ApiBadRequestResponse({ description: 'Identificador o estado inválido' })
  @ApiConflictResponse({ description: 'La asignación manual impide el cambio' })
  @ApiNotFoundResponse({ description: 'El espacio no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Patch(':id/estado')
  @HttpCode(HttpStatus.OK)
  cambiarEstado(
    @Param('id') id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CambiarEstadoEspacioDto,
  ): Promise<EspacioEstadoResponseDto> {
    return this.espacios.cambiarEstado(id, usuario.id, dto);
  }

  @ApiOperation({
    summary: 'Asignar manualmente un espacio',
    description:
      'Marca el espacio como asignado hasta que el gestor lo libere. No crea un permiso ni una solicitud.',
  })
  @ApiParam({ name: 'id', example: '7' })
  @ApiOkResponse({ type: EspacioAsignacionResponseDto })
  @ApiBadRequestResponse({ description: 'Identificador o motivo inválido' })
  @ApiConflictResponse({
    description: 'El espacio está en mantenimiento, bloqueado u ocupado',
  })
  @ApiNotFoundResponse({ description: 'El espacio no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Post(':id/asignar')
  @HttpCode(HttpStatus.OK)
  asignar(
    @Param('id') id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: MovimientoEspacioDto,
  ): Promise<EspacioAsignacionResponseDto> {
    return this.espacios.asignar(id, usuario.id, dto);
  }

  @ApiOperation({
    summary: 'Liberar una asignación manual',
    description:
      'Quita la asignación manual y recalcula el estado según bloqueos, permisos y solicitudes vigentes hoy.',
  })
  @ApiParam({ name: 'id', example: '7' })
  @ApiOkResponse({ type: EspacioAsignacionResponseDto })
  @ApiBadRequestResponse({ description: 'Identificador o motivo inválido' })
  @ApiConflictResponse({ description: 'El espacio no tiene asignación manual' })
  @ApiNotFoundResponse({ description: 'El espacio no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Post(':id/liberar')
  @HttpCode(HttpStatus.OK)
  liberar(
    @Param('id') id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: MovimientoEspacioDto,
  ): Promise<EspacioAsignacionResponseDto> {
    return this.espacios.liberar(id, usuario.id, dto);
  }

  @ApiOperation({
    summary: 'Crear un bloqueo de fechas',
    description:
      'Bloquea el espacio entre dos fechas. No se permite cruzar con otro bloqueo, un permiso vigente, una solicitud aprobada o una asignación manual.',
  })
  @ApiParam({ name: 'id', example: '7' })
  @ApiCreatedResponse({ type: BloqueoEspacioGestorDto })
  @ApiBadRequestResponse({ description: 'Fechas o motivo inválidos' })
  @ApiConflictResponse({ description: 'Las fechas se cruzan con una ocupación' })
  @ApiNotFoundResponse({ description: 'El espacio no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Post(':id/bloqueos')
  crearBloqueo(
    @Param('id') id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CrearBloqueoDto,
  ): Promise<BloqueoEspacioGestorDto> {
    return this.espacios.crearBloqueo(id, usuario.id, dto);
  }

  @ApiOperation({
    summary: 'Editar un bloqueo',
    description:
      'Actualiza las fechas o el motivo y vuelve a validar que no se cruce con otras ocupaciones.',
  })
  @ApiParam({ name: 'id', example: '7' })
  @ApiParam({ name: 'bloqueoId', example: '12' })
  @ApiOkResponse({ type: BloqueoEspacioGestorDto })
  @ApiBadRequestResponse({ description: 'Fechas o motivo inválidos' })
  @ApiConflictResponse({ description: 'Las fechas se cruzan con una ocupación' })
  @ApiNotFoundResponse({ description: 'El espacio o el bloqueo no existen' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Patch(':id/bloqueos/:bloqueoId')
  @HttpCode(HttpStatus.OK)
  actualizarBloqueo(
    @Param('id') id: string,
    @Param('bloqueoId') bloqueoId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: ActualizarBloqueoDto,
  ): Promise<BloqueoEspacioGestorDto> {
    return this.espacios.actualizarBloqueo(id, bloqueoId, usuario.id, dto);
  }

  @ApiOperation({
    summary: 'Eliminar un bloqueo',
    description:
      'Elimina el bloqueo y recalcula el estado del espacio. La operación no borra el espacio.',
  })
  @ApiParam({ name: 'id', example: '7' })
  @ApiParam({ name: 'bloqueoId', example: '12' })
  @ApiNoContentResponse({ description: 'Bloqueo eliminado' })
  @ApiNotFoundResponse({ description: 'El espacio o el bloqueo no existen' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Delete(':id/bloqueos/:bloqueoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminarBloqueo(
    @Param('id') id: string,
    @Param('bloqueoId') bloqueoId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    return this.espacios.eliminarBloqueo(id, bloqueoId, usuario.id);
  }

  @ApiOperation({
    summary: 'Eliminar un espacio temporal',
    description:
      'Elimina el espacio solo si no tiene permisos ni solicitudes. Los bloqueos se eliminan en cascada.',
  })
  @ApiParam({ name: 'id', example: '7' })
  @ApiNoContentResponse({ description: 'Espacio eliminado' })
  @ApiConflictResponse({
    description: 'El espacio tiene permisos o solicitudes asociadas',
  })
  @ApiNotFoundResponse({ description: 'El espacio no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(
    @Param('id') id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    return this.espacios.eliminar(id, usuario.id);
  }

  @ApiOperation({
    summary: 'Editar un espacio temporal',
    description:
      'Actualiza los campos enviados. Si cambia la ubicación, vuelve a detectar la zona activa.',
  })
  @ApiParam({ name: 'id', example: '7' })
  @ApiOkResponse({ type: EspacioGestorDetalleDto })
  @ApiBadRequestResponse({ description: 'Datos o geometría inválidos' })
  @ApiConflictResponse({ description: 'La asignación manual impide el cambio de estado' })
  @ApiNotFoundResponse({ description: 'El espacio no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  actualizar(
    @Param('id') id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: ActualizarEspacioDto,
  ): Promise<EspacioGestorDetalleDto> {
    return this.espacios.actualizar(id, usuario.id, dto);
  }
}
