import { ApiProperty } from '@nestjs/swagger';
import {
  categoria_comercio,
  estado_usuario,
  rol_usuario,
} from '../../generated/prisma/client';

/**
 * Respuesta estándar del registro y de la activación de la cuenta del
 * comerciante. Nunca incluye el hash de la contraseña ni el código de
 * activación.
 */
export class ComercianteResponseDto {
  /** Identificador de la cuenta. Los BIGINT se serializan como string. */
  id!: string;

  /** Nombres del comerciante. */
  nombre!: string;

  /** Apellidos del comerciante. */
  apellido?: string;

  /** Correo de la cuenta. */
  correo!: string;

  /** Rol de la cuenta (siempre "comerciante" en este flujo). */
  @ApiProperty({ enum: rol_usuario, example: 'comerciante' })
  rol!: rol_usuario;

  /** Estado de la cuenta tras la operación. */
  @ApiProperty({
    enum: estado_usuario,
    examples: ['pendiente_activacion', 'activa'],
  })
  estado!: estado_usuario;

  /** Actividad comercial registrada en el perfil. */
  @ApiProperty({
    example: 'Venta de frutas y verduras',
    required: false,
  })
  actividadComercial?: string;

  /** Categoría del comercio (formal/informal). */
  @ApiProperty({
    enum: categoria_comercio,
    example: 'formal',
    required: false,
  })
  categoria?: categoria_comercio;

  /** Mensaje orientador sobre el resultado de la operación. */
  mensaje!: string;
}

/** Respuesta genérica con solo un mensaje (reenvío de código). */
export class MensajeResponseDto {
  /** Mensaje orientador sobre el resultado de la operación. */
  mensaje!: string;
}
