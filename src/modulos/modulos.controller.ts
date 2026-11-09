import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import {
  ActualizarModuloDto,
  CambiarEstadoModuloDto,
  CrearModuloDto,
  ListarModulosQueryDto,
  ListarModulosResponseDto,
  ModuloDetalleDto,
  ModuloEstadoResponseDto,
  ModuloHistorialQueryDto,
  ModuloHistorialResponseDto,
  OpcionesModulosResponseDto,
  ZonaContenedoraQueryDto,
  ZonaContenedoraResponseDto,
} from './dto/modulos.dto';
import {
  limiteBytesFoto,
  TIPOS_MIME_FOTO,
  type ArchivoFoto,
} from './foto';
import { ModulosService } from './modulos.service';

/** Opciones de Multer para la foto opcional del puesto. */
function opcionesFoto(): MulterOptions {
  return {
    storage: memoryStorage(),
    limits: {
      fileSize: limiteBytesFoto(),
      files: 1,
    },
    fileFilter: (_request, file, callback) => {
      const mimetype = file.mimetype.toLowerCase().trim();
      if (
        !TIPOS_MIME_FOTO.includes(
          mimetype as (typeof TIPOS_MIME_FOTO)[number],
        )
      ) {
        callback(
          new BadRequestException('La foto debe ser JPG, PNG o WebP'),
          false,
        );
        return;
      }
      callback(null, true);
    },
  };
}

/** Adapta el archivo de Multer al tipo mínimo del servicio. */
function aArchivoFoto(
  foto: Express.Multer.File | undefined,
): ArchivoFoto | undefined {
  if (!foto) return undefined;
  return {
    buffer: foto.buffer,
    mimetype: foto.mimetype,
    size: foto.size,
    originalname: foto.originalname,
  };
}

/**
 * Censo municipal de módulos y puestos de comercio formal e informal.
 *
 * Todos los endpoints requieren rol `gestor`. A diferencia de zonas, el perfil
 * revisor también puede crear, editar, dar de baja y reactivar módulos.
 */
@ApiTags('modulos')
@ApiBearerAuth()
@Roles('gestor')
@Controller('modulos')
export class ModulosController {
  constructor(private readonly modulos: ModulosService) {}

  @ApiOperation({
    summary: 'Opciones de filtros del censo',
    description:
      'Devuelve las zonas activas que se usan como sectores y las categorías formal/informal.',
  })
  @ApiOkResponse({ type: OpcionesModulosResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Get('opciones')
  opciones(): Promise<OpcionesModulosResponseDto> {
    return this.modulos.opciones();
  }

  @ApiOperation({
    summary: 'Consultar zona contenedora y advertencias',
    description:
      'Devuelve la zona activa que contiene el punto y las advertencias que debe aceptar el gestor antes de confirmar el censo.',
  })
  @ApiQuery({ name: 'lat', example: 4.0885 })
  @ApiQuery({ name: 'lng', example: -76.1955 })
  @ApiOkResponse({ type: ZonaContenedoraResponseDto })
  @ApiBadRequestResponse({ description: 'Coordenadas inválidas' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Get('zona-contenedora')
  zonaContenedora(
    @Query() dto: ZonaContenedoraQueryDto,
  ): Promise<ZonaContenedoraResponseDto> {
    return this.modulos.zonaContenedora(dto.lat, dto.lng);
  }

  @ApiOperation({
    summary: 'Listar módulos',
    description:
      'Lista el censo con filtros por categoría, sector derivado de la zona, estado y búsqueda. El sector «sin_zona» agrupa los puntos fuera de toda zona activa.',
  })
  @ApiOkResponse({ type: ListarModulosResponseDto })
  @ApiBadRequestResponse({ description: 'Parámetros de consulta inválidos' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Get()
  listar(
    @Query() dto: ListarModulosQueryDto,
  ): Promise<ListarModulosResponseDto> {
    return this.modulos.listar(dto);
  }

  @ApiOperation({
    summary: 'Historial de un módulo',
    description:
      'Devuelve los eventos de auditoría del módulo: censo, edición, baja y reactivación, con actor y fecha.',
  })
  @ApiParam({ name: 'id', example: '7' })
  @ApiOkResponse({ type: ModuloHistorialResponseDto })
  @ApiBadRequestResponse({ description: 'Identificador o paginación inválidos' })
  @ApiNotFoundResponse({ description: 'El módulo no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Get(':id/historial')
  historial(
    @Param('id') id: string,
    @Query() dto: ModuloHistorialQueryDto,
  ): Promise<ModuloHistorialResponseDto> {
    return this.modulos.historial(id, dto);
  }

  @ApiOperation({
    summary: 'Ficha de un módulo',
    description:
      'Devuelve los datos del censo, el titular, la ubicación, la zona contenedora con sus restricciones y las advertencias vigentes.',
  })
  @ApiParam({ name: 'id', example: '7' })
  @ApiOkResponse({ type: ModuloDetalleDto })
  @ApiBadRequestResponse({ description: 'Identificador inválido' })
  @ApiNotFoundResponse({ description: 'El módulo no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Get(':id')
  detalle(@Param('id') id: string): Promise<ModuloDetalleDto> {
    return this.modulos.detalle(id);
  }

  @ApiOperation({
    summary: 'Censar un módulo',
    description:
      'Crea un módulo con punto, categoría, titular, actividad y foto opcional. Si el punto cae en una zona restringida, exige aceptaAdvertencia=true.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CrearModuloDto })
  @ApiCreatedResponse({ type: ModuloDetalleDto })
  @ApiBadRequestResponse({
    description: 'Datos inválidos, titular inexistente o foto inválida',
  })
  @ApiPayloadTooLargeResponse({ description: 'La foto supera el límite' })
  @ApiUnprocessableEntityResponse({
    description: 'El punto está en una zona restringida sin confirmación',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @UseInterceptors(FileInterceptor('foto', opcionesFoto()))
  @Post()
  crear(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CrearModuloDto,
    @UploadedFile() foto?: Express.Multer.File,
  ): Promise<ModuloDetalleDto> {
    return this.modulos.crear(usuario.id, dto, aArchivoFoto(foto));
  }

  @ApiOperation({
    summary: 'Dar de baja o reactivar un módulo',
    description:
      'Cambia el estado lógico entre activo y baja. La fila y su historial se conservan. La operación es idempotente.',
  })
  @ApiParam({ name: 'id', example: '7' })
  @ApiOkResponse({ type: ModuloEstadoResponseDto })
  @ApiBadRequestResponse({ description: 'Identificador o estado inválido' })
  @ApiNotFoundResponse({ description: 'El módulo no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Patch(':id/estado')
  @HttpCode(HttpStatus.OK)
  cambiarEstado(
    @Param('id') id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CambiarEstadoModuloDto,
  ): Promise<ModuloEstadoResponseDto> {
    return this.modulos.cambiarEstado(id, usuario.id, dto);
  }

  @ApiOperation({
    summary: 'Editar un módulo',
    description:
      'Actualiza los campos enviados. Si cambia la ubicación, recalcula la zona y exige confirmación cuando es restringida.',
  })
  @ApiParam({ name: 'id', example: '7' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: ActualizarModuloDto })
  @ApiOkResponse({ type: ModuloDetalleDto })
  @ApiBadRequestResponse({
    description: 'Datos inválidos, titular inexistente o foto inválida',
  })
  @ApiNotFoundResponse({ description: 'El módulo no existe' })
  @ApiPayloadTooLargeResponse({ description: 'La foto supera el límite' })
  @ApiUnprocessableEntityResponse({
    description: 'El nuevo punto está en una zona restringida sin confirmación',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @UseInterceptors(FileInterceptor('foto', opcionesFoto()))
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  actualizar(
    @Param('id') id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: ActualizarModuloDto,
    @UploadedFile() foto?: Express.Multer.File,
  ): Promise<ModuloDetalleDto> {
    return this.modulos.actualizar(id, usuario.id, dto, aArchivoFoto(foto));
  }
}
