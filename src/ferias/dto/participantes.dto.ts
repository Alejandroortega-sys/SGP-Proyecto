import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import type { estado_feria } from '../../generated/prisma/client';
import { ProductoFeriaDto } from './ferias.dto';

const FORMATO_ID = /^\d+$/;

function recortar(valor: unknown): unknown {
  return typeof valor === 'string' ? valor.trim() : valor;
}

function documentoOpcional(valor: unknown): unknown {
  if (typeof valor !== 'string') return valor;
  const texto = valor.trim();
  return texto.length === 0 ? null : texto;
}

/** Datos de alta de un participante de la feria. */
export class CrearParticipanteFeriaDto {
  @ApiProperty({ example: 'Doralice Lozano', maxLength: 150 })
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El nombre del vendedor debe ser texto' })
  @Length(3, 150, {
    message: 'El nombre del vendedor debe tener entre 3 y 150 caracteres',
  })
  nombre!: string;

  @ApiPropertyOptional({
    example: 'CC 43789123',
    maxLength: 30,
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => documentoOpcional(value))
  @IsString({ message: 'El documento debe ser texto' })
  @Length(3, 30, {
    message: 'El documento debe tener entre 3 y 30 caracteres',
  })
  documento?: string | null;

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

/** Datos de edición de un participante. Todos los campos son opcionales. */
export class ActualizarParticipanteFeriaDto {
  @ApiPropertyOptional({ example: 'Doralice Lozano', maxLength: 150 })
  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El nombre del vendedor debe ser texto' })
  @Length(3, 150, {
    message: 'El nombre del vendedor debe tener entre 3 y 150 caracteres',
  })
  nombre?: string;

  @ApiPropertyOptional({
    example: 'CC 43789123',
    maxLength: 30,
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => documentoOpcional(value))
  @IsString({ message: 'El documento debe ser texto' })
  @Length(3, 30, {
    message: 'El documento debe tener entre 3 y 30 caracteres',
  })
  documento?: string | null;

  @ApiPropertyOptional({ type: [String], example: ['1', '2'] })
  @IsOptional()
  @IsArray({ message: 'Los productos deben ser una lista' })
  @ArrayMinSize(1, { message: 'Selecciona al menos un producto' })
  @ArrayUnique({ message: 'Los productos no deben repetirse' })
  @IsString({ each: true, message: 'Cada producto debe ser un identificador' })
  @Matches(FORMATO_ID, {
    each: true,
    message: 'Cada producto debe tener un identificador válido',
  })
  productoIds?: string[];
}

export class ParticipanteFeriaDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Doralice Lozano' })
  nombre!: string;

  @ApiPropertyOptional({ example: 'CC 43789123', nullable: true })
  documento!: string | null;

  @ApiProperty({ type: [ProductoFeriaDto] })
  productos!: ProductoFeriaDto[];

  @ApiProperty({ example: '2026-11-23T10:00:00.000Z' })
  creadoEn!: Date;

  @ApiProperty({ example: '2026-11-23T10:00:00.000Z' })
  actualizadoEn!: Date;
}

export class CupoParticipantesDto {
  @ApiProperty({ example: 20 })
  aprobado!: number;

  @ApiProperty({ example: 3 })
  ocupados!: number;

  @ApiProperty({ example: 17 })
  disponibles!: number;

  @ApiProperty({ example: false })
  completo!: boolean;
}

export class FeriaParticipantesDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'FER-2026-00001' })
  numeroRadicado!: string;

  @ApiProperty({ example: 'Feria Agroecológica de Diciembre' })
  nombre!: string;

  @ApiProperty({ example: 'aprobada' })
  estado!: estado_feria;

  @ApiProperty({ example: '2026-12-10' })
  fechaInicio!: string;

  @ApiProperty({ example: '2026-12-12' })
  fechaFin!: string;

  @ApiProperty({ example: 20 })
  numeroPuestos!: number;

  @ApiProperty({
    example: { id: '4', nombre: 'Parque La Guadua' },
  })
  zona!: { id: string; nombre: string };
}

export class ListadoFinalParticipantesDto {
  @ApiProperty({ example: false })
  enviado!: boolean;

  @ApiPropertyOptional({
    example: '2026-11-23T10:00:00.000Z',
    nullable: true,
  })
  enviadoEn!: Date | null;
}

export class ListadoParticipantesFeriaDto {
  @ApiProperty({ type: FeriaParticipantesDto })
  feria!: FeriaParticipantesDto;

  @ApiProperty({ type: CupoParticipantesDto })
  cupo!: CupoParticipantesDto;

  @ApiProperty({ type: [ProductoFeriaDto] })
  productosPermitidos!: ProductoFeriaDto[];

  @ApiProperty({ type: [ProductoFeriaDto] })
  productosCatalogo!: ProductoFeriaDto[];

  @ApiProperty({ type: [ParticipanteFeriaDto] })
  participantes!: ParticipanteFeriaDto[];

  @ApiProperty({ type: ListadoFinalParticipantesDto })
  listadoFinal!: ListadoFinalParticipantesDto;
}

export class OrganizadorParticipantesDto {
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

  @ApiProperty({ example: '900123456-7' })
  nit!: string;
}

export class ListadoParticipantesGestorDto extends ListadoParticipantesFeriaDto {
  @ApiProperty({ type: OrganizadorParticipantesDto })
  organizador!: OrganizadorParticipantesDto;
}

export class EnviarListadoParticipantesResponseDto {
  @ApiProperty({ example: '1' })
  feriaId!: string;

  @ApiProperty({ example: '2026-11-23T10:00:00.000Z' })
  enviadoEn!: Date;

  @ApiProperty({ example: 3 })
  totalParticipantes!: number;

  @ApiProperty({ example: 'Listado final enviado correctamente.' })
  mensaje!: string;
}
