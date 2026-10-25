import { ApiProperty } from '@nestjs/swagger';
import {
  estado_feria,
  estado_permiso,
  estado_solicitud,
  perfil_gestor,
} from '../../generated/prisma/client';

/** Datos del gestor municipal autenticado que entra al panel. */
export class GestorPanelDto {
  /** Identificador de la cuenta (BIGINT como string). */
  @ApiProperty({ example: '1' })
  id!: string;

  /** Nombres del gestor. */
  @ApiProperty({ example: 'Carlos' })
  nombre!: string;

  /** Apellidos del gestor, si los tiene. */
  @ApiProperty({ example: 'Ramírez', required: false })
  apellido?: string;

  /** Correo institucional del gestor. */
  @ApiProperty({ example: 'admin@tulua.gov.co' })
  correo!: string;

  /** Perfil de permisos del gestor (revisor o administrador). */
  @ApiProperty({ enum: perfil_gestor, example: 'administrador' })
  perfil!: perfil_gestor;
}

/** Conteo de cuentas de usuario por rol. */
export class ConteoRolesDto {
  /** Cuentas con rol comerciante. */
  @ApiProperty({ example: 4 })
  comerciante!: number;

  /** Cuentas con rol organizador de feria. */
  @ApiProperty({ example: 2 })
  organizador!: number;

  /** Cuentas con rol gestor municipal. */
  @ApiProperty({ example: 2 })
  gestor!: number;
}

/** Conteo de cuentas por estado del ciclo de vida. */
export class ConteoEstadosUsuarioDto {
  /** Total de cuentas registradas. */
  @ApiProperty({ example: 8 })
  total!: number;

  /** Cuentas en «pendiente_activacion». */
  @ApiProperty({ example: 1 })
  pendientesActivacion!: number;

  /** Cuentas en «activa». */
  @ApiProperty({ example: 6 })
  activas!: number;

  /** Cuentas en «suspendida». */
  @ApiProperty({ example: 1 })
  suspendidas!: number;

  /** Cuentas en «inactiva». */
  @ApiProperty({ example: 0 })
  inactivas!: number;
}

/** Indicadores de usuarios del panel administrativo. */
export class IndicadorUsuariosDto {
  /** Conteo de cuentas por estado. */
  @ApiProperty({ type: ConteoEstadosUsuarioDto })
  estados!: ConteoEstadosUsuarioDto;

  /** Conteo de cuentas por rol. */
  @ApiProperty({ type: ConteoRolesDto })
  roles!: ConteoRolesDto;
}

/** Conteo de solicitudes de uso temporal por estado del trámite. */
export class IndicadorSolicitudesDto {
  /** Total de solicitudes registradas. */
  @ApiProperty({ example: 4 })
  total!: number;

  /** Solicitudes en cada estado del trámite. */
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number', example: 1 },
  })
  porEstado!: Record<estado_solicitud, number>;
}

/** Conteo de permisos digitales por estado de vigencia. */
export class IndicadorPermisosDto {
  /** Total de permisos emitidos. */
  @ApiProperty({ example: 1 })
  total!: number;

  /** Permisos en cada estado (vigente, suspendido, revocado, vencido). */
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number', example: 1 },
  })
  porEstado!: Record<estado_permiso, number>;
}

/** Conteo de ferias y eventos por estado del calendario. */
export class IndicadorFeriasDto {
  /** Total de ferias radicadas en la plataforma. */
  @ApiProperty({ example: 2 })
  total!: number;

  /** Ferias en cada estado (radicada, aprobada, rechazada…). */
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number', example: 1 },
  })
  porEstado!: Record<estado_feria, number>;
}

/** Bloque de indicadores que alimenta el panel administrativo. */
export class PanelIndicadoresDto {
  /** Conteos de cuentas de usuario. */
  @ApiProperty({ type: IndicadorUsuariosDto })
  usuarios!: IndicadorUsuariosDto;

  /** Conteos del trámite de solicitudes de espacio. */
  @ApiProperty({ type: IndicadorSolicitudesDto })
  solicitudes!: IndicadorSolicitudesDto;

  /** Conteos de permisos digitales emitidos. */
  @ApiProperty({ type: IndicadorPermisosDto })
  permisos!: IndicadorPermisosDto;

  /** Conteos del calendario de ferias. */
  @ApiProperty({ type: IndicadorFeriasDto })
  ferias!: IndicadorFeriasDto;
}

/** Respuesta de `GET /panel`: gestor autenticado + indicadores. */
export class PanelResponseDto {
  /** Datos del gestor municipal que consultó el panel. */
  @ApiProperty({ type: GestorPanelDto })
  gestor!: GestorPanelDto;

  /** Resumen de indicadores de la plataforma. */
  @ApiProperty({ type: PanelIndicadoresDto })
  indicadores!: PanelIndicadoresDto;
}
