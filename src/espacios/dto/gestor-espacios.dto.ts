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
import type { GeoJsonPoint } from '../../common/geo';
import type {
  estado_espacio,
  tipo_espacio,
  tipo_zona,
} from '../../generated/prisma/client';
import { ESTADOS_ESPACIO, TIPOS_ESPACIO } from './espacios.dto';

/** Estados que el gestor puede fijar manualmente. */
export const ESTADOS_MANUALES_ESPACIO: readonly estado_espacio[] = [
  'disponible',
  'mantenimiento',
];

/** Formato de hora de 24 horas. */
const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Formato de fecha ISO sin zona horaria. */
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

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

/** Query de `GET /gestor/espacios`. */
export class ListarEspaciosGestorQueryDto {
  @ApiPropertyOptional({ example: 'Calle 30' })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'La búsqueda debe ser texto' })
  @Length(1, 150, {
    message: 'La búsqueda debe tener entre 1 y 150 caracteres',
  })
  busqueda?: string;

  @ApiPropertyOptional({ enum: TIPOS_ESPACIO, example: 'puesto' })
  @IsOptional()
  @IsIn([...TIPOS_ESPACIO], {
    message: 'El tipo de espacio no es válido',
  })
  tipo?: tipo_espacio;

  @ApiPropertyOptional({
    enum: [...ESTADOS_ESPACIO, 'todos'],
    example: 'disponible',
    description: 'Estado registrado. Por defecto se devuelven todos.',
  })
  @IsOptional()
  @IsIn([...ESTADOS_ESPACIO, 'todos'], {
    message: 'El estado del espacio no es válido',
  })
  estado?: estado_espacio | 'todos';

  @ApiPropertyOptional({ example: 'Centro' })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El sector debe ser texto' })
  @Length(1, 100, {
    message: 'El sector debe tener entre 1 y 100 caracteres',
  })
  sector?: string;

  @ApiPropertyOptional({
    example: '1',
    description: 'Identificador de la zona activa asociada.',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'number' ? String(value) : recortar(value)))
  @IsString({ message: 'La zona debe ser un identificador' })
  @Matches(/^\d+$/, {
    message: 'La zona debe ser un identificador numérico',
  })
  zonaId?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Filtra espacios con o sin asignación manual.',
  })
  @IsOptional()
  @Transform(({ value }) => aBooleano(value))
  @IsBoolean({ message: 'La asignación manual debe ser true o false' })
  asignacionManual?: boolean;

  @ApiPropertyOptional({ example: '2026-11-10' })
  @IsOptional()
  @IsString({ message: 'La fecha debe ser texto' })
  @Matches(FORMATO_FECHA, {
    message: 'La fecha debe tener el formato YYYY-MM-DD',
  })
  fecha?: string;

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

/** Zona activa para las opciones del listado. */
export class ZonaOpcionEspacioDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Centro - Calle 30' })
  nombre!: string;

  @ApiProperty({ enum: ['permitida', 'restringida', 'alta_congestion'] })
  tipo!: tipo_zona;
}

/** Query de `GET /gestor/espacios/zona-contenedora`. */
export class ZonaEspacioQueryDto {
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

/** Respuesta de `GET /gestor/espacios/zona-contenedora`. */
export class ZonaContenedoraEspacioResponseDto {
  @ApiProperty({ type: ZonaOpcionEspacioDto, nullable: true })
  zona!: ZonaOpcionEspacioDto | null;

  @ApiProperty({ example: 'Centro - Calle 30', nullable: true })
  sector!: string | null;
}

/** Query de `GET /gestor/espacios/:id`. */
export class DetalleEspacioGestorQueryDto {
  @ApiPropertyOptional({
    example: '2026-11-10',
    description: 'Fecha con la que se calcula el estado efectivo.',
  })
  @IsOptional()
  @IsString({ message: 'La fecha debe ser texto' })
  @Matches(FORMATO_FECHA, {
    message: 'La fecha debe tener el formato YYYY-MM-DD',
  })
  fecha?: string;
}

/** Query de `GET /gestor/espacios/:id/historial`. */
export class HistorialEspacioQueryDto {
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

/** Cuerpo de `POST /gestor/espacios`. */
export class CrearEspacioDto {
  @ApiProperty({ example: 'Puesto Plaza Boyacá - Occidente' })
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El nombre debe ser texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @Length(1, 150, {
    message: 'El nombre debe tener entre 1 y 150 caracteres',
  })
  nombre!: string;

  @ApiProperty({ enum: TIPOS_ESPACIO, example: 'puesto' })
  @IsIn([...TIPOS_ESPACIO], {
    message: 'El tipo de espacio no es válido',
  })
  tipo!: tipo_espacio;

  @ApiPropertyOptional({ example: 'Plaza Boyacá', nullable: true })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El sector debe ser texto' })
  @Length(1, 100, {
    message: 'El sector debe tener entre 1 y 100 caracteres',
  })
  sector?: string | null;

  @ApiPropertyOptional({ example: '4 × 3 m', nullable: true })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'Las dimensiones deben ser texto' })
  @Length(1, 60, {
    message: 'Las dimensiones deben tener entre 1 y 60 caracteres',
  })
  dimensiones?: string | null;

  @ApiPropertyOptional({
    example: 'Comidas rápidas',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'La actividad permitida debe ser texto' })
  @Length(1, 100, {
    message: 'La actividad permitida debe tener entre 1 y 100 caracteres',
  })
  actividadPermitida?: string | null;

  @ApiProperty({
    type: Object,
    example: { type: 'Point', coordinates: [-76.1908, 4.0885] },
    description: 'Punto GeoJSON [longitud, latitud].',
  })
  @IsObject({ message: 'La ubicación debe ser un objeto GeoJSON' })
  ubicacion!: GeoJsonPoint;

  @ApiPropertyOptional({
    example: '07:00',
    nullable: true,
    description: 'Debe enviarse junto con horarioFin.',
  })
  @IsOptional()
  @IsString({ message: 'La hora de inicio debe ser texto' })
  @Matches(FORMATO_HORA, {
    message: 'La hora de inicio debe tener formato HH:MM',
  })
  horarioInicio?: string | null;

  @ApiPropertyOptional({
    example: '17:00',
    nullable: true,
    description: 'Debe ser posterior a horarioInicio.',
  })
  @IsOptional()
  @IsString({ message: 'La hora de fin debe ser texto' })
  @Matches(FORMATO_HORA, {
    message: 'La hora de fin debe tener formato HH:MM',
  })
  horarioFin?: string | null;

  @ApiPropertyOptional({
    enum: ESTADOS_MANUALES_ESPACIO,
    example: 'disponible',
    description:
      'Estado inicial. Bloqueado y asignado se calculan automáticamente.',
  })
  @IsOptional()
  @IsIn([...ESTADOS_MANUALES_ESPACIO], {
    message: 'El estado inicial debe ser disponible o mantenimiento',
  })
  estado?: estado_espacio;
}

/** Cuerpo de `PATCH /gestor/espacios/:id`. */
export class ActualizarEspacioDto {
  @ApiPropertyOptional({ example: 'Puesto Plaza Boyacá - Occidente' })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El nombre debe ser texto' })
  @IsNotEmpty({ message: 'El nombre no puede quedar vacío' })
  @Length(1, 150, {
    message: 'El nombre debe tener entre 1 y 150 caracteres',
  })
  nombre?: string;

  @ApiPropertyOptional({ enum: TIPOS_ESPACIO, example: 'kiosco' })
  @IsOptional()
  @IsIn([...TIPOS_ESPACIO], {
    message: 'El tipo de espacio no es válido',
  })
  tipo?: tipo_espacio;

  @ApiPropertyOptional({ example: 'Centro', nullable: true })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El sector debe ser texto' })
  @Length(1, 100, {
    message: 'El sector debe tener entre 1 y 100 caracteres',
  })
  sector?: string | null;

  @ApiPropertyOptional({ example: '4 × 3 m', nullable: true })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'Las dimensiones deben ser texto' })
  @Length(1, 60, {
    message: 'Las dimensiones deben tener entre 1 y 60 caracteres',
  })
  dimensiones?: string | null;

  @ApiPropertyOptional({ example: 'Artesanías', nullable: true })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'La actividad permitida debe ser texto' })
  @Length(1, 100, {
    message: 'La actividad permitida debe tener entre 1 y 100 caracteres',
  })
  actividadPermitida?: string | null;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject({ message: 'La ubicación debe ser un objeto GeoJSON' })
  ubicacion?: GeoJsonPoint;

  @ApiPropertyOptional({ example: '07:00', nullable: true })
  @IsOptional()
  @IsString({ message: 'La hora de inicio debe ser texto' })
  @Matches(FORMATO_HORA, {
    message: 'La hora de inicio debe tener formato HH:MM',
  })
  horarioInicio?: string | null;

  @ApiPropertyOptional({ example: '17:00', nullable: true })
  @IsOptional()
  @IsString({ message: 'La hora de fin debe ser texto' })
  @Matches(FORMATO_HORA, {
    message: 'La hora de fin debe tener formato HH:MM',
  })
  horarioFin?: string | null;

  @ApiPropertyOptional({
    enum: ESTADOS_MANUALES_ESPACIO,
    example: 'mantenimiento',
  })
  @IsOptional()
  @IsIn([...ESTADOS_MANUALES_ESPACIO], {
    message: 'El estado manual debe ser disponible o mantenimiento',
  })
  estado?: estado_espacio;
}

/** Cuerpo de `PATCH /gestor/espacios/:id/estado`. */
export class CambiarEstadoEspacioDto {
  @ApiProperty({ enum: ESTADOS_MANUALES_ESPACIO, example: 'mantenimiento' })
  @IsIn([...ESTADOS_MANUALES_ESPACIO], {
    message: 'El estado manual debe ser disponible o mantenimiento',
  })
  estado!: estado_espacio;
}

/** Cuerpo opcional de `POST /gestor/espacios/:id/asignar` y `/liberar`. */
export class MovimientoEspacioDto {
  @ApiPropertyOptional({
    example: 'Asignación temporal para evento municipal',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El motivo debe ser texto' })
  @Length(1, 300, {
    message: 'El motivo debe tener entre 1 y 300 caracteres',
  })
  motivo?: string | null;
}

/** Cuerpo de `POST /gestor/espacios/:id/bloqueos`. */
export class CrearBloqueoDto {
  @ApiProperty({ example: '2026-12-20' })
  @IsString({ message: 'La fecha de inicio debe ser texto' })
  @Matches(FORMATO_FECHA, {
    message: 'La fecha de inicio debe tener el formato YYYY-MM-DD',
  })
  fechaInicio!: string;

  @ApiProperty({ example: '2026-12-24' })
  @IsString({ message: 'La fecha de fin debe ser texto' })
  @Matches(FORMATO_FECHA, {
    message: 'La fecha de fin debe tener el formato YYYY-MM-DD',
  })
  fechaFin!: string;

  @ApiPropertyOptional({
    example: 'Evento navideño',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El motivo debe ser texto' })
  @Length(1, 300, {
    message: 'El motivo debe tener entre 1 y 300 caracteres',
  })
  motivo?: string | null;
}

/** Cuerpo de `PATCH /gestor/espacios/:id/bloqueos/:bloqueoId`. */
export class ActualizarBloqueoDto {
  @ApiPropertyOptional({ example: '2026-12-20' })
  @IsOptional()
  @IsString({ message: 'La fecha de inicio debe ser texto' })
  @Matches(FORMATO_FECHA, {
    message: 'La fecha de inicio debe tener el formato YYYY-MM-DD',
  })
  fechaInicio?: string;

  @ApiPropertyOptional({ example: '2026-12-24' })
  @IsOptional()
  @IsString({ message: 'La fecha de fin debe ser texto' })
  @Matches(FORMATO_FECHA, {
    message: 'La fecha de fin debe tener el formato YYYY-MM-DD',
  })
  fechaFin?: string;

  @ApiPropertyOptional({ example: 'Mantenimiento del andén', nullable: true })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El motivo debe ser texto' })
  @Length(1, 300, {
    message: 'El motivo debe tener entre 1 y 300 caracteres',
  })
  motivo?: string | null;
}

/** Bloqueo de fechas devuelto por la administración. */
export class BloqueoEspacioGestorDto {
  @ApiProperty({ example: '12' })
  id!: string;

  @ApiProperty({ example: '2026-12-20' })
  fechaInicio!: string;

  @ApiProperty({ example: '2026-12-24' })
  fechaFin!: string;

  @ApiProperty({ example: 'Evento navideño', nullable: true })
  motivo!: string | null;

  @ApiProperty({ example: true })
  activo!: boolean;

  @ApiProperty({ example: '1' })
  creadoPorId!: string;

  @ApiProperty({ example: 'Laura Martínez' })
  creadoPorNombre!: string;

  @ApiProperty({ example: '2026-11-11T10:00:00.000Z' })
  creadoEn!: Date;
}

/** Zona asociada al espacio. */
export class ZonaEspacioGestorDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Centro - Calle 30' })
  nombre!: string;

  @ApiProperty({ enum: ['permitida', 'restringida', 'alta_congestion'] })
  tipo!: tipo_zona;

  @ApiProperty({ example: true })
  activa!: boolean;

  @ApiProperty({ example: '06:00', nullable: true })
  horarioInicio!: string | null;

  @ApiProperty({ example: '18:00', nullable: true })
  horarioFin!: string | null;

  @ApiProperty({ example: 40, nullable: true })
  aforoMaximo!: number | null;

  @ApiProperty({ type: [String], example: ['Frutas frescas'] })
  productos!: string[];
}

/** Fila del catálogo administrativo. */
export class EspacioGestorListadoDto {
  @ApiProperty({ example: '7' })
  id!: string;

  @ApiProperty({ example: 'Puesto Plaza Boyacá - Occidente' })
  nombre!: string;

  @ApiProperty({ enum: TIPOS_ESPACIO, example: 'puesto' })
  tipo!: tipo_espacio;

  @ApiProperty({ example: 'Plaza Boyacá', nullable: true })
  sector!: string | null;

  @ApiProperty({ example: '4 × 3 m', nullable: true })
  dimensiones!: string | null;

  @ApiProperty({ example: 'Comidas rápidas', nullable: true })
  actividadPermitida!: string | null;

  @ApiProperty({
    enum: ESTADOS_ESPACIO,
    example: 'disponible',
    description: 'Estado registrado.',
  })
  estado!: estado_espacio;

  @ApiProperty({
    enum: ESTADOS_ESPACIO,
    example: 'disponible',
    description: 'Estado calculado para la fecha consultada.',
  })
  estadoEfectivo!: estado_espacio;

  @ApiProperty({ example: true })
  disponible!: boolean;

  @ApiProperty({ example: null, nullable: true })
  motivoEstado!: string | null;

  @ApiProperty({ example: false })
  asignacionManual!: boolean;

  @ApiProperty({
    type: Object,
    example: { type: 'Point', coordinates: [-76.1908, 4.0885] },
  })
  ubicacion!: GeoJsonPoint;

  @ApiProperty({
    example: { inicio: '07:00', fin: '17:00' },
  })
  horario!: { inicio: string | null; fin: string | null };

  @ApiProperty({
    example: { inicio: '07:00', fin: '17:00' },
    description: 'Horario propio del espacio; no hereda el de la zona.',
  })
  horarioPropio!: { inicio: string | null; fin: string | null };

  @ApiProperty({ type: ZonaEspacioGestorDto, nullable: true })
  zona!: ZonaEspacioGestorDto | null;

  @ApiProperty({ example: 2 })
  totalBloqueos!: number;

  @ApiProperty({ example: false })
  tienePermisos!: boolean;

  @ApiProperty({ example: false })
  tieneSolicitudes!: boolean;

  @ApiProperty({ example: '2026-11-11T10:00:00.000Z' })
  creadoEn!: Date;
}

/** Ficha administrativa del espacio. */
export class EspacioGestorDetalleDto extends EspacioGestorListadoDto {
  @ApiProperty({ type: [BloqueoEspacioGestorDto] })
  bloqueos!: BloqueoEspacioGestorDto[];

  @ApiProperty({
    example: false,
    description:
      'Indica si el espacio puede eliminarse sin romper permisos o solicitudes.',
  })
  puedeEliminar!: boolean;

  @ApiProperty({ example: 'Laura Martínez' })
  creadoPor!: string;

  @ApiProperty({ example: true })
  bloqueoVigente!: boolean;

  @ApiProperty({ example: false })
  permisoVigente!: boolean;

  @ApiProperty({ example: false })
  solicitudVigente!: boolean;
}

/** Respuesta de `GET /gestor/espacios`. */
export class ListarEspaciosGestorResponseDto {
  @ApiProperty({ type: [EspacioGestorListadoDto] })
  datos!: EspacioGestorListadoDto[];

  @ApiProperty({ example: 1 })
  pagina!: number;

  @ApiProperty({ example: 20 })
  limite!: number;

  @ApiProperty({ example: 12 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPaginas!: number;
}

/** Respuesta de `GET /gestor/espacios/opciones`. */
export class OpcionesEspaciosGestorResponseDto {
  @ApiProperty({
    type: [String],
    enum: TIPOS_ESPACIO,
    example: ['modulo', 'kiosco', 'puesto', 'espacio_movil'],
  })
  tipos!: tipo_espacio[];

  @ApiProperty({
    type: [String],
    enum: ESTADOS_ESPACIO,
    example: ['disponible', 'bloqueado', 'asignado', 'mantenimiento'],
  })
  estados!: estado_espacio[];

  @ApiProperty({ type: [ZonaOpcionEspacioDto] })
  zonas!: ZonaOpcionEspacioDto[];

  @ApiProperty({
    type: [String],
    example: ['Centro', 'Parque La Guadua', 'Plaza Boyacá'],
  })
  sectores!: string[];
}

/** Respuesta común de acciones sobre el estado. */
export class EspacioEstadoResponseDto {
  @ApiProperty({ example: '7' })
  id!: string;

  @ApiProperty({ example: 'Puesto Plaza Boyacá - Occidente' })
  nombre!: string;

  @ApiProperty({ enum: ESTADOS_ESPACIO, example: 'mantenimiento' })
  estado!: estado_espacio;

  @ApiProperty({ example: false })
  asignacionManual!: boolean;

  @ApiProperty({ example: 'Espacio puesto en mantenimiento.' })
  mensaje!: string;
}

/** Respuesta de asignar/liberar. */
export class EspacioAsignacionResponseDto extends EspacioEstadoResponseDto {}

/** Evento del historial administrativo. */
export class HistorialEspacioItemDto {
  @ApiProperty({ example: '31' })
  id!: string;

  @ApiProperty({ example: 'espacios_temporales' })
  tabla!: string;

  @ApiProperty({ enum: ['insert', 'update', 'delete'], example: 'update' })
  accion!: 'insert' | 'update' | 'delete';

  @ApiProperty({ example: '2026-11-11T10:00:00.000Z' })
  creadoEn!: Date;

  @ApiProperty({ example: null, nullable: true })
  actorId!: string | null;

  @ApiProperty({ example: 'Laura', nullable: true })
  actorNombre!: string | null;

  @ApiProperty({ example: 'Martínez', nullable: true })
  actorApellido!: string | null;

  @ApiProperty({ example: 'admin@tulua.gov.co', nullable: true })
  actorCorreo!: string | null;

  @ApiProperty({ example: null, nullable: true })
  valorAnterior!: unknown;

  @ApiProperty({ example: null, nullable: true })
  valorNuevo!: unknown;
}

/** Respuesta de `GET /gestor/espacios/:id/historial`. */
export class HistorialEspacioResponseDto {
  @ApiProperty({
    example: {
      id: '7',
      nombre: 'Puesto Plaza Boyacá - Occidente',
      estado: 'disponible',
    },
  })
  espacio!: {
    id: string;
    nombre: string;
    estado: estado_espacio;
  };

  @ApiProperty({ type: [HistorialEspacioItemDto] })
  datos!: HistorialEspacioItemDto[];

  @ApiProperty({ example: 1 })
  pagina!: number;

  @ApiProperty({ example: 20 })
  limite!: number;

  @ApiProperty({ example: 4 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPaginas!: number;
}

/** Respuesta de `GET /gestor/espacios/:id/bloqueos`. */
export class ListarBloqueosResponseDto {
  @ApiProperty({ type: [BloqueoEspacioGestorDto] })
  datos!: BloqueoEspacioGestorDto[];
}
