import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import type { estado_permiso } from '../../generated/prisma/client';

/** Estados reales del permiso (enum `estado_permiso` de la BD). */
export const ESTADOS_PERMISO = [
  'vigente',
  'suspendido',
  'revocado',
  'vencido',
] as const;

/** Estados a los que un gestor puede llevar un permiso (HU-35). */
export const DESTINOS_PERMISO = ['suspendido', 'vigente', 'revocado'] as const;

/** Resultados registrables en `verificaciones_qr` (HU-33). */
export const RESULTADOS_VERIFICACION = [
  'valido',
  'no_vigente',
  'no_encontrado',
] as const;

type DestinoPermiso = (typeof DESTINOS_PERMISO)[number];

/** Titular comercial de un permiso (datos mínimos, sin documento). */
export class TitularPermisoDto {
  @ApiProperty({ example: '3' })
  id!: string;

  @ApiProperty({ example: 'María Gómez' })
  nombre!: string;
}

/** Espacio asignado al permiso. */
export class EspacioPermisoDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Espacio móvil Calle 30 - A' })
  nombre!: string;
}

/** Cobro generado al emitir el permiso (HU-36, pago simulado). */
export class CobroPermisoDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({
    example: '50000.00',
    description: 'Valor NUMERIC(12,2) como string (Prisma.Decimal).',
  })
  valor!: string;

  @ApiProperty({
    enum: ['pendiente', 'pagado', 'anulado'],
    example: 'pendiente',
  })
  estado!: string;

  @ApiProperty({ example: null, nullable: true })
  pagadoEn!: Date | null;
}

/** Permiso del que nace este por renovación (HU-34). */
export class PermisoOrigenDto {
  @ApiProperty({ example: '7' })
  id!: string;

  @ApiProperty({ example: 'PER-2026-00007' })
  numero!: string;
}

/** Renovación emitida a partir de un permiso (listado del detalle). */
export class RenovacionPermisoDto {
  @ApiProperty({ example: '9' })
  id!: string;

  @ApiProperty({ example: 'PER-2026-00009' })
  numero!: string;

  @ApiProperty({ example: '2026-12-01' })
  fechaInicio!: string;

  @ApiProperty({ example: '2026-12-30' })
  fechaFin!: string;

  @ApiProperty({ enum: [...ESTADOS_PERMISO], example: 'vigente' })
  estado!: estado_permiso;
}

/** Cuerpo de `POST /gestor/permisos` (HU-31). */
export class EmitirPermisoDto {
  @ApiProperty({
    example: '12',
    description:
      'Identificador de la solicitud aprobada sobre la que se emite el permiso.',
  })
  @IsString({ message: 'El identificador de la solicitud debe ser texto' })
  @Matches(/^\d+$/, {
    message: 'El identificador de la solicitud no es válido',
  })
  solicitudId!: string;

  @ApiPropertyOptional({
    example: '7',
    description:
      'Identificador del permiso anterior cuando esta emisión es una ' +
      'renovación aprobada (HU-34); genera un permiso nuevo enlazado con ' +
      '`renovado_desde`. Opcional.',
  })
  @IsOptional()
  @IsString({
    message: 'El identificador del permiso de origen debe ser texto',
  })
  @Matches(/^\d+$/, {
    message: 'El identificador del permiso de origen no es válido',
  })
  renovadoDesde?: string;
}

/** Respuesta de `POST /gestor/permisos` (HU-31). */
export class EmitirPermisoResponseDto {
  @ApiProperty({ example: '8' })
  id!: string;

  @ApiProperty({ example: 'PER-2026-00008' })
  numero!: string;

  @ApiProperty({ example: '12' })
  solicitudId!: string;

  @ApiProperty({ type: TitularPermisoDto })
  titular!: TitularPermisoDto;

  @ApiProperty({ type: EspacioPermisoDto })
  espacio!: EspacioPermisoDto;

  @ApiProperty({ example: 'Venta de frutas y verduras' })
  categoria!: string;

  @ApiProperty({ example: '2026-11-01' })
  fechaInicio!: string;

  @ApiProperty({ example: '2026-11-30' })
  fechaFin!: string;

  @ApiProperty({ enum: [...ESTADOS_PERMISO], example: 'vigente' })
  estado!: estado_permiso;

  @ApiProperty({
    example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934c',
    description: 'Token aleatorio generado por la BD (hex de 48 caracteres).',
  })
  qrToken!: string;

  @ApiProperty({ example: '2026-11-23T10:00:00.000Z' })
  emitidoEn!: Date;

  @ApiProperty({ type: PermisoOrigenDto, nullable: true })
  renovadoDesde!: PermisoOrigenDto | null;

  @ApiProperty({
    type: CobroPermisoDto,
    nullable: true,
    description:
      'Cobro pendiente creado con la tarifa vigente; null si no hay tarifa aplicable.',
  })
  cobro!: CobroPermisoDto | null;

  @ApiProperty({
    example: 'Permiso PER-2026-00008 emitido y carné disponible.',
  })
  mensaje!: string;
}

/** Query de `GET /gestor/permisos` (HU-37). */
export class ListarPermisosGestorQueryDto {
  @ApiPropertyOptional({
    example: 'Gómez',
    description:
      'Búsqueda por número de permiso, nombre del titular o nombre del espacio (parcial, sin distinguir mayúsculas).',
  })
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser texto' })
  @Length(1, 100, {
    message: 'La búsqueda debe tener entre 1 y 100 caracteres',
  })
  q?: string;

  @ApiPropertyOptional({
    enum: [...ESTADOS_PERMISO],
    example: 'vigente',
    description: 'Filtra por el estado almacenado del permiso.',
  })
  @IsOptional()
  @IsIn([...ESTADOS_PERMISO], { message: 'El estado del permiso no es válido' })
  estado?: estado_permiso;

  @ApiPropertyOptional({
    example: '2026-11-01',
    description:
      'Fecha inicial del rango: incluye permisos cuya vigencia llega hasta ' +
      'esta fecha o después (fecha_fin >= desde).',
  })
  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'La fecha «desde» debe tener el formato AAAA-MM-DD' },
  )
  desde?: string;

  @ApiPropertyOptional({
    example: '2026-11-30',
    description:
      'Fecha final del rango: incluye permisos cuya vigencia empieza en ' +
      'esta fecha o antes (fecha_inicio <= hasta).',
  })
  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'La fecha «hasta» debe tener el formato AAAA-MM-DD' },
  )
  hasta?: string;

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

/** Permiso del listado del gestor (HU-37). */
export class PermisoListadoDto {
  @ApiProperty({ example: '8' })
  id!: string;

  @ApiProperty({ example: 'PER-2026-00008' })
  numero!: string;

  @ApiProperty({ example: 'María Gómez' })
  titularNombre!: string;

  @ApiProperty({ example: 'Espacio móvil Calle 30 - A', nullable: true })
  espacioNombre!: string | null;

  @ApiProperty({ example: 'Venta de frutas y verduras' })
  categoria!: string;

  @ApiProperty({ example: '2026-11-01' })
  fechaInicio!: string;

  @ApiProperty({ example: '2026-11-30' })
  fechaFin!: string;

  @ApiProperty({ enum: [...ESTADOS_PERMISO], example: 'vigente' })
  estado!: estado_permiso;

  @ApiProperty({ example: '2026-11-23T10:00:00.000Z' })
  emitidoEn!: Date;

  @ApiProperty({
    example: 'PER-2026-00007',
    nullable: true,
    description: 'Número del permiso del que nace por renovación, si aplica.',
  })
  renovadoDesdeNumero!: string | null;
}

/** Paginación del listado de permisos. */
export class PaginacionPermisosDto {
  @ApiProperty({ example: 1 })
  pagina!: number;

  @ApiProperty({ example: 20 })
  limite!: number;

  @ApiProperty({ example: 4 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPaginas!: number;
}

/** Respuesta de `GET /gestor/permisos` (HU-37). */
export class ListarPermisosGestorResponseDto {
  @ApiProperty({ type: [PermisoListadoDto] })
  datos!: PermisoListadoDto[];

  @ApiProperty({ type: PaginacionPermisosDto })
  paginacion!: PaginacionPermisosDto;
}

/** Detalle de un permiso para el gestor. */
export class PermisoGestorDetalleDto {
  @ApiProperty({ example: '8' })
  id!: string;

  @ApiProperty({ example: 'PER-2026-00008' })
  numero!: string;

  @ApiProperty({ example: '12' })
  solicitudId!: string;

  @ApiProperty({ example: 'SOL-2026-00012' })
  solicitudNumero!: string;

  @ApiProperty({ type: TitularPermisoDto })
  titular!: TitularPermisoDto;

  @ApiProperty({ type: EspacioPermisoDto, nullable: true })
  espacio!: EspacioPermisoDto | null;

  @ApiProperty({ example: 'Venta de frutas y verduras' })
  categoria!: string;

  @ApiProperty({ example: '2026-11-01' })
  fechaInicio!: string;

  @ApiProperty({ example: '2026-11-30' })
  fechaFin!: string;

  @ApiProperty({ enum: [...ESTADOS_PERMISO], example: 'vigente' })
  estado!: estado_permiso;

  @ApiProperty({
    example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934c',
  })
  qrToken!: string;

  @ApiProperty({ type: TitularPermisoDto })
  emitidoPor!: TitularPermisoDto;

  @ApiProperty({ example: '2026-11-23T10:00:00.000Z' })
  emitidoEn!: Date;

  @ApiProperty({ type: PermisoOrigenDto, nullable: true })
  renovadoDesde!: PermisoOrigenDto | null;

  @ApiProperty({ type: [RenovacionPermisoDto] })
  renovaciones!: RenovacionPermisoDto[];

  @ApiProperty({ type: CobroPermisoDto, nullable: true })
  cobro!: CobroPermisoDto | null;
}

/** Cuerpo de `PATCH /gestor/permisos/:id/estado` (HU-35). */
export class CambiarEstadoPermisoDto {
  @ApiProperty({
    enum: [...DESTINOS_PERMISO],
    example: 'suspendido',
    description:
      '«suspendido» y «revocado» exigen motivo; «vigente» solo se admite ' +
      'para reactivar un permiso suspendido.',
  })
  @IsIn([...DESTINOS_PERMISO], {
    message: 'El estado destino debe ser suspendido, vigente o revocado',
  })
  estado!: DestinoPermiso;

  @ApiPropertyOptional({
    example: 'Reporte de inspección: horario excedido.',
    description:
      'Motivo del cambio. Obligatorio para suspender o revocar (la BD lo exige); opcional para levantar la suspensión.',
  })
  @IsOptional()
  @IsString({ message: 'El motivo debe ser texto' })
  @Length(1, 2_000, {
    message: 'El motivo debe tener entre 1 y 2000 caracteres',
  })
  motivo?: string;
}

/** Respuesta de `PATCH /gestor/permisos/:id/estado` (HU-35). */
export class CambiarEstadoPermisoResponseDto {
  @ApiProperty({ example: '8' })
  id!: string;

  @ApiProperty({ example: 'PER-2026-00008' })
  numero!: string;

  @ApiProperty({ enum: [...ESTADOS_PERMISO], example: 'vigente' })
  estadoAnterior!: estado_permiso;

  @ApiProperty({ enum: [...ESTADOS_PERMISO], example: 'suspendido' })
  estado!: estado_permiso;

  @ApiProperty({
    example: 'Reporte de inspección: horario excedido.',
    nullable: true,
  })
  motivo!: string | null;

  @ApiProperty({ example: 'Permiso suspendido y comerciante notificado.' })
  mensaje!: string;
}

/** Evento del ciclo de vida del permiso (HU-35/HU-37). */
export class PermisoEventoDto {
  @ApiProperty({ example: '31' })
  id!: string;

  @ApiProperty({
    enum: ['emitido', 'vigente', 'suspendido', 'revocado', 'vencido'],
    example: 'suspendido',
  })
  evento!: string;

  @ApiProperty({
    example: 'Reporte de inspección: horario excedido.',
    nullable: true,
  })
  motivo!: string | null;

  @ApiProperty({ example: '2', nullable: true })
  actorId!: string | null;

  @ApiProperty({ example: 'Carlos Ramírez', nullable: true })
  actorNombre!: string | null;

  @ApiProperty({ example: '2026-11-23T10:00:00.000Z' })
  creadoEn!: Date;
}

/** Resumen del permiso en la vista de trazabilidad. */
export class TrazabilidadPermisoDto {
  @ApiProperty({ example: '8' })
  id!: string;

  @ApiProperty({ example: 'PER-2026-00008' })
  numero!: string;

  @ApiProperty({ example: 'María Gómez' })
  titularNombre!: string;

  @ApiProperty({ example: 'Espacio móvil Calle 30 - A', nullable: true })
  espacioNombre!: string | null;

  @ApiProperty({ example: 'Venta de frutas y verduras' })
  categoria!: string;

  @ApiProperty({ example: '2026-11-01' })
  fechaInicio!: string;

  @ApiProperty({ example: '2026-11-30' })
  fechaFin!: string;

  @ApiProperty({ enum: [...ESTADOS_PERMISO], example: 'vigente' })
  estado!: estado_permiso;
}

/** Consultas ciudadanas del QR del permiso (HU-33/HU-37). */
export class VerificacionesPermisoDto {
  @ApiProperty({ example: 2 })
  total!: number;

  @ApiProperty({ example: '2026-11-22T15:30:00.000Z', nullable: true })
  ultima!: Date | null;
}

/** Respuesta de `GET /gestor/permisos/:id/trazabilidad` (HU-37). */
export class TrazabilidadPermisoResponseDto {
  @ApiProperty({ type: TrazabilidadPermisoDto })
  permiso!: TrazabilidadPermisoDto;

  @ApiProperty({ type: [PermisoEventoDto] })
  eventos!: PermisoEventoDto[];

  @ApiProperty({ type: VerificacionesPermisoDto })
  verificaciones!: VerificacionesPermisoDto;
}

/** Query de `GET /permisos/mios` (HU-32). */
export class ListarMisPermisosQueryDto {
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

/** Permiso del listado del comerciante (HU-32). */
export class MiPermisoDto {
  @ApiProperty({ example: '8' })
  id!: string;

  @ApiProperty({ example: 'PER-2026-00008' })
  numero!: string;

  @ApiProperty({ enum: [...ESTADOS_PERMISO], example: 'vigente' })
  estado!: estado_permiso;

  @ApiProperty({ example: 'Venta de frutas y verduras' })
  categoria!: string;

  @ApiProperty({ example: 'Espacio móvil Calle 30 - A', nullable: true })
  espacioNombre!: string | null;

  @ApiProperty({ example: '2026-11-01' })
  fechaInicio!: string;

  @ApiProperty({ example: '2026-11-30' })
  fechaFin!: string;

  @ApiProperty({ example: '2026-11-23T10:00:00.000Z' })
  emitidoEn!: Date;

  @ApiProperty({
    example: 'PER-2026-00007',
    nullable: true,
    description: 'Número del permiso del que nace por renovación, si aplica.',
  })
  renovadoDesdeNumero!: string | null;
}

/** Respuesta de `GET /permisos/mios` (HU-32). */
export class ListarMisPermisosResponseDto {
  @ApiProperty({ type: [MiPermisoDto] })
  datos!: MiPermisoDto[];

  @ApiProperty({ type: PaginacionPermisosDto })
  paginacion!: PaginacionPermisosDto;
}

/** Detalle del permiso propio con los datos del carné (HU-32). */
export class MiPermisoDetalleDto {
  @ApiProperty({ example: '8' })
  id!: string;

  @ApiProperty({ example: 'PER-2026-00008' })
  numero!: string;

  @ApiProperty({ enum: [...ESTADOS_PERMISO], example: 'vigente' })
  estado!: estado_permiso;

  @ApiProperty({ example: 'María Gómez' })
  titularNombre!: string;

  @ApiProperty({ example: 'Venta de frutas y verduras' })
  categoria!: string;

  @ApiProperty({ example: 'Espacio móvil Calle 30 - A', nullable: true })
  espacioNombre!: string | null;

  @ApiProperty({ example: '2026-11-01' })
  fechaInicio!: string;

  @ApiProperty({ example: '2026-11-30' })
  fechaFin!: string;

  @ApiProperty({ example: '2026-11-23T10:00:00.000Z' })
  emitidoEn!: Date;

  @ApiProperty({
    example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934c',
  })
  qrToken!: string;

  @ApiProperty({
    example: 'http://localhost:3001/verificar/e3b0c44298fc1c149afbf4c8996fb924',
    description: 'URL pública que codifica el QR del carné.',
  })
  urlVerificacion!: string;
}

/** Respuesta de `POST /permisos/mios/:id/renovacion` (HU-34). */
export class RenovarPermisoResponseDto {
  @ApiProperty({ example: '8' })
  permisoId!: string;

  @ApiProperty({ example: 'PER-2026-00008' })
  permisoNumero!: string;

  @ApiProperty({ example: '13' })
  solicitudId!: string;

  @ApiProperty({ example: 'SOL-2026-00013' })
  numeroRadicado!: string;

  @ApiProperty({ example: '2026-12-01' })
  fechaInicio!: string;

  @ApiProperty({ example: '2026-12-30' })
  fechaFin!: string;

  @ApiProperty({
    example:
      'Solicitud de renovación radicada con sus datos precargados. Un gestor la revisará.',
  })
  mensaje!: string;
}

/**
 * Respuesta de `GET /verificaciones/:qrToken` (HU-33).
 *
 * Datos mínimos definidos en AGENTS §9.5: validez, vigencia, categoría y
 * nombre del titular comercial. Nunca documento, teléfono, correo,
 * dirección ni el motivo interno del gestor.
 */
export class VerificacionQrResponseDto {
  @ApiProperty({ example: true })
  valido!: boolean;

  @ApiProperty({
    enum: [...ESTADOS_PERMISO],
    example: 'vigente',
    description:
      'Estado efectivo: «vencido» se deriva de la fecha cuando el estado ' +
      'almacenado es vigente pero la vigencia ya pasó (decisión D3).',
  })
  estado!: estado_permiso;

  @ApiProperty({ example: '2026-11-01' })
  vigenciaInicio!: string;

  @ApiProperty({ example: '2026-11-30' })
  vigenciaFin!: string;

  @ApiProperty({ example: 'Venta de frutas y verduras' })
  categoria!: string;

  @ApiProperty({ example: 'María Gómez' })
  titular!: string;
}
