import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { PerfilGestor } from '../auth/decorators/perfil-gestor.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import {
  ConfirmacionResponseDto,
  ConfirmarImportacionDto,
  ConfirmarModulosDto,
  PrevisualizacionResponseDto,
  PrevisualizarZonasDto,
  SridsResponseDto,
} from './dto/importaciones.dto';
import {
  ImportacionesService,
  MAX_BYTES_IMPORTACION,
  type ArchivoImportacion,
} from './importaciones.service';

/** Configuración de Multer para un archivo de importación en memoria. */
function opcionesImportacion(extensiones: readonly string[]): MulterOptions {
  return {
    storage: memoryStorage(),
    limits: {
      fileSize: MAX_BYTES_IMPORTACION,
      files: 1,
    },
    fileFilter: (_request, file, callback) => {
      const nombre = file.originalname.toLowerCase();
      if (!extensiones.some((extension) => nombre.endsWith(extension))) {
        callback(
          new BadRequestException(
            `El archivo debe tener una de estas extensiones: ${extensiones.join(', ')}`,
          ),
          false,
        );
        return;
      }
      callback(null, true);
    },
  };
}

const OPCIONES_ZONAS = opcionesImportacion(['.geojson', '.json']);
const OPCIONES_MODULOS = opcionesImportacion(['.csv']);

function aArchivoImportacion(
  archivo: Express.Multer.File | undefined,
): ArchivoImportacion | undefined {
  if (!archivo) return undefined;
  return {
    buffer: archivo.buffer,
    originalname: archivo.originalname,
    mimetype: archivo.mimetype,
    size: archivo.size,
  };
}

/**
 * Importación masiva de zonas (GeoJSON) y módulos (CSV).
 *
 * - Zonas: solo gestor administrador.
 * - Módulos: revisor y administrador.
 * - La previsualización devuelve un token de 30 minutos; la confirmación y el
 *   reporte usan ese token y quedan ligados al gestor que lo creó.
 */
@ApiTags('importaciones')
@ApiBearerAuth()
@Roles('gestor')
@Controller('importaciones')
export class ImportacionesController {
  constructor(private readonly importaciones: ImportacionesService) {}

  @ApiOperation({
    summary: 'Sistemas de referencia disponibles',
    description:
      'Devuelve los SRID comunes que existen en spatial_ref_sys para el selector de origen del GeoJSON.',
  })
  @ApiOkResponse({ type: SridsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @Get('srids')
  srids(): Promise<SridsResponseDto> {
    return this.importaciones.srids();
  }

  @ApiOperation({
    summary: 'Previsualizar importación de zonas',
    description:
      'Lee un GeoJSON, valida las geometrías, las reproyecta a EPSG:4326 y devuelve un token con las filas válidas y rechazadas. Solo administrador.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo'],
      properties: {
        archivo: { type: 'string', format: 'binary' },
        sridOrigen: {
          type: 'integer',
          example: 3857,
          description: 'SRID de origen; vacío para detectarlo del archivo.',
        },
      },
    },
  })
  @ApiOkResponse({ type: PrevisualizacionResponseDto })
  @ApiBadRequestResponse({ description: 'Archivo ausente o extensión inválida' })
  @ApiPayloadTooLargeResponse({ description: 'El archivo supera 10 MB' })
  @ApiUnprocessableEntityResponse({
    description: 'GeoJSON inválido, SRID desconocido o CRS contradictorio',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({
    description: 'El rol no es gestor o el perfil no es administrador',
  })
  @PerfilGestor('administrador')
  @UseInterceptors(FileInterceptor('archivo', OPCIONES_ZONAS))
  @HttpCode(HttpStatus.OK)
  @Post('zonas/previsualizar')
  previsualizarZonas(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: PrevisualizarZonasDto,
    @UploadedFile() archivo?: Express.Multer.File,
  ): Promise<PrevisualizacionResponseDto> {
    return this.importaciones.previsualizarZonas(
      usuario.id,
      aArchivoImportacion(archivo),
      dto.sridOrigen,
    );
  }

  @ApiOperation({
    summary: 'Confirmar importación de zonas',
    description:
      'Importa las features válidas de la previsualización. Vuelve a validar con PostGIS y registra la versión inicial de cada zona.',
  })
  @ApiOkResponse({ type: ConfirmacionResponseDto })
  @ApiBadRequestResponse({ description: 'Token inválido' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({
    description: 'El rol no es gestor, el perfil no es administrador o el token es de otro gestor',
  })
  @ApiUnprocessableEntityResponse({
    description: 'La BD rechazó una geometría por solape o topología',
  })
  @PerfilGestor('administrador')
  @HttpCode(HttpStatus.OK)
  @Post('zonas/confirmar')
  confirmarZonas(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: ConfirmarImportacionDto,
  ): Promise<ConfirmacionResponseDto> {
    return this.importaciones.confirmarZonas(usuario.id, dto.token);
  }

  @ApiOperation({
    summary: 'Previsualizar importación de módulos',
    description:
      'Lee un CSV, valida cada fila, resuelve el titular y la zona contenedora del punto y devuelve un token con las filas válidas, con advertencia y rechazadas.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo'],
      properties: {
        archivo: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOkResponse({ type: PrevisualizacionResponseDto })
  @ApiBadRequestResponse({ description: 'Archivo ausente o extensión inválida' })
  @ApiPayloadTooLargeResponse({ description: 'El archivo supera 10 MB' })
  @ApiUnprocessableEntityResponse({
    description: 'CSV inválido, encabezados faltantes o más de 5.000 filas',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es gestor' })
  @UseInterceptors(FileInterceptor('archivo', OPCIONES_MODULOS))
  @HttpCode(HttpStatus.OK)
  @Post('modulos/previsualizar')
  previsualizarModulos(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @UploadedFile() archivo?: Express.Multer.File,
  ): Promise<PrevisualizacionResponseDto> {
    return this.importaciones.previsualizarModulos(
      usuario.id,
      aArchivoImportacion(archivo),
    );
  }

  @ApiOperation({
    summary: 'Confirmar importación de módulos',
    description:
      'Importa las filas válidas. Las filas en zona restringida solo se importan si aceptaAdvertencia es true.',
  })
  @ApiOkResponse({ type: ConfirmacionResponseDto })
  @ApiBadRequestResponse({ description: 'Token inválido' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({
    description: 'El rol no es gestor o el token es de otro gestor',
  })
  @ApiUnprocessableEntityResponse({
    description: 'La BD rechazó una fila al confirmar',
  })
  @HttpCode(HttpStatus.OK)
  @Post('modulos/confirmar')
  confirmarModulos(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: ConfirmarModulosDto,
  ): Promise<ConfirmacionResponseDto> {
    return this.importaciones.confirmarModulos(
      usuario.id,
      dto.token,
      dto.aceptaAdvertencia === true,
    );
  }

  @ApiOperation({
    summary: 'Descargar reporte de errores',
    description:
      'Descarga un CSV UTF-8 con el resumen y las filas rechazadas de una importación confirmada.',
  })
  @ApiParam({ name: 'token', description: 'Token de la previsualización' })
  @ApiProduces('text/csv')
  @ApiOkResponse({ description: 'Archivo CSV de errores' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({
    description: 'El rol no es gestor o el token es de otro gestor',
  })
  @Get(':token/reporte')
  async descargarReporte(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('token') token: string,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<StreamableFile> {
    const { contenido, nombreArchivo } = await this.importaciones.reporte(
      usuario.id,
      token,
    );

    respuesta.setHeader('Content-Type', 'text/csv; charset=utf-8');
    respuesta.setHeader(
      'Content-Disposition',
      `attachment; filename="${nombreArchivo}"`,
    );

    return new StreamableFile(Buffer.from(contenido, 'utf8'));
  }
}
