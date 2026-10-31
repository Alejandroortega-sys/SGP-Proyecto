import type {
  ComercianteActualizado,
  ComercianteListado,
  CuerpoError,
  FiltrosAuditoria,
  FiltrosComerciantes,
  FiltrosNotificaciones,
  FiltrosOrganizaciones,
  FiltrosUsuarios,
  GestorCreado,
  InvitacionReenviada,
  ListarAuditoriaResponse,
  ListarNotificacionesResponse,
  Notificacion,
  Organizacion,
  OrganizacionGestor,
  Paginacion,
  Panel,
  Perfil,
  PerfilGestorCompleto,
  RespuestaActivacion,
  RespuestaCambioEstadoOrganizacion,
  RespuestaCambioEstadoUsuario,
  RespuestaLogin,
  RespuestaMensaje,
  RespuestaRegistroComerciante,
  RespuestaRegistroOrganizador,
  SolicitudActivacion,
  SolicitudActualizarPerfil,
  SolicitudActualizarPerfilGestor,
  SolicitudCambioEstadoUsuario,
  SolicitudCambiarPassword,
  SolicitudCorregirComerciante,
  SolicitudCrearGestor,
  SolicitudLogin,
  SolicitudOrganizacion,
  SolicitudPrimerAcceso,
  SolicitudRecuperacion,
  SolicitudRegistroComerciante,
  SolicitudRegistroOrganizador,
  SolicitudRestablecer,
  UsuarioDetalle,
  UsuarioListado,
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

function conParametros(
  ruta: string,
  parametros: Record<string, string | number | boolean | undefined | null>,
): string {
  const busqueda = new URLSearchParams();
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor === undefined || valor === null || valor === "") continue;
    busqueda.set(clave, String(valor));
  }
  const consulta = busqueda.toString();
  return consulta ? `${ruta}?${consulta}` : ruta;
}

/* ------------------------------------------------------------------ */
/* Perfil                                                              */
/* ------------------------------------------------------------------ */

export function obtenerPerfil(): Promise<Perfil> {
  return peticion<Perfil>("/perfil");
}

export function actualizarPerfil(
  datos: SolicitudActualizarPerfil,
): Promise<Perfil> {
  return peticion<Perfil>("/perfil", { method: "PATCH", cuerpo: datos });
}

export function cambiarPasswordPerfil(
  datos: SolicitudCambiarPassword,
): Promise<RespuestaMensaje> {
  return peticion<RespuestaMensaje>("/perfil/password", {
    method: "PATCH",
    cuerpo: datos,
  });
}

/* ------------------------------------------------------------------ */
/* Organización propia                                                 */
/* ------------------------------------------------------------------ */

export function obtenerMiOrganizacion(): Promise<Organizacion> {
  return peticion<Organizacion>("/organizadores/mi-organizacion");
}

export function crearMiOrganizacion(
  datos: SolicitudOrganizacion,
): Promise<Organizacion> {
  return peticion<Organizacion>("/organizadores/mi-organizacion", {
    method: "POST",
    cuerpo: datos,
  });
}

export function actualizarMiOrganizacion(
  datos: Partial<SolicitudOrganizacion>,
): Promise<Organizacion> {
  return peticion<Organizacion>("/organizadores/mi-organizacion", {
    method: "PATCH",
    cuerpo: datos,
  });
}

/* ------------------------------------------------------------------ */
/* Panel y perfil del gestor                                           */
/* ------------------------------------------------------------------ */

export function obtenerPanel(): Promise<Panel> {
  return peticion<Panel>("/panel");
}

export function obtenerPerfilGestor(): Promise<PerfilGestorCompleto> {
  return peticion<PerfilGestorCompleto>("/gestor/perfil");
}

export function actualizarPerfilGestor(
  datos: SolicitudActualizarPerfilGestor,
): Promise<PerfilGestorCompleto> {
  return peticion<PerfilGestorCompleto>("/gestor/perfil", {
    method: "PATCH",
    cuerpo: datos,
  });
}

export function cambiarPasswordGestor(
  datos: SolicitudCambiarPassword,
): Promise<RespuestaMensaje> {
  return peticion<RespuestaMensaje>("/gestor/perfil/password", {
    method: "PATCH",
    cuerpo: datos,
  });
}

/* ------------------------------------------------------------------ */
/* Gestión de usuarios                                                 */
/* ------------------------------------------------------------------ */

export function listarUsuarios(
  filtros: FiltrosUsuarios = {},
): Promise<{ datos: UsuarioListado[]; paginacion: Paginacion }> {
  return peticion<{ datos: UsuarioListado[]; paginacion: Paginacion }>(
    conParametros("/gestor/usuarios", {
      busqueda: filtros.busqueda,
      rol: filtros.rol,
      estado: filtros.estado,
      perfil: filtros.perfil,
      pagina: filtros.pagina,
      limite: filtros.limite,
    }),
  );
}

export function listarComerciantes(
  filtros: FiltrosComerciantes = {},
): Promise<{ datos: ComercianteListado[]; paginacion: Paginacion }> {
  return peticion<{ datos: ComercianteListado[]; paginacion: Paginacion }>(
    conParametros("/gestor/comerciantes", {
      busqueda: filtros.busqueda,
      estado: filtros.estado,
      categoria: filtros.categoria,
      pagina: filtros.pagina,
      limite: filtros.limite,
    }),
  );
}

export function obtenerUsuarioDetalle(id: string): Promise<UsuarioDetalle> {
  return peticion<UsuarioDetalle>(`/gestor/usuarios/${id}`);
}

export function cambiarEstadoUsuario(
  id: string,
  datos: SolicitudCambioEstadoUsuario,
): Promise<RespuestaCambioEstadoUsuario> {
  return peticion<RespuestaCambioEstadoUsuario>(
    `/gestor/usuarios/${id}/estado`,
    { method: "PATCH", cuerpo: datos },
  );
}

export function corregirComerciante(
  id: string,
  datos: SolicitudCorregirComerciante,
): Promise<ComercianteActualizado> {
  return peticion<ComercianteActualizado>(`/usuarios/${id}/comerciante`, {
    method: "PATCH",
    cuerpo: datos,
  });
}

/* ------------------------------------------------------------------ */
/* Gestores                                                            */
/* ------------------------------------------------------------------ */

export function crearGestor(datos: SolicitudCrearGestor): Promise<GestorCreado> {
  return peticion<GestorCreado>("/gestor/gestores", {
    method: "POST",
    cuerpo: datos,
  });
}

export function reenviarInvitacionGestor(
  id: string,
): Promise<InvitacionReenviada> {
  return peticion<InvitacionReenviada>(
    `/gestor/gestores/${id}/reenviar-invitacion`,
    { method: "POST" },
  );
}

/* ------------------------------------------------------------------ */
/* Organizaciones (gestor)                                             */
/* ------------------------------------------------------------------ */

export function listarOrganizaciones(
  filtros: FiltrosOrganizaciones = {},
): Promise<{ datos: OrganizacionGestor[]; paginacion: Paginacion }> {
  return peticion<{ datos: OrganizacionGestor[]; paginacion: Paginacion }>(
    conParametros("/gestor/organizaciones", {
      busqueda: filtros.busqueda,
      estado: filtros.estado,
      pagina: filtros.pagina,
      limite: filtros.limite,
    }),
  );
}

export function obtenerOrganizacionGestor(
  id: string,
): Promise<OrganizacionGestor> {
  return peticion<OrganizacionGestor>(`/gestor/organizaciones/${id}`);
}

export function cambiarEstadoOrganizacion(
  id: string,
  datos: { estado: "activa" | "suspendida"; motivo?: string },
): Promise<RespuestaCambioEstadoOrganizacion> {
  return peticion<RespuestaCambioEstadoOrganizacion>(
    `/gestor/organizaciones/${id}/estado`,
    { method: "PATCH", cuerpo: datos },
  );
}

/* ------------------------------------------------------------------ */
/* Notificaciones                                                      */
/* ------------------------------------------------------------------ */

export function listarNotificaciones(
  filtros: FiltrosNotificaciones = {},
): Promise<ListarNotificacionesResponse> {
  return peticion<ListarNotificacionesResponse>(
    conParametros("/notificaciones", {
      leida: filtros.leida,
      pagina: filtros.pagina,
      limite: filtros.limite,
    }),
  );
}

export function marcarNotificacionLeida(
  id: string,
  leida = true,
): Promise<Notificacion> {
  return peticion<Notificacion>(`/notificaciones/${id}/leida`, {
    method: "PATCH",
    cuerpo: { leida },
  });
}

export function marcarTodasNotificacionesLeidas(): Promise<{
  actualizadas: number;
  mensaje: string;
}> {
  return peticion<{ actualizadas: number; mensaje: string }>(
    "/notificaciones/leer-todas",
    { method: "PATCH" },
  );
}

/* ------------------------------------------------------------------ */
/* Auditoría                                                           */
/* ------------------------------------------------------------------ */

export function listarAuditoria(
  filtros: FiltrosAuditoria = {},
): Promise<ListarAuditoriaResponse> {
  return peticion<ListarAuditoriaResponse>(
    conParametros("/gestor/auditoria", {
      tabla: filtros.tabla,
      registroId: filtros.registroId,
      accion: filtros.accion,
      pagina: filtros.pagina,
      limite: filtros.limite,
    }),
  );
}
