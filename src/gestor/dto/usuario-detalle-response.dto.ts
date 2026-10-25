import { ApiProperty } from '@nestjs/swagger';
import type {
  categoria_comercio,
  estado_cobro,
  estado_organizacion,
  estado_permiso,
  estado_solicitud,
  estado_usuario,
  perfil_gestor,
  rol_usuario,
} from '../../generated/prisma/client';

/** Perfil comercial del comerciante dentro del detalle. */
export class PerfilComercialDetalleDto {
  /** Actividad comercial registrada. */
  @ApiProperty({ example: 'Venta de frutas y verduras' })
  actividadComercial!: string;

  /** Categoría del comercio. */
  @ApiProperty({ enum: ['formal', 'informal'], example: 'formal' })
  categoria!: categoria_comercio;

  /** Fecha de la última actualización del perfil comercial. */
  @ApiProperty({ example: '2026-09-15T14:30:00.000Z' })
  actualizadoEn!: Date;
}

/** Perfil del gestor dentro del detalle de una cuenta de gestor. */
export class PerfilGestorDetalleDto {
  /** Perfil de permisos del gestor. */
  @ApiProperty({ enum: ['revisor', 'administrador'], example: 'administrador' })
  perfil!: perfil_gestor;

  /** Identificador del gestor que creó la cuenta, si se conoce. */
  @ApiProperty({ example: '1', required: false, nullable: true })
  creadoPor?: string | null;
}

/** Organización de feria dentro del detalle de una cuenta de organizador. */
export class OrganizacionDetalleDto {
  /** Nombre de la organización. */
  @ApiProperty({ example: 'Feria Campesina del Valle' })
  nombreOrganizacion!: string;

  /** NIT de la organización. */
  @ApiProperty({ example: '900123456-7' })
  nit!: string;

  /** Representante legal. */
  @ApiProperty({ example: 'María Gómez' })
  representante!: string;

  /** Tipo de feria que organiza. */
  @ApiProperty({ example: 'Agroecológica' })
  tipoFeria!: string;

  /** Datos de contacto. */
  @ApiProperty({
    example: 'contacto@feriavalle.co',
    required: false,
    nullable: true,
  })
  contacto?: string | null;

  /** Estado de validación de la organización. */
  @ApiProperty({
    enum: ['pendiente_validacion', 'activa', 'suspendida'],
    example: 'activa',
  })
  estado!: estado_organizacion;

  /** Fecha en que el gestor validó la organización. */
  @ApiProperty({
    example: '2026-09-20T10:00:00.000Z',
    required: false,
    nullable: true,
  })
  validadoEn?: Date | null;
}

/** Permiso asociado a una solicitud (resumen). */
export class PermisoDeSolicitudDto {
  /** Número consecutivo del permiso. */
  @ApiProperty({ example: 'PER-2026-00001' })
  numero!: string;

  /** Estado del permiso. */
  @ApiProperty({
    enum: ['vigente', 'suspendido', 'revocado', 'vencido'],
    example: 'vigente',
  })
  estado!: estado_permiso;
}

/** Solicitud de uso temporal dentro del detalle del usuario. */
export class SolicitudDetalleDto {
  /** Identificador de la solicitud (BIGINT como string). */
  @ApiProperty({ example: '12' })
  id!: string;

  /** Número de radicado. */
  @ApiProperty({ example: 'SOL-2026-00012' })
  numeroRadicado!: string;

  /** Estado del trámite. */
  @ApiProperty({
    enum: [
      'borrador',
      'radicada',
      'en_revision',
      'devuelta',
      'aprobada',
      'rechazada',
      'cancelada',
    ],
    example: 'aprobada',
  })
  estado!: estado_solicitud;

  /** Actividad solicitada. */
  @ApiProperty({ example: 'Venta de frutas y verduras' })
  actividad!: string;

  /** Fecha de inicio solicitada. */
  @ApiProperty({ example: '2026-10-01' })
  fechaInicio!: Date;

  /** Fecha de fin solicitada. */
  @ApiProperty({ example: '2026-10-31' })
  fechaFin!: Date;

  /** Hora de inicio en formato HH:mm. */
  @ApiProperty({ example: '08:00' })
  horaInicio!: string;

  /** Hora de fin en formato HH:mm. */
  @ApiProperty({ example: '18:00' })
  horaFin!: string;

  /** Fecha de radicación, si ya fue radicada. */
  @ApiProperty({
    example: '2026-09-20T15:00:00.000Z',
    required: false,
    nullable: true,
  })
  radicadaEn?: Date | null;

  /** Fecha de la decisión (aprobada/rechazada). */
  @ApiProperty({
    example: '2026-09-21T09:30:00.000Z',
    required: false,
    nullable: true,
  })
  decididaEn?: Date | null;

  /** Motivo del rechazo, si aplica. */
  @ApiProperty({
    example: 'Documentación incompleta',
    required: false,
    nullable: true,
  })
  motivoRechazo?: string | null;

  /** Fecha de creación de la solicitud. */
  @ApiProperty({ example: '2026-09-19T11:00:00.000Z' })
  creadoEn!: Date;

  /** Nombre del espacio temporal solicitado, si se asignó. */
  @ApiProperty({
    example: 'Espacio móvil Calle 30 - A',
    required: false,
    nullable: true,
  })
  espacio?: string | null;

  /** Permiso emitido a partir de esta solicitud, si ya existe. */
  @ApiProperty({ type: PermisoDeSolicitudDto, required: false, nullable: true })
  permiso?: PermisoDeSolicitudDto | null;
}

/** Cobro asociado a un permiso. */
export class CobroDetalleDto {
  /** Valor del cobro (decimal como string para no perder precisión). */
  @ApiProperty({ example: '25000.00' })
  valor!: string;

  /** Estado del cobro. */
  @ApiProperty({ enum: ['pendiente', 'pagado', 'anulado'], example: 'pagado' })
  estado!: estado_cobro;

  /** Fecha del pago, si ya se pagó. */
  @ApiProperty({
    example: '2026-09-22T10:00:00.000Z',
    required: false,
    nullable: true,
  })
  pagadoEn?: Date | null;
}

/** Permiso digital dentro del detalle del usuario. */
export class PermisoDetalleDto {
  /** Identificador del permiso (BIGINT como string). */
  @ApiProperty({ example: '7' })
  id!: string;

  /** Número consecutivo del permiso. */
  @ApiProperty({ example: 'PER-2026-00007' })
  numero!: string;

  /** Categoría autorizada. */
  @ApiProperty({ example: 'Venta de frutas y verduras' })
  categoriaAutorizada!: string;

  /** Fecha de inicio de la vigencia. */
  @ApiProperty({ example: '2026-10-01' })
  fechaInicio!: Date;

  /** Fecha de fin de la vigencia. */
  @ApiProperty({ example: '2026-10-31' })
  fechaFin!: Date;

  /** Estado del permiso. */
  @ApiProperty({
    enum: ['vigente', 'suspendido', 'revocado', 'vencido'],
    example: 'vigente',
  })
  estado!: estado_permiso;

  /** Fecha de emisión. */
  @ApiProperty({ example: '2026-09-21T10:00:00.000Z' })
  emitidoEn!: Date;

  /** Nombre del espacio temporal asociado, si lo tiene. */
  @ApiProperty({
    example: 'Espacio móvil Calle 30 - A',
    required: false,
    nullable: true,
  })
  espacio?: string | null;

  /** Número de radicado de la solicitud que originó el permiso. */
  @ApiProperty({ example: 'SOL-2026-00012' })
  solicitudNumero!: string;

  /** Cobro asociado al permiso, si ya se generó. */
  @ApiProperty({ type: CobroDetalleDto, required: false, nullable: true })
  cobro?: CobroDetalleDto | null;
}

/** Datos de la cuenta y su perfil según el rol. */
export class UsuarioDetalleDto {
  /** Identificador de la cuenta (BIGINT como string). */
  @ApiProperty({ example: '5' })
  id!: string;

  /** Nombres. */
  @ApiProperty({ example: 'José' })
  nombre!: string;

  /** Apellidos. */
  @ApiProperty({ example: 'Pérez', required: false, nullable: true })
  apellido?: string | null;

  /** Tipo de documento. */
  @ApiProperty({ example: 'CC', required: false, nullable: true })
  tipoDocumento?: string | null;

  /** Número de documento. */
  @ApiProperty({ example: '1029384756', required: false, nullable: true })
  documento?: string | null;

  /** Teléfono de contacto. */
  @ApiProperty({ example: '3001122334', required: false, nullable: true })
  telefono?: string | null;

  /** Correo de la cuenta. */
  @ApiProperty({ example: 'jose.perez@hotmail.com' })
  correo!: string;

  /** Rol de la cuenta. */
  @ApiProperty({
    enum: ['comerciante', 'organizador', 'gestor'],
    example: 'comerciante',
  })
  rol!: rol_usuario;

  /** Estado de la cuenta. */
  @ApiProperty({
    enum: ['pendiente_activacion', 'activa', 'suspendida', 'inactiva'],
    example: 'activa',
  })
  estado!: estado_usuario;

  /** Fecha de creación de la cuenta. */
  @ApiProperty({ example: '2026-09-15T14:30:00.000Z' })
  creadoEn!: Date;

  /** Fecha de la última actualización de la cuenta. */
  @ApiProperty({ example: '2026-09-20T10:00:00.000Z' })
  actualizadoEn!: Date;

  /** Perfil comercial, solo para comerciantes. */
  @ApiProperty({
    type: PerfilComercialDetalleDto,
    required: false,
    nullable: true,
  })
  perfilComercial?: PerfilComercialDetalleDto | null;

  /** Perfil de gestor, solo para cuentas de gestor. */
  @ApiProperty({
    type: PerfilGestorDetalleDto,
    required: false,
    nullable: true,
  })
  perfilGestor?: PerfilGestorDetalleDto | null;

  /** Organización de feria, solo para organizadores. */
  @ApiProperty({
    type: OrganizacionDetalleDto,
    required: false,
    nullable: true,
  })
  organizacion?: OrganizacionDetalleDto | null;
}

/** Totales de las colecciones del detalle. */
export class TotalesDetalleDto {
  /** Cantidad de solicitudes registradas por el usuario. */
  @ApiProperty({ example: 3 })
  solicitudes!: number;

  /** Cantidad de permisos emitidos al usuario. */
  @ApiProperty({ example: 1 })
  permisos!: number;
}

/** Respuesta de `GET /gestor/usuarios/:id`. */
export class UsuarioDetalleResponseDto {
  /** Datos de la cuenta y su perfil. */
  @ApiProperty({ type: UsuarioDetalleDto })
  usuario!: UsuarioDetalleDto;

  /** Solicitudes del usuario, de la más reciente a la más antigua. */
  @ApiProperty({ type: [SolicitudDetalleDto] })
  solicitudes!: SolicitudDetalleDto[];

  /** Permisos del usuario, del más reciente al más antiguo. */
  @ApiProperty({ type: [PermisoDetalleDto] })
  permisos!: PermisoDetalleDto[];

  /** Cantidad de solicitudes y permisos. */
  @ApiProperty({ type: TotalesDetalleDto })
  totales!: TotalesDetalleDto;
}
