import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import type { estado_usuario } from '../../generated/prisma/client';

/** Estados a los que un administrador puede llevar una cuenta. */
export const ESTADOS_CUENTA_GESTIONABLES = [
  'activa',
  'suspendida',
  'inactiva',
] as const;

/** Estado gestionable por el gestor administrador. */
export type EstadoCuentaGestionable =
  (typeof ESTADOS_CUENTA_GESTIONABLES)[number];

/**
 * Cuerpo de `PATCH /gestor/usuarios/:id/estado`.
 *
 * `activa` habilita la cuenta (y limpia el bloqueo por intentos fallidos);
 * `suspendida` e `inactiva` la deshabilitan. El cambio queda registrado en la
 * tabla `auditoria` con el gestor autenticado como actor.
 */
export class CambiarEstadoUsuarioDto {
  /** Estado nuevo de la cuenta. */
  @ApiProperty({
    enum: ESTADOS_CUENTA_GESTIONABLES,
    example: 'suspendida',
    description: 'Nuevo estado de la cuenta: activa, suspendida o inactiva',
  })
  @IsIn([...ESTADOS_CUENTA_GESTIONABLES], {
    message: 'El estado debe ser "activa", "suspendida" o "inactiva"',
  })
  estado!: EstadoCuentaGestionable;

  /**
   * Motivo de la suspensión o inactivación. Se usa en el correo que recibe
   * el titular y en el mensaje de confirmación del administrador. No se
   * almacena en una columna nueva.
   */
  @ApiProperty({
    example: 'Incumplimiento del horario autorizado',
    required: false,
    description:
      'Motivo de la suspensión o inactivación; se incluye en el correo al titular',
  })
  @IsOptional()
  @IsString({ message: 'El motivo debe ser texto' })
  @Length(3, 300, {
    message: 'El motivo debe tener entre 3 y 300 caracteres',
  })
  motivo?: string;
}

/** Respuesta de `PATCH /gestor/usuarios/:id/estado`. */
export class UsuarioEstadoActualizadoDto {
  /** Identificador de la cuenta (BIGINT como string). */
  @ApiProperty({ example: '5' })
  id!: string;

  /** Nombres del titular de la cuenta. */
  @ApiProperty({ example: 'José' })
  nombre!: string;

  /** Correo de la cuenta. */
  @ApiProperty({ example: 'jose.perez@hotmail.com' })
  correo!: string;

  /** Estado que tenía la cuenta antes del cambio. */
  @ApiProperty({
    enum: ['pendiente_activacion', 'activa', 'suspendida', 'inactiva'],
    example: 'activa',
  })
  estadoAnterior!: estado_usuario;

  /** Estado nuevo de la cuenta. */
  @ApiProperty({
    enum: ['activa', 'suspendida', 'inactiva'],
    example: 'suspendida',
  })
  estado!: estado_usuario;

  /** Motivo informado al titular, si se envió. */
  @ApiProperty({
    example: 'Incumplimiento del horario autorizado',
    required: false,
    nullable: true,
  })
  motivo?: string | null;

  /** Mensaje orientador sobre el resultado de la operación. */
  @ApiProperty({
    example: 'Cuenta suspendida. El cambio quedó registrado en la auditoría.',
  })
  mensaje!: string;
}
