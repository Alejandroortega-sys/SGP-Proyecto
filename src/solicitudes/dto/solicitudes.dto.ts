import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import type { estado_solicitud, estado_documento } from '../../generated/prisma/client';

/** Estados admitidos por el enum `estado_solicitud` de la BD. */
export const ESTADOS_SOLICITUD: readonly estado_solicitud[] = [
  'borrador',
  'radicada',
  'en_revision',
  'devuelta',
  'aprobada',
  'rechazada',
  'cancelada',
];

/** Estados que cuentan como solicitud activa para el control de duplicados. */
export const ESTADOS_DUPLICADO: readonly estado_solicitud[] = [
  'radicada',
  'en_revision',
  'devuelta',
];

/** Formato de fecha ISO sin hora. */
export const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Formato de hora de 24 horas. */
export const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const FORMATO_ID = /^\d+$/;

function recortar(valor: unknown): unknown {
  return typeof valor === 'string' ? valor.trim() : valor;
}

/**
 * Datos del formulario de radicación. Llegan como un campo JSON dentro del
 * cuerpo `multipart/form-data` para poder enviar los documentos en la misma
 * petición.
 */
export class RadicarSolicitudDatosDto {
  @ApiProperty({ example: '1' })
  @IsString({ message: 'El espacio es obligatorio' })
  @Matches(FORMATO_ID, { message: 'El identificador del espacio no es válido' })
  espacioId!: string;

  @ApiProperty({ example: 'Venta de frutas y verduras', minLength: 3, maxLength: 200 })
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'La actividad debe ser texto' })
  @Length(3, 200, {
    message: 'La actividad debe tener entre 3 y 200 caracteres',
  })
  actividad!: string;

  @ApiProperty({ type: [String], example: ['1', '2'] })
  @IsArray({ message: 'Los productos deben ser una lista' })
  @ArrayMinSize(1, { message: 'Selecciona al menos un producto' })
  @ArrayUnique({ message: 'Los productos no deben repetirse' })
  @IsString({ each: true, message: 'Cada producto debe ser un identificador' })
  @Matches(FORMATO_ID, {
    each: true,
    message: 'Cada producto debe tener un identificador válido',
  })
  productoIds!: string[];

  @ApiProperty({ example: '2026-12-01' })
  @IsString({ message: 'La fecha de inicio es obligatoria' })
  @Matches(FORMATO_FECHA, {
    message: 'La fecha de inicio debe tener el formato YYYY-MM-DD',
  })
  fechaInicio!: string;

  @ApiProperty({ example: '2026-12-15' })
  @IsString({ message: 'La fecha de fin es obligatoria' })
  @Matches(FORMATO_FECHA, {
    message: 'La fecha de fin debe tener el formato YYYY-MM-DD',
  })
  fechaFin!: string;

  @ApiProperty({ example: '08:00' })
  @IsString({ message: 'La hora de inicio es obligatoria' })
  @Matches(FORMATO_HORA, {
    message: 'La hora de inicio debe tener el formato HH:MM',
  })
  horaInicio!: string;

  @ApiProperty({ example: '12:00' })
  @IsString({ message: 'La hora de fin es obligatoria' })
  @Matches(FORMATO_HORA, {
    message: 'La hora de fin debe tener el formato HH:MM',
  })
  horaFin!: string;
}

/** Metadatos de un documento dentro del formulario multipart. */
export class DocumentoMetaDto {
  @ApiProperty({ example: '1' })
  @IsString({ message: 'El requisito documental es obligatorio' })
  @Matches(FORMATO_ID, {
    message: 'El identificador del requisito no es válido',
  })
  requisitoId!: string;

  @ApiProperty({ example: 'documento-identidad.pdf' })
  @IsString({ message: 'El nombre original del documento es obligatorio' })
  @Length(1, 255, {
    message: 'El nombre original del documento no puede superar 255 caracteres',
  })
  nombreOriginal!: string;
}

/** Cuerpo multipart de `POST /solicitudes`. */
export class RadicarSolicitudFormDto {
  @ApiProperty({
    description: 'JSON con los datos de la solicitud (RadicarSolicitudDatosDto).',
    example:
      '{"espacioId":"1","actividad":"Venta de frutas","productoIds":["1"],"fechaInicio":"2026-12-01","fechaFin":"2026-12-15","horaInicio":"08:00","horaFin":"12:00"}',
  })
  @IsString({ message: 'El campo «datos» es obligatorio' })
  @Length(2, 10_000, { message: 'El campo «datos» no es válido' })
  datos!: string;

  @ApiPropertyOptional({
    description:
      'JSON con los metadatos de los archivos, en el mismo orden de «documentos».',
    example: '[{"requisitoId":"1","nombreOriginal":"cedula.pdf"}]',
  })
  @IsOptional()
  @IsString({ message: 'El campo «documentosMeta» debe ser texto JSON' })
  @Length(2, 10_000, { message: 'El campo «documentosMeta» no es válido' })
  documentosMeta?: string;
}

/** Query de `GET /solicitudes/mias`. */
export class ListarMisSolicitudesQueryDto {
  @ApiPropertyOptional({ enum: ESTADOS_SOLICITUD, example: 'radicada' })
  @IsOptional()
  @IsIn([...ESTADOS_SOLICITUD], { message: 'El estado no es válido' })
  estado?: estado_solicitud;

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

/** Query de `GET /solicitudes/disponibilidad`. */
export class ConsultarDisponibilidadQueryDto {
  @ApiProperty({ example: '1' })
  @IsString({ message: 'El espacio es obligatorio' })
  @Matches(FORMATO_ID, { message: 'El identificador del espacio no es válido' })
  espacioId!: string;

  @ApiProperty({ example: '2026-12-01' })
  @IsString({ message: 'La fecha de inicio es obligatoria' })
  @Matches(FORMATO_FECHA, {
    message: 'La fecha de inicio debe tener el formato YYYY-MM-DD',
  })
  fechaInicio!: string;

  @ApiProperty({ example: '2026-12-15' })
  @IsString({ message: 'La fecha de fin es obligatoria' })
  @Matches(FORMATO_FECHA, {
    message: 'La fecha de fin debe tener el formato YYYY-MM-DD',
  })
  fechaFin!: string;

  @ApiProperty({ example: '08:00' })
  @IsString({ message: 'La hora de inicio es obligatoria' })
  @Matches(FORMATO_HORA, {
    message: 'La hora de inicio debe tener el formato HH:MM',
  })
  horaInicio!: string;

  @ApiProperty({ example: '12:00' })
  @IsString({ message: 'La hora de fin es obligatoria' })
  @Matches(FORMATO_HORA, {
    message: 'La hora de fin debe tener el formato HH:MM',
  })
  horaFin!: string;
}

/** Query de `GET /solicitudes/requisitos`. */
export class RequisitosSolicitudQueryDto {
  @ApiPropertyOptional({
    example: 'Venta de alimentos y frutas',
    description: 'Actividad permitida del espacio seleccionado.',
  })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'La actividad debe ser texto' })
  @Length(1, 100, {
    message: 'La actividad debe tener entre 1 y 100 caracteres',
  })
  actividad?: string;
}

export class ProductoSolicitudDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Frutas frescas' })
  nombre!: string;
}

export class EspacioSolicitudDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Espacio móvil Calle 30 - A' })
  nombre!: string;

  @ApiProperty({ example: 'Centro', nullable: true })
  sector!: string | null;

  @ApiProperty({ example: 'espacio_movil', nullable: true })
  tipo!: string | null;

  @ApiProperty({ example: 'Venta de alimentos y frutas', nullable: true })
  actividadPermitida!: string | null;
}

export class DocumentoSolicitudDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Documento de identidad' })
  tipoDocumento!: string;

  @ApiProperty({ example: 'cedula.pdf', nullable: true })
  nombreOriginal!: string | null;

  @ApiProperty({ example: 'application/pdf', nullable: true })
  mimeType!: string | null;

  @ApiProperty({ example: 245_760, nullable: true })
  tamanoBytes!: number | null;

  @ApiProperty({
    enum: ['pendiente', 'validado', 'observado'],
    example: 'pendiente',
  })
  estado!: estado_documento;

  @ApiProperty({ example: null, nullable: true })
  observacion!: string | null;

  @ApiProperty({ example: '2026-11-20T10:00:00.000Z' })
  cargadoEn!: Date;

  @ApiProperty({ example: '/solicitudes/12/documentos/3/archivo' })
  url!: string;
}

export class ActorSolicitudDto {
  @ApiProperty({ example: '3' })
  id!: string;

  @ApiProperty({ example: 'María' })
  nombre!: string;

  @ApiProperty({ example: 'Gómez', nullable: true })
  apellido!: string | null;
}

export class HistorialSolicitudDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ enum: ESTADOS_SOLICITUD, example: 'borrador', nullable: true })
  estadoAnterior!: estado_solicitud | null;

  @ApiProperty({ enum: ESTADOS_SOLICITUD, example: 'radicada' })
  estadoNuevo!: estado_solicitud;

  @ApiProperty({ example: 'Solicitud radicada por el comerciante.', nullable: true })
  observacion!: string | null;

  @ApiProperty({ example: '2026-11-20T10:00:00.000Z' })
  creadoEn!: Date;

  @ApiProperty({ type: ActorSolicitudDto, nullable: true })
  actor!: ActorSolicitudDto | null;
}

export class SolicitudListadoDto {
  @ApiProperty({ example: '12' })
  id!: string;

  @ApiProperty({ example: 'SOL-2026-00005' })
  numeroRadicado!: string;

  @ApiProperty({ enum: ESTADOS_SOLICITUD, example: 'radicada' })
  estado!: estado_solicitud;

  @ApiProperty({ example: 'Venta de frutas y verduras' })
  actividad!: string;

  @ApiProperty({ example: '2026-12-01' })
  fechaInicio!: string;

  @ApiProperty({ example: '2026-12-15' })
  fechaFin!: string;

  @ApiProperty({ example: '08:00' })
  horaInicio!: string;

  @ApiProperty({ example: '12:00' })
  horaFin!: string;

  @ApiProperty({ example: '2026-11-20T10:00:00.000Z', nullable: true })
  radicadaEn!: Date | null;

  @ApiProperty({ example: '2026-11-20T10:00:00.000Z' })
  creadoEn!: Date;

  @ApiProperty({ type: EspacioSolicitudDto, nullable: true })
  espacio!: EspacioSolicitudDto | null;

  @ApiProperty({ type: [ProductoSolicitudDto] })
  productos!: ProductoSolicitudDto[];

  @ApiProperty({ type: [DocumentoSolicitudDto] })
  documentos!: DocumentoSolicitudDto[];
}

export class SolicitudTemporalDetalleDto extends SolicitudListadoDto {
  @ApiProperty({ example: '2026-11-21T09:30:00.000Z', nullable: true })
  decididaEn!: Date | null;

  @ApiProperty({ example: null, nullable: true })
  motivoRechazo!: string | null;

  @ApiProperty({ example: '2026-11-20T10:00:00.000Z' })
  actualizadoEn!: Date;

  @ApiProperty({ type: [HistorialSolicitudDto] })
  historial!: HistorialSolicitudDto[];
}

export class PaginacionSolicitudesDto {
  @ApiProperty({ example: 1 })
  pagina!: number;

  @ApiProperty({ example: 20 })
  limite!: number;

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPaginas!: number;
}

export class ListarSolicitudesResponseDto {
  @ApiProperty({ type: [SolicitudListadoDto] })
  datos!: SolicitudListadoDto[];

  @ApiProperty({ type: PaginacionSolicitudesDto })
  paginacion!: PaginacionSolicitudesDto;
}

export class RequisitoDocumentalDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Documento de identidad' })
  nombre!: string;

  @ApiProperty({ example: 'Copia legible del documento.', nullable: true })
  descripcion!: string | null;

  @ApiProperty({ example: true })
  obligatorio!: boolean;

  @ApiProperty({ example: null, nullable: true })
  tipoActividad!: string | null;

  @ApiProperty({ example: 10 })
  orden!: number;
}

export class RequisitosSolicitudResponseDto {
  @ApiProperty({ example: 'Venta de alimentos y frutas', nullable: true })
  actividad!: string | null;

  @ApiProperty({ type: [RequisitoDocumentalDto] })
  requisitos!: RequisitoDocumentalDto[];
}

export class DisponibilidadSolicitudDto {
  @ApiProperty({ example: true })
  disponible!: boolean;

  @ApiProperty({ example: null, nullable: true })
  motivo!: string | null;

  @ApiProperty({
    example: { id: '1', nombre: 'Espacio móvil Calle 30 - A' },
  })
  espacio!: { id: string; nombre: string };
}

export class RadicarSolicitudResponseDto {
  @ApiProperty({ example: '12' })
  id!: string;

  @ApiProperty({ example: 'SOL-2026-00005' })
  numeroRadicado!: string;

  @ApiProperty({ enum: ESTADOS_SOLICITUD, example: 'radicada' })
  estado!: estado_solicitud;

  @ApiProperty({ example: 'Solicitud radicada correctamente.' })
  mensaje!: string;

  @ApiProperty({ example: true })
  correoEnviado!: boolean;

  @ApiProperty({ example: null, nullable: true })
  mensajeCorreo!: string | null;
}
