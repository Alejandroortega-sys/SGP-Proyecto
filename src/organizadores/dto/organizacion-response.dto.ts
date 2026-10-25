import { ApiProperty } from '@nestjs/swagger';
import type { estado_organizacion } from '../../generated/prisma/client';

/** Organización vista por su propio organizador. */
export class OrganizacionResponseDto {
  /** Identificador de la cuenta del organizador (BIGINT como string). */
  @ApiProperty({ example: '7' })
  usuarioId!: string;

  /** Nombre de la organización. */
  @ApiProperty({ example: 'Fundación Agroecológica del Valle' })
  nombreOrganizacion!: string;

  /** NIT de la organización. */
  @ApiProperty({ example: '900123456-1' })
  nit!: string;

  /** Representante legal. */
  @ApiProperty({ example: 'Luis Álvarez' })
  representante!: string;

  /** Tipo de feria que organiza. */
  @ApiProperty({ example: 'Feria agroecológica' })
  tipoFeria!: string;

  /** Datos de contacto. */
  @ApiProperty({
    example: '3105551234',
    required: false,
    nullable: true,
  })
  contacto?: string | null;

  /** Estado de validación de la organización. */
  @ApiProperty({
    enum: ['pendiente_validacion', 'activa', 'suspendida'],
    example: 'pendiente_validacion',
  })
  estado!: estado_organizacion;

  /** Fecha en que el gestor validó la organización, si aplica. */
  @ApiProperty({
    example: '2026-09-20T10:00:00.000Z',
    required: false,
    nullable: true,
  })
  validadoEn?: Date | null;

  /** Mensaje orientador en las respuestas de creación y actualización. */
  @ApiProperty({
    example: 'Organización registrada y pendiente de validación.',
    required: false,
  })
  mensaje?: string;
}

/** Organización vista por el gestor municipal, con los datos del organizador. */
export class OrganizacionGestorResponseDto extends OrganizacionResponseDto {
  /** Nombres del organizador. */
  @ApiProperty({ example: 'Luis' })
  nombre!: string;

  /** Apellidos del organizador. */
  @ApiProperty({ example: 'Álvarez', required: false, nullable: true })
  apellido?: string | null;

  /** Correo del organizador. */
  @ApiProperty({ example: 'luis.alvarez@agrovalle.org' })
  correo!: string;

  /** Teléfono del organizador. */
  @ApiProperty({ example: '3105551234', required: false, nullable: true })
  telefono?: string | null;

  /** Identificador del gestor que validó la organización. */
  @ApiProperty({ example: '1', required: false, nullable: true })
  validadoPor?: string | null;

  /** Fecha de creación de la cuenta del organizador. */
  @ApiProperty({ example: '2026-09-15T14:30:00.000Z' })
  creadoEn!: Date;
}
