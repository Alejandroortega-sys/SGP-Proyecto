import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import type {
  estado_espacio,
  tipo_espacio,
  tipo_zona,
} from '../../generated/prisma/client';
import type { GeoJsonPoint } from '../../common/geo';

/** Tipos de espacio admitidos por el enum `tipo_espacio` de la BD. */
export const TIPOS_ESPACIO: readonly tipo_espacio[] = [
  'modulo',
  'kiosco',
  'puesto',
  'espacio_movil',
];

/** Estados admitidos por el enum `estado_espacio` de la BD. */
export const ESTADOS_ESPACIO: readonly estado_espacio[] = [
  'disponible',
  'bloqueado',
  'asignado',
  'mantenimiento',
];

/** Formato de hora de 24 horas aceptado por los filtros. */
const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Convierte `"true"`/`"false"` de query string a boolean. */
function aBooleano(valor: unknown): unknown {
  if (valor === 'true') return true;
  if (valor === 'false') return false;
  return valor;
}

/** Recorta espacios de los textos antes de validarlos. */
function recortar(valor: unknown): unknown {
  return typeof valor === 'string' ? valor.trim() : valor;
}

/**
 * Query de `GET /espacios`.
 *
 * Por defecto solo se devuelven espacios disponibles. `incluirNoDisponibles`
 * permite ver el resto para consultar su ficha y su estado sin confundirlos
 * con espacios asignables.
 */
export class ListarEspaciosQueryDto {
  /** `true` devuelve también bloqueados, asignados y en mantenimiento. */
  @ApiPropertyOptional({
    example: false,
    default: false,
    description:
      'Si es true, incluye espacios no disponibles para consultar su estado.',
  })
  @IsOptional()
  @Transform(({ value }) => aBooleano(value))
  @IsBoolean({ message: 'El filtro «incluirNoDisponibles» debe ser true o false' })
  incluirNoDisponibles?: boolean;

  /**
   * Fecha de consulta de disponibilidad (`YYYY-MM-DD`). Si se omite se usa la
   * fecha actual de la base de datos.
   */
  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsString({ message: 'La fecha debe ser texto' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener el formato YYYY-MM-DD',
  })
  @IsDateString({}, { message: 'La fecha no es válida' })
  fecha?: string;

  /** Sector o barrio registrado en el espacio. */
  @ApiPropertyOptional({ example: 'Centro' })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El sector debe ser texto' })
  @Length(1, 100, {
    message: 'El sector debe tener entre 1 y 100 caracteres',
  })
  sector?: string;

  /** Actividad permitida registrada en el espacio. */
  @ApiPropertyOptional({ example: 'Venta de alimentos y frutas' })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'La actividad debe ser texto' })
  @Length(1, 100, {
    message: 'La actividad debe tener entre 1 y 100 caracteres',
  })
  actividad?: string;

  /** Hora de inicio del rango solicitado (HH:MM). */
  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @IsString({ message: 'La hora de inicio debe ser texto' })
  @Matches(FORMATO_HORA, {
    message: 'La hora de inicio debe tener formato HH:MM',
  })
  horaInicio?: string;

  /** Hora de fin del rango solicitado (HH:MM). */
  @ApiPropertyOptional({ example: '12:00' })
  @IsOptional()
  @IsString({ message: 'La hora de fin debe ser texto' })
  @Matches(FORMATO_HORA, {
    message: 'La hora de fin debe tener formato HH:MM',
  })
  horaFin?: string;
}

/** Query de `GET /espacios/:id`. */
export class DetalleEspacioQueryDto {
  /** Fecha con la que se evalúa el estado efectivo. */
  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsString({ message: 'La fecha debe ser texto' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener el formato YYYY-MM-DD',
  })
  @IsDateString({}, { message: 'La fecha no es válida' })
  fecha?: string;
}

/** Horario propio del espacio. */
export class HorarioEspacioDto {
  @ApiProperty({ example: '06:00', nullable: true })
  inicio!: string | null;

  @ApiProperty({ example: '14:00', nullable: true })
  fin!: string | null;
}

/** Resumen de la zona normativa a la que pertenece el espacio. */
export class ZonaResumenEspacioDto {
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

/** Bloqueo de fechas registrado para un espacio. */
export class BloqueoEspacioDto {
  @ApiProperty({ example: '2026-10-25' })
  fechaInicio!: string;

  @ApiProperty({ example: '2026-10-31' })
  fechaFin!: string;

  @ApiProperty({ example: 'Mantenimiento del andén', nullable: true })
  motivo!: string | null;

  @ApiProperty({
    example: true,
    description: 'Indica si el bloqueo cubre la fecha consultada.',
  })
  activo!: boolean;
}

/** Permiso vigente que ocupa el espacio en la fecha consultada. */
export class PermisoEspacioDto {
  @ApiProperty({ example: 'PER-2026-00001' })
  numero!: string;

  @ApiProperty({ example: '2026-11-01' })
  fechaInicio!: string;

  @ApiProperty({ example: '2026-11-30' })
  fechaFin!: string;
}

/** Restricciones completas de la zona de un espacio. */
export class ZonaRestriccionesDto extends ZonaResumenEspacioDto {
  @ApiProperty({ example: true })
  activa!: boolean;

  @ApiProperty({ example: '06:00', nullable: true })
  horarioInicio!: string | null;

  @ApiProperty({ example: '18:00', nullable: true })
  horarioFin!: string | null;

  @ApiProperty({ example: 40, nullable: true })
  aforoMaximo!: number | null;

  @ApiProperty({
    type: [String],
    example: ['Frutas frescas', 'Verduras'],
  })
  productos!: string[];
}

/** Espacio devuelto por el listado del mapa y la tabla. */
export class EspacioListadoDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Espacio móvil Calle 30 - A' })
  nombre!: string;

  @ApiProperty({ enum: TIPOS_ESPACIO, example: 'espacio_movil' })
  tipo!: tipo_espacio;

  @ApiProperty({ example: 'Centro', nullable: true })
  sector!: string | null;

  @ApiProperty({ example: '3 × 2 m', nullable: true })
  dimensiones!: string | null;

  @ApiProperty({
    example: 'Venta de alimentos y frutas',
    nullable: true,
  })
  actividadPermitida!: string | null;

  @ApiProperty({
    enum: ESTADOS_ESPACIO,
    example: 'disponible',
    description: 'Estado registrado en la base de datos.',
  })
  estado!: estado_espacio;

  @ApiProperty({
    enum: ESTADOS_ESPACIO,
    example: 'disponible',
    description:
      'Estado resultante de aplicar bloqueos y permisos vigentes a la fecha.',
  })
  estadoEfectivo!: estado_espacio;

  @ApiProperty({
    example: true,
    description:
      'Solo es true si el estado efectivo es disponible. Los espacios ocupados o bloqueados nunca aparecen como disponibles.',
  })
  disponible!: boolean;

  @ApiProperty({
    example: null,
    nullable: true,
    description: 'Explicación legible cuando el espacio no está disponible.',
  })
  motivoEstado!: string | null;

  @ApiProperty({
    type: Object,
    example: { type: 'Point', coordinates: [-76.195, 4.089] },
  })
  ubicacion!: GeoJsonPoint;

  @ApiProperty({ type: HorarioEspacioDto })
  horario!: HorarioEspacioDto;

  @ApiProperty({ type: ZonaResumenEspacioDto, nullable: true })
  zona!: ZonaResumenEspacioDto | null;
}

/** Detalle completo de un espacio y las restricciones de su zona. */
export class EspacioDetalleDto extends EspacioListadoDto {
  @ApiProperty({ type: BloqueoEspacioDto, nullable: true })
  bloqueo!: BloqueoEspacioDto | null;

  @ApiProperty({ type: PermisoEspacioDto, nullable: true })
  permiso!: PermisoEspacioDto | null;

  @ApiProperty({ type: ZonaRestriccionesDto, nullable: true })
  declare zona: ZonaRestriccionesDto | null;

  @ApiProperty({ example: '2026-10-01T12:00:00.000Z' })
  creadoEn!: Date;
}

/** Opciones disponibles para los filtros de sector y actividad. */
export class OpcionesEspaciosResponseDto {
  @ApiProperty({
    type: [String],
    example: ['Centro', 'Parque La Guadua', 'Plaza Boyacá'],
  })
  sectores!: string[];

  @ApiProperty({
    type: [String],
    example: ['Artesanías', 'Comidas rápidas', 'Ventas de alimentos'],
  })
  actividades!: string[];
}

/** Respuesta de `GET /espacios`. */
export class ListarEspaciosResponseDto {
  @ApiProperty({ type: [EspacioListadoDto] })
  datos!: EspacioListadoDto[];

  @ApiProperty({
    example: 3,
    description: 'Cantidad de espacios devueltos por el filtro actual.',
  })
  total!: number;

  @ApiProperty({
    example: 3,
    description: 'Cantidad de espacios disponibles para la fecha consultada.',
  })
  disponibles!: number;

  @ApiProperty({
    example: 3,
    description: 'Cantidad de espacios no disponibles para la fecha consultada.',
  })
  noDisponibles!: number;
}

/** Valida que un estado de espacio sea válido. */
export function esEstadoEspacio(valor: unknown): valor is estado_espacio {
  return (
    typeof valor === 'string' &&
    (ESTADOS_ESPACIO as readonly string[]).includes(valor)
  );
}

/** Valida que un tipo de espacio sea válido. */
export function esTipoEspacio(valor: unknown): valor is tipo_espacio {
  return (
    typeof valor === 'string' &&
    (TIPOS_ESPACIO as readonly string[]).includes(valor)
  );
}

/** Normaliza un texto opcional para la respuesta. */
export function textoOpcional(valor: string | null): string | null {
  return valor && valor.trim().length > 0 ? valor : null;
}

/** Etiqueta legible de un tipo de espacio (para mensajes del backend). */
export const ETIQUETAS_TIPO_ESPACIO: Record<tipo_espacio, string> = {
  modulo: 'Módulo',
  kiosco: 'Kiosco',
  puesto: 'Puesto',
  espacio_movil: 'Espacio móvil',
};

/** Etiqueta legible de un estado de espacio. */
export const ETIQUETAS_ESTADO_ESPACIO: Record<estado_espacio, string> = {
  disponible: 'Disponible',
  bloqueado: 'Bloqueado',
  asignado: 'Ocupado',
  mantenimiento: 'En mantenimiento',
};

/** Reexporta los tipos usados por los DTOs. */
export type { estado_espacio, tipo_espacio, tipo_zona };
