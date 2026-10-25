import { ApiProperty } from '@nestjs/swagger';
import { OrganizacionGestorResponseDto } from './organizacion-response.dto';

/** Metadatos de paginación del listado de organizaciones. */
export class PaginacionOrganizacionesDto {
  /** Página solicitada (inicia en 1). */
  @ApiProperty({ example: 1 })
  pagina!: number;

  /** Cantidad de registros por página. */
  @ApiProperty({ example: 20 })
  limite!: number;

  /** Total de organizaciones que cumplen los filtros. */
  @ApiProperty({ example: 3 })
  total!: number;

  /** Total de páginas disponibles. */
  @ApiProperty({ example: 1 })
  totalPaginas!: number;
}

/** Respuesta paginada de `GET /gestor/organizaciones`. */
export class ListarOrganizacionesResponseDto {
  /** Organizaciones de la página solicitada. */
  @ApiProperty({ type: [OrganizacionGestorResponseDto] })
  datos!: OrganizacionGestorResponseDto[];

  /** Metadatos de la paginación. */
  @ApiProperty({ type: PaginacionOrganizacionesDto })
  paginacion!: PaginacionOrganizacionesDto;
}
