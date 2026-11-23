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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
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
import { createReadStream } from 'node:fs';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import {
  limiteBytesArchivo,
  maxArchivos,
} from '../common/almacenamiento-archivos';
import {
  AgendaFeriaDto,
  ConsultarAgendaFeriaQueryDto,
  ConsultarDisponibilidadFeriaQueryDto,
  DisponibilidadFeriaDto,
  FeriaDetalleDto,
  ListarFeriasResponseDto,
  ListarMisFeriasQueryDto,
  OpcionesFeriaDto,
  RadicarFeriaFormDto,
  RadicarFeriaResponseDto,
} from './dto/ferias.dto';
import { FeriasService } from './ferias.service';

/** MIME aceptados para los adjuntos de una feria. */
const TIPOS_MIME_ADJUNTO = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
] as const;

/** Opciones de Multer para los adjuntos de la feria. */
function opcionesAdjuntos(): MulterOptions {
  return {
    storage: memoryStorage(),
    limits: {
      fileSize: limiteBytesArchivo(),
      files: maxArchivos(),
    },
    fileFilter: (_request, file, callback) => {
      const mimetype = file.mimetype.toLowerCase().trim();
      if (
        !TIPOS_MIME_ADJUNTO.includes(
          mimetype as (typeof TIPOS_MIME_ADJUNTO)[number],
        )
      ) {
        callback(
          new BadRequestException('Los adjuntos deben ser PDF, JPG o PNG'),
          false,
        );
        return;
      }
      callback(null, true);
    },
  };
}

/**
 * Solicitud de espacio para ferias agroecológicas (HU-21).
 *
 * Solo el organizador autenticado puede consultar zonas, disponibilidad,
 * radicar y ver sus propias ferias. La descarga de adjuntos también está
 * disponible para gestores.
 */
@ApiTags('ferias')
@ApiBearerAuth()
@Controller('ferias')
export class FeriasController {
  constructor(private readonly ferias: FeriasService) {}

  @ApiOperation({
    summary: 'Zonas y productos para el formulario de feria',
    description:
      'Devuelve las zonas activas con aforo, horario y productos permitidos, además del catálogo de productos activos.',
  })
  @ApiOkResponse({ type: OpcionesFeriaDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es organizador' })
  @Roles('organizador')
  @Get('zonas')
  opciones(): Promise<OpcionesFeriaDto> {
    return this.ferias.opciones();
  }

  @ApiOperation({
    summary: 'Agenda ocupada de una zona',
    description:
      'Devuelve los rangos de fechas ocupados por ferias radicadas o aprobadas. No expone datos de otros organizadores.',
  })
  @ApiOkResponse({ type: AgendaFeriaDto })
  @ApiBadRequestResponse({ description: 'Zona o fechas inválidas' })
  @ApiNotFoundResponse({ description: 'La zona no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es organizador' })
  @Roles('organizador')
  @Get('agenda')
  agenda(@Query() dto: ConsultarAgendaFeriaQueryDto): Promise<AgendaFeriaDto> {
    return this.ferias.agenda(dto);
  }

  @ApiOperation({
    summary: 'Consultar disponibilidad de una zona para una feria',
    description:
      'Evalúa fechas, aforo y cruces de agenda. Cuando hay conflicto devuelve hasta tres rangos alternativos.',
  })
  @ApiOkResponse({ type: DisponibilidadFeriaDto })
  @ApiBadRequestResponse({
    description: 'Fechas o número de puestos inválidos',
  })
  @ApiNotFoundResponse({ description: 'La zona no existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es organizador' })
  @Roles('organizador')
  @Get('disponibilidad')
  disponibilidad(
    @Query() dto: ConsultarDisponibilidadFeriaQueryDto,
  ): Promise<DisponibilidadFeriaDto> {
    return this.ferias.disponibilidad(dto);
  }

  @ApiOperation({
    summary: 'Listar mis ferias',
    description:
      'Devuelve las ferias del organizador autenticado, con filtro por estado y paginación.',
  })
  @ApiOkResponse({ type: ListarFeriasResponseDto })
  @ApiBadRequestResponse({ description: 'Filtros o paginación inválidos' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es organizador' })
  @Roles('organizador')
  @Get('mias')
  listarMias(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query() dto: ListarMisFeriasQueryDto,
  ): Promise<ListarFeriasResponseDto> {
    return this.ferias.listarMias(usuario.id, dto);
  }

  @ApiOperation({
    summary: 'Radicar una feria',
    description:
      'Crea la feria en estado radicada, genera el número FER-AAAA-#####, valida aforo y cruces de agenda, guarda los adjuntos y envía la confirmación por correo.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        datos: {
          type: 'string',
          description:
            'JSON con nombre, tipoFeria, zonaId, fechaInicio, fechaFin, numeroPuestos y productoIds.',
        },
        adjuntos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['datos'],
    },
  })
  @ApiCreatedResponse({ type: RadicarFeriaResponseDto })
  @ApiBadRequestResponse({
    description:
      'Datos incompletos, aforo insuficiente, productos inválidos o adjuntos inválidos',
  })
  @ApiConflictResponse({
    description: 'Cruce de agenda con otra feria radicada o aprobada',
  })
  @ApiForbiddenResponse({
    description: 'El rol no es organizador o la organización no está activa',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @Roles('organizador')
  @Post()
  @UseInterceptors(
    FilesInterceptor('adjuntos', maxArchivos(), opcionesAdjuntos()),
  )
  radicar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() form: RadicarFeriaFormDto,
    @UploadedFiles() archivos: Express.Multer.File[] = [],
  ): Promise<RadicarFeriaResponseDto> {
    return this.ferias.radicar(usuario, form, archivos);
  }

  @ApiOperation({
    summary: 'Detalle de una feria propia',
    description:
      'Devuelve la feria, su zona, productos y adjuntos. Solo el organizador dueño puede consultarla.',
  })
  @ApiParam({ name: 'id', example: '12' })
  @ApiOkResponse({ type: FeriaDetalleDto })
  @ApiBadRequestResponse({ description: 'Identificador inválido' })
  @ApiNotFoundResponse({
    description: 'La feria no existe o no pertenece al organizador',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es organizador' })
  @Roles('organizador')
  @Get(':id')
  detalle(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ): Promise<FeriaDetalleDto> {
    return this.ferias.detalle(usuario.id, id);
  }

  @ApiOperation({
    summary: 'Descargar un adjunto de la feria',
    description:
      'Solo el organizador dueño o un gestor pueden descargar el archivo. El archivo nunca se sirve como recurso público.',
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
  @Roles('organizador', 'gestor')
  @Get(':id/documentos/:documentoId/archivo')
  async descargarDocumento(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Param('documentoId') documentoId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const archivo = await this.ferias.descargarDocumento(
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
}
