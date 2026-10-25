import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
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
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { parseIdBigint } from '../common/parse-id';
import { Public } from '../auth/decorators/public.decorator';
import { ActivarCuentaDto } from './dto/activar-cuenta.dto';
import {
  ActualizarComercianteGestorDto,
  ComercianteActualizadoDto,
} from './dto/actualizar-comerciante-gestor.dto';
import {
  ComercianteResponseDto,
  MensajeResponseDto,
} from './dto/comerciante-response.dto';
import { CrearComercianteDto } from './dto/crear-comerciante.dto';
import { CrearOrganizadorDto } from './dto/crear-organizador.dto';
import { CuentaResponseDto } from './dto/cuenta-response.dto';
import { ReenviarCodigoDto } from './dto/reenviar-codigo.dto';
import { RestablecerPasswordDto } from './dto/restablecer-password.dto';
import { SolicitarRecuperacionDto } from './dto/solicitar-recuperacion.dto';
import { UsuariosService } from './usuarios.service';

/**
 * Registro, activación y recuperación de contraseña de los usuarios.
 *
 * Endpoints públicos: el registro crea la cuenta en «Pendiente de
 * activación», la activación compara el código enviado por correo con el
 * hash guardado en la base de datos, y la recuperación permite cambiar la
 * contraseña confirmando un código de vigencia corta.
 */
@ApiTags('usuarios')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  /**
   * Registra el perfil de un comerciante con sus datos personales,
   * actividad comercial y contraseña (hasheada con argon2).
   */
  @ApiOperation({
    summary: 'Registrar comerciante',
    description:
      'Crea la cuenta en estado «pendiente_activacion» junto con su perfil ' +
      'comercial y envía un código de activación al correo. La contraseña se ' +
      'almacena hasheada con argon2 (argon2id).',
  })
  @ApiCreatedResponse({
    type: ComercianteResponseDto,
    description: 'Cuenta creada en estado «pendiente_activacion»',
  })
  @ApiBadRequestResponse({
    description: 'Los datos enviados no cumplen las validaciones del DTO',
  })
  @ApiConflictResponse({
    description: 'El correo o el documento ya están registrados',
  })
  @ApiServiceUnavailableResponse({
    description:
      'La cuenta fue creada, pero no se pudo enviar el código de activación',
  })
  @Public()
  @Post('comerciantes')
  crearComerciante(
    @Body() dto: CrearComercianteDto,
  ): Promise<ComercianteResponseDto> {
    return this.usuarios.crearComerciante(dto);
  }

  /**
   * Registra la cuenta personal de un organizador de feria. La organización
   * se crea después de activar la cuenta.
   */
  @ApiOperation({
    summary: 'Registrar organizador',
    description:
      'Crea la cuenta personal de un organizador en estado ' +
      '«pendiente_activacion» y envía un código de activación al correo. ' +
      'La organización se registra después de activar la cuenta, con ' +
      '`POST /organizadores/mi-organizacion`. La contraseña se almacena ' +
      'hasheada con argon2 (argon2id).',
  })
  @ApiCreatedResponse({
    type: CuentaResponseDto,
    description:
      'Cuenta de organizador creada en estado «pendiente_activacion»',
  })
  @ApiBadRequestResponse({
    description: 'Los datos enviados no cumplen las validaciones del DTO',
  })
  @ApiConflictResponse({
    description: 'El correo o el documento ya están registrados',
  })
  @ApiServiceUnavailableResponse({
    description:
      'La cuenta fue creada, pero no se pudo enviar el código de activación',
  })
  @Public()
  @Post('organizadores')
  crearOrganizador(
    @Body() dto: CrearOrganizadorDto,
  ): Promise<CuentaResponseDto> {
    return this.usuarios.crearOrganizador(dto);
  }

  /**
   * Activa la cuenta del comerciante u organizador con el código numérico de
   * 6 dígitos que recibió por correo.
   */
  @ApiOperation({
    summary: 'Activar cuenta con el código recibido por correo',
    description:
      'Compara el código enviado con el hash guardado en `tokens_seguridad`. ' +
      'Si es correcto y no ha expirado, la cuenta pasa a estado «activa».',
  })
  @ApiOkResponse({
    type: CuentaResponseDto,
    description: 'Cuenta activada correctamente',
  })
  @ApiBadRequestResponse({
    description: 'El código es inválido, ya fue usado o ha expirado',
  })
  @ApiConflictResponse({ description: 'La cuenta ya está activa' })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('activacion')
  activarCuenta(@Body() dto: ActivarCuentaDto): Promise<CuentaResponseDto> {
    return this.usuarios.activarCuenta(dto);
  }

  /**
   * Vuelve a generar el código de activación y lo envía al correo.
   * La respuesta es genérica para no revelar si la cuenta existe.
   */
  @ApiOperation({
    summary: 'Reenviar el código de activación',
    description:
      'Invalida los códigos anteriores y genera uno nuevo con la misma ' +
      'vigencia. La respuesta es idéntica exista o no la cuenta, para evitar ' +
      'la enumeración de correos registrados.',
  })
  @ApiOkResponse({
    type: MensajeResponseDto,
    description: 'Código reenviado si la cuenta estaba pendiente de activación',
  })
  @ApiBadRequestResponse({
    description: 'El correo enviado no es válido',
  })
  @ApiServiceUnavailableResponse({
    description: 'No se pudo enviar el nuevo código de activación',
  })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('activacion/reenviar')
  reenviarCodigo(@Body() dto: ReenviarCodigoDto): Promise<MensajeResponseDto> {
    return this.usuarios.reenviarCodigo(dto);
  }

  /**
   * Solicita un código para restablecer la contraseña. Solo las cuentas
   * activas reciben código; la respuesta es genérica para no revelar si el
   * correo está registrado.
   */
  @ApiOperation({
    summary: 'Solicitar recuperación de contraseña',
    description:
      'Envía un código de 6 dígitos al correo de la cuenta, si existe y ' +
      'está activa. El código vence en 2 minutos y cada solicitud invalida ' +
      'las anteriores. La respuesta es idéntica exista o no la cuenta, para ' +
      'evitar la enumeración de correos registrados.',
  })
  @ApiOkResponse({
    type: MensajeResponseDto,
    description: 'Código enviado si el correo corresponde a una cuenta activa',
  })
  @ApiBadRequestResponse({
    description: 'El correo enviado no es válido',
  })
  @ApiTooManyRequestsResponse({
    description:
      'La IP superó el límite de 10 peticiones por minuto; el encabezado ' +
      'Retry-After indica los segundos de espera',
  })
  @ApiServiceUnavailableResponse({
    description: 'No se pudo enviar el código de recuperación',
  })
  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @Post('password/recuperar')
  solicitarRecuperacion(
    @Body() dto: SolicitarRecuperacionDto,
  ): Promise<MensajeResponseDto> {
    return this.usuarios.solicitarRecuperacion(dto);
  }

  /**
   * Restablece la contraseña confirmando el código de recuperación.
   * La contraseña nueva sigue la misma política del registro y el cambio
   * limpia el bloqueo por intentos fallidos del login.
   */
  @ApiOperation({
    summary: 'Restablecer la contraseña con el código recibido',
    description:
      'Compara el código con el hash guardado en `tokens_seguridad` ' +
      '(tipo `recuperacion_password`). Si es correcto y no ha expirado, ' +
      'actualiza la contraseña con hash argon2id y desbloquea la cuenta. ' +
      'La contraseña nueva debe tener entre 8 y 128 caracteres e incluir ' +
      'al menos un número.',
  })
  @ApiOkResponse({
    type: MensajeResponseDto,
    description: 'Contraseña actualizada correctamente',
  })
  @ApiBadRequestResponse({
    description:
      'El código es inválido, ya fue usado o ha expirado, o la contraseña ' +
      'no cumple la política',
  })
  @ApiTooManyRequestsResponse({
    description:
      'La IP superó el límite de 10 peticiones por minuto; el encabezado ' +
      'Retry-After indica los segundos de espera',
  })
  @ApiServiceUnavailableResponse({
    description: 'Error inesperado al actualizar la contraseña',
  })
  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @Post('password/restablecer')
  restablecerPassword(
    @Body() dto: RestablecerPasswordDto,
  ): Promise<MensajeResponseDto> {
    return this.usuarios.restablecerPassword(dto);
  }

  /**
   * Corrige los campos sensibles del perfil de un comerciante (documento,
   * tipo de documento, actividad comercial y categoría). Los demás datos los
   * actualiza el propio comerciante desde `PATCH /perfil`. El cambio queda
   * registrado en la tabla `auditoria` con el gestor como actor.
   */
  @ApiOperation({
    summary: 'Corregir datos sensibles de un comerciante (gestor)',
    description:
      'Acceso exclusivo del rol «gestor» (perfiles revisor y ' +
      'administrador). Corrige los campos que el comerciante no puede tocar ' +
      'desde su perfil (HU-04): documento (único en el sistema), tipo de ' +
      'documento, actividad comercial y categoría. Debe enviarse al menos un ' +
      'campo. El cambio se audita en la base de datos con el gestor como ' +
      'actor: el trigger de `usuarios` cubre documento y tipo, y la ' +
      'aplicación registra en `auditoria` los cambios de `comerciantes`.',
  })
  @ApiOkResponse({
    type: ComercianteActualizadoDto,
    description: 'Datos del comerciante corregidos y auditados',
  })
  @ApiBadRequestResponse({
    description:
      'El identificador no es numérico, el cuerpo no trae campos válidos o ' +
      'una propiedad no está permitida',
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({
    description: 'El rol del usuario no es gestor',
  })
  @ApiNotFoundResponse({
    description: 'El usuario no existe o no es comerciante',
  })
  @ApiConflictResponse({
    description: 'El documento ya está registrado en otra cuenta',
  })
  @ApiBearerAuth()
  @Roles('gestor')
  @HttpCode(HttpStatus.OK)
  @Patch(':id/comerciante')
  actualizarComerciante(
    @Param('id') id: string,
    @Body() dto: ActualizarComercianteGestorDto,
    @UsuarioActual() gestor: UsuarioAutenticado,
  ): Promise<ComercianteActualizadoDto> {
    return this.usuarios.actualizarComerciantePorGestor(
      parseIdBigint(id),
      dto,
      parseIdBigint(gestor.id),
    );
  }
}
