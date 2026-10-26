import { ApiProperty } from '@nestjs/swagger';
import {
  estado_usuario,
  perfil_gestor,
  rol_usuario,
} from '../../generated/prisma/client';

/** Datos públicos del usuario que inicia sesión. */
export class UsuarioLoginDto {
  /** Identificador de la cuenta (BIGINT como string). */
  @ApiProperty({ example: '3' })
  id!: string;

  /** Nombres del usuario. */
  @ApiProperty({ example: 'María' })
  nombre!: string;

  /** Apellidos del usuario. */
  @ApiProperty({ example: 'Gómez', required: false })
  apellido?: string;

  /** Correo normalizado de la cuenta. */
  @ApiProperty({ example: 'maria.gomez@gmail.com' })
  correo!: string;

  /** Rol que determina los endpoints permitidos. */
  @ApiProperty({ enum: rol_usuario, example: 'comerciante' })
  rol!: rol_usuario;

  /** Perfil del gestor; `null` para los demás roles. */
  @ApiProperty({
    enum: perfil_gestor,
    example: 'administrador',
    nullable: true,
  })
  perfil!: perfil_gestor | null;

  /** Estado de la cuenta (siempre `activa` en un login correcto). */
  @ApiProperty({ enum: estado_usuario, example: 'activa' })
  estado!: estado_usuario;
}

/** Respuesta del inicio de sesión correcto (`POST /auth/login`). */
export class LoginResponseDto {
  /** Indica que el usuario ya puede usar la plataforma. */
  @ApiProperty({ example: false })
  requiereCambioPassword!: false;

  /** JWT que debe enviarse como `Authorization: Bearer <token>`. */
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  /** Token opaco para renovar la sesión sin volver a pedir credenciales. */
  @ApiProperty({ example: '9f8c1b...' })
  refreshToken!: string;

  /** Esquema de autorización; siempre `Bearer`. */
  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  /** Vigencia del access token en segundos (1800 gestor, 28800 resto). */
  @ApiProperty({ example: 28800 })
  expiresIn!: number;

  /** Vigencia del refresh token en segundos. */
  @ApiProperty({ example: 604800 })
  refreshExpiresIn!: number;

  /** Datos públicos del usuario autenticado. */
  @ApiProperty({ type: UsuarioLoginDto })
  usuario!: UsuarioLoginDto;
}

/**
 * Respuesta de `POST /auth/login` cuando un gestor recién creado aún no ha
 * cambiado su contraseña temporal.
 *
 * No incluye JWT de acceso a la plataforma: el cliente debe dirigir al
 * usuario al cambio de contraseña de primer acceso.
 */
export class LoginPrimerAccesoResponseDto {
  /** Indica que el usuario debe cambiar la contraseña antes de continuar. */
  @ApiProperty({ example: true })
  requiereCambioPassword!: true;

  /** Correo de la cuenta (para mostrarlo en el formulario de cambio). */
  @ApiProperty({ example: 'ana.lopez@tulua.gov.co' })
  correo!: string;

  /** Nombres del gestor. */
  @ApiProperty({ example: 'Ana' })
  nombre!: string;

  /** Perfil asignado al gestor. */
  @ApiProperty({ enum: perfil_gestor, example: 'revisor' })
  perfil!: perfil_gestor;

  /** Mensaje orientador para el primer acceso. */
  @ApiProperty({
    example:
      'Debes cambiar tu contraseña para activar la cuenta y acceder a la plataforma.',
  })
  mensaje!: string;
}

/** Respuesta de `POST /auth/refresh`. */
export class RefreshResponseDto {
  /** Nuevo JWT de acceso. */
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  /** Nuevo refresh token; el anterior queda invalidado por rotación. */
  @ApiProperty({ example: '9f8c1b...' })
  refreshToken!: string;

  /** Esquema de autorización; siempre `Bearer`. */
  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  /** Vigencia del access token en segundos. */
  @ApiProperty({ example: 28800 })
  expiresIn!: number;

  /** Vigencia del refresh token en segundos. */
  @ApiProperty({ example: 604800 })
  refreshExpiresIn!: number;

  /** Datos públicos del usuario autenticado. */
  @ApiProperty({ type: UsuarioLoginDto })
  usuario!: UsuarioLoginDto;
}
