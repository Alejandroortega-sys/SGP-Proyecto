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
import type { estado_feria, tipo_zona } from '../../generated/prisma/client';
import { ESTADOS_FERIA } from '../reglas';

/** Formato de fecha ISO sin hora. */
export const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

const FORMATO_ID = /^\d+$/;

function recortar(valor: unknown): unknown {
  return typeof valor === 'string' ? valor.trim() : valor;
}

/** Datos del formulario de radicación de una feria. */
export class RadicarFeriaDatosDto {
  @ApiProperty({ example: 'Feria Agroecológica de Primavera', maxLength: 200 })
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El nombre de la feria debe ser texto' })
  @Length(3, 200, {
    message: 'El nombre de la feria debe tener entre 3 y 200 caracteres',
  })
  nombre!: string;

  @ApiProperty({ example: 'Feria agroecológica', maxLength: 100 })
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El tipo de feria debe ser texto' })
  @Length(3, 100, {
    message: 'El tipo de feria debe tener entre 3 y 100 caracteres',
  })
  tipoFeria!: string;

  @ApiProperty({ example: '4' })
  @IsString({ message: 'La zona es obligatoria' })
  @Matches(FORMATO_ID, { message: 'El identificador de la zona no es válido' })
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

  @ApiProperty({ example: 20, minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: 'El número de puestos debe ser un número entero' })
  @Min(1, { message: 'El número de puestos debe ser mayor que cero' })
  numeroPuestos!: number;

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
}

/** Cuerpo multipart de `POST /ferias`. */
export class RadicarFeriaFormDto {
  @ApiProperty({
    description: 'JSON con los datos de la feria (RadicarFeriaDatosDto).',
    example:
      '{"nombre":"Feria Agroecológica","tipoFeria":"Feria agroecológica","zonaId":"4","fechaInicio":"2027-02-10","fechaFin":"2027-02-12","numeroPuestos":20,"productoIds":["1"]}',
  })
  @IsString({ message: 'El campo «datos» es obligatorio' })
  @Length(2, 10_000, { message: 'El campo «datos» no es válido' })
  datos!: string;
}

/** Query de `GET /ferias/agenda`. */
export class ConsultarAgendaFeriaQueryDto {
  @ApiProperty({ example: '4' })
  @IsString({ message: 'La zona es obligatoria' })
  @Matches(FORMATO_ID, { message: 'El identificador de la zona no es válido' })
  zonaId!: string;

  @ApiPropertyOptional({ example: '2026-12-01' })
  @IsOptional()
  @IsString({ message: 'La fecha inicial debe ser texto' })
  @Matches(FORMATO_FECHA, {
    message: 'La fecha inicial debe tener el formato YYYY-MM-DD',
  })
  desde?: string;

  @ApiPropertyOptional({ example: '2027-01-31' })
  @IsOptional()
  @IsString({ message: 'La fecha final debe ser texto' })
  @Matches(FORMATO_FECHA, {
    message: 'La fecha final debe tener el formato YYYY-MM-DD',
  })
  hasta?: string;
}

/** Query de `GET /ferias/disponibilidad`. */
export class ConsultarDisponibilidadFeriaQueryDto {
  @ApiProperty({ example: '4' })
  @IsString({ message: 'La zona es obligatoria' })
  @Matches(FORMATO_ID, { message: 'El identificador de la zona no es válido' })
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

  @ApiPropertyOptional({ example: 20, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El número de puestos debe ser un número entero' })
  @Min(1, { message: 'El número de puestos debe ser mayor que cero' })
  numeroPuestos?: number;
}

/** Query de `GET /ferias/mias`. */
export class ListarMisFeriasQueryDto {
  @ApiPropertyOptional({ enum: ESTADOS_FERIA, example: 'radicada' })
  @IsOptional()
  @IsIn([...ESTADOS_FERIA], { message: 'El estado no es válido' })
  estado?: estado_feria;

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

export class ProductoFeriaDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Frutas frescas' })
  nombre!: string;
}

export class ZonaFeriaDto {
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

  @ApiProperty({ type: [String], example: ['Frutas frescas'] })
  productosPermitidos!: string[];

  @ApiProperty({ example: true })
  admiteFerias!: boolean;
}

export class OpcionesFeriaDto {
  @ApiProperty({ type: [ZonaFeriaDto] })
  zonas!: ZonaFeriaDto[];

  @ApiProperty({ type: [ProductoFeriaDto] })
  productos!: ProductoFeriaDto[];
}

export class RangoFeriaDto {
  @ApiProperty({ example: '2026-12-10' })
  fechaInicio!: string;

  @ApiProperty({ example: '2026-12-12' })
  fechaFin!: string;
}

export class AgendaFeriaDto {
  @ApiProperty({ example: '4' })
  zonaId!: string;

  @ApiProperty({ example: '2026-12-01' })
  desde!: string;

  @ApiProperty({ example: '2027-01-31' })
  hasta!: string;

  @ApiProperty({ type: [RangoFeriaDto] })
  ocupados!: RangoFeriaDto[];
}

export class ConflictoFeriaDto extends RangoFeriaDto {
  @ApiPropertyOptional({ example: '12', description: 'Identificador interno.' })
  id?: string;
}

export class AforoFeriaDto {
  @ApiProperty({ example: 20 })
  solicitado!: number;

  @ApiProperty({ example: 25, nullable: true })
  maximo!: number | null;

  @ApiProperty({ example: true })
  suficiente!: boolean;
}

export class DisponibilidadFeriaDto {
  @ApiProperty({ example: false })
  disponible!: boolean;

  @ApiProperty({ type: ZonaFeriaDto })
  zona!: ZonaFeriaDto;

  @ApiProperty({ type: AforoFeriaDto })
  aforo!: AforoFeriaDto;

  @ApiProperty({ type: ConflictoFeriaDto, nullable: true })
  conflicto!: ConflictoFeriaDto | null;

  @ApiProperty({ type: [RangoFeriaDto] })
  sugerencias!: RangoFeriaDto[];

  @ApiPropertyOptional({ example: null, nullable: true })
  motivo!: string | null;
}

export class DocumentoFeriaDto {
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

export class FeriaListadoDto {
  @ApiProperty({ example: '12' })
  id!: string;

  @ApiProperty({ example: 'FER-2026-00003' })
  numeroRadicado!: string;

  @ApiProperty({ example: 'Feria Agroecológica de Primavera' })
  nombre!: string;

  @ApiProperty({ example: 'Feria agroecológica' })
  tipoFeria!: string;

  @ApiProperty({ example: 'radicada' })
  estado!: estado_feria;

  @ApiProperty({ example: '2027-02-10' })
  fechaInicio!: string;

  @ApiProperty({ example: '2027-02-12' })
  fechaFin!: string;

  @ApiProperty({ example: 20 })
  numeroPuestos!: number;

  @ApiProperty({ example: '2026-11-22T10:00:00.000Z' })
  radicadaEn!: Date;

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

  @ApiProperty({ type: ZonaFeriaDto })
  zona!: ZonaFeriaDto;
}

export class ListarFeriasResponseDto {
  @ApiProperty({ type: [FeriaListadoDto] })
  datos!: FeriaListadoDto[];

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

export class FeriaDetalleDto extends FeriaListadoDto {
  @ApiProperty({ type: [ProductoFeriaDto] })
  productos!: ProductoFeriaDto[];

  @ApiProperty({ type: [DocumentoFeriaDto] })
  documentos!: DocumentoFeriaDto[];
}

export class RadicarFeriaResponseDto {
  @ApiProperty({ example: '12' })
  id!: string;

  @ApiProperty({ example: 'FER-2026-00003' })
  numeroRadicado!: string;

  @ApiProperty({ example: 'radicada' })
  estado!: estado_feria;

  @ApiProperty({ example: 'Feria radicada correctamente.' })
  mensaje!: string;

  @ApiProperty({ example: true })
  correoEnviado!: boolean;

  @ApiProperty({ example: null, nullable: true })
  mensajeCorreo!: string | null;
}
