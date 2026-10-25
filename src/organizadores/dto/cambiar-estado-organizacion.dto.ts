import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import type { estado_organizacion } from '../../generated/prisma/client';

/** Estados a los que el gestor puede llevar una organización. */
export const ESTADOS_ORGANIZACION_GESTOR = ['activa', 'suspendida'] as const;

/** Cuerpo de `PATCH /gestor/organizaciones/:id/estado`. */
export class CambiarEstadoOrganizacionDto {
  /** Estado nuevo de la organización. */
  @ApiProperty({
    enum: ESTADOS_ORGANIZACION_GESTOR,
    example: 'activa',
  })
  @IsIn([...ESTADOS_ORGANIZACION_GESTOR], {
    message: 'El estado debe ser "activa" o "suspendida"',
  })
  estado!: Extract<estado_organizacion, 'activa' | 'suspendida'>;

  /** Motivo opcional; se incluye en la notificación al organizador. */
  @IsOptional()
  @IsString({ message: 'El motivo debe ser texto' })
  @Length(3, 300, {
    message: 'El motivo debe tener entre 3 y 300 caracteres',
  })
  motivo?: string;
}
