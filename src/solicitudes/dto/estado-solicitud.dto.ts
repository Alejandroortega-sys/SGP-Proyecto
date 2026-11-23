import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import type { estado_solicitud } from '../../generated/prisma/client';
import { ESTADOS_CAMBIO_GESTOR } from '../../common/estados-solicitud';

function recortar(valor: unknown): unknown {
  return typeof valor === 'string' ? valor.trim() : valor;
}

/**
 * Cuerpo de `PATCH /gestor/solicitudes/:id/estado` (HU-18).
 *
 * La aprobación y el rechazo se realizan con `PATCH .../resolucion` porque
 * asignan el espacio en la misma transacción (HU-20).
 */
export class CambiarEstadoSolicitudDto {
  @ApiProperty({
    enum: [...ESTADOS_CAMBIO_GESTOR],
    example: 'en_revision',
    description:
      'Estado nuevo del trámite. Solo se permiten las transiciones de la máquina de estados que no resuelven la solicitud.',
  })
  @IsIn([...ESTADOS_CAMBIO_GESTOR], {
    message: 'El estado debe ser en_revision o devuelta',
  })
  estado!: estado_solicitud;

  @ApiPropertyOptional({
    example: 'Falta el RUT actualizado.',
    description:
      'Observación del gestor. Obligatoria cuando el estado es «devuelta».',
  })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'La observación debe ser texto' })
  @Length(1, 2_000, {
    message: 'La observación debe tener entre 1 y 2000 caracteres',
  })
  observacion?: string;
}

/** Respuesta de un cambio de estado de solicitud. */
export class CambiarEstadoSolicitudResponseDto {
  @ApiProperty({ example: '12' })
  id!: string;

  @ApiProperty({ example: 'SOL-2026-00012' })
  numeroRadicado!: string;

  @ApiProperty({ example: 'radicada' })
  estadoAnterior!: estado_solicitud;

  @ApiProperty({ example: 'en_revision' })
  estado!: estado_solicitud;

  @ApiProperty({
    example: 'El gestor inició la revisión de la solicitud.',
    nullable: true,
  })
  observacion!: string | null;

  @ApiProperty({ example: null, nullable: true })
  motivoRechazo!: string | null;

  @ApiProperty({ example: null, nullable: true })
  decididaEn!: Date | null;

  @ApiProperty({ example: '2026-11-21T09:30:00.000Z' })
  actualizadoEn!: Date;

  @ApiProperty({ example: true })
  correoEnviado!: boolean;

  @ApiProperty({ example: null, nullable: true })
  mensajeCorreo!: string | null;

  @ApiProperty({ example: 'Solicitud actualizada a «En revisión».' })
  mensaje!: string;
}
