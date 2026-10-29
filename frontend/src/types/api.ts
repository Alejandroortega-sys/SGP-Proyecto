export type RolUsuario = "comerciante" | "organizador" | "gestor";

export type EstadoUsuario =
  | "pendiente_activacion"
  | "activa"
  | "suspendida"
  | "inactiva";

export type PerfilGestor = "revisor" | "administrador";

export type EstadoOrganizacion = "pendiente_validacion" | "activa" | "suspendida";

export type CategoriaComercio = "formal" | "informal";

export type TipoDocumento = "CC" | "CE" | "TI" | "PP" | "NIT";

export type AccionAuditoria = "insert" | "update" | "delete";

export interface UsuarioSesion {
  id: string;
  nombre: string;
  apellido: string | null;
  correo: string;
  rol: RolUsuario;
  perfil: PerfilGestor | null;
  estado: EstadoUsuario;
}

export interface SesionActiva {
  requiereCambioPassword: false;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  refreshExpiresIn: number;
  usuario: UsuarioSesion;
}

export interface SesionPrimerAcceso {
  requiereCambioPassword: true;
  correo: string;
  nombre: string;
  perfil: PerfilGestor;
  mensaje: string;
}

export type RespuestaLogin = SesionActiva | SesionPrimerAcceso;

export interface CuerpoError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export interface RespuestaMensaje {
  mensaje: string;
}

export interface Paginacion {
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
}

export interface RespuestaRegistroComerciante {
  id: string;
  nombre: string;
  apellido: string | null;
  correo: string;
  rol: RolUsuario;
  estado: EstadoUsuario;
  actividadComercial: string;
  categoria: CategoriaComercio;
  mensaje: string;
}

export interface RespuestaRegistroOrganizador {
  id: string;
  nombre: string;
  apellido: string | null;
  correo: string;
  rol: RolUsuario;
  estado: EstadoUsuario;
  mensaje: string;
}

export interface RespuestaActivacion {
  id: string;
  nombre: string;
  correo: string;
  rol: RolUsuario;
  estado: EstadoUsuario;
  mensaje: string;
}

export interface SolicitudLogin {
  correo: string;
  password: string;
}

export interface SolicitudPrimerAcceso {
  correo: string;
  passwordActual: string;
  password: string;
  confirmarPassword: string;
}

export interface SolicitudRegistroComerciante {
  nombre: string;
  apellido?: string;
  tipoDocumento: TipoDocumento;
  documento: string;
  telefono: string;
  correo: string;
  password: string;
  confirmarPassword: string;
  actividadComercial: string;
  categoria: CategoriaComercio;
}

export interface SolicitudRegistroOrganizador {
  nombre: string;
  apellido?: string;
  tipoDocumento: TipoDocumento;
  documento: string;
  telefono: string;
  correo: string;
  password: string;
  confirmarPassword: string;
}

export interface SolicitudActivacion {
  correo: string;
  codigo: string;
}

export interface SolicitudRecuperacion {
  correo: string;
}

export interface SolicitudRestablecer {
  correo: string;
  codigo: string;
  password: string;
  confirmarPassword: string;
}

/* ------------------------------------------------------------------ */
/* Perfil del comerciante y del organizador                            */
/* ------------------------------------------------------------------ */

export interface PerfilDatosPersonales {
  id: string;
  nombre: string;
  apellido: string | null;
  tipoDocumento?: string | null;
  documento?: string | null;
  telefono?: string | null;
}

export interface PerfilActividadComercial {
  actividadComercial: string;
  categoria: CategoriaComercio;
}

export interface PerfilOrganizacion {
  nombreOrganizacion: string;
  nit: string;
  representante: string;
  tipoFeria: string;
  contacto?: string | null;
  estado: EstadoOrganizacion;
  validadoEn?: string | null;
}

export interface PerfilSeguridad {
  correo: string;
  estado: EstadoUsuario;
  creadoEn: string;
}

export interface Perfil {
  datosPersonales: PerfilDatosPersonales;
  actividadComercial?: PerfilActividadComercial;
  organizacion?: PerfilOrganizacion | null;
  seguridad: PerfilSeguridad;
}

export interface SolicitudActualizarPerfil {
  nombre?: string;
  apellido?: string | null;
  telefono?: string;
}

export interface SolicitudCambiarPassword {
  passwordActual: string;
  passwordNueva: string;
  confirmarPassword: string;
}

/* ------------------------------------------------------------------ */
/* Organización propia                                                 */
/* ------------------------------------------------------------------ */

export interface Organizacion {
  usuarioId: string;
  nombreOrganizacion: string;
  nit: string;
  representante: string;
  tipoFeria: string;
  contacto?: string | null;
  estado: EstadoOrganizacion;
  validadoEn?: string | null;
  mensaje?: string;
}

export interface OrganizacionGestor extends Organizacion {
  nombre: string;
  apellido: string | null;
  correo: string;
  telefono?: string | null;
  validadoPor?: string | null;
  creadoEn: string;
}

export interface SolicitudOrganizacion {
  nombreOrganizacion: string;
  nit: string;
  representante: string;
  tipoFeria: string;
  contacto?: string;
}

/* ------------------------------------------------------------------ */
/* Panel del gestor                                                    */
/* ------------------------------------------------------------------ */

export interface ConteoEstadosUsuario {
  total: number;
  pendientesActivacion: number;
  activas: number;
  suspendidas: number;
  inactivas: number;
}

export interface ConteoRoles {
  comerciante: number;
  organizador: number;
  gestor: number;
}

export interface Panel {
  gestor: {
    id: string;
    nombre: string;
    apellido?: string;
    correo: string;
    perfil: PerfilGestor;
  };
  indicadores: {
    usuarios: {
      estados: ConteoEstadosUsuario;
      roles: ConteoRoles;
    };
    solicitudes: {
      total: number;
      porEstado: Record<string, number>;
    };
    permisos: {
      total: number;
      porEstado: Record<string, number>;
    };
    ferias: {
      total: number;
      porEstado: Record<string, number>;
    };
  };
}

/* ------------------------------------------------------------------ */
/* Gestión de usuarios                                                 */
/* ------------------------------------------------------------------ */

export interface UsuarioListado {
  id: string;
  nombre: string;
  apellido: string | null;
  correo: string;
  documento?: string | null;
  telefono?: string | null;
  rol: RolUsuario;
  estado: EstadoUsuario;
  perfil?: PerfilGestor | null;
  categoria?: CategoriaComercio | null;
  actividadComercial?: string | null;
  nombreOrganizacion?: string | null;
  creadoEn: string;
}

export interface ComercianteListado {
  id: string;
  nombre: string;
  apellido: string | null;
  tipoDocumento?: string | null;
  documento?: string | null;
  correo: string;
  telefono?: string | null;
  estado: EstadoUsuario;
  categoria?: CategoriaComercio | null;
  actividadComercial?: string | null;
  totalSolicitudes: number;
  totalPermisos: number;
  creadoEn: string;
}

export interface PerfilComercialDetalle {
  actividadComercial: string;
  categoria: CategoriaComercio;
  actualizadoEn: string;
}

export interface PerfilGestorDetalle {
  perfil: PerfilGestor;
  creadoPor?: string | null;
}

export interface OrganizacionDetalle {
  nombreOrganizacion: string;
  nit: string;
  representante: string;
  tipoFeria: string;
  contacto?: string | null;
  estado: EstadoOrganizacion;
  validadoEn?: string | null;
}

export interface SolicitudDetalle {
  id: string;
  numeroRadicado: string;
  estado: string;
  actividad: string;
  fechaInicio: string;
  fechaFin: string;
  horaInicio: string;
  horaFin: string;
  radicadaEn?: string | null;
  decididaEn?: string | null;
  motivoRechazo?: string | null;
  creadoEn: string;
  espacio?: string | null;
  permiso?: { numero: string; estado: string } | null;
}

export interface PermisoDetalle {
  id: string;
  numero: string;
  categoriaAutorizada: string;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  emitidoEn: string;
  espacio?: string | null;
  solicitudNumero: string;
  cobro?: {
    valor: string;
    estado: string;
    pagadoEn?: string | null;
  } | null;
}

export interface UsuarioDetalle {
  usuario: {
    id: string;
    nombre: string;
    apellido: string | null;
    tipoDocumento?: string | null;
    documento?: string | null;
    telefono?: string | null;
    correo: string;
    rol: RolUsuario;
    estado: EstadoUsuario;
    creadoEn: string;
    actualizadoEn: string;
    perfilComercial?: PerfilComercialDetalle | null;
    perfilGestor?: PerfilGestorDetalle | null;
    organizacion?: OrganizacionDetalle | null;
  };
  solicitudes: SolicitudDetalle[];
  permisos: PermisoDetalle[];
  totales: { solicitudes: number; permisos: number };
}

export interface RespuestaCambioEstadoUsuario {
  id: string;
  nombre: string;
  correo: string;
  estadoAnterior: EstadoUsuario;
  estado: EstadoUsuario;
  motivo?: string | null;
  mensaje: string;
}

export interface SolicitudCambioEstadoUsuario {
  estado: "activa" | "suspendida" | "inactiva";
  motivo?: string;
}

export interface SolicitudCorregirComerciante {
  documento?: string;
  tipoDocumento?: TipoDocumento;
  actividadComercial?: string;
  categoria?: CategoriaComercio;
}

export interface ComercianteActualizado {
  id: string;
  nombre: string;
  apellido: string | null;
  tipoDocumento?: string | null;
  documento?: string | null;
  telefono?: string | null;
  correo: string;
  estado: string;
  actividadComercial: string;
  categoria: CategoriaComercio;
  mensaje: string;
}

export interface FiltrosUsuarios {
  busqueda?: string;
  rol?: RolUsuario;
  estado?: EstadoUsuario;
  perfil?: PerfilGestor;
  pagina?: number;
  limite?: number;
}

export interface FiltrosComerciantes {
  busqueda?: string;
  estado?: EstadoUsuario;
  categoria?: CategoriaComercio;
  pagina?: number;
  limite?: number;
}

export interface FiltrosOrganizaciones {
  busqueda?: string;
  estado?: EstadoOrganizacion;
  pagina?: number;
  limite?: number;
}

/* ------------------------------------------------------------------ */
/* Gestores                                                            */
/* ------------------------------------------------------------------ */

export interface PerfilGestorCompleto {
  id: string;
  nombre: string;
  apellido: string | null;
  correo: string;
  telefono?: string | null;
  perfil: PerfilGestor;
  estado: EstadoUsuario;
  creadoEn: string;
  actualizadoEn: string;
}

export interface SolicitudActualizarPerfilGestor {
  nombre?: string;
  apellido?: string | null;
  telefono?: string;
}

export interface SolicitudCrearGestor {
  nombre: string;
  apellido?: string;
  correo: string;
  perfil: PerfilGestor;
}

export interface GestorCreado {
  id: string;
  nombre: string;
  apellido: string | null;
  correo: string;
  perfil: PerfilGestor;
  estado: EstadoUsuario;
  mensaje: string;
}

export interface InvitacionReenviada {
  id: string;
  correo: string;
  perfil: PerfilGestor;
  mensaje: string;
}

/* ------------------------------------------------------------------ */
/* Organizaciones (gestor)                                             */
/* ------------------------------------------------------------------ */

export interface RespuestaCambioEstadoOrganizacion {
  usuarioId: string;
  nombreOrganizacion: string;
  nit: string;
  representante: string;
  tipoFeria: string;
  contacto?: string | null;
  estado: EstadoOrganizacion;
  validadoEn?: string | null;
  mensaje?: string;
  nombre: string;
  apellido: string | null;
  correo: string;
  telefono?: string | null;
  validadoPor?: string | null;
  creadoEn: string;
}

/* ------------------------------------------------------------------ */
/* Notificaciones                                                      */
/* ------------------------------------------------------------------ */

export interface Notificacion {
  id: string;
  tipo: string;
  asunto: string;
  cuerpo?: string | null;
  canal: string;
  leida: boolean;
  creadaEn: string;
}

export interface ListarNotificacionesResponse {
  datos: Notificacion[];
  paginacion: Paginacion;
  noLeidas: number;
}

export interface FiltrosNotificaciones {
  leida?: boolean;
  pagina?: number;
  limite?: number;
}

/* ------------------------------------------------------------------ */
/* Auditoría                                                           */
/* ------------------------------------------------------------------ */

export interface AuditoriaItem {
  id: string;
  tabla: string;
  registroId: string;
  accion: AccionAuditoria | string;
  valorAnterior?: unknown;
  valorNuevo?: unknown;
  actor?: {
    id: string;
    nombre: string;
    apellido?: string | null;
    correo: string;
  } | null;
  creadoEn: string;
}

export interface FiltrosAuditoria {
  tabla?: string;
  registroId?: string;
  accion?: AccionAuditoria;
  pagina?: number;
  limite?: number;
}

export interface ListarAuditoriaResponse {
  datos: AuditoriaItem[];
  paginacion: Paginacion;
}
