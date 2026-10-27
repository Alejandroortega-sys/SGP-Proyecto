import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import type { tipo_zona } from '../../generated/prisma/client';
import type { GeoJsonPolygon } from '../../common/geo';

/** Tipos de zona admitidos por el enum `tipo_zona` de la BD. */
export const TIPOS_ZONA: readonly tipo_zona[] = [
  'permitida',
  'restringida',
  'alta_congestion',
];

/** Formato de hora de 24 horas aceptado por los campos TIME. */
const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const MENSAJE_HORA =
  'El horario debe tener formato HH:MM en 24 horas (por ejemplo, 06:00)';

/** Recorta espacios de los textos antes de validarlos. */
function recortar(valor: unknown): unknown {
  return typeof valor === 'string' ? valor.trim() : valor;
}

/** Convierte `"true"`/`"false"` de query string a boolean. */
function aBooleano(valor: unknown): unknown {
  if (valor === 'true') return true;
  if (valor === 'false') return false;
  return valor;
}

/** Solo valida el campo cuando viene definido (permite PATCH parcial). */
function estaDefinido(_objeto: unknown, valor: unknown): boolean {
  return valor !== undefined;
}

/** Cuerpo de `POST /zonas`. */
export class CrearZonaDto {
  /** Nombre descriptivo de la zona. */
  @ApiProperty({ example: 'Centro - Calle 30', minLength: 3, maxLength: 150 })
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El nombre de la zona debe ser texto' })
  @IsNotEmpty({ message: 'El nombre de la zona es obligatorio' })
  @Length(3, 150, {
    message: 'El nombre de la zona debe tener entre 3 y 150 caracteres',
  })
  nombre!: string;

  /** Tipo normativo de la zona. */
  @ApiProperty({ enum: TIPOS_ZONA, example: 'permitida' })
  @IsIn([...TIPOS_ZONA], {
    message: 'El tipo debe ser permitida, restringida o alta_congestion',
  })
  tipo!: tipo_zona;

  /** Polígono GeoJSON en WGS84 (SRID 4326). */
  @ApiProperty({
    type: Object,
    example: {
      type: 'Polygon',
      coordinates: [
        [
          [-76.196, 4.088],
          [-76.192, 4.088],
          [-76.192, 4.09],
          [-76.196, 4.09],
          [-76.196, 4.088],
        ],
      ],
    },
    description:
      'Polígono GeoJSON [longitud, latitud]. La validez topológica y el ' +
      'solape con otras zonas activas los comprueba PostGIS.',
  })
  @IsObject({ message: 'La geometría debe ser un objeto GeoJSON' })
  geometria!: GeoJsonPolygon;

  /** Hora de inicio del horario permitido (HH:MM). */
  @ApiPropertyOptional({ example: '06:00', nullable: true })
  @IsOptional()
  @IsString({ message: 'El horario de inicio debe ser texto' })
  @Matches(FORMATO_HORA, { message: MENSAJE_HORA })
  horarioInicio?: string | null;

  /** Hora de fin del horario permitido (HH:MM). */
  @ApiPropertyOptional({ example: '18:00', nullable: true })
  @IsOptional()
  @IsString({ message: 'El horario de fin debe ser texto' })
  @Matches(FORMATO_HORA, { message: MENSAJE_HORA })
  horarioFin?: string | null;

  /** Aforo máximo de la zona. `null` deja que el motor use el parámetro global. */
  @ApiPropertyOptional({ example: 40, minimum: 1, nullable: true })
  @IsOptional()
  @IsInt({ message: 'El aforo máximo debe ser un número entero' })
  @Min(1, { message: 'El aforo máximo debe ser mayor que cero' })
  aforoMaximo?: number | null;

  /** IDs de los productos permitidos en la zona. */
  @ApiPropertyOptional({
    type: [String],
    example: ['1', '2', '5'],
    description: 'Identificadores de productos activos del catálogo',
  })
  @ValidateIf(estaDefinido)
  @IsArray({ message: 'Los productos permitidos deben ser una lista' })
  @ArrayUnique({ message: 'No se puede repetir un producto permitido' })
  @ArrayMaxSize(100, {
    message: 'No se pueden asociar más de 100 productos a una zona',
  })
  @IsString({
    each: true,
    message: 'Cada producto permitido debe ser un identificador',
  })
  @Matches(/^\d+$/, {
    each: true,
    message: 'Cada producto permitido debe ser un identificador numérico',
  })
  productosPermitidos?: string[];
}

/** Cuerpo de `PATCH /zonas/:id` (todos los campos son opcionales). */
export class ActualizarZonaDto {
  /** Nuevo nombre de la zona. */
  @ApiPropertyOptional({
    example: 'Centro - Calle 30',
    minLength: 3,
    maxLength: 150,
  })
  @ValidateIf(estaDefinido)
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El nombre de la zona debe ser texto' })
  @IsNotEmpty({ message: 'El nombre de la zona no puede quedar vacío' })
  @Length(3, 150, {
    message: 'El nombre de la zona debe tener entre 3 y 150 caracteres',
  })
  nombre?: string;

  /** Nuevo tipo normativo. */
  @ApiPropertyOptional({ enum: TIPOS_ZONA, example: 'restringida' })
  @ValidateIf(estaDefinido)
  @IsIn([...TIPOS_ZONA], {
    message: 'El tipo debe ser permitida, restringida o alta_congestion',
  })
  tipo?: tipo_zona;

  /** Nuevo polígono GeoJSON (SRID 4326). */
  @ApiPropertyOptional({
    type: Object,
    description: 'Polígono GeoJSON [longitud, latitud]',
  })
  @ValidateIf(estaDefinido)
  @IsObject({ message: 'La geometría debe ser un objeto GeoJSON' })
  geometria?: GeoJsonPolygon;

  /** Hora de inicio; `null` borra el horario. */
  @ApiPropertyOptional({ example: '06:00', nullable: true })
  @IsOptional()
  @IsString({ message: 'El horario de inicio debe ser texto' })
  @Matches(FORMATO_HORA, { message: MENSAJE_HORA })
  horarioInicio?: string | null;

  /** Hora de fin; `null` borra el horario. */
  @ApiPropertyOptional({ example: '18:00', nullable: true })
  @IsOptional()
  @IsString({ message: 'El horario de fin debe ser texto' })
  @Matches(FORMATO_HORA, { message: MENSAJE_HORA })
  horarioFin?: string | null;

  /** Aforo máximo; `null` lo deja sin límite propio. */
  @ApiPropertyOptional({ example: 40, minimum: 1, nullable: true })
  @IsOptional()
  @IsInt({ message: 'El aforo máximo debe ser un número entero' })
  @Min(1, { message: 'El aforo máximo debe ser mayor que cero' })
  aforoMaximo?: number | null;

  /** Lista completa de productos permitidos (reemplaza la anterior). */
  @ApiPropertyOptional({
    type: [String],
    example: ['1', '2'],
    description: 'Si se envía, reemplaza la lista completa de productos',
  })
  @ValidateIf(estaDefinido)
  @IsArray({ message: 'Los productos permitidos deben ser una lista' })
  @ArrayUnique({ message: 'No se puede repetir un producto permitido' })
  @ArrayMaxSize(100, {
    message: 'No se pueden asociar más de 100 productos a una zona',
  })
  @IsString({
    each: true,
    message: 'Cada producto permitido debe ser un identificador',
  })
  @Matches(/^\d+$/, {
    each: true,
    message: 'Cada producto permitido debe ser un identificador numérico',
  })
  productosPermitidos?: string[];
}

/** Cuerpo de `PATCH /zonas/:id/estado`. */
export class CambiarEstadoZonaDto {
  /** `true` para activar la zona, `false` para desactivarla. */
  @ApiProperty({ example: false })
  @IsBoolean({ message: 'El campo «activa» debe ser true o false' })
  activa!: boolean;
}

/** Query de `GET /zonas`. */
export class ListarZonasQueryDto {
  /** Filtra por tipo de zona. */
  @ApiPropertyOptional({ enum: TIPOS_ZONA, example: 'permitida' })
  @IsOptional()
  @IsIn([...TIPOS_ZONA], {
    message: 'El tipo debe ser permitida, restringida o alta_congestion',
  })
  tipo?: tipo_zona;

  /** Filtra por zonas activas o inactivas. */
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => aBooleano(value))
  @IsBoolean({ message: 'El filtro «activo» debe ser true o false' })
  activo?: boolean;

  /** Búsqueda por nombre (sin distinguir mayúsculas). */
  @ApiPropertyOptional({ example: 'Centro' })
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser texto' })
  @Length(1, 150, {
    message: 'La búsqueda debe tener entre 1 y 150 caracteres',
  })
  busqueda?: string;

  /** Número de página, empezando en 1. */
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser mayor o igual a 1' })
  pagina?: number;

  /** Cantidad de zonas por página (máximo 100). */
  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser mayor o igual a 1' })
  @Max(100, { message: 'El límite no puede superar 100' })
  limite?: number;
}

/** Producto permitido dentro de una zona. */
export class ProductoPermitidoDto {
  /** Identificador del producto (BIGINT como string). */
  @ApiProperty({ example: '1' })
  id!: string;

  /** Nombre del producto. */
  @ApiProperty({ example: 'Frutas frescas' })
  nombre!: string;

  /** Indica si el producto sigue activo. */
  @ApiProperty({ example: true })
  activo!: boolean;
}

/** Fila del listado de zonas (sin geometría). */
export class ZonaListadoItemDto {
  /** Identificador de la zona. */
  @ApiProperty({ example: '1' })
  id!: string;

  /** Nombre de la zona. */
  @ApiProperty({ example: 'Centro - Calle 30' })
  nombre!: string;

  /** Tipo normativo. */
  @ApiProperty({ enum: TIPOS_ZONA, example: 'permitida' })
  tipo!: tipo_zona;

  /** Hora de inicio del horario permitido. */
  @ApiProperty({ example: '06:00', nullable: true })
  horarioInicio!: string | null;

  /** Hora de fin del horario permitido. */
  @ApiProperty({ example: '18:00', nullable: true })
  horarioFin!: string | null;

  /** Aforo máximo de la zona. */
  @ApiProperty({ example: 40, nullable: true })
  aforoMaximo!: number | null;

  /** Indica si la zona está activa. */
  @ApiProperty({ example: true })
  activa!: boolean;

  /** Cantidad de espacios temporales asignados a la zona. */
  @ApiProperty({ example: 2 })
  totalEspacios!: number;

  /** Cantidad de módulos del censo ubicados dentro del polígono. */
  @ApiProperty({ example: 2 })
  totalModulos!: number;

  /** Fecha de creación. */
  @ApiProperty({ example: '2026-09-15T14:30:00.000Z' })
  creadoEn!: Date;

  /** Fecha de la última actualización. */
  @ApiProperty({ example: '2026-09-20T10:00:00.000Z' })
  actualizadoEn!: Date;
}

/** Paginación del listado de zonas. */
export class PaginacionZonasDto {
  /** Página solicitada. */
  @ApiProperty({ example: 1 })
  pagina!: number;

  /** Registros por página. */
  @ApiProperty({ example: 20 })
  limite!: number;

  /** Total de zonas que cumplen los filtros. */
  @ApiProperty({ example: 4 })
  total!: number;

  /** Total de páginas (0 si no hay resultados). */
  @ApiProperty({ example: 1 })
  totalPaginas!: number;
}

/** Respuesta de `GET /zonas`. */
export class ListarZonasResponseDto {
  /** Zonas de la página solicitada. */
  @ApiProperty({ type: [ZonaListadoItemDto] })
  datos!: ZonaListadoItemDto[];

  /** Metadatos de paginación. */
  @ApiProperty({ type: PaginacionZonasDto })
  paginacion!: PaginacionZonasDto;
}

/** Detalle de una zona, con geometría y productos permitidos. */
export class ZonaDetalleDto {
  /** Identificador de la zona. */
  @ApiProperty({ example: '1' })
  id!: string;

  /** Nombre de la zona. */
  @ApiProperty({ example: 'Centro - Calle 30' })
  nombre!: string;

  /** Tipo normativo. */
  @ApiProperty({ enum: TIPOS_ZONA, example: 'permitida' })
  tipo!: tipo_zona;

  /** Hora de inicio del horario permitido. */
  @ApiProperty({ example: '06:00', nullable: true })
  horarioInicio!: string | null;

  /** Hora de fin del horario permitido. */
  @ApiProperty({ example: '18:00', nullable: true })
  horarioFin!: string | null;

  /** Aforo máximo. */
  @ApiProperty({ example: 40, nullable: true })
  aforoMaximo!: number | null;

  /** Indica si la zona está activa. */
  @ApiProperty({ example: true })
  activa!: boolean;

  /** Gestor que creó la zona. */
  @ApiProperty({ example: '1', nullable: true })
  creadoPor!: string | null;

  /** Fecha de creación. */
  @ApiProperty({ example: '2026-09-15T14:30:00.000Z' })
  creadoEn!: Date;

  /** Fecha de la última actualización. */
  @ApiProperty({ example: '2026-09-20T10:00:00.000Z' })
  actualizadoEn!: Date;

  /** Polígono GeoJSON de la zona. */
  @ApiProperty({ type: Object })
  geometria!: GeoJsonPolygon;

  /** Productos permitidos en la zona. */
  @ApiProperty({ type: [ProductoPermitidoDto] })
  productosPermitidos!: ProductoPermitidoDto[];
}

/** Respuesta de `PATCH /zonas/:id/estado`. */
export class ZonaEstadoResponseDto {
  /** Identificador de la zona. */
  @ApiProperty({ example: '1' })
  id!: string;

  /** Nombre de la zona. */
  @ApiProperty({ example: 'Centro - Calle 30' })
  nombre!: string;

  /** Nuevo estado. */
  @ApiProperty({ example: false })
  activa!: boolean;

  /** Fecha de la última actualización. */
  @ApiProperty({ example: '2026-09-20T10:00:00.000Z' })
  actualizadoEn!: Date;

  /** Mensaje orientador. */
  @ApiProperty({ example: 'Zona desactivada.' })
  mensaje!: string;
}

/** Horarios de una zona dentro del GeoJSON público. */
export class HorariosZonaDto {
  /** Hora de inicio (HH:MM) o `null`. */
  @ApiProperty({ example: '06:00', nullable: true })
  inicio!: string | null;

  /** Hora de fin (HH:MM) o `null`. */
  @ApiProperty({ example: '18:00', nullable: true })
  fin!: string | null;
}

/** Propiedades de cada feature del GeoJSON público. */
export class ZonaGeoJsonPropertiesDto {
  /** Identificador de la zona. */
  @ApiProperty({ example: '1' })
  id!: string;

  /** Nombre de la zona. */
  @ApiProperty({ example: 'Centro - Calle 30' })
  nombre!: string;

  /** Tipo normativo. */
  @ApiProperty({ enum: TIPOS_ZONA, example: 'permitida' })
  tipo!: tipo_zona;

  /** Horarios de la zona. */
  @ApiProperty({ type: HorariosZonaDto })
  horarios!: HorariosZonaDto;

  /** Aforo máximo. */
  @ApiProperty({ example: 40, nullable: true })
  aforo!: number | null;

  /** Nombres de los productos permitidos. */
  @ApiProperty({ type: [String], example: ['Frutas frescas', 'Verduras'] })
  productos!: string[];
}

/** Feature GeoJSON de una zona. */
export class ZonaFeatureDto {
  /** Tipo GeoJSON. */
  @ApiProperty({ example: 'Feature' })
  type!: 'Feature';

  /** Polígono de la zona. */
  @ApiProperty({ type: Object })
  geometry!: GeoJsonPolygon;

  /** Propiedades de la zona. */
  @ApiProperty({ type: ZonaGeoJsonPropertiesDto })
  properties!: ZonaGeoJsonPropertiesDto;
}

/** Respuesta de `GET /zonas/geojson`. */
export class ZonaFeatureCollectionDto {
  /** Tipo GeoJSON. */
  @ApiProperty({ example: 'FeatureCollection' })
  type!: 'FeatureCollection';

  /** Zonas activas. */
  @ApiProperty({ type: [ZonaFeatureDto] })
  features!: ZonaFeatureDto[];
}
