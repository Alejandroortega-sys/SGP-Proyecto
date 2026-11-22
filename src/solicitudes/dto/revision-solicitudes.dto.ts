import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import type {
  estado_documento,
  estado_solicitud,
  perfil_gestor,
} from '../../generated/prisma/client';
import {
  ESTADOS_BANDEJA_REVISION,
  ORDENES_REVISION,
  type EstadoRequisitoRevision,
  type OrdenRevision,
  type ProgresoRevision,
} from '../revision';
import {
  ActorSolicitudDto,
  ESTADOS_SOLICITUD,
  HistorialSolicitudDto,
  ProductoSolicitudDto,
} from './solicitudes.dto';

function recortar(valor: unknown): unknown {
  return typeof valor === 'string' ? valor.trim() : valor;
}

/** Query de `GET /gestor/solicitudes` (HU-19). */
export class ListarSolicitudesRevisionQueryDto {
  @ApiPropertyOptional({
    enum: ESTADOS_BANDEJA_REVISION,
    description:
      'Si se omite, la bandeja muestra las solicitudes Radicada y En revisión.',
  })
  @IsOptional()
  @IsIn([...ESTADOS_BANDEJA_REVISION], { message: 'El estado no es válido' })
  estado?: estado_solicitud;

  @ApiPropertyOptional({ example: 'Centro' })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El sector debe ser texto' })
  @Length(1, 100, { message: 'El sector no puede superar 100 caracteres' })
  sector?: string;

  @ApiPropertyOptional({ example: 'Artesanías' })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'La actividad debe ser texto' })
  @Length(1, 100, {
    message: 'La actividad no puede superar 100 caracteres',
  })
  actividad?: string;

  @ApiPropertyOptional({
    enum: ORDENES_REVISION,
    default: 'antiguedad',
    description: 'Por defecto, las solicitudes más antiguas primero.',
  })
  @IsOptional()
  @IsIn([...ORDENES_REVISION], { message: 'El orden no es válido' })
  orden?: OrdenRevision;

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

export class OpcionesRevisionSolicitudesResponseDto {
  @ApiProperty({ type: [String], example: ['Centro', 'Parque La Guadua'] })
  sectores!: string[];

  @ApiProperty({ type: [String], example: ['Artesanías', 'Comidas rápidas'] })
  actividades!: string[];
}

export class GestorBloqueoRevisionDto {
  @ApiProperty({ example: '2' })
  id!: string;

  @ApiProperty({ example: 'Laura' })
  nombre!: string;

  @ApiProperty({ example: 'Martínez', nullable: true })
  apellido!: string | null;

  @ApiProperty({ example: 'revisor' })
  perfil!: perfil_gestor;
}

export class BloqueoRevisionDto {
  @ApiProperty({ example: '12' })
  solicitudId!: string;

  @ApiProperty({ type: GestorBloqueoRevisionDto })
  gestor!: GestorBloqueoRevisionDto;

  @ApiProperty({ example: '2026-11-21T10:00:00.000Z' })
  iniciadaEn!: Date;

  @ApiProperty({ example: '2026-11-21T10:05:00.000Z' })
  ultimaActividad!: Date;

  @ApiProperty({ example: '2026-11-21T10:20:00.000Z' })
  expiraEn!: Date;

  @ApiProperty({
    example: true,
    description: 'Indica si el bloqueo pertenece al gestor autenticado.',
  })
  esPropio!: boolean;
}

export class ComercianteRevisionDto {
  @ApiProperty({ example: '3' })
  id!: string;

  @ApiProperty({ example: 'María' })
  nombre!: string;

  @ApiProperty({ example: 'Gómez', nullable: true })
  apellido!: string | null;

  @ApiProperty({ example: 'maria.gomez@gmail.com' })
  correo!: string;

  @ApiProperty({ example: '11223344', nullable: true })
  documento!: string | null;

  @ApiProperty({ example: '3001234567', nullable: true })
  telefono!: string | null;

  @ApiProperty({
    example: 'Venta de artesanías',
    nullable: true,
  })
  actividadComercial!: string | null;

  @ApiProperty({ example: 'informal', nullable: true })
  categoria!: string | null;
}

export class DocumentoRevisionDto {
  @ApiProperty({ example: '8' })
  id!: string;

  @ApiProperty({ example: '1', nullable: true })
  requisitoId!: string | null;

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
    example: 'validado',
  })
  estado!: estado_documento;

  @ApiProperty({ example: 'Documento legible.', nullable: true })
  observacion!: string | null;

  @ApiProperty({ example: '2026-11-20T10:00:00.000Z' })
  cargadoEn!: Date;

  @ApiProperty({ example: 2 })
  numeroVersion!: number;

  @ApiProperty({ example: '5', nullable: true })
  reemplazaA!: string | null;

  @ApiProperty({ example: true })
  esActual!: boolean;

  @ApiProperty({ example: '/solicitudes/12/documentos/8/archivo' })
  url!: string;

  @ApiProperty({ example: '2026-11-21T10:00:00.000Z', nullable: true })
  verificadoEn!: Date | null;

  @ApiProperty({ type: ActorSolicitudDto, nullable: true })
  verificadoPor!: ActorSolicitudDto | null;
}

export class RequisitoRevisionDto {
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

  @ApiProperty({
    enum: ['faltante', 'cargado', 'cumple', 'no_cumple'],
    example: 'cargado',
  })
  estado!: EstadoRequisitoRevision;

  @ApiProperty({ type: DocumentoRevisionDto, nullable: true })
  documentoActual!: DocumentoRevisionDto | null;

  @ApiProperty({ type: [DocumentoRevisionDto] })
  versiones!: DocumentoRevisionDto[];

  @ApiProperty({ example: 'El RUT está vencido.', nullable: true })
  observacion!: string | null;

  @ApiProperty({ example: '2026-11-21T10:00:00.000Z', nullable: true })
  verificadoEn!: Date | null;

  @ApiProperty({ type: ActorSolicitudDto, nullable: true })
  verificadoPor!: ActorSolicitudDto | null;
}

export class ProgresoRevisionDto implements ProgresoRevision {
  @ApiProperty({ example: 4 })
  total!: number;

  @ApiProperty({ example: 1 })
  pendientes!: number;

  @ApiProperty({ example: 3 })
  verificados!: number;

  @ApiProperty({ example: 2 })
  cumple!: number;

  @ApiProperty({ example: 1 })
  noCumple!: number;
}

export class SolicitudRevisionListadoDto {
  @ApiProperty({ example: '12' })
  id!: string;

  @ApiProperty({ example: 'SOL-2026-00012' })
  numeroRadicado!: string;

  @ApiProperty({ enum: ESTADOS_SOLICITUD, example: 'radicada' })
  estado!: estado_solicitud;

  @ApiProperty({ example: 'Venta de artesanías' })
  actividad!: string;

  @ApiProperty({ example: '2026-12-01' })
  fechaInicio!: string;

  @ApiProperty({ example: '2026-12-15' })
  fechaFin!: string;

  @ApiProperty({ example: '09:00' })
  horaInicio!: string;

  @ApiProperty({ example: '12:00' })
  horaFin!: string;

  @ApiProperty({ example: '2026-11-20T10:00:00.000Z', nullable: true })
  radicadaEn!: Date | null;

  @ApiProperty({ example: '2026-11-20T10:00:00.000Z' })
  creadoEn!: Date;

  @ApiProperty({ type: ComercianteRevisionDto })
  comerciante!: ComercianteRevisionDto;

  @ApiProperty({
    type: Object,
    example: {
      id: '1',
      nombre: 'Kiosco Parque La Guadua',
      sector: 'Parque La Guadua',
      tipo: 'kiosco',
      actividadPermitida: 'Artesanías',
    },
    nullable: true,
  })
  espacio!: {
    id: string;
    nombre: string;
    sector: string | null;
    tipo: string;
    actividadPermitida: string | null;
  } | null;

  @ApiProperty({ example: 2 })
  documentosCargados!: number;

  @ApiProperty({ example: 1 })
  requisitosVerificados!: number;

  @ApiProperty({ example: 1 })
  requisitosNoCumplen!: number;

  @ApiProperty({ type: BloqueoRevisionDto, nullable: true })
  bloqueo!: BloqueoRevisionDto | null;
}

export class PaginacionRevisionSolicitudesDto {
  @ApiProperty({ example: 1 })
  pagina!: number;

  @ApiProperty({ example: 20 })
  limite!: number;

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPaginas!: number;
}

export class ListarSolicitudesRevisionResponseDto {
  @ApiProperty({ type: [SolicitudRevisionListadoDto] })
  datos!: SolicitudRevisionListadoDto[];

  @ApiProperty({ type: PaginacionRevisionSolicitudesDto })
  paginacion!: PaginacionRevisionSolicitudesDto;
}

export class SolicitudRevisionDetalleDto extends SolicitudRevisionListadoDto {
  @ApiProperty({ example: '2026-11-21T09:30:00.000Z', nullable: true })
  decididaEn!: Date | null;

  @ApiProperty({ example: null, nullable: true })
  motivoRechazo!: string | null;

  @ApiProperty({ example: '2026-11-20T10:00:00.000Z' })
  actualizadoEn!: Date;

  @ApiProperty({ type: [ProductoSolicitudDto] })
  productos!: { id: string; nombre: string }[];

  @ApiProperty({ type: [RequisitoRevisionDto] })
  requisitos!: RequisitoRevisionDto[];

  @ApiProperty({ type: [DocumentoRevisionDto] })
  otrosDocumentos!: DocumentoRevisionDto[];

  @ApiProperty({ type: [HistorialSolicitudDto] })
  historial!: HistorialSolicitudDto[];

  @ApiProperty({ type: ProgresoRevisionDto })
  progreso!: ProgresoRevisionDto;

  @ApiProperty({ example: true })
  puedeVerificar!: boolean;

  @ApiProperty({ example: null, nullable: true })
  motivoBloqueo!: string | null;
}

export class TomarRevisionResponseDto {
  @ApiProperty({ example: 'en_revision' })
  estado!: estado_solicitud;

  @ApiProperty({ example: true })
  transiciono!: boolean;

  @ApiProperty({ example: true })
  correoEnviado!: boolean;

  @ApiProperty({ example: null, nullable: true })
  mensajeCorreo!: string | null;

  @ApiProperty({
    example: 'Revisión iniciada. La solicitud pasó a «En revisión».',
  })
  mensaje!: string;

  @ApiProperty({ type: BloqueoRevisionDto })
  bloqueo!: BloqueoRevisionDto;

  @ApiProperty({
    example: '7b0d4a4e-9f0c-4d7b-8a5e-1f2c3d4e5f6a',
    description:
      'Token de la sesión de bloqueo. Se usa para liberar únicamente el bloqueo de esta pantalla.',
  })
  tokenBloqueo!: string;

  @ApiProperty({ type: SolicitudRevisionDetalleDto })
  detalle!: SolicitudRevisionDetalleDto;
}

export class RenovarRevisionResponseDto {
  @ApiProperty({ example: '2026-11-21T10:20:00.000Z' })
  expiraEn!: Date;

  @ApiProperty({ example: 'Bloqueo de revisión renovado.' })
  mensaje!: string;
}

export class LiberarRevisionResponseDto {
  @ApiProperty({ example: true })
  liberado!: boolean;

  @ApiProperty({ example: 'Bloqueo de revisión liberado.' })
  mensaje!: string;
}

/** Cuerpo de `PATCH /gestor/solicitudes/:id/requisitos/:requisitoId/verificacion`. */
export class VerificarRequisitoRevisionDto {
  @ApiProperty({
    enum: ['cumple', 'no_cumple'],
    example: 'no_cumple',
  })
  @IsIn(['cumple', 'no_cumple'], {
    message: 'La verificación debe ser cumple o no_cumple',
  })
  estado!: 'cumple' | 'no_cumple';

  @ApiPropertyOptional({
    example: 'El RUT está vencido.',
    description: 'Obligatoria cuando el estado es «no_cumple».',
  })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'La observación debe ser texto' })
  @Length(1, 2_000, {
    message: 'La observación debe tener entre 1 y 2000 caracteres',
  })
  observacion?: string;
}

export class RespuestaVerificarRequisitoDto {
  @ApiProperty({ example: 'Requisito marcado como «Cumple».' })
  mensaje!: string;

  @ApiProperty({ type: RequisitoRevisionDto })
  requisito!: RequisitoRevisionDto;

  @ApiProperty({ type: ProgresoRevisionDto })
  progreso!: ProgresoRevisionDto;

  @ApiProperty({ example: '2026-11-21T10:20:00.000Z' })
  expiraEn!: Date;
}
