import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import type {
  categoria_comercio,
  estado_modulo,
  tipo_zona,
} from '../../generated/prisma/client';
import type { GeoJsonPoint } from '../../common/geo';

/** Categorías admitidas por el enum `categoria_comercio`. */
export const CATEGORIAS_MODULO: readonly categoria_comercio[] = [
  'formal',
  'informal',
];

/** Estados admitidos por el enum `estado_modulo`. */
export const ESTADOS_MODULO: readonly estado_modulo[] = ['activo', 'baja'];

/** Valor especial del filtro de sector para módulos fuera de toda zona. */
export const SECTOR_SIN_ZONA = 'sin_zona';

/** Recorta espacios de los textos antes de validarlos. */
function recortar(valor: unknown): unknown {
  return typeof valor === 'string' ? valor.trim() : valor;
}

/** Convierte `"true"`/`"false"` de multipart o query a boolean. */
function aBooleano(valor: unknown): unknown {
  if (valor === 'true') return true;
  if (valor === 'false') return false;
  return valor;
}

/** Convierte una cadena JSON de multipart en objeto. */
function aObjetoJson(valor: unknown): unknown {
  if (typeof valor !== 'string') return valor;
  const texto = valor.trim();
  if (texto === '') return valor;
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return valor;
  }
}

/** Convierte los campos multipart numéricos a string limpio. */
function comoTexto(valor: unknown): unknown {
  if (typeof valor === 'number') return String(valor);
  return recortar(valor);
}

/** Query de `GET /modulos`. */
export class ListarModulosQueryDto {
  @ApiPropertyOptional({ enum: CATEGORIAS_MODULO, example: 'informal' })
  @IsOptional()
  @IsIn([...CATEGORIAS_MODULO], {
    message: 'La categoría debe ser formal o informal',
  })
  categoria?: categoria_comercio;

  @ApiPropertyOptional({
    example: 'Centro - Calle 30',
    description:
      `Nombre de una zona activa o "${SECTOR_SIN_ZONA}" para módulos fuera de zona.`,
  })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El sector debe ser texto' })
  @Length(1, 150, {
    message: 'El sector debe tener entre 1 y 150 caracteres',
  })
  sector?: string;

  @ApiPropertyOptional({
    enum: [...ESTADOS_MODULO, 'todos'],
    example: 'activo',
    description: 'Estado del módulo. Por defecto se devuelven todos.',
  })
  @IsOptional()
  @IsIn([...ESTADOS_MODULO, 'todos'], {
    message: 'El estado debe ser activo, baja o todos',
  })
  estado?: estado_modulo | 'todos';

  @ApiPropertyOptional({ example: 'MOD-0007' })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'La búsqueda debe ser texto' })
  @Length(1, 150, {
    message: 'La búsqueda debe tener entre 1 y 150 caracteres',
  })
  busqueda?: string;

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

/** Query de `GET /modulos/zona-contenedora`. */
export class ZonaContenedoraQueryDto {
  @ApiProperty({ example: 4.0885, minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsNumber({}, { message: 'La latitud debe ser un número' })
  @Min(-90, { message: 'La latitud debe estar entre -90 y 90' })
  @Max(90, { message: 'La latitud debe estar entre -90 y 90' })
  lat!: number;

  @ApiProperty({ example: -76.1955, minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsNumber({}, { message: 'La longitud debe ser un número' })
  @Min(-180, { message: 'La longitud debe estar entre -180 y 180' })
  @Max(180, { message: 'La longitud debe estar entre -180 y 180' })
  lng!: number;
}

/** Cuerpo de `POST /modulos` (multipart). */
export class CrearModuloDto {
  @ApiProperty({ enum: CATEGORIAS_MODULO, example: 'informal' })
  @IsIn([...CATEGORIAS_MODULO], {
    message: 'La categoría debe ser formal o informal',
  })
  categoria!: categoria_comercio;

  @ApiProperty({ example: 'Venta de empanadas' })
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'La actividad debe ser texto' })
  @IsNotEmpty({ message: 'La actividad es obligatoria' })
  @Length(1, 200, {
    message: 'La actividad debe tener entre 1 y 200 caracteres',
  })
  actividad!: string;

  @ApiProperty({
    type: Object,
    example: { type: 'Point', coordinates: [-76.1955, 4.0885] },
    description:
      'Punto GeoJSON [longitud, latitud]. En multipart se envía como JSON.',
  })
  @Transform(({ value }) => aObjetoJson(value))
  @IsObject({ message: 'La ubicación debe ser un objeto GeoJSON' })
  ubicacion!: GeoJsonPoint;

  @ApiPropertyOptional({
    example: '4',
    description: 'ID del comerciante registrado como titular.',
  })
  @IsOptional()
  @Transform(({ value }) => comoTexto(value))
  @IsString({ message: 'El titular debe ser un identificador' })
  @Matches(/^\d+$/, {
    message: 'El titular debe ser un identificador numérico',
  })
  titularId?: string;

  @ApiPropertyOptional({
    example: 'Nelson Mina',
    description: 'Nombre del titular sin cuenta en la plataforma.',
  })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El nombre del titular debe ser texto' })
  @IsNotEmpty({ message: 'El nombre del titular no puede estar vacío' })
  @Length(1, 150, {
    message: 'El nombre del titular debe tener entre 1 y 150 caracteres',
  })
  titularNombre?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Confirmación explícita cuando el punto cae en una zona restringida.',
  })
  @IsOptional()
  @Transform(({ value }) => aBooleano(value))
  @IsBoolean({ message: 'La aceptación debe ser true o false' })
  aceptaAdvertencia?: boolean;
}

/** Cuerpo de `PATCH /modulos/:id` (todos los campos son opcionales). */
export class ActualizarModuloDto {
  @ApiPropertyOptional({ enum: CATEGORIAS_MODULO, example: 'formal' })
  @IsOptional()
  @IsIn([...CATEGORIAS_MODULO], {
    message: 'La categoría debe ser formal o informal',
  })
  categoria?: categoria_comercio;

  @ApiPropertyOptional({ example: 'Venta de artesanías' })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'La actividad debe ser texto' })
  @IsNotEmpty({ message: 'La actividad no puede quedar vacía' })
  @Length(1, 200, {
    message: 'La actividad debe tener entre 1 y 200 caracteres',
  })
  actividad?: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Nuevo punto GeoJSON [longitud, latitud].',
  })
  @IsOptional()
  @Transform(({ value }) => aObjetoJson(value))
  @IsObject({ message: 'La ubicación debe ser un objeto GeoJSON' })
  ubicacion?: GeoJsonPoint;

  @ApiPropertyOptional({ example: '4' })
  @IsOptional()
  @Transform(({ value }) => comoTexto(value))
  @IsString({ message: 'El titular debe ser un identificador' })
  @Matches(/^\d+$/, {
    message: 'El titular debe ser un identificador numérico',
  })
  titularId?: string;

  @ApiPropertyOptional({ example: 'Nelson Mina' })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El nombre del titular debe ser texto' })
  @IsNotEmpty({ message: 'El nombre del titular no puede estar vacío' })
  @Length(1, 150, {
    message: 'El nombre del titular debe tener entre 1 y 150 caracteres',
  })
  titularNombre?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => aBooleano(value))
  @IsBoolean({ message: 'La aceptación debe ser true o false' })
  aceptaAdvertencia?: boolean;
}

/** Cuerpo de `PATCH /modulos/:id/estado`. */
export class CambiarEstadoModuloDto {
  @ApiProperty({ enum: ESTADOS_MODULO, example: 'baja' })
  @IsIn([...ESTADOS_MODULO], {
    message: 'El estado debe ser activo o baja',
  })
  estado!: estado_modulo;
}

/** Paginación del listado de módulos. */
export class PaginacionModulosDto {
  @ApiProperty({ example: 1 })
  pagina!: number;

  @ApiProperty({ example: 20 })
  limite!: number;

  @ApiProperty({ example: 6 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPaginas!: number;
}

/** Titular registrado en la plataforma. */
export class TitularModuloDto {
  @ApiProperty({ example: '4' })
  id!: string;

  @ApiProperty({ example: 'José' })
  nombre!: string;

  @ApiProperty({ example: 'Pérez', nullable: true })
  apellido!: string | null;

  @ApiProperty({ example: 'jose.perez@hotmail.com' })
  correo!: string;
}

/** Gestor que realizó un cambio. */
export class ActorModuloDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Laura' })
  nombre!: string;

  @ApiProperty({ example: 'Martínez', nullable: true })
  apellido!: string | null;

  @ApiProperty({ example: 'admin@tulua.gov.co' })
  correo!: string;
}

/** Restricciones de la zona contenedora. */
export class ZonaContenedoraDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Centro - Calle 30' })
  nombre!: string;

  @ApiProperty({
    enum: ['permitida', 'restringida', 'alta_congestion'],
    example: 'permitida',
  })
  tipo!: tipo_zona;

  @ApiProperty({ example: '06:00', nullable: true })
  horarioInicio!: string | null;

  @ApiProperty({ example: '18:00', nullable: true })
  horarioFin!: string | null;

  @ApiProperty({ example: 40, nullable: true })
  aforoMaximo!: number | null;

  @ApiProperty({ type: [String], example: ['Frutas frescas', 'Verduras'] })
  productos!: string[];
}

/** Advertencia del punto seleccionado. */
export class AdvertenciaModuloDto {
  @ApiProperty({
    enum: ['zona_restringida', 'alta_congestion', 'fuera_de_zona'],
    example: 'zona_restringida',
  })
  tipo!: 'zona_restringida' | 'alta_congestion' | 'fuera_de_zona';

  @ApiProperty({
    example:
      'El punto está en la zona restringida «Entorno Hospital». El censo se guardará solo si confirmas que conoces la restricción.',
  })
  mensaje!: string;

  @ApiProperty({ example: true })
  requiereConfirmacion!: boolean;
}

/** Fila del listado de módulos. */
export class ModuloListadoDto {
  @ApiProperty({ example: '7' })
  id!: string;

  @ApiProperty({ example: 'MOD-0007' })
  codigo!: string;

  @ApiProperty({ enum: CATEGORIAS_MODULO, example: 'informal' })
  categoria!: categoria_comercio;

  @ApiProperty({
    type: TitularModuloDto,
    nullable: true,
    description: 'Titular con cuenta registrada.',
  })
  titular!: TitularModuloDto | null;

  @ApiProperty({
    example: 'Nelson Mina',
    nullable: true,
    description: 'Titular sin cuenta en la plataforma.',
  })
  titularNombre!: string | null;

  @ApiProperty({ example: 'Venta de empanadas' })
  actividad!: string;

  @ApiProperty({
    example: '/uploads/modulos/uuid.jpg',
    nullable: true,
  })
  fotoUrl!: string | null;

  @ApiProperty({ enum: ESTADOS_MODULO, example: 'activo' })
  estado!: estado_modulo;

  @ApiProperty({
    example: 'Centro - Calle 30',
    nullable: true,
    description: 'Nombre de la zona activa que contiene el punto.',
  })
  sector!: string | null;

  @ApiProperty({
    type: ZonaContenedoraDto,
    nullable: true,
  })
  zonaContenedora!: ZonaContenedoraDto | null;

  @ApiProperty({
    type: Object,
    example: { type: 'Point', coordinates: [-76.1955, 4.0885] },
  })
  ubicacion!: GeoJsonPoint;

  @ApiProperty({ example: '2026-10-01T12:00:00.000Z' })
  creadoEn!: Date;
}

/** Ficha completa de un módulo. */
export class ModuloDetalleDto extends ModuloListadoDto {
  @ApiProperty({
    type: ActorModuloDto,
    nullable: true,
    description: 'Gestor que censó el módulo.',
  })
  registradoPor!: ActorModuloDto | null;

  @ApiProperty({ type: [AdvertenciaModuloDto] })
  advertencias!: AdvertenciaModuloDto[];
}

/** Respuesta de `GET /modulos`. */
export class ListarModulosResponseDto {
  @ApiProperty({ type: [ModuloListadoDto] })
  datos!: ModuloListadoDto[];

  @ApiProperty({ type: PaginacionModulosDto })
  paginacion!: PaginacionModulosDto;
}

/** Respuesta de `GET /modulos/opciones`. */
export class OpcionesModulosResponseDto {
  @ApiProperty({
    type: [String],
    example: ['Centro - Calle 30', 'Entorno Hospital', 'Plaza Boyacá'],
  })
  sectores!: string[];

  @ApiProperty({
    type: [String],
    enum: CATEGORIAS_MODULO,
    example: ['formal', 'informal'],
  })
  categorias!: categoria_comercio[];
}

/** Respuesta de `GET /modulos/zona-contenedora`. */
export class ZonaContenedoraResponseDto {
  @ApiProperty({ type: ZonaContenedoraDto, nullable: true })
  zona!: ZonaContenedoraDto | null;

  @ApiProperty({ example: 'Centro - Calle 30', nullable: true })
  sector!: string | null;

  @ApiProperty({ type: [AdvertenciaModuloDto] })
  advertencias!: AdvertenciaModuloDto[];

  @ApiProperty({ example: false })
  requiereConfirmacion!: boolean;
}

/** Respuesta de `PATCH /modulos/:id/estado`. */
export class ModuloEstadoResponseDto {
  @ApiProperty({ example: '7' })
  id!: string;

  @ApiProperty({ example: 'MOD-0007' })
  codigo!: string;

  @ApiProperty({ enum: ESTADOS_MODULO, example: 'baja' })
  estado!: estado_modulo;

  @ApiProperty({ example: 'Módulo dado de baja.' })
  mensaje!: string;
}

/** Cambio visible en el historial. */
export class CambioModuloDto {
  @ApiProperty({ example: 'estado' })
  campo!: string;

  @ApiProperty({ example: 'Estado' })
  etiqueta!: string;

  @ApiProperty({ nullable: true })
  anterior!: unknown;

  @ApiProperty({ nullable: true })
  nuevo!: unknown;
}

/** Evento del historial de un módulo. */
export class ModuloHistorialItemDto {
  @ApiProperty({ example: '12' })
  id!: string;

  @ApiProperty({ enum: ['insert', 'update', 'delete'], example: 'update' })
  accion!: 'insert' | 'update' | 'delete';

  @ApiProperty({ example: '2026-10-01T12:00:00.000Z' })
  creadoEn!: Date;

  @ApiProperty({ type: ActorModuloDto, nullable: true })
  actor!: ActorModuloDto | null;

  @ApiProperty({ type: [CambioModuloDto] })
  cambios!: CambioModuloDto[];
}

/** Respuesta de `GET /modulos/:id/historial`. */
export class ModuloHistorialResponseDto {
  @ApiProperty({
    example: { id: '7', codigo: 'MOD-0007', estado: 'activo' },
  })
  modulo!: {
    id: string;
    codigo: string;
    estado: estado_modulo;
  };

  @ApiProperty({ type: [ModuloHistorialItemDto] })
  datos!: ModuloHistorialItemDto[];

  @ApiProperty({ type: PaginacionModulosDto })
  paginacion!: PaginacionModulosDto;
}

/** Query de `GET /modulos/:id/historial`. */
export class ModuloHistorialQueryDto {
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
