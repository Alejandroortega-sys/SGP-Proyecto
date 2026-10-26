import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginacionDto } from './listar-comerciantes-response.dto';

/** Acciones registradas por la auditoría. */
export const ACCIONES_AUDITORIA = ['insert', 'update', 'delete'] as const;

/** Query de `GET /gestor/auditoria`. */
export class ListarAuditoriaQueryDto {
  /** Nombre de la tabla auditada (por ejemplo `usuarios`). */
  @ApiPropertyOptional({ example: 'usuarios' })
  @IsOptional()
  @IsString({ message: 'La tabla debe ser texto' })
  @MaxLength(60, { message: 'La tabla no puede superar los 60 caracteres' })
  tabla?: string;

  /** Identificador del registro auditado. */
  @ApiPropertyOptional({ example: '5' })
  @IsOptional()
  @Matches(/^\d+$/, {
    message: 'El registroId debe ser un número entero positivo',
  })
  registroId?: string;

  /** Acción auditada. */
  @ApiPropertyOptional({ enum: ACCIONES_AUDITORIA, example: 'update' })
  @IsOptional()
  @IsIn([...ACCIONES_AUDITORIA], {
    message: 'La acción debe ser insert, update o delete',
  })
  accion?: (typeof ACCIONES_AUDITORIA)[number];

  /** Número de página, empezando en 1. */
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser mayor o igual a 1' })
  pagina?: number;

  /** Cantidad de registros por página (máximo 100). */
  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser mayor o igual a 1' })
  @Max(100, { message: 'El límite no puede superar 100' })
  limite?: number;
}

/** Actor que realizó el cambio auditado. */
export class ActorAuditoriaDto {
  /** Identificador del actor (BIGINT como string). */
  @ApiProperty({ example: '1' })
  id!: string;

  /** Nombres del actor. */
  @ApiProperty({ example: 'Laura' })
  nombre!: string;

  /** Apellidos del actor. */
  @ApiProperty({ example: 'Martínez', required: false, nullable: true })
  apellido?: string | null;

  /** Correo del actor. */
  @ApiProperty({ example: 'admin@tulua.gov.co' })
  correo!: string;
}

/** Un registro de la tabla `auditoria`. */
export class AuditoriaItemDto {
  /** Identificador del registro de auditoría (BIGINT como string). */
  @ApiProperty({ example: '101' })
  id!: string;

  /** Tabla afectada. */
  @ApiProperty({ example: 'usuarios' })
  tabla!: string;

  /** Identificador del registro afectado. */
  @ApiProperty({ example: '5' })
  registroId!: string;

  /** Acción realizada. */
  @ApiProperty({ enum: ACCIONES_AUDITORIA, example: 'update' })
  accion!: string;

  /** Estado anterior, sin campos sensibles. */
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  valorAnterior?: unknown;

  /** Estado nuevo, sin campos sensibles. */
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  valorNuevo?: unknown;

  /** Usuario que realizó el cambio; `null` si no hay actor identificado. */
  @ApiProperty({
    type: ActorAuditoriaDto,
    required: false,
    nullable: true,
  })
  actor?: ActorAuditoriaDto | null;

  /** Fecha del cambio. */
  @ApiProperty({ example: '2026-09-20T10:00:00.000Z' })
  creadoEn!: Date;
}

/** Respuesta de `GET /gestor/auditoria`. */
export class ListarAuditoriaResponseDto {
  /** Registros de auditoría de la página solicitada. */
  @ApiProperty({ type: [AuditoriaItemDto] })
  datos!: AuditoriaItemDto[];

  /** Metadatos de paginación. */
  @ApiProperty({ type: PaginacionDto })
  paginacion!: PaginacionDto;
}
