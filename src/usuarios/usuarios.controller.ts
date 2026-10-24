import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ActivarCuentaDto } from './dto/activar-cuenta.dto';
import { ComercianteResponseDto, MensajeResponseDto } from './dto/comerciante-response.dto';
import { CrearComercianteDto } from './dto/crear-comerciante.dto';
import { ReenviarCodigoDto } from './dto/reenviar-codigo.dto';
import { UsuariosService } from './usuarios.service';

/**
 * Registro y activación de comerciantes (HU-01).
 *
 * Endpoints públicos: el registro crea la cuenta en «Pendiente de activación»
 * y la activación compara el código enviado por correo con el hash guardado
 * en la base de datos.
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
  @Post('comerciantes')
  crearComerciante(
    @Body() dto: CrearComercianteDto,
  ): Promise<ComercianteResponseDto> {
    return this.usuarios.crearComerciante(dto);
  }

  /**
   * Activa la cuenta del comerciante con el código numérico de 6 dígitos
   * que recibió por correo.
   */
  @ApiOperation({
    summary: 'Activar cuenta con el código recibido por correo',
    description:
      'Compara el código enviado con el hash guardado en `tokens_seguridad`. ' +
      'Si es correcto y no ha expirado, la cuenta pasa a estado «activa».',
  })
  @ApiOkResponse({
    type: ComercianteResponseDto,
    description: 'Cuenta activada correctamente',
  })
  @ApiBadRequestResponse({
    description: 'El código es inválido, ya fue usado o ha expirado',
  })
  @ApiConflictResponse({ description: 'La cuenta ya está activa' })
  @HttpCode(HttpStatus.OK)
  @Post('activacion')
  activarCuenta(
    @Body() dto: ActivarCuentaDto,
  ): Promise<ComercianteResponseDto> {
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
  @HttpCode(HttpStatus.OK)
  @Post('activacion/reenviar')
  reenviarCodigo(@Body() dto: ReenviarCodigoDto): Promise<MensajeResponseDto> {
    return this.usuarios.reenviarCodigo(dto);
  }
}
