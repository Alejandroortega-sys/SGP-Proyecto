import { ApiProperty } from '@nestjs/swagger';
import { estado_usuario, rol_usuario } from '../../generated/prisma/client';

/**
 * Respuesta común del registro y de la activación de una cuenta.
 *
 * La usan comerciantes y organizadores; nunca incluye el hash de la
 * contraseña ni el código de activación.
 */
export class CuentaResponseDto {
  /** Identificador de la cuenta. Los BIGINT se serializan como string. */
  id!: string;

  /** Nombres del titular de la cuenta. */
  nombre!: string;

  /** Apellidos del titular, si los registró. */
  apellido?: string;

  /** Correo de la cuenta. */
  correo!: string;

  /** Rol de la cuenta. */
  @ApiProperty({ enum: rol_usuario, example: 'organizador' })
  rol!: rol_usuario;

  /** Estado de la cuenta tras la operación. */
  @ApiProperty({
    enum: estado_usuario,
    examples: ['pendiente_activacion', 'activa'],
  })
  estado!: estado_usuario;

  /** Mensaje orientador sobre el resultado de la operación. */
  mensaje!: string;
}
