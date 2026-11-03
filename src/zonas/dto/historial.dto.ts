import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { tipo_zona } from '../../generated/prisma/client';
import type { GeoJsonPolygon } from '../../common/geo';
import { TIPOS_ZONA, PaginacionZonasDto, ProductoPermitidoDto } from './zonas.dto';
import {
  ACCIONES_VERSION_ZONA,
  type AccionVersionZona,
} from '../historial';

/** Query de `GET /zonas/:id/historial`. */
export class HistorialZonaQueryDto {
  /** Número de página, empezando en 1. */
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser mayor o igual a 1' })
  pagina?: number;

  /** Cantidad de versiones por página (máximo 100). */
  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser mayor o igual a 1' })
  @Max(100, { message: 'El límite no puede superar 100' })
  limite?: number;
}

/** Actor que realizó el cambio versionado. */
export class ActorVersionZonaDto {
  /** Identificador del actor (BIGINT como string). */
  @ApiProperty({ example: '1' })
  id!: string;

  /** Nombres del actor. */
  @ApiProperty({ example: 'Laura' })
  nombre!: string;

  /** Apellidos del actor. */
  @ApiProperty({ example: 'Martínez', nullable: true })
  apellido?: string | null;

  /** Correo institucional del actor. */
  @ApiProperty({ example: 'admin@tulua.gov.co' })
  correo!: string;
}

/** Resumen geométrico de una versión. */
export class ResumenGeometriaVersionDto {
  /** Cantidad de vértices del polígono. */
  @ApiProperty({ example: 5 })
  vertices!: number;

  /** Área aproximada en metros cuadrados. */
  @ApiProperty({ example: 151500.25, nullable: true })
  areaM2!: number | null;
}

/** Cambio de un campo entre dos versiones consecutivas. */
export class CambioZonaVersionDto {
  /** Nombre técnico del campo. */
  @ApiProperty({ example: 'geometria' })
  campo!: string;

  /** Etiqueta legible del campo. */
  @ApiProperty({ example: 'Geometría' })
  etiqueta!: string;

  /** Valor anterior; `null` en la creación. */
  @ApiProperty({ nullable: true })
  anterior!: unknown;

  /** Valor nuevo de la versión. */
  @ApiProperty()
  nuevo!: unknown;
}

/** Estado completo congelado en una versión. */
export class EstadoVersionZonaDto {
  /** Nombre de la zona. */
  @ApiProperty({ example: 'Centro - Calle 30' })
  nombre!: string;

  /** Tipo normativo. */
  @ApiProperty({ enum: TIPOS_ZONA, example: 'permitida' })
  tipo!: tipo_zona;

  /** Hora de inicio (HH:MM) o `null`. */
  @ApiProperty({ example: '06:00', nullable: true })
  horarioInicio!: string | null;

  /** Hora de fin (HH:MM) o `null`. */
  @ApiProperty({ example: '18:00', nullable: true })
  horarioFin!: string | null;

  /** Aforo máximo o `null`. */
  @ApiProperty({ example: 40, nullable: true })
  aforoMaximo!: number | null;

  /** Indica si la zona estaba activa en esa versión. */
  @ApiProperty({ example: true })
  activa!: boolean;

  /** Polígono GeoJSON de la versión. */
  @ApiProperty({ type: Object })
  geometria!: GeoJsonPolygon;

  /** Productos permitidos congelados en la versión. */
  @ApiProperty({ type: [ProductoPermitidoDto] })
  productosPermitidos!: ProductoPermitidoDto[];

  /** Resumen de vértices y área. */
  @ApiProperty({ type: ResumenGeometriaVersionDto })
  resumenGeometria!: ResumenGeometriaVersionDto;
}

/** Una versión del historial de una zona. */
export class ZonaVersionItemDto {
  /** Número consecutivo de versión. */
  @ApiProperty({ example: 3 })
  version!: number;

  /** Acción que generó la versión. */
  @ApiProperty({ enum: ACCIONES_VERSION_ZONA, example: 'edicion' })
  accion!: AccionVersionZona;

  /** Fecha del cambio. */
  @ApiProperty({ example: '2026-09-20T10:00:00.000Z' })
  creadoEn!: Date;

  /** Gestor responsable; `null` si no hay actor identificado. */
  @ApiProperty({
    type: ActorVersionZonaDto,
    nullable: true,
    required: false,
  })
  actor!: ActorVersionZonaDto | null;

  /** Campos que cambiaron respecto a la versión anterior. */
  @ApiProperty({ type: [CambioZonaVersionDto] })
  cambios!: CambioZonaVersionDto[];

  /** Estado completo de la zona en esta versión. */
  @ApiProperty({ type: EstadoVersionZonaDto })
  estado!: EstadoVersionZonaDto;
}

/** Resumen de la zona consultada. */
export class ZonaHistorialResumenDto {
  /** Identificador de la zona. */
  @ApiProperty({ example: '1' })
  id!: string;

  /** Nombre actual de la zona. */
  @ApiProperty({ example: 'Centro - Calle 30' })
  nombre!: string;

  /** Estado actual de la zona. */
  @ApiProperty({ example: true })
  activa!: boolean;
}

/** Respuesta de `GET /zonas/:id/historial`. */
export class ZonaHistorialResponseDto {
  /** Datos actuales de la zona consultada. */
  @ApiProperty({ type: ZonaHistorialResumenDto })
  zona!: ZonaHistorialResumenDto;

  /** Versiones de la página solicitada, de la más reciente a la más antigua. */
  @ApiProperty({ type: [ZonaVersionItemDto] })
  datos!: ZonaVersionItemDto[];

  /** Metadatos de paginación. */
  @ApiProperty({ type: PaginacionZonasDto })
  paginacion!: PaginacionZonasDto;
}
