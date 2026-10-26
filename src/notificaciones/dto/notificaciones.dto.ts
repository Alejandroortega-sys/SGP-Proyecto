import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

/** Convierte `"true"`/`"false"` de query string a boolean. */
function aBooleano(valor: unknown): unknown {
  if (valor === 'true') return true;
  if (valor === 'false') return false;
  return valor;
}

/** Query de `GET /notificaciones`. */
export class ListarNotificacionesQueryDto {
  /** Filtra por notificaciones leídas o no leídas. */
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) => aBooleano(value))
  @IsBoolean({ message: 'El filtro «leida» debe ser true o false' })
  leida?: boolean;

  /** Número de página, empezando en 1. */
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser mayor o igual a 1' })
  pagina?: number;

  /** Cantidad de notificaciones por página (máximo 100). */
  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser mayor o igual a 1' })
  @Max(100, { message: 'El límite no puede superar 100' })
  limite?: number;
}

/** Cuerpo de `PATCH /notificaciones/:id/leida`. */
export class ActualizarNotificacionDto {
  /** Estado de lectura; por defecto `true`. */
  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @Transform(({ value }) => aBooleano(value))
  @IsBoolean({ message: 'El campo «leida» debe ser true o false' })
  leida?: boolean;
}

/** Notificación devuelta por la API. */
export class NotificacionResponseDto {
  /** Identificador de la notificación (BIGINT como string). */
  @ApiProperty({ example: '12' })
  id!: string;

  /** Tipo interno de la notificación. */
  @ApiProperty({ example: 'cambio_password' })
  tipo!: string;

  /** Asunto visible. */
  @ApiProperty({ example: 'Contraseña actualizada' })
  asunto!: string;

  /** Cuerpo del mensaje. */
  @ApiProperty({
    example: 'La contraseña de tu cuenta fue actualizada.',
    required: false,
    nullable: true,
  })
  cuerpo?: string | null;

  /** Canal original (`correo` o `app`). */
  @ApiProperty({ example: 'app' })
  canal!: string;

  /** Indica si ya fue leída. */
  @ApiProperty({ example: false })
  leida!: boolean;

  /** Fecha de creación. */
  @ApiProperty({ example: '2026-09-20T10:00:00.000Z' })
  creadaEn!: Date;
}

/** Paginación del listado de notificaciones. */
export class PaginacionNotificacionesDto {
  /** Página solicitada. */
  @ApiProperty({ example: 1 })
  pagina!: number;

  /** Registros por página. */
  @ApiProperty({ example: 20 })
  limite!: number;

  /** Total de notificaciones que cumplen el filtro. */
  @ApiProperty({ example: 3 })
  total!: number;

  /** Total de páginas (0 si no hay registros). */
  @ApiProperty({ example: 1 })
  totalPaginas!: number;
}

/** Respuesta de `GET /notificaciones`. */
export class ListarNotificacionesResponseDto {
  /** Notificaciones de la página solicitada. */
  @ApiProperty({ type: [NotificacionResponseDto] })
  datos!: NotificacionResponseDto[];

  /** Metadatos de paginación. */
  @ApiProperty({ type: PaginacionNotificacionesDto })
  paginacion!: PaginacionNotificacionesDto;

  /** Total de notificaciones no leídas del usuario. */
  @ApiProperty({ example: 2 })
  noLeidas!: number;
}

/** Respuesta de `PATCH /notificaciones/leer-todas`. */
export class TodasLeidasResponseDto {
  /** Cantidad de notificaciones marcadas como leídas. */
  @ApiProperty({ example: 2 })
  actualizadas!: number;

  /** Mensaje orientador. */
  @ApiProperty({ example: 'Notificaciones marcadas como leídas.' })
  mensaje!: string;
}
