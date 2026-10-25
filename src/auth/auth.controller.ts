import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import {
  LoginPrimerAccesoResponseDto,
  LoginResponseDto,
} from './dto/login-response.dto';
import { LoginDto } from './dto/login.dto';
import { PrimerAccesoGestorDto } from './dto/primer-acceso-gestor.dto';

/**
 * Autenticación de usuarios.
 *
 * `POST /auth/login` es el único endpoint público del módulo: entrega un JWT
 * que el cliente debe enviar como `Authorization: Bearer <token>` en el resto
 * de la API. Los guards globales (`JwtAuthGuard` y `RolesGuard`) validan la
 * sesión y el rol en cada petición.
 *
 * Los gestores recién creados reciben una contraseña temporal. En su primer
 * inicio de sesión el login no entrega el JWT de acceso: responde con
 * `requiereCambioPassword` y el cliente debe llamar a
 * `POST /auth/gestor/primer-acceso` para definir la contraseña definitiva.
 */
@ApiTags('auth')
@ApiExtraModels(LoginResponseDto, LoginPrimerAccesoResponseDto)
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Inicia sesión y devuelve el token JWT junto con los datos públicos del
   * usuario. Si es un gestor pendiente de primer acceso, devuelve el reto de
   * cambio de contraseña.
   */
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Valida el correo y la contraseña (argon2id) y emite un JWT. Tras 5 ' +
      'intentos fallidos consecutivos la cuenta queda bloqueada 15 minutos, ' +
      'y cada IP puede hacer como máximo 10 peticiones por minuto (la ' +
      'petición 11 recibe 429 con el encabezado Retry-After). La vigencia ' +
      'del token es de 30 minutos para gestores y 8 horas para comerciantes ' +
      'y organizadores. Si el usuario es un gestor recién creado con ' +
      'contraseña temporal, no se emite JWT: se responde ' +
      '`requiereCambioPassword: true` para que el cliente lo dirija a ' +
      '`POST /auth/gestor/primer-acceso`.',
  })
  @ApiOkResponse({
    description:
      'Credenciales válidas. Devuelve un JWT o, para un gestor pendiente de ' +
      'primer acceso, la indicación de cambiar la contraseña.',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(LoginResponseDto) },
        { $ref: getSchemaPath(LoginPrimerAccesoResponseDto) },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: 'El cuerpo no cumple las validaciones del DTO',
  })
  @ApiUnauthorizedResponse({
    description:
      'Credenciales inválidas (correo inexistente o contraseña errónea)',
  })
  @ApiForbiddenResponse({
    description:
      'La cuenta no está activa (pendiente de activación que no es de ' +
      'gestor, suspendida o inactiva)',
  })
  @ApiResponse({
    status: HttpStatus.LOCKED,
    description:
      'Cuenta bloqueada temporalmente por demasiados intentos fallidos',
  })
  @ApiTooManyRequestsResponse({
    description:
      'La IP superó el límite de 10 peticiones por minuto; el encabezado ' +
      'Retry-After indica los segundos de espera',
  })
  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
  ): Promise<LoginResponseDto | LoginPrimerAccesoResponseDto> {
    return this.auth.login(dto);
  }

  /**
   * Completa el primer acceso de un gestor recién creado: valida la
   * contraseña temporal enviada por correo y guarda la contraseña definitiva.
   */
  @ApiOperation({
    summary: 'Cambiar la contraseña en el primer acceso del gestor',
    description:
      'Endpoint público con rate limit. Verifica el correo y la contraseña ' +
      'temporal enviada al gestor y guarda la contraseña definitiva. La ' +
      'cuenta pasa de «pendiente_activacion» a «activa» y el cambio queda ' +
      'auditado con el propio gestor como actor. Devuelve el JWT normal de ' +
      'inicio de sesión.',
  })
  @ApiOkResponse({
    type: LoginResponseDto,
    description: 'Contraseña actualizada y sesión iniciada',
  })
  @ApiBadRequestResponse({
    description:
      'Los datos no cumplen las validaciones o las contraseñas no coinciden',
  })
  @ApiUnauthorizedResponse({
    description: 'La cuenta no existe o la contraseña temporal es incorrecta',
  })
  @ApiForbiddenResponse({
    description:
      'La cuenta no pertenece a un gestor o está suspendida/inactiva',
  })
  @ApiConflictResponse({
    description: 'La cuenta ya está activa y no requiere primer acceso',
  })
  @ApiResponse({
    status: HttpStatus.LOCKED,
    description:
      'Cuenta bloqueada temporalmente por demasiados intentos fallidos',
  })
  @ApiTooManyRequestsResponse({
    description:
      'La IP superó el límite de peticiones por minuto; el encabezado ' +
      'Retry-After indica los segundos de espera',
  })
  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @Post('gestor/primer-acceso')
  async primerAccesoGestor(
    @Body() dto: PrimerAccesoGestorDto,
  ): Promise<LoginResponseDto> {
    return this.auth.primerAccesoGestor(dto);
  }
}
