import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
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

  /** Mensaje orientador sobre el resultado de la operación. */
  @ApiProperty({
    example: 'Cuenta suspendida. El cambio quedó registrado en la auditoría.',
  })
  mensaje!: string;
}
