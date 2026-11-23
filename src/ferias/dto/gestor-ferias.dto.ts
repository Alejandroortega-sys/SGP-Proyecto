import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import type { estado_feria, tipo_zona } from '../../generated/prisma/client';
import { ESTADOS_FERIA } from '../reglas';

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const FORMATO_ID = /^\d+$/;

function recortar(valor: unknown): unknown {
  return typeof valor === 'string' ? valor.trim() : valor;
}

function aBooleano(valor: unknown): boolean {
  return valor === true || valor === 'true';
}

/** Filtros del listado administrativo de ferias. */
export class ListarFeriasGestorQueryDto {
  @ApiPropertyOptional({ enum: ESTADOS_FERIA, example: 'radicada' })
  @IsOptional()
  @IsIn([...ESTADOS_FERIA], { message: 'El estado no es válido' })
  estado?: estado_feria;

  @ApiPropertyOptional({ example: '4' })
  @IsOptional()
  @IsString({ message: 'La zona debe ser un identificador' })
  @Matches(FORMATO_ID, {
    message: 'El identificador de la zona no es válido',
  })
  zonaId?: string;

  @ApiPropertyOptional({ example: '2026-12-01' })
  @IsOptional()
  @IsString({ message: 'La fecha inicial debe ser texto' })
  @Matches(FORMATO_FECHA, {
    message: 'La fecha inicial debe tener el formato YYYY-MM-DD',
  })
  desde?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsString({ message: 'La fecha final debe ser texto' })
  @Matches(FORMATO_FECHA, {
    message: 'La fecha final debe tener el formato YYYY-MM-DD',
  })
  hasta?: string;

  @ApiPropertyOptional({ example: 'Feria Agroecológica', maxLength: 150 })
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser texto' })
  @Length(1, 150, { message: 'La búsqueda admite máximo 150 caracteres' })
  busqueda?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser mayor o igual a 1' })
  pagina?: number;

  @ApiPropertyOptional({ example: 20, default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser mayor o igual a 1' })
  @Max(100, { message: 'El límite no puede superar 100' })
  limite?: number;
}

/** Filtros de la agenda del calendario. */
export class AgendaFeriasQueryDto {
  @ApiProperty({ example: '2026-12-01' })
  @IsString({ message: 'La fecha inicial es obligatoria' })
  @Matches(FORMATO_FECHA, {
    message: 'La fecha inicial debe tener el formato YYYY-MM-DD',
  })
  desde!: string;

  @ApiProperty({ example: '2026-12-31' })
  @IsString({ message: 'La fecha final es obligatoria' })
  @Matches(FORMATO_FECHA, {
    message: 'La fecha final debe tener el formato YYYY-MM-DD',
  })
  hasta!: string;

  @ApiPropertyOptional({ example: '4' })
  @IsOptional()
  @IsString({ message: 'La zona debe ser un identificador' })
  @Matches(FORMATO_ID, {
    message: 'El identificador de la zona no es válido',
  })
  zonaId?: string;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description:
      'Si es true, incluye ferias canceladas, rechazadas y realizadas.',
  })
  @IsOptional()
  @Transform(({ value }) => aBooleano(value))
  @IsBoolean({ message: 'El filtro de todos los estados debe ser booleano' })
  incluirTodos?: boolean;
}

/** Consulta previa de cruces para mover o aprobar una feria. */
export class CrucesFeriaQueryDto {
  @ApiPropertyOptional({ example: '4' })
  @IsOptional()
  @IsString({ message: 'La zona debe ser un identificador' })
  @Matches(FORMATO_ID, {
    message: 'El identificador de la zona no es válido',
  })
  zonaId?: string;

  @ApiProperty({ example: '2027-02-10' })
  @IsString({ message: 'La fecha de inicio es obligatoria' })
  @Matches(FORMATO_FECHA, {
    message: 'La fecha de inicio debe tener el formato YYYY-MM-DD',
  })
  fechaInicio!: string;

  @ApiProperty({ example: '2027-02-12' })
  @IsString({ message: 'La fecha de fin es obligatoria' })
  @Matches(FORMATO_FECHA, {
    message: 'La fecha de fin debe tener el formato YYYY-MM-DD',
  })
  fechaFin!: string;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description:
      'Si es true, incluye los conflictos de espacios individuales de la zona.',
  })
  @IsOptional()
  @Transform(({ value }) => aBooleano(value))
  @IsBoolean({ message: 'El filtro para aprobación debe ser booleano' })
  paraAprobacion?: boolean;
}

/** Cuerpo para mover una feria a otra zona o rango de fechas. */
export class MoverFeriaDto {
  @ApiProperty({ example: '4' })
  @IsString({ message: 'La zona es obligatoria' })
  @Matches(FORMATO_ID, {
    message: 'El identificador de la zona no es válido',
  })
  zonaId!: string;

  @ApiProperty({ example: '2027-02-10' })
  @IsString({ message: 'La fecha de inicio es obligatoria' })
  @Matches(FORMATO_FECHA, {
    message: 'La fecha de inicio debe tener el formato YYYY-MM-DD',
  })
  fechaInicio!: string;

  @ApiProperty({ example: '2027-02-12' })
  @IsString({ message: 'La fecha de fin es obligatoria' })
  @Matches(FORMATO_FECHA, {
    message: 'La fecha de fin debe tener el formato YYYY-MM-DD',
  })
  fechaFin!: string;

  @ApiPropertyOptional({
    example: 'Se ajusta la fecha para evitar el cruce con otra feria.',
    maxLength: 2000,
  })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El motivo del movimiento debe ser texto' })
  @Length(1, 2000, {
    message: 'El motivo del movimiento debe tener entre 1 y 2000 caracteres',
  })
  motivo?: string;
}

/** Cuerpo para cancelar una feria. */
export class CancelarFeriaDto {
  @ApiProperty({
    example: 'La zona fue reservada para una jornada institucional.',
    maxLength: 2000,
  })
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El motivo de cancelación es obligatorio' })
  @Length(1, 2000, {
    message: 'El motivo de cancelación debe tener entre 1 y 2000 caracteres',
  })
  motivo!: string;
}

export class ZonaFeriaGestorDto {
  @ApiProperty({ example: '4' })
  id!: string;

  @ApiProperty({ example: 'Parque La Guadua' })
  nombre!: string;

  @ApiProperty({ example: 'permitida' })
  tipo!: tipo_zona;

  @ApiProperty({ example: true })
  activa!: boolean;

  @ApiProperty({ example: 25, nullable: true })
  aforoMaximo!: number | null;

  @ApiPropertyOptional({ example: '06:00', nullable: true })
  horarioInicio!: string | null;

  @ApiPropertyOptional({ example: '20:00', nullable: true })
  horarioFin!: string | null;
}

export class OrganizadorFeriaGestorDto {
  @ApiProperty({ example: '7' })
  id!: string;

  @ApiProperty({ example: 'Luis' })
  nombre!: string;

  @ApiPropertyOptional({ example: 'Álvarez', nullable: true })
  apellido!: string | null;

  @ApiProperty({ example: 'luis.alvarez@agrovalle.org' })
  correo!: string;

  @ApiProperty({ example: 'Fundación Agroecológica del Valle' })
  organizacion!: string;

  @ApiProperty({ example: '901234567-8' })
  nit!: string;
}

export class EventoAgendaFeriaDto {
  @ApiProperty({ example: '12' })
  id!: string;

  @ApiProperty({ example: 'FER-2026-00003' })
  numeroRadicado!: string;

  @ApiProperty({ example: 'Feria Agroecológica de Primavera' })
  nombre!: string;

  @ApiProperty({ example: 'Feria agroecológica' })
  tipoFeria!: string;

  @ApiProperty({ example: 'aprobada' })
  estado!: estado_feria;

  @ApiProperty({ example: '2027-02-10' })
  fechaInicio!: string;

  @ApiProperty({ example: '2027-02-12' })
  fechaFin!: string;

  @ApiProperty({ example: 20 })
  numeroPuestos!: number;

  @ApiProperty({ type: ZonaFeriaGestorDto })
  zona!: ZonaFeriaGestorDto;

  @ApiProperty({ type: OrganizadorFeriaGestorDto })
  organizador!: OrganizadorFeriaGestorDto;

  @ApiProperty({ example: false })
  tieneCruces!: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  motivoCancelacion!: string | null;

  @ApiPropertyOptional({
    example: '2026-11-22T10:00:00.000Z',
    nullable: true,
  })
  aprobadaEn!: Date | null;

  @ApiPropertyOptional({
    example: '2026-11-22T10:00:00.000Z',
    nullable: true,
  })
  canceladaEn!: Date | null;
}

export class ConflictoAgendaFeriaDto {
  @ApiProperty({ example: 'feria' })
  tipo!: 'feria' | 'espacio' | 'permiso' | 'solicitud' | 'bloqueo';

  @ApiPropertyOptional({ example: '12', nullable: true })
  feriaId!: string | null;

  @ApiPropertyOptional({
    example: 'Feria Agroecológica de Diciembre',
    nullable: true,
  })
  feriaNombre!: string | null;

  @ApiPropertyOptional({ example: '3', nullable: true })
  espacioId!: string | null;

  @ApiPropertyOptional({
    example: 'Espacio Plaza Boyacá - Norte',
    nullable: true,
  })
  espacioNombre!: string | null;

  @ApiPropertyOptional({
    example: 'SOL-2026-00001',
    nullable: true,
  })
  referencia!: string | null;

  @ApiProperty({ example: '2026-12-10' })
  fechaInicio!: string;

  @ApiProperty({ example: '2026-12-12' })
  fechaFin!: string;

  @ApiProperty({ example: 'La feria se cruza con otra feria activa.' })
  mensaje!: string;
}

export class ResumenAgendaFeriaDto {
  @ApiProperty({ example: 4 })
  total!: number;

  @ApiProperty({ example: 1 })
  radicadas!: number;

  @ApiProperty({ example: 2 })
  aprobadas!: number;

  @ApiProperty({ example: 0 })
  canceladas!: number;

  @ApiProperty({ example: 0 })
  rechazadas!: number;

  @ApiProperty({ example: 0 })
  realizadas!: number;
}

export class AgendaFeriaGestorResponseDto {
  @ApiProperty({ example: '2026-12-01' })
  desde!: string;

  @ApiProperty({ example: '2026-12-31' })
  hasta!: string;

  @ApiPropertyOptional({ example: '4', nullable: true })
  zonaId!: string | null;

  @ApiProperty({ type: [ZonaFeriaGestorDto] })
  zonas!: ZonaFeriaGestorDto[];

  @ApiProperty({ type: [EventoAgendaFeriaDto] })
  eventos!: EventoAgendaFeriaDto[];

  @ApiProperty({ type: [ConflictoAgendaFeriaDto] })
  cruces!: ConflictoAgendaFeriaDto[];

  @ApiProperty({ type: ResumenAgendaFeriaDto })
  resumen!: ResumenAgendaFeriaDto;
}

export class FeriaGestorListadoDto extends EventoAgendaFeriaDto {
  @ApiProperty({ example: '2026-11-22T10:00:00.000Z' })
  radicadaEn!: Date;

  @ApiProperty({ example: '2026-11-22T10:00:00.000Z' })
  actualizadoEn!: Date;
}

export class ListarFeriasGestorResponseDto {
  @ApiProperty({ type: [FeriaGestorListadoDto] })
  datos!: FeriaGestorListadoDto[];

  @ApiProperty({
    example: { pagina: 1, limite: 20, total: 1, totalPaginas: 1 },
  })
  paginacion!: {
    pagina: number;
    limite: number;
    total: number;
    totalPaginas: number;
  };
}

export class DocumentoFeriaGestorDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Documento del evento' })
  tipoDocumento!: string;

  @ApiPropertyOptional({ example: 'acta.pdf', nullable: true })
  nombreOriginal!: string | null;

  @ApiPropertyOptional({ example: 'application/pdf', nullable: true })
  mimeType!: string | null;

  @ApiPropertyOptional({ example: 34567, nullable: true })
  tamanoBytes!: number | null;

  @ApiProperty({ example: '2026-11-22T10:00:00.000Z' })
  cargadoEn!: Date;

  @ApiProperty({ example: '/ferias/12/documentos/3/archivo' })
  url!: string;
}

export class EspacioBloqueadoFeriaDto {
  @ApiProperty({ example: '3' })
  id!: string;

  @ApiProperty({ example: 'Espacio Plaza Boyacá - Norte' })
  nombre!: string;
}

export class FeriaGestorDetalleDto extends FeriaGestorListadoDto {
  @ApiProperty({
    type: [Object],
    example: [{ id: '1', nombre: 'Frutas frescas' }],
  })
  productos!: { id: string; nombre: string }[];

  @ApiProperty({ type: [DocumentoFeriaGestorDto] })
  documentos!: DocumentoFeriaGestorDto[];

  @ApiProperty({ type: [EspacioBloqueadoFeriaDto] })
  espaciosBloqueados!: EspacioBloqueadoFeriaDto[];

  @ApiPropertyOptional({ example: 'Carlos', nullable: true })
  aprobadaPor!: string | null;
}

export class CrucesFeriaResponseDto {
  @ApiProperty({ example: true })
  disponible!: boolean;

  @ApiProperty({ type: [ConflictoAgendaFeriaDto] })
  conflictos!: ConflictoAgendaFeriaDto[];

  @ApiProperty({
    type: [Object],
    example: [{ fechaInicio: '2027-02-13', fechaFin: '2027-02-15' }],
  })
  sugerencias!: { fechaInicio: string; fechaFin: string }[];
}

export class AprobarFeriaResponseDto {
  @ApiProperty({ example: '12' })
  id!: string;

  @ApiProperty({ example: 'FER-2026-00003' })
  numeroRadicado!: string;

  @ApiProperty({ example: 'radicada' })
  estadoAnterior!: estado_feria;

  @ApiProperty({ example: 'aprobada' })
  estado!: estado_feria;

  @ApiProperty({ example: '2026-11-22T10:00:00.000Z' })
  aprobadaEn!: Date | null;

  @ApiProperty({ type: [EspacioBloqueadoFeriaDto] })
  espaciosBloqueados!: EspacioBloqueadoFeriaDto[];

  @ApiProperty({ example: true })
  correoEnviado!: boolean;

  @ApiProperty({ example: null, nullable: true })
  mensajeCorreo!: string | null;

  @ApiProperty({ example: 'Feria aprobada y espacios bloqueados.' })
  mensaje!: string;
}

export class CancelarFeriaResponseDto {
  @ApiProperty({ example: '12' })
  id!: string;

  @ApiProperty({ example: 'FER-2026-00003' })
  numeroRadicado!: string;

  @ApiProperty({ example: 'aprobada' })
  estadoAnterior!: estado_feria;

  @ApiProperty({ example: 'cancelada' })
  estado!: estado_feria;

  @ApiProperty({
    example: 'La zona fue reservada para una jornada institucional.',
  })
  motivoCancelacion!: string;

  @ApiProperty({ example: '2026-11-22T10:00:00.000Z' })
  canceladaEn!: Date | null;

  @ApiProperty({ example: 2 })
  espaciosLiberados!: number;

  @ApiProperty({ example: true })
  correoEnviado!: boolean;

  @ApiProperty({ example: null, nullable: true })
  mensajeCorreo!: string | null;

  @ApiProperty({ example: 'Feria cancelada y espacios liberados.' })
  mensaje!: string;
}

export class MoverFeriaResponseDto {
  @ApiProperty({ example: '12' })
  id!: string;

  @ApiProperty({ example: 'FER-2026-00003' })
  numeroRadicado!: string;

  @ApiProperty({ example: 'aprobada' })
  estado!: estado_feria;

  @ApiProperty({ example: '2027-02-10' })
  fechaInicioAnterior!: string;

  @ApiProperty({ example: '2027-02-12' })
  fechaFinAnterior!: string;

  @ApiProperty({ example: '4' })
  zonaAnteriorId!: string;

  @ApiProperty({ example: 'Parque La Guadua' })
  zonaAnteriorNombre!: string;

  @ApiProperty({ example: '2027-02-13' })
  fechaInicio!: string;

  @ApiProperty({ example: '2027-02-15' })
  fechaFin!: string;

  @ApiProperty({ type: ZonaFeriaGestorDto })
  zona!: ZonaFeriaGestorDto;

  @ApiProperty({ type: [EspacioBloqueadoFeriaDto] })
  espaciosBloqueados!: EspacioBloqueadoFeriaDto[];

  @ApiProperty({ example: true })
  correoEnviado!: boolean;

  @ApiProperty({ example: null, nullable: true })
  mensajeCorreo!: string | null;

  @ApiProperty({ example: 'Feria movida correctamente.' })
  mensaje!: string;
}
