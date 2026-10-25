import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PerfilGestor } from '../auth/decorators/perfil-gestor.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { parseIdBigint } from '../common/parse-id';
import { CambiarEstadoOrganizacionDto } from './dto/cambiar-estado-organizacion.dto';
import { ListarOrganizacionesQueryDto } from './dto/listar-organizaciones-query.dto';
import { ListarOrganizacionesResponseDto } from './dto/listar-organizaciones-response.dto';
import { OrganizacionGestorResponseDto } from './dto/organizacion-response.dto';
import { OrganizadoresService } from './organizadores.service';

/**
 * Revisión y validación de organizaciones desde el panel del gestor.
 *
 * El revisor puede consultar el listado y el detalle; solo el administrador
 * puede activar o suspender una organización, igual que ocurre con el cambio
 * de estado de las cuentas.
 */
@ApiTags('gestor')
@ApiBearerAuth()
@Roles('gestor')
@Controller('gestor/organizaciones')
export class GestorOrganizacionesController {
  constructor(private readonly organizadores: OrganizadoresService) {}

  /**
   * Lista las organizaciones registradas por los organizadores.
   */
  @ApiOperation({
    summary: 'Listar organizaciones',
    description:
      'Lista las cuentas de organizadores que ya registraron su organización. ' +
      'Permite filtrar por estado de validación y buscar por nombre del ' +
      'organizador, correo, nombre de la organización, NIT o representante.',
  })
  @ApiOkResponse({
    type: ListarOrganizacionesResponseDto,
    description: 'Organizaciones paginadas',
  })
  @ApiBadRequestResponse({
    description: 'Los parámetros de consulta no son válidos',
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({
    description: 'El rol del usuario no es gestor',
  })
  @Get()
  listar(
    @Query() dto: ListarOrganizacionesQueryDto,
  ): Promise<ListarOrganizacionesResponseDto> {
    return this.organizadores.listar(dto);
  }

  /**
   * Devuelve el detalle de una organización y los datos del organizador.
   */
  @ApiOperation({
    summary: 'Ver una organización',
    description:
      'Devuelve los datos de la organización y del organizador. El ' +
      'identificador es el `usuario_id` del organizador.',
  })
  @ApiOkResponse({
    type: OrganizacionGestorResponseDto,
    description: 'Detalle de la organización',
  })
  @ApiBadRequestResponse({
    description: 'El identificador no es numérico',
  })
  @ApiNotFoundResponse({
    description: 'La organización no existe',
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({
    description: 'El rol del usuario no es gestor',
  })
  @Get(':id')
  detalle(@Param('id') id: string): Promise<OrganizacionGestorResponseDto> {
    return this.organizadores.detalle(parseIdBigint(id));
  }

  /**
   * Activa o suspende una organización.
   */
  @ApiOperation({
    summary: 'Activar o suspender una organización (administrador)',
    description:
      'Acceso exclusivo de gestores con perfil «administrador». Cambia el ' +
      'estado de la organización, registra `validado_por` y `validado_en`, ' +
      'deja el cambio en la auditoría y notifica al organizador. Los estados ' +
      'permitidos son `activa` y `suspendida`.',
  })
  @ApiOkResponse({
    type: OrganizacionGestorResponseDto,
    description: 'Organización actualizada',
  })
  @ApiBadRequestResponse({
    description: 'El cuerpo o el identificador no son válidos',
  })
  @ApiNotFoundResponse({
    description: 'La organización no existe',
  })
  @ApiConflictResponse({
    description: 'La organización ya se encuentra en ese estado',
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({
    description: 'El rol no es gestor o el perfil no es administrador',
  })
  @PerfilGestor('administrador')
  @Patch(':id/estado')
  cambiarEstado(
    @Param('id') id: string,
    @Body() dto: CambiarEstadoOrganizacionDto,
    @UsuarioActual() gestor: UsuarioAutenticado,
  ): Promise<OrganizacionGestorResponseDto> {
    return this.organizadores.cambiarEstado(
      parseIdBigint(id),
      dto,
      parseIdBigint(gestor.id),
    );
  }
}
