import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { parseIdBigint } from '../common/parse-id';
import { ActualizarOrganizacionDto } from './dto/actualizar-organizacion.dto';
import { CrearOrganizacionDto } from './dto/crear-organizacion.dto';
import { OrganizacionResponseDto } from './dto/organizacion-response.dto';
import { OrganizadoresService } from './organizadores.service';

/**
 * Organización del organizador de feria autenticado.
 *
 * El modelo es 1:1: cada organizador registra una sola organización. La
 * organización nace en `pendiente_validacion` y solo el gestor administrador
 * puede activarla o suspenderla.
 */
@ApiTags('organizadores')
@ApiBearerAuth()
@Roles('organizador')
@Controller('organizadores')
export class OrganizadoresController {
  constructor(private readonly organizadores: OrganizadoresService) {}

  /**
   * Registra la organización del organizador autenticado.
   */
  @ApiOperation({
    summary: 'Registrar mi organización',
    description:
      'Crea la organización del organizador autenticado en estado ' +
      '«pendiente_validacion». Solo se permite una organización por ' +
      'organizador. El NIT y el nombre de la organización deben ser únicos; ' +
      'el nombre se compara sin distinguir mayúsculas.',
  })
  @ApiCreatedResponse({
    type: OrganizacionResponseDto,
    description: 'Organización registrada y pendiente de validación',
  })
  @ApiBadRequestResponse({
    description: 'Los datos enviados no cumplen las validaciones del DTO',
  })
  @ApiConflictResponse({
    description:
      'El organizador ya tiene organización, o el NIT/nombre ya están registrados',
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({
    description: 'El rol del usuario no es organizador',
  })
  @Post('mi-organizacion')
  crear(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CrearOrganizacionDto,
  ): Promise<OrganizacionResponseDto> {
    return this.organizadores.crear(parseIdBigint(usuario.id), dto);
  }

  /**
   * Devuelve la organización del organizador autenticado.
   */
  @ApiOperation({
    summary: 'Ver mi organización',
    description:
      'Devuelve los datos, el estado de validación y la fecha de validación ' +
      'de la organización del organizador autenticado.',
  })
  @ApiOkResponse({
    type: OrganizacionResponseDto,
    description: 'Organización registrada',
  })
  @ApiNotFoundResponse({
    description: 'El organizador aún no ha registrado una organización',
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({
    description: 'El rol del usuario no es organizador',
  })
  @Get('mi-organizacion')
  ver(
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<OrganizacionResponseDto> {
    return this.organizadores.ver(parseIdBigint(usuario.id));
  }

  /**
   * Actualiza parcialmente la organización del organizador autenticado.
   */
  @ApiOperation({
    summary: 'Actualizar mi organización',
    description:
      'Actualiza parcialmente nombreOrganizacion, nit, representante, ' +
      'tipoFeria y contacto (al menos uno). El estado y los datos de ' +
      'validación solo los modifica el gestor municipal. El NIT y el nombre ' +
      'siguen siendo únicos.',
  })
  @ApiOkResponse({
    type: OrganizacionResponseDto,
    description: 'Organización actualizada',
  })
  @ApiBadRequestResponse({
    description: 'Ningún campo válido en el cuerpo',
  })
  @ApiNotFoundResponse({
    description: 'El organizador aún no ha registrado una organización',
  })
  @ApiConflictResponse({
    description: 'El NIT o el nombre ya pertenecen a otra organización',
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({
    description: 'El rol del usuario no es organizador',
  })
  @Patch('mi-organizacion')
  actualizar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: ActualizarOrganizacionDto,
  ): Promise<OrganizacionResponseDto> {
    return this.organizadores.actualizar(parseIdBigint(usuario.id), dto);
  }
}
