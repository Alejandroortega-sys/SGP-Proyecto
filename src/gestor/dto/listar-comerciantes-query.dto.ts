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
import type {
  categoria_comercio,
  estado_usuario,
} from '../../generated/prisma/client';

/** Estados de cuenta admitidos como filtro del listado. */
export const ESTADOS_USUARIO: readonly estado_usuario[] = [
  'pendiente_activacion',
  'activa',
  'suspendida',
  'inactiva',
];

/** Categorías de comercio admitidas como filtro del listado. */
export const CATEGORIAS_COMERCIO: readonly categoria_comercio[] = [
  'formal',
  'informal',
];

/**
 * Query de `GET /gestor/comerciantes`.
 *
 * Todos los campos son opcionales: sin filtros devuelve la primera página de
 * todos los comerciantes ordenados por fecha de registro descendente.
 */
export class ListarComerciantesQueryDto {
  /**
   * Texto libre para buscar por nombre, apellido, correo, documento o
   * actividad comercial. Se ignoran mayúsculas/minúsculas y cada palabra
   * debe aparecer en alguno de esos campos.
   */
  @ApiPropertyOptional({
    example: 'José Pérez',
    description:
      'Búsqueda por nombre, apellido, correo, documento o actividad comercial',
  })
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser texto' })
  @MaxLength(150, {
    message: 'La búsqueda no puede superar los 150 caracteres',
  })
  busqueda?: string;

  /** Estado del ciclo de vida de la cuenta. */
  @ApiPropertyOptional({
    enum: ESTADOS_USUARIO,
    example: 'activa',
    description: 'Filtra por estado de la cuenta',
  })
  @IsOptional()
  @IsIn([...ESTADOS_USUARIO], {
    message:
      'El estado debe ser pendiente_activacion, activa, suspendida o inactiva',
  })
  estado?: estado_usuario;

  /** Categoría del comercio registrada en el perfil comercial. */
  @ApiPropertyOptional({
    enum: CATEGORIAS_COMERCIO,
    example: 'formal',
    description: 'Filtra por categoría del comercio',
  })
  @IsOptional()
  @IsIn([...CATEGORIAS_COMERCIO], {
    message: 'La categoría debe ser "formal" o "informal"',
  })
  categoria?: categoria_comercio;

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

  /** Cantidad de comerciantes por página (máximo 100). */
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
