import type {
  CuerpoError,
  RespuestaActivacion,
  RespuestaLogin,
  RespuestaMensaje,
  RespuestaRegistroComerciante,
  RespuestaRegistroOrganizador,
  SolicitudActivacion,
  SolicitudLogin,
  SolicitudPrimerAcceso,
  SolicitudRecuperacion,
  SolicitudRegistroComerciante,
  SolicitudRegistroOrganizador,
  SolicitudRestablecer,
  UsuarioSesion,
} from "@/types/api";
import { guardarSesion, limpiarSesion, obtenerAccessToken, obtenerRefreshToken } from "./sesion";

const URL_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly campos: string[];
  readonly segundosEspera: number | null;

  constructor(
    status: number,
    mensaje: string,
    campos: string[] = [],
    segundosEspera: number | null = null,
  ) {
    super(mensaje);
    this.name = "ApiError";
    this.status = status;
    this.campos = campos;
    this.segundosEspera = segundosEspera;
  }

  get mensaje(): string {
    return this.message;
  }
}

interface OpcionesPeticion {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  cuerpo?: unknown;
  auth?: boolean;
}

function redirigirALogin(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  window.location.replace("/login");
}

async function leerCuerpo<T>(respuesta: Response): Promise<T> {
  if (respuesta.status === 204) return undefined as T;
  const texto = await respuesta.text();
  if (!texto) return undefined as T;
  return JSON.parse(texto) as T;
}

async function construirError(respuesta: Response): Promise<ApiError> {
  const cabeceraRetry = respuesta.headers.get("Retry-After");
  const segundosEspera = cabeceraRetry ? Number.parseInt(cabeceraRetry, 10) : null;

  let cuerpo: CuerpoError | null = null;
  try {
    cuerpo = (await respuesta.json()) as CuerpoError;
  } catch {
    cuerpo = null;
  }

  const mensajes = cuerpo
    ? Array.isArray(cuerpo.message)
      ? cuerpo.message
      : [cuerpo.message]
    : ["Ocurrió un error inesperado. Intenta de nuevo."];

  return new ApiError(
    respuesta.status,
    mensajes.join("\n"),
    mensajes,
    Number.isFinite(segundosEspera) ? segundosEspera : null,
  );
}

let promesaRefresh: Promise<string | null> | null = null;

function rotarSesion(): Promise<string | null> {
  promesaRefresh ??= ejecutarRefresh().finally(() => {
    promesaRefresh = null;
  });
  return promesaRefresh;
}

async function ejecutarRefresh(): Promise<string | null> {
  const refreshToken = obtenerRefreshToken();
  if (!refreshToken) return null;

  try {
    const respuesta = await fetch(`${URL_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!respuesta.ok) return null;

    const datos = await leerCuerpo<RespuestaLogin>(respuesta);
    if (datos.requiereCambioPassword) return null;
    guardarSesion(datos);
    return datos.accessToken;
  } catch {
    return null;
  }
}

async function peticion<T>(
  ruta: string,
  opciones: OpcionesPeticion = {},
  reintento = false,
): Promise<T> {
  const { method = "GET", cuerpo, auth = true } = opciones;
  const token = obtenerAccessToken();
  const habiaSesion = token !== null || obtenerRefreshToken() !== null;

  const cabeceras: Record<string, string> = { Accept: "application/json" };
  if (cuerpo !== undefined) cabeceras["Content-Type"] = "application/json";
  if (auth && token) cabeceras.Authorization = `Bearer ${token}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(`${URL_BASE}${ruta}`, {
      method,
      headers: cabeceras,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      0,
      "No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.",
    );
  }

  if (respuesta.ok) return leerCuerpo<T>(respuesta);

  if (respuesta.status === 401 && auth && habiaSesion) {
    if (!reintento) {
      const accessToken = await rotarSesion();
      if (accessToken) return peticion<T>(ruta, opciones, true);
    }
    limpiarSesion();
    redirigirALogin();
  }

  throw await construirError(respuesta);
}

export function comoApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(0, "Ocurrió un error inesperado. Intenta de nuevo.");
}

export async function iniciarSesion(
  datos: SolicitudLogin,
): Promise<RespuestaLogin> {
  const respuesta = await peticion<RespuestaLogin>("/auth/login", {
    method: "POST",
    cuerpo: datos,
    auth: false,
  });
  if (!respuesta.requiereCambioPassword) guardarSesion(respuesta);
  return respuesta;
}

export async function completarPrimerAcceso(
  datos: SolicitudPrimerAcceso,
): Promise<RespuestaLogin> {
  const respuesta = await peticion<RespuestaLogin>(
    "/auth/gestor/primer-acceso",
    { method: "POST", cuerpo: datos, auth: false },
  );
  if (!respuesta.requiereCambioPassword) guardarSesion(respuesta);
  return respuesta;
}

export function registrarComerciante(
  datos: SolicitudRegistroComerciante,
): Promise<RespuestaRegistroComerciante> {
  return peticion<RespuestaRegistroComerciante>("/usuarios/comerciantes", {
    method: "POST",
    cuerpo: datos,
    auth: false,
  });
}

export function registrarOrganizador(
  datos: SolicitudRegistroOrganizador,
): Promise<RespuestaRegistroOrganizador> {
  return peticion<RespuestaRegistroOrganizador>("/usuarios/organizadores", {
    method: "POST",
    cuerpo: datos,
    auth: false,
  });
}

export function activarCuenta(
  datos: SolicitudActivacion,
): Promise<RespuestaActivacion> {
  return peticion<RespuestaActivacion>("/usuarios/activacion", {
    method: "POST",
    cuerpo: datos,
    auth: false,
  });
}

export function reenviarActivacion(
  datos: SolicitudRecuperacion,
): Promise<RespuestaMensaje> {
  return peticion<RespuestaMensaje>("/usuarios/activacion/reenviar", {
    method: "POST",
    cuerpo: datos,
    auth: false,
  });
}

export function solicitarRecuperacion(
  datos: SolicitudRecuperacion,
): Promise<RespuestaMensaje> {
  return peticion<RespuestaMensaje>("/usuarios/password/recuperar", {
    method: "POST",
    cuerpo: datos,
    auth: false,
  });
}

export function restablecerPassword(
  datos: SolicitudRestablecer,
): Promise<RespuestaMensaje> {
  return peticion<RespuestaMensaje>("/usuarios/password/restablecer", {
    method: "POST",
    cuerpo: datos,
    auth: false,
  });
}

export function obtenerSesion(): Promise<UsuarioSesion> {
  return peticion<UsuarioSesion>("/auth/me");
}

export async function cerrarSesion(): Promise<void> {
  try {
    await peticion<void>("/auth/logout", { method: "POST" });
  } finally {
    limpiarSesion();
  }
}
