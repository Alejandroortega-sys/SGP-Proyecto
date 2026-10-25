import { ApiProperty } from '@nestjs/swagger';
import {
  categoria_comercio,
  estado_organizacion,
  estado_usuario,
} from '../../generated/prisma/client';

/** Sección de datos personales del perfil (HU-04). */
export class DatosPersonalesPerfilDto {
  /** Identificador de la cuenta (BIGINT como string). */
  @ApiProperty({ example: '5' })
  id!: string;

  /** Nombres del comerciante. */
  @ApiProperty({ example: 'José' })
  nombre!: string;

  /** Apellidos del comerciante, si los registró. */
  @ApiProperty({ example: 'Pérez', required: false, nullable: true })
  apellido?: string | null;

  /** Tipo de documento (CC, CE…). Solo lectura: cambia vía gestor. */
  @ApiProperty({ example: 'CC', required: false, nullable: true })
  tipoDocumento?: string | null;

  /** Número de documento. Único e inmutable (HU-04): cambia vía gestor. */
  @ApiProperty({ example: '1029384756', required: false, nullable: true })
  documento?: string | null;

  /** Teléfono de contacto; editable desde el perfil. */
  @ApiProperty({ example: '3001122334', required: false, nullable: true })
  telefono?: string | null;
}

/** Sección de actividad comercial del perfil (solo lectura, HU-04). */
export class ActividadComercialPerfilDto {
  /** Actividad comercial registrada; la corrige un gestor. */
  @ApiProperty({ example: 'Venta de frutas y verduras' })
  actividadComercial!: string;

  /** Categoría del comercio (formal/informal); la corrige un gestor. */
  @ApiProperty({ enum: categoria_comercio, example: 'formal' })
  categoria!: categoria_comercio;
}

/** Sección de seguridad del perfil (HU-04). */
export class SeguridadPerfilDto {
  /** Correo de la cuenta; fijo por ahora (su cambio exige verificación). */
  @ApiProperty({ example: 'jose.perez@hotmail.com' })
  correo!: string;

  /** Estado vigente de la cuenta. */
  @ApiProperty({ enum: estado_usuario, example: 'activa' })
  estado!: estado_usuario;

  /** Fecha de creación de la cuenta (ISO 8601). */
  @ApiProperty({ example: '2026-09-15T14:30:00.000Z' })
  creadoEn!: Date;
}

/** Organización de feria registrada por el organizador. */
export class OrganizacionPerfilDto {
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
}

/**
 * Respuesta de `GET /perfil` y `PATCH /perfil`.
 *
 * Para comerciantes incluye la sección `actividadComercial`; para
 * organizadores incluye `organizacion` (o `null` si aún no la ha creado).
 * Nunca incluye el hash de la contraseña.
 */
export class PerfilResponseDto {
  /** Datos personales y de contacto. */
  @ApiProperty({ type: DatosPersonalesPerfilDto })
  datosPersonales!: DatosPersonalesPerfilDto;

  /** Actividad comercial (solo para comerciantes, solo lectura). */
  @ApiProperty({
    type: ActividadComercialPerfilDto,
    required: false,
  })
  actividadComercial?: ActividadComercialPerfilDto;

  /** Organización registrada (solo para organizadores). */
  @ApiProperty({
    type: OrganizacionPerfilDto,
    required: false,
    nullable: true,
  })
  organizacion?: OrganizacionPerfilDto | null;

  /** Datos de seguridad de la cuenta. */
  @ApiProperty({ type: SeguridadPerfilDto })
  seguridad!: SeguridadPerfilDto;
}
