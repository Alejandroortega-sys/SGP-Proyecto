import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  Length,
  Matches,
} from 'class-validator';
import {
  TIPOS_DOCUMENTO,
  type TipoDocumento,
} from './crear-comerciante.dto';
import type { categoria_comercio } from '../../generated/prisma/client';

/**
 * Cuerpo de `PATCH /usuarios/:id/comerciante` (rol gestor): corrección de los
 * campos sensibles del perfil que el comerciante no puede tocar (HU-04):
 * documento, tipo de documento, actividad comercial y categoría. Todos son
 * opcionales pero debe enviarse al menos uno; los demás datos del
 * comerciante se actualizan desde su propio `PATCH /perfil`.
 */
export class ActualizarComercianteGestorDto {
  /** Número de documento (único en el sistema; el filtro responde 409 si ya existe). */
  @IsOptional()
  @IsNotEmpty({ message: 'El documento no puede quedar vacío' })
  @Matches(/^[0-9A-Za-z-]{5,30}$/, {
    message:
      'El documento debe tener entre 5 y 30 caracteres (letras, números o guion)',
  })
  documento?: string;

  /** Tipo de documento de identidad (misma lista del registro). */
  @ApiProperty({ enum: TIPOS_DOCUMENTO, example: 'CC', required: false })
  @IsOptional()
  @IsIn([...TIPOS_DOCUMENTO], {
    message: 'El tipo de documento debe ser CC, CE, TI, PP o NIT',
  })
  tipoDocumento?: TipoDocumento;

  /** Actividad comercial que ejerce el comerciante. */
  @IsOptional()
  @IsNotEmpty({ message: 'La actividad comercial no puede quedar vacía' })
  @Length(3, 200, {
    message: 'La actividad comercial debe tener entre 3 y 200 caracteres',
  })
  actividadComercial?: string;

  /** Categoría del comercio: formal o informal. */
  @ApiProperty({ enum: ['formal', 'informal'], required: false })
  @IsOptional()
  @IsIn(['formal', 'informal'] as unknown as string[], {
    message: 'La categoría debe ser "formal" o "informal"',
  })
  categoria?: categoria_comercio;
}

/** Respuesta de la actualización hecha por el gestor: perfil comercial completo. */
export class ComercianteActualizadoDto {
  /** Identificador de la cuenta (BIGINT como string). */
  @ApiProperty({ example: '5' })
  id!: string;

  /** Nombres del comerciante. */
  @ApiProperty({ example: 'José' })
  nombre!: string;

  /** Apellidos del comerciante. */
  @ApiProperty({ example: 'Pérez', required: false, nullable: true })
  apellido?: string | null;

  /** Tipo de documento corregido por el gestor. */
  @ApiProperty({ example: 'CC', required: false, nullable: true })
  tipoDocumento?: string | null;

  /** Documento corregido por el gestor. */
  @ApiProperty({ example: '1029384756', required: false, nullable: true })
  documento?: string | null;

  /** Teléfono de contacto del comerciante. */
  @ApiProperty({ example: '3001122334', required: false, nullable: true })
  telefono?: string | null;

  /** Correo de la cuenta. */
  @ApiProperty({ example: 'jose.perez@hotmail.com' })
  correo!: string;

  /** Estado de la cuenta. */
  @ApiProperty({ example: 'activa' })
  estado!: string;

  /** Actividad comercial actualizada. */
  @ApiProperty({ example: 'Venta de frutas y verduras' })
  actividadComercial!: string;

  /** Categoría del comercio actualizada. */
  @ApiProperty({ enum: ['formal', 'informal'] })
  categoria!: categoria_comercio;

  /** Mensaje orientador sobre el resultado de la operación. */
  mensaje!: string;
}
