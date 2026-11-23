import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import type { estado_solicitud } from '../../generated/prisma/client';
import { AsignacionSolicitudDto, ESTADOS_SOLICITUD } from './solicitudes.dto';

/** Decisiones finales admitidas por la resolución (HU-20). */
export const DECISIONES_RESOLUCION = ['aprobar', 'rechazar'] as const;

export type DecisionResolucion = (typeof DECISIONES_RESOLUCION)[number];

function recortar(valor: unknown): unknown {
  return typeof valor === 'string' ? valor.trim() : valor;
}

/** Cuerpo de `PATCH /gestor/solicitudes/:id/resolucion` (HU-20). */
export class ResolverSolicitudDto {
  @ApiProperty({
    enum: [...DECISIONES_RESOLUCION],
    example: 'aprobar',
    description:
      '«aprobar» asigna el espacio y deja la solicitud en Aprobada; «rechazar» la deja en Rechazada.',
  })
  @IsIn([...DECISIONES_RESOLUCION], {
    message: 'La decisión debe ser aprobar o rechazar',
  })
  decision!: DecisionResolucion;

  @ApiPropertyOptional({
    example: 'Cumple con los requisitos documentales.',
    description:
      'Dictamen opcional de la aprobación. Queda en el historial y es visible para el solicitante.',
  })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El dictamen debe ser texto' })
  @Length(1, 2_000, {
    message: 'El dictamen debe tener entre 1 y 2000 caracteres',
  })
  dictamen?: string;

  @ApiPropertyOptional({
    example: 'La documentación no permite verificar la actividad solicitada.',
    description:
      'Motivo visible para el solicitante. Obligatorio cuando la decisión es «rechazar».',
  })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El motivo de rechazo debe ser texto' })
  @Length(1, 2_000, {
    message: 'El motivo de rechazo debe tener entre 1 y 2000 caracteres',
  })
  motivoRechazo?: string;
}

/** Respuesta de la resolución de una solicitud (HU-20). */
export class ResolverSolicitudResponseDto {
  @ApiProperty({ example: '12' })
  id!: string;

  @ApiProperty({ example: 'SOL-2026-00012' })
  numeroRadicado!: string;

  @ApiProperty({ enum: [...DECISIONES_RESOLUCION], example: 'aprobar' })
  decision!: DecisionResolucion;

  @ApiProperty({ enum: ESTADOS_SOLICITUD, example: 'en_revision' })
  estadoAnterior!: estado_solicitud;

  @ApiProperty({ enum: ESTADOS_SOLICITUD, example: 'aprobada' })
  estado!: estado_solicitud;

  @ApiProperty({
    example: 'Cumple con los requisitos documentales.',
    nullable: true,
  })
  dictamen!: string | null;

  @ApiProperty({ example: null, nullable: true })
  motivoRechazo!: string | null;

  @ApiProperty({ example: '2026-11-22T10:00:00.000Z', nullable: true })
  decididaEn!: Date | null;

  @ApiProperty({ example: '2026-11-22T10:00:00.000Z' })
  actualizadoEn!: Date;

  @ApiProperty({ type: AsignacionSolicitudDto, nullable: true })
  asignacion!: AsignacionSolicitudDto | null;

  @ApiProperty({ example: true })
  correoEnviado!: boolean;

  @ApiProperty({ example: null, nullable: true })
  mensajeCorreo!: string | null;

  @ApiProperty({
    example: 'Solicitud aprobada y espacio asignado.',
  })
  mensaje!: string;
}
