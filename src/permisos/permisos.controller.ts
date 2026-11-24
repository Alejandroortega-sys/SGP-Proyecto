import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
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
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import {
  ListarMisPermisosQueryDto,
  ListarMisPermisosResponseDto,
  MiPermisoDetalleDto,
  RenovarPermisoResponseDto,
} from './dto/permisos.dto';
import { PermisosService } from './permisos.service';

/**
 * Permisos propios del comerciante: listado, carné digital y renovación
 * (HU-32 y HU-34).
 *
 * Todo se filtra por el titular del JWT: un permiso ajeno responde 404
 * (control IDOR en el Service, AGENTS §9.8).
 */
@ApiTags('permisos')
@ApiBearerAuth()
@Roles('comerciante')
@Controller('permisos')
export class PermisosController {
  constructor(private readonly permisos: PermisosService) {}

  @ApiOperation({
    summary: 'Mis permisos',
    description:
      'Lista los permisos emitidos a nombre del comercio autenticado, del ' +
      'más reciente al más antiguo, con paginación estándar.',
  })
  @ApiOkResponse({ type: ListarMisPermisosResponseDto })
  @ApiBadRequestResponse({ description: 'Paginación inválida' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es comerciante' })
  @Get('mios')
  listarMios(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query() dto: ListarMisPermisosQueryDto,
  ): Promise<ListarMisPermisosResponseDto> {
    return this.permisos.listarMios(usuario, dto);
  }

  @ApiOperation({
    summary: 'Radicar la renovación de un permiso',
    description:
      'Crea una solicitud nueva con los datos precargados del permiso ' +
      '(mismo espacio, actividad y horario) cuya vigencia empieza el día ' +
      'siguiente al vencimiento actual. La solicitud pasa a revisión del ' +
      'gestor; al aprobarse, se emite un permiso nuevo enlazado con ' +
      '`renovado_desde` (con QR nuevo). Un permiso vencido o revocado no se ' +
      'puede renovar: exige radicar una solicitud nueva.',
  })
  @ApiParam({ name: 'id', example: '8' })
  @ApiCreatedResponse({ type: RenovarPermisoResponseDto })
  @ApiBadRequestResponse({ description: 'Identificador inválido' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es comerciante' })
  @ApiNotFoundResponse({
    description: 'El permiso no existe o no pertenece a su cuenta',
  })
  @ApiConflictResponse({
    description:
      'Ya tiene una solicitud radicada o en revisión para ese espacio',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'El permiso está suspendido, revocado o ya venció: debe radicar una nueva solicitud',
  })
  @Post('mios/:id/renovacion')
  renovar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ): Promise<RenovarPermisoResponseDto> {
    return this.permisos.renovar(usuario, id);
  }

  @ApiOperation({
    summary: 'Detalle de un permiso propio (datos del carné)',
    description:
      'Devuelve los datos del carné: número, estado, titular, categoría, ' +
      'espacio, vigencia, el token QR y la URL pública de verificación que ' +
      'codifica el QR.',
  })
  @ApiParam({ name: 'id', example: '8' })
  @ApiOkResponse({ type: MiPermisoDetalleDto })
  @ApiBadRequestResponse({ description: 'Identificador inválido' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es comerciante' })
  @ApiNotFoundResponse({
    description: 'El permiso no existe o no pertenece a su cuenta',
  })
  @Get('mios/:id')
  detalleMio(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ): Promise<MiPermisoDetalleDto> {
    return this.permisos.detalleMio(usuario, id);
  }

  @ApiOperation({
    summary: 'Descargar el carné digital en PDF',
    description:
      'Genera el carné en PDF con el código QR de la URL pública de ' +
      'verificación y el estado visible. Solo el titular del permiso puede ' +
      'descargarlo.',
  })
  @ApiParam({ name: 'id', example: '8' })
  @ApiOkResponse({
    description: 'Archivo PDF adjunto (Content-Disposition).',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiBadRequestResponse({ description: 'Identificador inválido' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'El rol no es comerciante' })
  @ApiNotFoundResponse({
    description: 'El permiso no existe o no pertenece a su cuenta',
  })
  @Get('mios/:id/carne')
  async carne(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<StreamableFile> {
    const { buffer, nombreArchivo } = await this.permisos.carneMio(usuario, id);
    respuesta.status(HttpStatus.OK);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${nombreArchivo}"`,
    });
  }
}
