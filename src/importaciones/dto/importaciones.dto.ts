import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import type { tipo_zona } from '../../generated/prisma/client';

/** Query/body de `POST /importaciones/zonas/previsualizar`. */
export class PrevisualizarZonasDto {
  @ApiPropertyOptional({
    example: 3857,
    minimum: 1,
    maximum: 999999,
    description:
      'SRID de origen. Si el GeoJSON declara `crs`, ambos deben coincidir. Si se omite, se usa el CRS del archivo o EPSG:4326.',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return Number(value);
  })
  @Type(() => Number)
  @IsInt({ message: 'El SRID de origen debe ser un número entero' })
  @Min(1, { message: 'El SRID de origen debe ser mayor que cero' })
  @Max(999999, { message: 'El SRID de origen no es válido' })
  sridOrigen?: number;
}

/** Cuerpo de `POST /importaciones/zonas/confirmar`. */
export class ConfirmarImportacionDto {
  @ApiProperty({
    example: '3f1c2b9e-7a4d-4f0e-9b2a-1d2c3e4f5a6b',
    description: 'Token devuelto por la previsualización.',
  })
  @IsString({ message: 'El token es obligatorio' })
  @IsUUID('4', { message: 'El token de previsualización no es válido' })
  token!: string;
}

/** Cuerpo de `POST /importaciones/modulos/confirmar`. */
export class ConfirmarModulosDto extends ConfirmarImportacionDto {
  @ApiPropertyOptional({
    example: true,
    description:
      'Confirma la importación de filas ubicadas en zonas restringidas.',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'La confirmación debe ser true o false' })
  aceptaAdvertencia?: boolean;
}

/** Opción de sistema de referencia para el selector de la interfaz. */
export class SridOpcionDto {
  @ApiProperty({ example: 4326 })
  srid!: number;

  @ApiProperty({ example: 'WGS 84 (EPSG:4326)' })
  etiqueta!: string;
}

/** Respuesta de `GET /importaciones/srids`. */
export class SridsResponseDto {
  @ApiProperty({ type: [SridOpcionDto] })
  comunes!: SridOpcionDto[];

  @ApiProperty({ example: true })
  permiteOtro!: boolean;
}

/** Zona activa que contiene un punto del CSV. */
export class ZonaPreviewDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Centro - Calle 30' })
  nombre!: string;

  @ApiProperty({
    enum: ['permitida', 'restringida', 'alta_congestion'],
    example: 'permitida',
  })
  tipo!: tipo_zona;
}

/** Fila normalizada de la previsualización. */
export class FilaPreviewDto {
  @ApiProperty({ example: 2 })
  fila!: number;

  @ApiProperty({
    enum: ['valida', 'rechazada', 'advertencia'],
    example: 'valida',
  })
  estado!: 'valida' | 'rechazada' | 'advertencia';

  @ApiProperty({
    type: Object,
    example: {
      nombre: 'Zona nueva',
      tipo: 'permitida',
      productosPermitidos: ['Frutas frescas'],
    },
  })
  datos!: Record<string, unknown>;

  @ApiPropertyOptional({
    type: Object,
    description: 'Geometría reproyectada a EPSG:4326 o punto del módulo.',
  })
  geometria?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: ZonaPreviewDto,
    nullable: true,
    description: 'Solo para módulos: zona activa que contiene el punto.',
  })
  zonaContenedora?: ZonaPreviewDto | null;

  @ApiProperty({
    type: [String],
    example: [],
  })
  errores!: string[];

  @ApiProperty({
    type: [String],
    example: [],
  })
  advertencias!: string[];

  @ApiPropertyOptional({
    example: true,
    description:
      'La fila requiere confirmación global por estar en zona restringida.',
  })
  requiereConfirmacion?: boolean;
}

/** Totales de la previsualización. */
export class ResumenPreviewDto {
  @ApiProperty({ example: 10 })
  total!: number;

  @ApiProperty({ example: 8 })
  validas!: number;

  @ApiProperty({ example: 2 })
  rechazadas!: number;

  @ApiProperty({ example: 1 })
  advertencias!: number;
}

/** Respuesta de las rutas de previsualización. */
export class PrevisualizacionResponseDto {
  @ApiProperty({
    example: '3f1c2b9e-7a4d-4f0e-9b2a-1d2c3e4f5a6b',
  })
  token!: string;

  @ApiProperty({ enum: ['zonas', 'modulos'], example: 'zonas' })
  tipo!: 'zonas' | 'modulos';

  @ApiProperty({ example: '2026-11-09T15:30:00.000Z' })
  expiraEn!: Date;

  @ApiProperty({
    example: { nombre: 'zonas.geojson', bytes: 12345 },
  })
  archivo!: { nombre: string; bytes: number };

  @ApiProperty({ example: 3857, nullable: true })
  sridOrigen!: number | null;

  @ApiProperty({ example: true })
  sridDetectado!: boolean;

  @ApiProperty({ type: ResumenPreviewDto })
  resumen!: ResumenPreviewDto;

  @ApiProperty({ type: [FilaPreviewDto] })
  filas!: FilaPreviewDto[];
}

/** Registro importado correctamente. */
export class ImportadoDto {
  @ApiProperty({ example: 2 })
  fila!: number;

  @ApiProperty({ example: '12' })
  id!: string;

  @ApiPropertyOptional({ example: 'MOD-0012' })
  codigo?: string;

  @ApiProperty({ example: 'Zona nueva' })
  nombre!: string;
}

/** Registro rechazado durante la confirmación. */
export class RechazadoDto {
  @ApiProperty({ example: 3 })
  fila!: number;

  @ApiProperty({ example: 'La latitud debe estar entre -90 y 90' })
  motivo!: string;
}

/** Totales de la confirmación. */
export class ResumenConfirmacionDto {
  @ApiProperty({ example: 10 })
  total!: number;

  @ApiProperty({ example: 7 })
  importados!: number;

  @ApiProperty({ example: 3 })
  rechazados!: number;

  @ApiProperty({ example: 1 })
  conAdvertencia!: number;
}

/** Información del reporte descargable. */
export class ReporteInfoDto {
  @ApiProperty({ example: true })
  disponible!: boolean;

  @ApiProperty({ example: 'reporte-importacion-modulos-20261109-1530.csv' })
  nombreArchivo!: string;

  @ApiProperty({ example: '/importaciones/uuid/reporte' })
  url!: string;
}

/** Respuesta de las rutas de confirmación. */
export class ConfirmacionResponseDto {
  @ApiProperty({
    example: '3f1c2b9e-7a4d-4f0e-9b2a-1d2c3e4f5a6b',
  })
  token!: string;

  @ApiProperty({ enum: ['zonas', 'modulos'], example: 'modulos' })
  tipo!: 'zonas' | 'modulos';

  @ApiProperty({ type: ResumenConfirmacionDto })
  resumen!: ResumenConfirmacionDto;

  @ApiProperty({ type: [ImportadoDto] })
  importados!: ImportadoDto[];

  @ApiProperty({ type: [RechazadoDto] })
  rechazados!: RechazadoDto[];

  @ApiProperty({ type: ReporteInfoDto })
  reporte!: ReporteInfoDto;
}
