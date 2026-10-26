import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import type {
  estado_usuario,
  perfil_gestor,
} from '../../generated/prisma/client';

/**
 * Cuerpo de `PATCH /gestor/perfil`.
 *
 * Permite actualizar los datos personales y de contacto del gestor
 * autenticado. El correo, el perfil y el estado no se modifican desde aquí.
 */
export class ActualizarPerfilGestorDto {
  /** Nombres del gestor. */
  @IsOptional()
  @IsNotEmpty({ message: 'El nombre no puede quedar vacío' })
  @Length(2, 150, {
    message: 'El nombre debe tener entre 2 y 150 caracteres',
  })
  nombre?: string;

  /** Apellidos del gestor; `null` los limpia. */
  @IsOptional()
  @IsString({ message: 'Los apellidos deben ser texto' })
  @Length(2, 150, {
    message: 'Los apellidos deben tener entre 2 y 150 caracteres',
  })
  apellido?: string | null;

  /** Teléfono de contacto del gestor. */
  @IsOptional()
  @Matches(/^[+0-9][0-9\s()-]{6,29}$/, {
    message: 'El teléfono no es válido',
  })
  telefono?: string;
}

/** Respuesta de `GET /gestor/perfil` y `PATCH /gestor/perfil`. */
export class PerfilGestorResponseDto {
  /** Identificador de la cuenta (BIGINT como string). */
  @ApiProperty({ example: '1' })
  id!: string;

  /** Nombres del gestor. */
  @ApiProperty({ example: 'Laura' })
  nombre!: string;

  /** Apellidos del gestor. */
  @ApiProperty({ example: 'Martínez', required: false, nullable: true })
  apellido?: string | null;

  /** Correo institucional. */
  @ApiProperty({ example: 'admin@tulua.gov.co' })
  correo!: string;

  /** Teléfono de contacto. */
  @ApiProperty({ example: '3001122334', required: false, nullable: true })
  telefono?: string | null;

  /** Perfil de permisos del gestor. */
  @ApiProperty({ enum: ['revisor', 'administrador'], example: 'administrador' })
  perfil!: perfil_gestor;

  /** Estado de la cuenta. */
  @ApiProperty({ enum: ['activa', 'suspendida', 'inactiva'], example: 'activa' })
  estado!: estado_usuario;

  /** Fecha de creación de la cuenta. */
  @ApiProperty({ example: '2026-09-15T14:30:00.000Z' })
  creadoEn!: Date;

  /** Fecha de la última actualización. */
  @ApiProperty({ example: '2026-09-20T10:00:00.000Z' })
  actualizadoEn!: Date;
}
