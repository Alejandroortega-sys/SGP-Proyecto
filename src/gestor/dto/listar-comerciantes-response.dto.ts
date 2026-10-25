import { ApiProperty } from '@nestjs/swagger';
import type {
  categoria_comercio,
  estado_usuario,
} from '../../generated/prisma/client';

/** Una página del listado de comerciantes. */
export class PaginacionDto {
  /** Página solicitada (inicia en 1). */
  @ApiProperty({ example: 1 })
  pagina!: number;

  /** Cantidad máxima de registros por página. */
  @ApiProperty({ example: 20 })
  limite!: number;

  /** Total de comerciantes que cumplen los filtros. */
  @ApiProperty({ example: 42 })
  total!: number;

  /** Total de páginas disponibles (0 si no hay registros). */
  @ApiProperty({ example: 3 })
  totalPaginas!: number;
}

/** Comerciante resumido en el listado del gestor. */
export class ComercianteListadoDto {
  /** Identificador de la cuenta (BIGINT como string). */
  @ApiProperty({ example: '5' })
  id!: string;

  /** Nombres del comerciante. */
  @ApiProperty({ example: 'José' })
  nombre!: string;

  /** Apellidos del comerciante, si los registró. */
  @ApiProperty({ example: 'Pérez', required: false, nullable: true })
  apellido?: string | null;

  /** Tipo de documento de identidad. */
  @ApiProperty({ example: 'CC', required: false, nullable: true })
  tipoDocumento?: string | null;

  /** Número de documento (único en el sistema). */
  @ApiProperty({ example: '1029384756', required: false, nullable: true })
  documento?: string | null;

  /** Correo de la cuenta. */
  @ApiProperty({ example: 'jose.perez@hotmail.com' })
  correo!: string;

  /** Teléfono de contacto. */
  @ApiProperty({ example: '3001122334', required: false, nullable: true })
  telefono?: string | null;

  /** Estado actual de la cuenta. */
  @ApiProperty({
    enum: ['pendiente_activacion', 'activa', 'suspendida', 'inactiva'],
  })
  estado!: estado_usuario;

  /** Categoría del comercio (formal/informal). */
  @ApiProperty({
    enum: ['formal', 'informal'],
    required: false,
    nullable: true,
  })
  categoria?: categoria_comercio | null;

  /** Actividad comercial registrada. */
  @ApiProperty({
    example: 'Venta de frutas y verduras',
    required: false,
    nullable: true,
  })
  actividadComercial?: string | null;

  /** Cantidad de solicitudes registradas por el comerciante. */
  @ApiProperty({ example: 3 })
  totalSolicitudes!: number;

  /** Cantidad de permisos emitidos al comerciante. */
  @ApiProperty({ example: 1 })
  totalPermisos!: number;

  /** Fecha de creación de la cuenta (ISO 8601). */
  @ApiProperty({ example: '2026-09-15T14:30:00.000Z' })
  creadoEn!: Date;
}

/** Respuesta paginada de `GET /gestor/comerciantes`. */
export class ListarComerciantesResponseDto {
  /** Comerciantes de la página solicitada. */
  @ApiProperty({ type: [ComercianteListadoDto] })
  datos!: ComercianteListadoDto[];

  /** Metadatos de la paginación. */
  @ApiProperty({ type: PaginacionDto })
  paginacion!: PaginacionDto;
}
