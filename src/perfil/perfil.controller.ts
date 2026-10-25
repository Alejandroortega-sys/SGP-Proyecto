import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { MensajeResponseDto } from '../usuarios/dto/comerciante-response.dto';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { PerfilResponseDto } from './dto/ver-perfil.dto';
import { PerfilService } from './perfil.service';

/**
 * Perfil del usuario autenticado (HU-04).
 *
 * Disponible para comerciantes y organizadores. Muestra los datos personales,
 * el perfil de negocio (actividad comercial u organización) y la seguridad de
 * la cuenta, y permite actualizar los datos de contacto. Los campos sensibles
 * del comerciante solo los corrige un gestor municipal (HU-04) y el correo
 * queda fijo hasta que exista un flujo de verificación. Los guards globales
 * aplican el JWT y el rol; cada cambio queda auditado en `auditoria`.
 */
@ApiTags('perfil')
@ApiBearerAuth()
@Roles('comerciante', 'organizador')
@Controller('perfil')
export class PerfilController {
  constructor(private readonly perfil: PerfilService) {}

  /**
   * Devuelve el perfil del usuario autenticado. En comerciantes incluye la
   * actividad comercial; en organizadores, la organización registrada.
   */
  @ApiOperation({
    summary: 'Ver mi perfil',
    description:
      'Devuelve los datos personales y de seguridad del usuario autenticado. ' +
      'Para comerciantes incluye la sección `actividadComercial` (HU-04); ' +
      'para organizadores incluye `organizacion` (o `null` si aún no la ha ' +
      'creado). Nunca expone la contraseña.',
  })
  @ApiOkResponse({
    type: PerfilResponseDto,
    description: 'Perfil del comerciante autenticado',
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({
    description: 'El rol del usuario no es comerciante ni organizador',
  })
  @Get()
  ver(
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<PerfilResponseDto> {
    return this.perfil.ver(usuario.id);
  }

  /**
   * Actualiza los datos personales del usuario: `nombre`, `apellido` y
   * `telefono` (al menos uno). El resto de campos no se aceptan: si se envían,
   * la validación global responde 400.
   */
  @ApiOperation({
    summary: 'Actualizar mis datos personales',
    description:
      'Actualiza parcialmente los datos personales y de contacto del usuario ' +
      'autenticado (nombre, apellido y/o teléfono; al menos uno). Los datos ' +
      'de la organización se actualizan en `PATCH /organizadores/mi-organizacion`. ' +
      '**Campos bloqueados** (documento, tipoDocumento, actividadComercial, ' +
      'categoria, nombreOrganizacion, nit, correo y estado): si se envían, la ' +
      'respuesta es 400. El cambio queda registrado en la auditoría.',
  })
  @ApiOkResponse({
    type: PerfilResponseDto,
    description: 'Perfil actualizado (se devuelve completo)',
  })
  @ApiBadRequestResponse({
    description:
      'Ningún campo válido en el cuerpo, o se envió una propiedad bloqueada ' +
      '(documento, actividad comercial, categoría, correo o estado)',
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({
    description: 'El rol del usuario no es comerciante ni organizador',
  })
  @Patch()
  actualizar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: ActualizarPerfilDto,
  ): Promise<PerfilResponseDto> {
    return this.perfil.actualizar(usuario.id, dto);
  }

  /**
   * Cambia la contraseña del comerciante: exige la actual y envía un aviso
   * al correo de la cuenta (HU-04).
   */
  @ApiOperation({
    summary: 'Cambiar mi contraseña',
    description:
      'Requiere la contraseña actual como prueba de identidad y la nueva ' +
      'debe cumplir la política del registro (entre 8 y 128 caracteres con ' +
      'al menos un número). El cambio se aplica, se registra en la tabla de ' +
      'auditoría y se confirma con un aviso al correo de la cuenta (HU-04).',
  })
  @ApiOkResponse({
    type: MensajeResponseDto,
    description: 'Contraseña actualizada y aviso enviado',
  })
  @ApiBadRequestResponse({
    description:
      'La contraseña actual es incorrecta, o la nueva no cumple la política ' +
      'o no coincide con su confirmación',
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({
    description: 'El rol del usuario no es comerciante ni organizador',
  })
  @Patch('password')
  cambiarPassword(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CambiarPasswordDto,
  ): Promise<MensajeResponseDto> {
    return this.perfil.cambiarPassword(usuario.id, dto);
  }
}
