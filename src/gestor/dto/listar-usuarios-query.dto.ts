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
  estado_usuario,
  perfil_gestor,
  rol_usuario,
} from '../../generated/prisma/client';
import { PERFILES_GESTOR } from './crear-gestor.dto';
import { ESTADOS_USUARIO } from './listar-comerciantes-query.dto';

/** Roles de usuario admitidos como filtro. */
export const ROLES_USUARIO: readonly rol_usuario[] = [
  'comerciante',
  'organizador',
  'gestor',
];

/**
 * Query de `GET /gestor/usuarios`.
 *
 * El administrador puede filtrar por cualquier rol. El revisor solo puede ver
 * comerciantes y organizadores; el servicio ignora los filtros que intenten
 * salir de ese alcance y responde 403.
 */
export class ListarUsuariosQueryDto {
  /** Texto libre para buscar por nombre, apellido, correo, documento, actividad u organización. */
  @ApiPropertyOptional({
    example: 'Ana',
    description:
      'Búsqueda por nombre, apellido, correo, documento, actividad comercial o nombre de la organización',
  })
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser texto' })
  @MaxLength(150, {
    message: 'La búsqueda no puede superar los 150 caracteres',
  })
  busqueda?: string;

  /** Rol de la cuenta. */
  @ApiPropertyOptional({
    enum: ROLES_USUARIO,
    example: 'organizador',
    description: 'Filtra por rol de la cuenta',
  })
  @IsOptional()
  @IsIn([...ROLES_USUARIO], {
    message: 'El rol debe ser comerciante, organizador o gestor',
  })
  rol?: rol_usuario;

  /** Estado de la cuenta. */
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

  /** Perfil de gestor (solo aplica a cuentas con rol gestor). */
  @ApiPropertyOptional({
    enum: PERFILES_GESTOR,
    example: 'administrador',
    description: 'Filtra gestores por perfil; el revisor no puede usarlo',
  })
  @IsOptional()
  @IsIn([...PERFILES_GESTOR], {
    message: 'El perfil debe ser "revisor" o "administrador"',
  })
  perfil?: perfil_gestor;

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
