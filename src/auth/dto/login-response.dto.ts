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
  /** JWT que debe enviarse como `Authorization: Bearer <token>`. */
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  /** Esquema de autorización; siempre `Bearer`. */
  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  /** Vigencia del token en segundos (1800 para gestor, 28800 para el resto). */
  @ApiProperty({ example: 28800 })
  expiresIn!: number;

  /** Datos públicos del usuario autenticado. */
  @ApiProperty({ type: UsuarioLoginDto })
  usuario!: UsuarioLoginDto;
}
