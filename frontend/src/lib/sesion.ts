import type {
  RespuestaLogin,
  SesionActiva,
  SesionPrimerAcceso,
  UsuarioSesion,
} from "@/types/api";

const CLAVE_ACCESS_TOKEN = "sgp.accessToken";
const CLAVE_REFRESH_TOKEN = "sgp.refreshToken";
const CLAVE_USUARIO = "sgp.usuario";
const CLAVE_CORREO_PENDIENTE = "sgp.correoPendiente";

function leer(clave: string): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(clave);
}

function escribir(clave: string, valor: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(clave, valor);
}

function borrar(clave: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(clave);
}

export function guardarSesion(sesion: SesionActiva): void {
  escribir(CLAVE_ACCESS_TOKEN, sesion.accessToken);
  escribir(CLAVE_REFRESH_TOKEN, sesion.refreshToken);
  escribir(CLAVE_USUARIO, JSON.stringify(sesion.usuario));
}

export function obtenerAccessToken(): string | null {
  return leer(CLAVE_ACCESS_TOKEN);
}

export function obtenerRefreshToken(): string | null {
  return leer(CLAVE_REFRESH_TOKEN);
}

export function obtenerUsuario(): UsuarioSesion | null {
  const crudo = leer(CLAVE_USUARIO);
  if (!crudo) return null;
  try {
    return JSON.parse(crudo) as UsuarioSesion;
  } catch {
    return null;
  }
}

export function haySesion(): boolean {
  return obtenerAccessToken() !== null || obtenerRefreshToken() !== null;
}

export function limpiarSesion(): void {
  borrar(CLAVE_ACCESS_TOKEN);
  borrar(CLAVE_REFRESH_TOKEN);
  borrar(CLAVE_USUARIO);
}

export function guardarCorreoPendiente(correo: string): void {
  escribir(CLAVE_CORREO_PENDIENTE, correo);
}

export function obtenerCorreoPendiente(): string | null {
  return leer(CLAVE_CORREO_PENDIENTE);
}

export function limpiarCorreoPendiente(): void {
  borrar(CLAVE_CORREO_PENDIENTE);
}

export function esSesionPrimerAcceso(
  respuesta: RespuestaLogin,
): respuesta is SesionPrimerAcceso {
  return respuesta.requiereCambioPassword;
}
