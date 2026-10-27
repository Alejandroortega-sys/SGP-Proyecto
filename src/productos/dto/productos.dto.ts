import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsString, Length } from 'class-validator';

/** Recorta los espacios del nombre antes de validarlo. */
function recortar(valor: unknown): unknown {
  return typeof valor === 'string' ? valor.trim() : valor;
}

/**
 * Cuerpo de `POST /productos`.
 *
 * Solo el gestor (revisor o administrador) puede crear productos. El estado
 * no se envía: la base de datos aplica `activo = TRUE` por defecto.
 */
export class CrearProductoDto {
  /** Nombre único del producto (máximo 100 caracteres). */
  @ApiProperty({
    example: 'Frutas frescas',
    minLength: 2,
    maxLength: 100,
  })
  @Transform(({ value }) => recortar(value))
  @IsString({ message: 'El nombre del producto debe ser texto' })
  @IsNotEmpty({ message: 'El nombre del producto es obligatorio' })
  @Length(2, 100, {
    message: 'El nombre del producto debe tener entre 2 y 100 caracteres',
  })
  nombre!: string;
}

/**
 * Cuerpo de `PATCH /productos/:id`.
 *
 * Solo permite activar o desactivar el producto; el nombre no se modifica
 * desde este endpoint.
 */
export class CambiarEstadoProductoDto {
  /** `true` para activar el producto, `false` para desactivarlo. */
  @ApiProperty({ example: false })
  @IsBoolean({ message: 'El campo «activo» debe ser true o false' })
  activo!: boolean;
}

/** Producto devuelto por la API. */
export class ProductoResponseDto {
  /** Identificador del producto (BIGINT como string). */
  @ApiProperty({ example: '1' })
  id!: string;

  /** Nombre del producto. */
  @ApiProperty({ example: 'Frutas frescas' })
  nombre!: string;

  /** Indica si el producto está disponible para solicitudes y ferias. */
  @ApiProperty({ example: true })
  activo!: boolean;
}

/** Respuesta de `GET /productos`. */
export class ListarProductosResponseDto {
  /** Productos visibles para el usuario autenticado. */
  @ApiProperty({ type: [ProductoResponseDto] })
  datos!: ProductoResponseDto[];
}
