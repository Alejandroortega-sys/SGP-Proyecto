import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { UsuarioActual } from './decorators/usuario-actual.decorator';
import {
  LoginPrimerAccesoResponseDto,
  LoginResponseDto,
  RefreshResponseDto,
  UsuarioLoginDto,
} from './dto/login-response.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { PrimerAccesoGestorDto } from './dto/primer-acceso-gestor.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import type { UsuarioAutenticado } from './interfaces/usuario-autenticado.interface';

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
   * Devuelve el usuario autenticado a partir del JWT. Sirve para comprobar
   * al cargar el frontend si la sesión sigue vigente y recuperar el rol.
   */
  @ApiOperation({
    summary: 'Consultar la sesión actual',
    description:
      'Devuelve los datos públicos del usuario autenticado. Es el endpoint ' +
      'que usa el frontend para saber si el token sigue vigente y a qué ' +
      'vista redirigir. Responde 401 si el token falta, es inválido, expiró ' +
      'o fue revocado por un logout.',
  })
  @ApiOkResponse({
    type: UsuarioLoginDto,
    description: 'Datos del usuario autenticado',
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el token, es inválido, expiró o fue revocado',
  })
  @ApiBearerAuth()
  @Get('me')
  me(@UsuarioActual() usuario: UsuarioAutenticado): UsuarioLoginDto {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      correo: usuario.correo,
      rol: usuario.rol,
      perfil: usuario.perfil,
      estado: usuario.estado,
    };
  }

  /**
   * Cierra la sesión: revoca la sesión en la base de datos. El frontend debe
   * eliminar el access token y el refresh token de su almacenamiento.
   */
  @ApiOperation({
    summary: 'Cerrar sesión',
    description:
      'Marca como revocada la sesión actual en la tabla `sesiones`. Si el ' +
      'cuerpo envía `todas: true`, revoca todas las sesiones del usuario. ' +
      'El access token deja de servir inmediatamente y el refresh token ya ' +
      'no puede rotarse. El frontend debe eliminar ambos tokens tras ' +
      'recibir 204.',
  })
  @ApiNoContentResponse({ description: 'Sesión cerrada' })
  @ApiUnauthorizedResponse({
    description: 'Falta el token o es inválido/expirado',
  })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Req() request: Request,
    @Body() dto: LogoutDto,
  ): Promise<void> {
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException(
        'Falta el token de acceso (Authorization: Bearer <token>)',
      );
    }
    await this.auth.logout(usuario.id, token, dto);
  }

  /**
   * Renueva el access token a partir de un refresh token válido.
   */
  @ApiOperation({
    summary: 'Renovar la sesión con refresh token',
    description:
      'Valida el refresh token, lo rota y devuelve un nuevo access token y un ' +
      'nuevo refresh token. El refresh anterior queda invalidado. Si se ' +
      'reutiliza el refresh anterior, la sesión se revoca y responde 401. ' +
      'El access token resultante mantiene la misma sesión (`sid`).',
  })
  @ApiOkResponse({
    type: RefreshResponseDto,
    description: 'Nuevos tokens de acceso y refresh',
  })
  @ApiBadRequestResponse({ description: 'Refresh token ausente o inválido' })
  @ApiUnauthorizedResponse({
    description: 'Refresh token inválido, expirado, revocado o reutilizado',
  })
  @ApiForbiddenResponse({
    description: 'La cuenta asociada a la sesión no está activa',
  })
  @ApiTooManyRequestsResponse({
    description:
      'La IP superó el límite de 10 peticiones por minuto; el encabezado ' +
      'Retry-After indica los segundos de espera',
  })
  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto): Promise<RefreshResponseDto> {
    return this.auth.refresh(dto);
  }

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
