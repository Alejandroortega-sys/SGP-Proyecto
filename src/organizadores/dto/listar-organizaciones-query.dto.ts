import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { estado_organizacion } from '../../generated/prisma/client';

/** Estados de organización admitidos como filtro. */
export const ESTADOS_ORGANIZACION: readonly estado_organizacion[] = [
  'pendiente_validacion',
  'activa',
  'suspendida',
];

/** Query de `GET /gestor/organizaciones`. */
export class ListarOrganizacionesQueryDto {
  /** Texto libre para buscar por organizador, correo, organización, NIT o representante. */
  @ApiPropertyOptional({
    example: 'Agrovalle',
    description:
      'Búsqueda por nombre del organizador, correo, nombre de la organización, NIT o representante',
  })
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser texto' })
  @MaxLength(150, {
    message: 'La búsqueda no puede superar los 150 caracteres',
  })
  busqueda?: string;

  /** Estado de validación de la organización. */
  @ApiPropertyOptional({
    enum: ESTADOS_ORGANIZACION,
    example: 'pendiente_validacion',
    description: 'Filtra por estado de validación de la organización',
  })
  @IsOptional()
  @IsIn([...ESTADOS_ORGANIZACION], {
    message: 'El estado debe ser pendiente_validacion, activa o suspendida',
  })
  estado?: estado_organizacion;

  /** Número de página, empezando en 1. */
  @ApiPropertyOptional({
    example: 1,
    default: 1,
    minimum: 1,
    description: 'Número de página (inicia en 1)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser mayor o igual a 1' })
  pagina?: number;

  /** Cantidad de registros por página (máximo 100). */
  @ApiPropertyOptional({
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
    description: 'Cantidad de registros por página (máximo 100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser mayor o igual a 1' })
  @Max(100, { message: 'El límite no puede superar 100' })
  limite?: number;
}
