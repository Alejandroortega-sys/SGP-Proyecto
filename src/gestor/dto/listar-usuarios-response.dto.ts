import { ApiProperty } from '@nestjs/swagger';
import type {
  categoria_comercio,
  estado_usuario,
  perfil_gestor,
  rol_usuario,
} from '../../generated/prisma/client';
import { PaginacionDto } from './listar-comerciantes-response.dto';

/** Cuenta resumida en el listado general del administrador. */
export class UsuarioListadoDto {
  /** Identificador de la cuenta (BIGINT como string). */
  @ApiProperty({ example: '5' })
  id!: string;

  /** Nombres. */
  @ApiProperty({ example: 'Ana' })
  nombre!: string;

  /** Apellidos. */
  @ApiProperty({ example: 'López', required: false, nullable: true })
  apellido?: string | null;

  /** Correo de la cuenta. */
  @ApiProperty({ example: 'ana.lopez@tulua.gov.co' })
  correo!: string;

  /** Documento de identidad, si lo tiene. */
  @ApiProperty({ example: '1029384756', required: false, nullable: true })
  documento?: string | null;

  /** Teléfono de contacto, si lo tiene. */
  @ApiProperty({ example: '3001122334', required: false, nullable: true })
  telefono?: string | null;

  /** Rol de la cuenta. */
  @ApiProperty({
    enum: ['comerciante', 'organizador', 'gestor'],
    example: 'organizador',
  })
  rol!: rol_usuario;

  /** Estado de la cuenta. */
  @ApiProperty({
    enum: ['pendiente_activacion', 'activa', 'suspendida', 'inactiva'],
    example: 'activa',
  })
  estado!: estado_usuario;

  /** Perfil del gestor; `null` para los demás roles. */
  @ApiProperty({
    enum: ['revisor', 'administrador'],
    required: false,
    nullable: true,
  })
  perfil?: perfil_gestor | null;

  /** Categoría del comercio; solo para comerciantes. */
  @ApiProperty({
    enum: ['formal', 'informal'],
    required: false,
    nullable: true,
  })
  categoria?: categoria_comercio | null;

  /** Actividad comercial; solo para comerciantes. */
  @ApiProperty({
    example: 'Venta de frutas y verduras',
    required: false,
    nullable: true,
  })
  actividadComercial?: string | null;

  /** Nombre de la organización; solo para organizadores. */
  @ApiProperty({
    example: 'Feria Campesina del Valle',
    required: false,
    nullable: true,
  })
  nombreOrganizacion?: string | null;

  /** Fecha de creación de la cuenta. */
  @ApiProperty({ example: '2026-09-15T14:30:00.000Z' })
  creadoEn!: Date;
}

/** Respuesta paginada de `GET /gestor/usuarios`. */
export class ListarUsuariosResponseDto {
  /** Cuentas de la página solicitada. */
  @ApiProperty({ type: [UsuarioListadoDto] })
  datos!: UsuarioListadoDto[];

  /** Metadatos de la paginación. */
  @ApiProperty({ type: PaginacionDto })
  paginacion!: PaginacionDto;
}
