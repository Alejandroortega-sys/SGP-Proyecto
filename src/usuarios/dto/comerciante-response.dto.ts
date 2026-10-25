import { ApiProperty } from '@nestjs/swagger';
import { categoria_comercio } from '../../generated/prisma/client';
import { CuentaResponseDto } from './cuenta-response.dto';

/**
 * Respuesta del registro de un comerciante. Nunca incluye el hash de la
 * contraseña ni el código de activación.
 */
export class ComercianteResponseDto extends CuentaResponseDto {
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
}

/** Respuesta genérica con solo un mensaje (reenvío de código). */
export class MensajeResponseDto {
  /** Mensaje orientador sobre el resultado de la operación. */
  mensaje!: string;
}
