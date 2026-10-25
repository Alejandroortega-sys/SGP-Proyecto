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
 * Perfil del comerciante autenticado (HU-04).
 *
 * Exclusivo del rol «comerciante»: muestra sus datos en tres secciones
 * (datos personales, actividad comercial y seguridad) y permite actualizar
 * los datos de contacto. El documento, la actividad comercial y la categoría
 * solo los corrige un gestor municipal (HU-04), y el correo queda fijo hasta
 * que exista un flujo de verificación. Los guards globales aplican el JWT y
 * el rol; cada cambio queda auditado en la tabla `auditoria`.
 */
@ApiTags('perfil')
@ApiBearerAuth()
@Roles('comerciante')
@Controller('perfil')
export class PerfilController {
  constructor(private readonly perfil: PerfilService) {}

  /**
   * Devuelve el perfil del comerciante autenticado en las tres secciones de
   * la HU-04. El documento y la actividad comercial se muestran pero no se
   * pueden cambiar aquí.
   */
  @ApiOperation({
    summary: 'Ver mi perfil',
    description:
      'Devuelve los datos del comerciante autenticado organizados en tres ' +
      'secciones (HU-04): datos personales, actividad comercial y seguridad. ' +
      'Nunca expone la contraseña (solo su hash interno).',
  })
  @ApiOkResponse({
    type: PerfilResponseDto,
    description: 'Perfil del comerciante autenticado',
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({
    description: 'El rol del usuario no es comerciante',
  })
  @Get()
  ver(@UsuarioActual() usuario: UsuarioAutenticado): Promise<PerfilResponseDto> {
    return this.perfil.ver(usuario.id);
  }

  /**
   * Actualiza los datos personales del comerciante: `nombre`, `apellido` y
   * `telefono` (al menos uno). El resto de campos del perfil no se aceptan:
   * si se envían, la validación global responde 400.
   */
  @ApiOperation({
    summary: 'Actualizar mis datos personales',
    description:
      'Actualiza parcialmente los datos personales y de contacto del ' +
      'comerciante autenticado (nombre, apellido y/o teléfono; al menos uno). ' +
      '**Campos bloqueados** (documento, tipoDocumento, actividadComercial, ' +
      'categoria, correo y estado): si se envían, la respuesta es 400 porque ' +
      'su corrección corresponde a un gestor municipal (HU-04). El cambio ' +
      'queda registrado en la tabla de auditoría.',
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
    description: 'El rol del usuario no es comerciante',
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
    description: 'El rol del usuario no es comerciante',
  })
  @Patch('password')
  cambiarPassword(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CambiarPasswordDto,
  ): Promise<MensajeResponseDto> {
    return this.perfil.cambiarPassword(usuario.id, dto);
  }
}
