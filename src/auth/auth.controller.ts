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
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { LoginResponseDto } from './dto/login-response.dto';
import { LoginDto } from './dto/login.dto';

/**
 * Autenticación de usuarios.
 *
 * `POST /auth/login` es el único endpoint público del módulo: entrega un JWT
 * que el cliente debe enviar como `Authorization: Bearer <token>` en el resto
 * de la API. Los guards globales (`JwtAuthGuard` y `RolesGuard`) validan la
 * sesión y el rol en cada petición.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Inicia sesión y devuelve el token JWT junto con los datos públicos del
   * usuario. El token del gestor vence en 30 minutos; el de comerciantes y
   * organizadores, en 8 horas.
   */
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Valida el correo y la contraseña (argon2id) y emite un JWT. Tras 5 ' +
      'intentos fallidos consecutivos la cuenta queda bloqueada 15 minutos, ' +
      'y cada IP puede hacer como máximo 10 peticiones por minuto (la ' +
      'petición 11 recibe 429 con el encabezado Retry-After). La vigencia ' +
      'del token es de 30 minutos para gestores y 8 horas para comerciantes ' +
      'y organizadores.',
  })
  @ApiOkResponse({
    type: LoginResponseDto,
    description: 'Credenciales válidas; incluye el JWT y los datos del usuario',
  })
  @ApiBadRequestResponse({
    description: 'El cuerpo no cumple las validaciones del DTO',
  })
  @ApiUnauthorizedResponse({
    description: 'Credenciales inválidas (correo inexistente o contraseña errónea)',
  })
  @ApiForbiddenResponse({
    description:
      'La cuenta no está activa (pendiente de activación, suspendida o inactiva)',
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
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.auth.login(dto);
  }
}
