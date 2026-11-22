import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { createReadStream } from 'node:fs';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import {
  limiteBytesDocumento,
  maxDocumentos,
  TIPOS_MIME_DOCUMENTO,
} from './documentos';
import {
  CargarDocumentoSolicitudFormDto,
  ConsultarDisponibilidadQueryDto,
  DisponibilidadSolicitudDto,
  ListarMisSolicitudesQueryDto,
  ListarSolicitudesResponseDto,
  RadicarSolicitudFormDto,
  RadicarSolicitudResponseDto,
  RequisitosSolicitudDetalleResponseDto,
  RequisitosSolicitudQueryDto,
  RequisitosSolicitudResponseDto,
  RespuestaCargaDocumentoSolicitudDto,
  SolicitudTemporalDetalleDto,
} from './dto/solicitudes.dto';
import { SolicitudesService } from './solicitudes.service';

/** Opciones de Multer para los documentos de la solicitud. */
function opcionesDocumentos(): MulterOptions {
  return {
    storage: memoryStorage(),
    limits: {
      fileSize: limiteBytesDocumento(),
      files: maxDocumentos(),
    },
    fileFilter: (_request, file, callback) => {
      const mimetype = file.mimetype.toLowerCase().trim();
      if (
        !TIPOS_MIME_DOCUMENTO.includes(
          mimetype as (typeof TIPOS_MIME_DOCUMENTO)[number],
        )
      ) {
        callback(
          new BadRequestException('Los documentos deben ser PDF, JPG o PNG'),
          false,
        );
        return;
      }
      callback(null, true);
    },
  };
}

/**
 * Radicación y consulta de solicitudes de uso temporal (HU-16).
 *
 * El comerciante radica una solicitud completa; no hay borradores en el
 * backend. Los documentos se envían en la misma petición multipart.
 */
@ApiTags('solicitudes')
@ApiBearerAuth()
@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudes: SolicitudesService) {}

  @ApiOperation({
    summary: 'Listar mis solicitudes',
    description:
      'Devuelve las solicitudes radicadas del comerciante autenticado. Los borradores se gestionan en el navegador y no se incluyen.',
  })
  @ApiOkResponse({ type: ListarSolicitudesResponseDto })
  @ApiBadRequestResponse({ description: 'Filtros o paginación inválidos' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es comerciante' })
  @Roles('comerciante')
  @Get('mias')
  listarMias(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query() dto: ListarMisSolicitudesQueryDto,
  ): Promise<ListarSolicitudesResponseDto> {
    return this.solicitudes.listarMias(usuario.id, dto);
  }

  @ApiOperation({
    summary: 'Requisitos documentales de una actividad',
    description:
      'Devuelve los documentos globales y los específicos de la actividad permitida del espacio seleccionado.',
  })
  @ApiOkResponse({ type: RequisitosSolicitudResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es comerciante' })
  @Roles('comerciante')
  @Get('requisitos')
  requisitos(
    @Query() dto: RequisitosSolicitudQueryDto,
  ): Promise<RequisitosSolicitudResponseDto> {
    return this.solicitudes.requisitos(dto);
  }

  @ApiOperation({
    summary: 'Consultar disponibilidad para una solicitud',
    description:
      'Evalúa fechas, horario, bloqueos, permisos, solicitudes aprobadas y duplicados antes de radicar.',
  })
  @ApiOkResponse({ type: DisponibilidadSolicitudDto })
  @ApiBadRequestResponse({ description: 'Fechas u horas inválidas' })
  @ApiNotFoundResponse({ description: 'El espacio no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es comerciante' })
  @Roles('comerciante')
  @Get('disponibilidad')
  disponibilidad(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query() dto: ConsultarDisponibilidadQueryDto,
  ): Promise<DisponibilidadSolicitudDto> {
    return this.solicitudes.consultarDisponibilidad(usuario.id, dto);
  }

  @ApiOperation({
    summary: 'Radicar una solicitud',
    description:
      'Crea la solicitud en estado radicada, genera el número SOL-AAAA-#####, guarda los documentos, registra el historial y envía la confirmación por correo.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        datos: {
          type: 'string',
          description:
            'JSON con espacioId, actividad, productoIds, fechaInicio, fechaFin, horaInicio y horaFin.',
        },
        documentosMeta: {
          type: 'string',
          description:
            'JSON con [{ requisitoId, nombreOriginal }] en el mismo orden de los archivos.',
        },
        documentos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['datos'],
    },
  })
  @ApiCreatedResponse({ type: RadicarSolicitudResponseDto })
  @ApiBadRequestResponse({
    description:
      'Datos incompletos, documentos inválidos o fechas fuera de regla',
  })
  @ApiConflictResponse({
    description: 'Espacio no disponible o solicitud duplicada',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es comerciante' })
  @Roles('comerciante')
  @Post()
  @UseInterceptors(
    FilesInterceptor('documentos', maxDocumentos(), opcionesDocumentos()),
  )
  radicar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() form: RadicarSolicitudFormDto,
    @UploadedFiles() archivos: Express.Multer.File[] = [],
  ): Promise<RadicarSolicitudResponseDto> {
    return this.solicitudes.radicar(usuario, form, archivos);
  }

  @ApiOperation({
    summary: 'Cargar o reemplazar un documento de la solicitud',
    description:
      'Valida tipo y tamaño, guarda el archivo en el directorio privado y conserva la versión anterior mediante reemplaza_a. Solo el comerciante dueño puede cargar documentos en estado radicada o devuelta.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        requisitoId: { type: 'string', example: '1' },
        archivo: { type: 'string', format: 'binary' },
      },
      required: ['requisitoId', 'archivo'],
    },
  })
  @ApiCreatedResponse({ type: RespuestaCargaDocumentoSolicitudDto })
  @ApiBadRequestResponse({
    description: 'Archivo o requisito inválido',
  })
  @ApiConflictResponse({
    description: 'La solicitud no admite cambios en su estado actual',
  })
  @ApiNotFoundResponse({
    description: 'La solicitud no existe o no pertenece al usuario',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es comerciante' })
  @Roles('comerciante')
  @Post(':id/documentos')
  @UseInterceptors(FileInterceptor('archivo', opcionesDocumentos()))
  cargarDocumento(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body() form: CargarDocumentoSolicitudFormDto,
    @UploadedFile() archivo?: Express.Multer.File,
  ): Promise<RespuestaCargaDocumentoSolicitudDto> {
    return this.solicitudes.cargarDocumentoSolicitud(
      usuario,
      id,
      form,
      archivo,
    );
  }

  @ApiOperation({
    summary: 'Listar los requisitos documentales de una solicitud',
    description:
      'Devuelve el catálogo de requisitos de la actividad con su estado, la versión vigente y el historial de versiones. Solo el comerciante dueño puede consultarlo.',
  })
  @ApiOkResponse({ type: RequisitosSolicitudDetalleResponseDto })
  @ApiBadRequestResponse({ description: 'Identificador inválido' })
  @ApiNotFoundResponse({
    description: 'La solicitud no existe o no pertenece al usuario',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es comerciante' })
  @Roles('comerciante')
  @Get(':id/requisitos')
  listarRequisitosSolicitud(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ): Promise<RequisitosSolicitudDetalleResponseDto> {
    return this.solicitudes.listarRequisitosSolicitud(usuario.id, id);
  }

  @ApiOperation({
    summary: 'Descargar un documento de la solicitud',
    description:
      'Solo el dueño de la solicitud o un gestor pueden descargar el archivo. El archivo no se sirve como recurso público.',
  })
  @ApiParam({ name: 'id', example: '12' })
  @ApiParam({ name: 'documentoId', example: '3' })
  @ApiProduces(
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/octet-stream',
  )
  @ApiOkResponse({ description: 'Archivo binario' })
  @ApiBadRequestResponse({ description: 'Identificadores inválidos' })
  @ApiNotFoundResponse({ description: 'Documento o archivo inexistente' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'Sin acceso al documento' })
  @Roles('comerciante', 'gestor')
  @Get(':id/documentos/:documentoId/archivo')
  async descargarDocumento(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Param('documentoId') documentoId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const archivo = await this.solicitudes.descargarDocumento(
      usuario,
      id,
      documentoId,
    );

    res.setHeader('Content-Type', archivo.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${archivo.nombreOriginal}"; filename*=UTF-8''${encodeURIComponent(archivo.nombreOriginal)}`,
    );

    return new StreamableFile(createReadStream(archivo.ruta));
  }

  @ApiOperation({
    summary: 'Detalle de una solicitud propia',
    description:
      'Devuelve la solicitud, sus productos, documentos e historial de estados.',
  })
  @ApiOkResponse({ type: SolicitudTemporalDetalleDto })
  @ApiBadRequestResponse({ description: 'Identificador inválido' })
  @ApiNotFoundResponse({
    description: 'La solicitud no existe o no pertenece al usuario',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es comerciante' })
  @Roles('comerciante')
  @Get(':id')
  detalle(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ): Promise<SolicitudTemporalDetalleDto> {
    return this.solicitudes.detalle(usuario.id, id);
  }
}
