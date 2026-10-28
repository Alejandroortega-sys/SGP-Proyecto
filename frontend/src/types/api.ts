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
