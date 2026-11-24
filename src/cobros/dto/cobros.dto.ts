import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Estados reales del cobro (enum `estado_cobro` de la BD). */
export const ESTADOS_COBRO = ['pendiente', 'pagado', 'anulado'] as const;

/** Cobro del listado del comerciante (HU-36). */
export class CobroListadoDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: '8' })
  permisoId!: string;

  @ApiProperty({ example: 'PER-2026-00008' })
  permisoNumero!: string;

  @ApiProperty({
    example: '50000.00',
    description: 'Valor NUMERIC(12,2) como string (Prisma.Decimal).',
  })
  valor!: string;

  @ApiProperty({ enum: [...ESTADOS_COBRO], example: 'pendiente' })
  estado!: string;

  @ApiProperty({ example: null, nullable: true })
  pagadoEn!: Date | null;

  @ApiProperty({ example: '/cobros/mios/1/recibo', nullable: true })
  reciboUrl!: string | null;

  @ApiProperty({ example: '2026-11-23T10:00:00.000Z' })
  creadoEn!: Date;
}

/** Paginación del listado de cobros. */
export class PaginacionCobrosDto {
  @ApiProperty({ example: 1 })
  pagina!: number;

  @ApiProperty({ example: 20 })
  limite!: number;

  @ApiProperty({ example: 2 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPaginas!: number;
}

/** Query de `GET /cobros/mios` (HU-36). */
export class ListarMisCobrosQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser mayor o igual a 1' })
  pagina?: number;

  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser mayor o igual a 1' })
  @Max(100, { message: 'El límite no puede superar 100' })
  limite?: number;
}

/** Respuesta de `GET /cobros/mios` (HU-36). */
export class ListarMisCobrosResponseDto {
  @ApiProperty({ type: [CobroListadoDto] })
  datos!: CobroListadoDto[];

  @ApiProperty({ type: PaginacionCobrosDto })
  paginacion!: PaginacionCobrosDto;
}

/** Respuesta de `POST /cobros/mios/:id/pago` (HU-36, pago SIMULADO). */
export class PagarCobroResponseDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'PER-2026-00008' })
  permisoNumero!: string;

  @ApiProperty({ example: '50000.00' })
  valor!: string;

  @ApiProperty({ enum: [...ESTADOS_COBRO], example: 'pagado' })
  estado!: string;

  @ApiProperty({ example: '2026-11-23T10:05:00.000Z' })
  pagadoEn!: Date;

  @ApiProperty({ example: '/cobros/mios/1/recibo' })
  reciboUrl!: string;

  @ApiProperty({
    example:
      'Pago simulado registrado: no se realizó ninguna transacción real.',
  })
  mensaje!: string;
}
