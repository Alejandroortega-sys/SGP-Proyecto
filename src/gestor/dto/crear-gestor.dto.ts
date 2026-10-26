import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import type {
  estado_usuario,
  perfil_gestor,
} from '../../generated/prisma/client';

/** Perfiles de gestor que puede asignar un administrador. */
export const PERFILES_GESTOR: readonly perfil_gestor[] = [
  'revisor',
  'administrador',
];

/**
 * Cuerpo de `POST /gestor/gestores` (solo administrador).
 *
 * Crea una cuenta de gestor con el perfil indicado. La cuenta nace en
 * «pendiente_activacion» y recibe por correo una contraseña temporal que debe
 * cambiarse en el primer inicio de sesión.
 */
export class CrearGestorDto {
  /** Nombres del gestor. */
  @ApiProperty({ example: 'Ana' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @Length(2, 150, {
    message: 'El nombre debe tener entre 2 y 150 caracteres',
  })
  nombre!: string;

  /** Apellidos del gestor. */
  @ApiProperty({ example: 'López', required: false })
  @IsOptional()
  @IsString({ message: 'Los apellidos deben ser texto' })
  @Length(2, 150, {
    message: 'Los apellidos deben tener entre 2 y 150 caracteres',
  })
  apellido?: string;

  /** Correo institucional del gestor. */
  @ApiProperty({ example: 'ana.lopez@tulua.gov.co' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @IsEmail({}, { message: 'El correo no es válido' })
  @MaxLength(150, {
    message: 'El correo no puede superar los 150 caracteres',
  })
  correo!: string;

  /** Perfil del gestor: revisor o administrador. */
  @ApiProperty({ enum: PERFILES_GESTOR, example: 'revisor' })
  @IsIn([...PERFILES_GESTOR], {
    message: 'El perfil debe ser "revisor" o "administrador"',
  })
  perfil!: perfil_gestor;
}

/** Respuesta de `POST /gestor/gestores`. */
export class GestorCreadoDto {
  /** Identificador de la cuenta (BIGINT como string). */
  @ApiProperty({ example: '9' })
  id!: string;

  /** Nombres del gestor. */
  @ApiProperty({ example: 'Ana' })
  nombre!: string;

  /** Apellidos del gestor, si los tiene. */
  @ApiProperty({ example: 'López', required: false, nullable: true })
  apellido?: string | null;

  /** Correo de la cuenta. */
  @ApiProperty({ example: 'ana.lopez@tulua.gov.co' })
  correo!: string;

  /** Perfil asignado. */
  @ApiProperty({ enum: PERFILES_GESTOR, example: 'revisor' })
  perfil!: perfil_gestor;

  /** Estado inicial de la cuenta. */
  @ApiProperty({ example: 'pendiente_activacion' })
  estado!: estado_usuario;

  /** Mensaje orientador. */
  @ApiProperty({
    example:
      'Cuenta de gestor creada. Enviamos la contraseña temporal al correo.',
  })
  mensaje!: string;
}

/** Respuesta de `POST /gestor/gestores/:id/reenviar-invitacion`. */
export class InvitacionGestorReenviadaDto {
  /** Identificador de la cuenta (BIGINT como string). */
  @ApiProperty({ example: '9' })
  id!: string;

  /** Correo institucional al que se enviaron las credenciales. */
  @ApiProperty({ example: 'ana.lopez@tulua.gov.co' })
  correo!: string;

  /** Perfil del gestor. */
  @ApiProperty({ enum: PERFILES_GESTOR, example: 'revisor' })
  perfil!: perfil_gestor;

  /** Mensaje orientador. */
  @ApiProperty({
    example:
      'Invitación reenviada. El gestor recibirá una nueva contraseña temporal.',
  })
  mensaje!: string;
}
