import type {
  AgendaFeria,
  ComercianteActualizado,
  ComercianteListado,
  ConfirmacionImportacion,
  BloqueoEspacioGestor,
  CuerpoError,
  DatosRadicacionFeria,
  DatosRadicacionSolicitud,
  DisponibilidadFeria,
  DisponibilidadSolicitud,
  DocumentoAdjuntoRadicacion,
  EspacioDetalle,
  EspacioGestorDetalle,
  FiltrosAuditoria,
  FiltrosComerciantes,
  FeriaDetalle,
  FiltrosEspacios,
  FiltrosEspaciosGestor,
  FiltrosFerias,
  FiltrosNotificaciones,
  FiltrosSolicitudes,
  FiltrosHistorialZona,
  FiltrosModulos,
  FiltrosOrganizaciones,
  FiltrosRevisionSolicitudes,
  FiltrosUsuarios,
  FiltrosZonas,
  GestorCreado,
  HistorialEspacio,
  InvitacionReenviada,
  ListarAuditoriaResponse,
  ListarEspaciosGestorResponse,
  ListarEspaciosResponse,
  ListarFeriasResponse,
  ListarModulosResponse,
  ListarNotificacionesResponse,
  ListarProductosResponse,
  ListarSolicitudesRevisionResponse,
  ListarSolicitudesResponse,
  ListarZonasResponse,
  ModuloDetalle,
  ModuloHistorial,
  Notificacion,
  OpcionesEspacios,
  OpcionesEspaciosGestor,
  OpcionesFeria,
  OpcionesModulos,
  OpcionesRevisionSolicitudes,
  Organizacion,
  OrganizacionGestor,
  Paginacion,
  Panel,
  Perfil,
  PerfilGestorCompleto,
  PrevisualizacionImportacion,
  RespuestaActivacion,
  RespuestaCambioEstadoOrganizacion,
  RespuestaCambioEstadoUsuario,
  RespuestaCambioEstadoRevision,
  RespuestaEstadoEspacio,
  RespuestaEstadoModulo,
  RespuestaEstadoZona,
  RespuestaLogin,
  ProgresoSubida,
  RespuestaMensaje,
  RespuestaCargaDocumentoSolicitud,
  RespuestaLiberarRevision,
  RespuestaRadicacion,
  RespuestaRadicacionFeria,
  RespuestaRequisitosSolicitud,
  RequisitosSolicitudResponse,
  RespuestaRegistroComerciante,
  RespuestaRegistroOrganizador,
  RespuestaRenovarRevision,
  RespuestaResolucionSolicitud,
  RespuestaTomarRevision,
  RespuestaVerificarRequisito,
  RespuestaZonaContenedora,
  DatosResolucionSolicitud,
  SolicitudActivacion,
  SolicitudActualizarPerfil,
  SolicitudTemporalDetalle,
  SolicitudActualizarPerfilGestor,
  SolicitudCambioEstadoUsuario,
  SolicitudCambiarPassword,
  SolicitudCorregirComerciante,
  SolicitudCrearGestor,
  SolicitudBloqueoEspacio,
  SolicitudDevolucionRevision,
  SolicitudEspacioGestor,
  SolicitudLogin,
  SolicitudModulo,
  SolicitudOrganizacion,
  SolicitudPrimerAcceso,
  SolicitudRecuperacion,
  SolicitudRegistroComerciante,
  SolicitudRegistroOrganizador,
  SolicitudRestablecer,
  SolicitudRevisionDetalle,
  SolicitudZona,
  SridsImportacion,
  UsuarioDetalle,
  UsuarioListado,
  UsuarioSesion,
  ZonaContenedoraEspacio,
  ZonaDetalle,
  ZonaFeatureCollection,
  ZonaHistorial,
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
  formulario?: FormData;
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
  const { method = "GET", cuerpo, formulario, auth = true } = opciones;
  const token = obtenerAccessToken();
  const habiaSesion = token !== null || obtenerRefreshToken() !== null;

  const cabeceras: Record<string, string> = { Accept: "application/json" };
  if (formulario === undefined && cuerpo !== undefined) {
    cabeceras["Content-Type"] = "application/json";
  }
  if (auth && token) cabeceras.Authorization = `Bearer ${token}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(`${URL_BASE}${ruta}`, {
      method,
      headers: cabeceras,
      body:
        formulario ??
        (cuerpo === undefined ? undefined : JSON.stringify(cuerpo)),
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

interface RespuestaArchivo {
  blob: Blob;
  nombreArchivo: string;
}

/** Descarga autenticada de un archivo, con la misma rotación de sesión. */
async function peticionArchivo(
  ruta: string,
  reintento = false,
  accept = "text/csv",
): Promise<RespuestaArchivo> {
  const token = obtenerAccessToken();
  const habiaSesion = token !== null || obtenerRefreshToken() !== null;

  const cabeceras: Record<string, string> = { Accept: accept };
  if (token) cabeceras.Authorization = `Bearer ${token}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(`${URL_BASE}${ruta}`, {
      headers: cabeceras,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      0,
      "No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.",
    );
  }

  if (respuesta.ok) {
    const disposicion = respuesta.headers.get("Content-Disposition") ?? "";
    const coincidencia = /filename="?([^";]+)"?/i.exec(disposicion);
    return {
      blob: await respuesta.blob(),
      nombreArchivo: coincidencia?.[1] ?? "reporte-importacion.csv",
    };
  }

  if (respuesta.status === 401 && habiaSesion) {
    if (!reintento) {
      const accessToken = await rotarSesion();
      if (accessToken) return peticionArchivo(ruta, true, accept);
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

/* ------------------------------------------------------------------ */
/* Zonas / Geo-Portal                                                  */
/* ------------------------------------------------------------------ */

/**
 * Obtiene el GeoJSON público de zonas activas. Si se envía `zoom`, el backend
 * simplifica las geometrías según la escala visible del mapa.
 */
export function obtenerZonasGeoJson(
  zoom?: number,
): Promise<ZonaFeatureCollection> {
  return peticion<ZonaFeatureCollection>(
    conParametros("/zonas/geojson", { zoom }),
    { auth: false },
  );
}

/** Lista las zonas con filtros y paginación, sin geometría. */
export function listarZonas(
  filtros: FiltrosZonas = {},
): Promise<ListarZonasResponse> {
  return peticion<ListarZonasResponse>(
    conParametros("/zonas", {
      tipo: filtros.tipo,
      activo: filtros.activo,
      busqueda: filtros.busqueda,
      pagina: filtros.pagina,
      limite: filtros.limite,
    }),
  );
}

/** Obtiene el detalle de una zona con su polígono y productos permitidos. */
export function obtenerZona(id: string): Promise<ZonaDetalle> {
  return peticion<ZonaDetalle>(`/zonas/${id}`);
}

/** Obtiene el historial versionado de una zona. */
export function obtenerHistorialZona(
  id: string,
  filtros: FiltrosHistorialZona = {},
): Promise<ZonaHistorial> {
  return peticion<ZonaHistorial>(
    conParametros(`/zonas/${id}/historial`, {
      pagina: filtros.pagina,
      limite: filtros.limite,
    }),
  );
}

/** Crea una zona normativa. */
export function crearZona(datos: SolicitudZona): Promise<ZonaDetalle> {
  return peticion<ZonaDetalle>("/zonas", { method: "POST", cuerpo: datos });
}

/** Edita los campos enviados de una zona. */
export function actualizarZona(
  id: string,
  datos: Partial<SolicitudZona>,
): Promise<ZonaDetalle> {
  return peticion<ZonaDetalle>(`/zonas/${id}`, {
    method: "PATCH",
    cuerpo: datos,
  });
}

/** Activa o desactiva una zona (baja lógica). */
export function cambiarEstadoZona(
  id: string,
  activa: boolean,
): Promise<RespuestaEstadoZona> {
  return peticion<RespuestaEstadoZona>(`/zonas/${id}/estado`, {
    method: "PATCH",
    cuerpo: { activa },
  });
}

/** Lista el catálogo de productos visible para el gestor. */
export function listarProductos(): Promise<ListarProductosResponse> {
  return peticion<ListarProductosResponse>("/productos");
}

/* ------------------------------------------------------------------ */
/* Espacios temporales (HU-09)                                         */
/* ------------------------------------------------------------------ */

/**
 * Lista los espacios disponibles del comerciante. Con
 * `incluirNoDisponibles` se incluyen bloqueados, asignados y en
 * mantenimiento para consultar su ficha.
 */
export function obtenerEspacios(
  filtros: FiltrosEspacios = {},
): Promise<ListarEspaciosResponse> {
  return peticion<ListarEspaciosResponse>(
    conParametros("/espacios", {
      incluirNoDisponibles: filtros.incluirNoDisponibles,
      fecha: filtros.fecha,
      sector: filtros.sector,
      actividad: filtros.actividad,
      horaInicio: filtros.horaInicio,
      horaFin: filtros.horaFin,
    }),
  );
}

/** Obtiene las listas cerradas de sectores y actividades para los filtros. */
export function obtenerOpcionesEspacios(): Promise<OpcionesEspacios> {
  return peticion<OpcionesEspacios>("/espacios/opciones");
}

/** Obtiene la ficha completa de un espacio, incluso si no está disponible. */
export function obtenerEspacio(
  id: string,
  fecha?: string,
): Promise<EspacioDetalle> {
  return peticion<EspacioDetalle>(
    conParametros(`/espacios/${id}`, { fecha }),
  );
}

/* ------------------------------------------------------------------ */
/* Administración de espacios temporales (HU-15)                       */
/* ------------------------------------------------------------------ */

/** Lista el catálogo administrativo de espacios temporales. */
export function listarEspaciosGestor(
  filtros: FiltrosEspaciosGestor = {},
): Promise<ListarEspaciosGestorResponse> {
  return peticion<ListarEspaciosGestorResponse>(
    conParametros("/gestor/espacios", {
      busqueda: filtros.busqueda,
      tipo: filtros.tipo,
      estado: filtros.estado,
      sector: filtros.sector,
      zonaId: filtros.zonaId,
      asignacionManual: filtros.asignacionManual,
      fecha: filtros.fecha,
      pagina: filtros.pagina,
      limite: filtros.limite,
    }),
  );
}

/** Opciones de tipos, estados, zonas y sectores del catálogo. */
export function obtenerOpcionesEspaciosGestor(): Promise<OpcionesEspaciosGestor> {
  return peticion<OpcionesEspaciosGestor>("/gestor/espacios/opciones");
}

/** Zona activa que contiene un punto y sector sugerido. */
export function consultarZonaEspacio(
  lat: number,
  lng: number,
): Promise<ZonaContenedoraEspacio> {
  return peticion<ZonaContenedoraEspacio>(
    conParametros("/gestor/espacios/zona-contenedora", { lat, lng }),
  );
}

/** Ficha administrativa de un espacio. */
export function obtenerEspacioGestor(
  id: string,
  fecha?: string,
): Promise<EspacioGestorDetalle> {
  return peticion<EspacioGestorDetalle>(
    conParametros(`/gestor/espacios/${id}`, { fecha }),
  );
}

/** Crea un espacio temporal. */
export function crearEspacioGestor(
  datos: SolicitudEspacioGestor,
): Promise<EspacioGestorDetalle> {
  return peticion<EspacioGestorDetalle>("/gestor/espacios", {
    method: "POST",
    cuerpo: datos,
  });
}

/** Edita un espacio temporal. */
export function actualizarEspacioGestor(
  id: string,
  datos: Partial<SolicitudEspacioGestor>,
): Promise<EspacioGestorDetalle> {
  return peticion<EspacioGestorDetalle>(`/gestor/espacios/${id}`, {
    method: "PATCH",
    cuerpo: datos,
  });
}

/** Elimina un espacio sin permisos ni solicitudes asociadas. */
export function eliminarEspacioGestor(id: string): Promise<void> {
  return peticion<void>(`/gestor/espacios/${id}`, { method: "DELETE" });
}

/** Fija el estado manual disponible o mantenimiento. */
export function cambiarEstadoEspacioGestor(
  id: string,
  estado: "disponible" | "mantenimiento",
): Promise<RespuestaEstadoEspacio> {
  return peticion<RespuestaEstadoEspacio>(`/gestor/espacios/${id}/estado`, {
    method: "PATCH",
    cuerpo: { estado },
  });
}

/** Asigna manualmente un espacio. */
export function asignarEspacioGestor(
  id: string,
  motivo?: string,
): Promise<RespuestaEstadoEspacio> {
  return peticion<RespuestaEstadoEspacio>(`/gestor/espacios/${id}/asignar`, {
    method: "POST",
    cuerpo: motivo ? { motivo } : {},
  });
}

/** Libera una asignación manual. */
export function liberarEspacioGestor(
  id: string,
  motivo?: string,
): Promise<RespuestaEstadoEspacio> {
  return peticion<RespuestaEstadoEspacio>(`/gestor/espacios/${id}/liberar`, {
    method: "POST",
    cuerpo: motivo ? { motivo } : {},
  });
}

/** Lista los bloqueos de un espacio. */
export function listarBloqueosEspacio(
  id: string,
): Promise<{ datos: BloqueoEspacioGestor[] }> {
  return peticion<{ datos: BloqueoEspacioGestor[] }>(
    `/gestor/espacios/${id}/bloqueos`,
  );
}

/** Crea un bloqueo de fechas. */
export function crearBloqueoEspacio(
  id: string,
  datos: SolicitudBloqueoEspacio,
): Promise<BloqueoEspacioGestor> {
  return peticion<BloqueoEspacioGestor>(`/gestor/espacios/${id}/bloqueos`, {
    method: "POST",
    cuerpo: datos,
  });
}

/** Edita un bloqueo de fechas. */
export function actualizarBloqueoEspacio(
  id: string,
  bloqueoId: string,
  datos: Partial<SolicitudBloqueoEspacio>,
): Promise<BloqueoEspacioGestor> {
  return peticion<BloqueoEspacioGestor>(
    `/gestor/espacios/${id}/bloqueos/${bloqueoId}`,
    { method: "PATCH", cuerpo: datos },
  );
}

/** Elimina un bloqueo de fechas. */
export function eliminarBloqueoEspacio(
  id: string,
  bloqueoId: string,
): Promise<void> {
  return peticion<void>(`/gestor/espacios/${id}/bloqueos/${bloqueoId}`, {
    method: "DELETE",
  });
}

/** Historial de auditoría del espacio y sus bloqueos. */
export function obtenerHistorialEspacio(
  id: string,
  filtros: { pagina?: number; limite?: number } = {},
): Promise<HistorialEspacio> {
  return peticion<HistorialEspacio>(
    conParametros(`/gestor/espacios/${id}/historial`, {
      pagina: filtros.pagina,
      limite: filtros.limite,
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Censo de módulos y puestos (HU-13)                                  */
/* ------------------------------------------------------------------ */

/** Convierte una URL relativa del backend en URL absoluta para `<img>`. */
export function urlArchivo(ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  if (/^https?:\/\//i.test(ruta)) return ruta;
  return `${URL_BASE}${ruta.startsWith("/") ? "" : "/"}${ruta}`;
}

function agregarCamposModulo(
  formulario: FormData,
  datos: Partial<SolicitudModulo>,
): void {
  if (datos.categoria !== undefined) {
    formulario.append("categoria", datos.categoria);
  }
  if (datos.actividad !== undefined) {
    formulario.append("actividad", datos.actividad);
  }
  if (datos.ubicacion !== undefined) {
    formulario.append("ubicacion", JSON.stringify(datos.ubicacion));
  }
  if (datos.titularId !== undefined) {
    formulario.append("titularId", datos.titularId);
  }
  if (datos.titularNombre !== undefined) {
    formulario.append("titularNombre", datos.titularNombre);
  }
  if (datos.aceptaAdvertencia !== undefined) {
    formulario.append(
      "aceptaAdvertencia",
      datos.aceptaAdvertencia ? "true" : "false",
    );
  }
}

/** Lista el censo con filtros por categoría, sector, estado y búsqueda. */
export function listarModulos(
  filtros: FiltrosModulos = {},
): Promise<ListarModulosResponse> {
  return peticion<ListarModulosResponse>(
    conParametros("/modulos", {
      categoria: filtros.categoria,
      sector: filtros.sector,
      estado: filtros.estado,
      busqueda: filtros.busqueda,
      pagina: filtros.pagina,
      limite: filtros.limite,
    }),
  );
}

/** Obtiene las zonas activas y categorías para los filtros. */
export function obtenerOpcionesModulos(): Promise<OpcionesModulos> {
  return peticion<OpcionesModulos>("/modulos/opciones");
}

/** Consulta la zona contenedora y las advertencias de un punto. */
export function consultarZonaContenedora(
  lat: number,
  lng: number,
): Promise<RespuestaZonaContenedora> {
  return peticion<RespuestaZonaContenedora>(
    conParametros("/modulos/zona-contenedora", { lat, lng }),
  );
}

/** Ficha completa de un módulo. */
export function obtenerModulo(id: string): Promise<ModuloDetalle> {
  return peticion<ModuloDetalle>(`/modulos/${id}`);
}

/** Historial de auditoría de un módulo. */
export function obtenerHistorialModulo(
  id: string,
  filtros: { pagina?: number; limite?: number } = {},
): Promise<ModuloHistorial> {
  return peticion<ModuloHistorial>(
    conParametros(`/modulos/${id}/historial`, {
      pagina: filtros.pagina,
      limite: filtros.limite,
    }),
  );
}

/** Censa un módulo con foto opcional. */
export function crearModulo(
  datos: SolicitudModulo,
  foto?: File | null,
): Promise<ModuloDetalle> {
  const formulario = new FormData();
  agregarCamposModulo(formulario, datos);
  if (foto) formulario.append("foto", foto);
  return peticion<ModuloDetalle>("/modulos", {
    method: "POST",
    formulario,
  });
}

/** Edita los campos enviados de un módulo, con foto opcional. */
export function actualizarModulo(
  id: string,
  datos: Partial<SolicitudModulo>,
  foto?: File | null,
): Promise<ModuloDetalle> {
  const formulario = new FormData();
  agregarCamposModulo(formulario, datos);
  if (foto) formulario.append("foto", foto);
  return peticion<ModuloDetalle>(`/modulos/${id}`, {
    method: "PATCH",
    formulario,
  });
}

/** Da de baja o reactiva un módulo (baja lógica). */
export function cambiarEstadoModulo(
  id: string,
  estado: "activo" | "baja",
): Promise<RespuestaEstadoModulo> {
  return peticion<RespuestaEstadoModulo>(`/modulos/${id}/estado`, {
    method: "PATCH",
    cuerpo: { estado },
  });
}

/* ------------------------------------------------------------------ */
/* Importación de zonas y módulos (HU-14)                              */
/* ------------------------------------------------------------------ */

/** Sistemas de referencia disponibles para el selector del GeoJSON. */
export function obtenerSridsImportacion(): Promise<SridsImportacion> {
  return peticion<SridsImportacion>("/importaciones/srids");
}

/** Sube un GeoJSON de zonas y obtiene la previsualización. */
export function previsualizarImportacionZonas(
  archivo: File,
  sridOrigen?: number,
): Promise<PrevisualizacionImportacion> {
  const formulario = new FormData();
  formulario.append("archivo", archivo);
  if (sridOrigen !== undefined) {
    formulario.append("sridOrigen", String(sridOrigen));
  }
  return peticion<PrevisualizacionImportacion>(
    "/importaciones/zonas/previsualizar",
    { method: "POST", formulario },
  );
}

/** Confirma la importación de las zonas válidas. */
export function confirmarImportacionZonas(
  token: string,
): Promise<ConfirmacionImportacion> {
  return peticion<ConfirmacionImportacion>(
    "/importaciones/zonas/confirmar",
    { method: "POST", cuerpo: { token } },
  );
}

/** Sube un CSV de módulos y obtiene la previsualización. */
export function previsualizarImportacionModulos(
  archivo: File,
): Promise<PrevisualizacionImportacion> {
  const formulario = new FormData();
  formulario.append("archivo", archivo);
  return peticion<PrevisualizacionImportacion>(
    "/importaciones/modulos/previsualizar",
    { method: "POST", formulario },
  );
}

/** Confirma la importación de los módulos válidos. */
export function confirmarImportacionModulos(
  token: string,
  aceptaAdvertencia: boolean,
): Promise<ConfirmacionImportacion> {
  return peticion<ConfirmacionImportacion>(
    "/importaciones/modulos/confirmar",
    { method: "POST", cuerpo: { token, aceptaAdvertencia } },
  );
}

/** Descarga el reporte CSV de errores de una importación confirmada. */
export function descargarReporteImportacion(
  token: string,
): Promise<RespuestaArchivo> {
  return peticionArchivo(`/importaciones/${token}/reporte`);
}

/* ------------------------------------------------------------------ */
/* Solicitudes de ubicación temporal (HU-16)                           */
/* ------------------------------------------------------------------ */

/** Lista las solicitudes radicadas del comerciante autenticado. */
export function listarMisSolicitudes(
  filtros: FiltrosSolicitudes = {},
): Promise<ListarSolicitudesResponse> {
  return peticion<ListarSolicitudesResponse>(
    conParametros("/solicitudes/mias", {
      estado: filtros.estado,
      pagina: filtros.pagina,
      limite: filtros.limite,
    }),
  );
}

/** Devuelve el detalle de una solicitud propia, con documentos e historial. */
export function obtenerMiSolicitud(
  id: string,
): Promise<SolicitudTemporalDetalle> {
  return peticion<SolicitudTemporalDetalle>(`/solicitudes/${id}`);
}

/** Requisitos documentales globales y los específicos de una actividad. */
export function obtenerRequisitosSolicitud(
  actividad?: string | null,
): Promise<RequisitosSolicitudResponse> {
  return peticion<RequisitosSolicitudResponse>(
    conParametros("/solicitudes/requisitos", { actividad }),
  );
}

/** Consulta la disponibilidad de un espacio para el rango solicitado. */
export function consultarDisponibilidadSolicitud(datos: {
  espacioId: string;
  fechaInicio: string;
  fechaFin: string;
  horaInicio: string;
  horaFin: string;
}): Promise<DisponibilidadSolicitud> {
  return peticion<DisponibilidadSolicitud>(
    conParametros("/solicitudes/disponibilidad", datos),
  );
}

/** Radica una solicitud completa con sus documentos en una sola petición. */
export function radicarSolicitud(
  datos: DatosRadicacionSolicitud,
  documentos: DocumentoAdjuntoRadicacion[] = [],
): Promise<RespuestaRadicacion> {
  const formulario = new FormData();
  formulario.append("datos", JSON.stringify(datos));
  formulario.append(
    "documentosMeta",
    JSON.stringify(
      documentos.map((documento) => ({
        requisitoId: documento.requisitoId,
        nombreOriginal: documento.archivo.name,
      })),
    ),
  );
  for (const documento of documentos) {
    formulario.append("documentos", documento.archivo, documento.archivo.name);
  }

  return peticion<RespuestaRadicacion>("/solicitudes", {
    method: "POST",
    formulario,
  });
}

/** Descarga un documento de una solicitud propia. */
export function descargarDocumentoSolicitud(
  solicitudId: string,
  documentoId: string,
): Promise<RespuestaArchivo> {
  return peticionArchivo(
    `/solicitudes/${solicitudId}/documentos/${documentoId}/archivo`,
    false,
    "application/pdf,image/jpeg,image/png,application/octet-stream",
  );
}

/** Lista los requisitos documentales de una solicitud con sus versiones. */
export function listarRequisitosSolicitud(
  solicitudId: string,
): Promise<RespuestaRequisitosSolicitud> {
  return peticion<RespuestaRequisitosSolicitud>(
    `/solicitudes/${solicitudId}/requisitos`,
  );
}

function errorDesdeXhr(xhr: XMLHttpRequest): ApiError {
  try {
    const cuerpo = JSON.parse(xhr.responseText) as CuerpoError;
    const mensajes = Array.isArray(cuerpo.message)
      ? cuerpo.message
      : [cuerpo.message];
    return new ApiError(xhr.status, mensajes.join("\n"), mensajes);
  } catch {
    return new ApiError(
      xhr.status,
      "Ocurrió un error inesperado. Intenta de nuevo.",
    );
  }
}

function subirDocumentoConProgreso(
  solicitudId: string,
  requisitoId: string,
  archivo: File,
  onProgress?: (progreso: ProgresoSubida) => void,
): Promise<RespuestaCargaDocumentoSolicitud> {
  return new Promise((resolver, rechazar) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${URL_BASE}/solicitudes/${solicitudId}/documentos`);
    const token = obtenerAccessToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Accept", "application/json");

    xhr.upload.onprogress = (evento) => {
      if (!evento.lengthComputable || !onProgress) return;
      const porcentaje = Math.min(
        100,
        Math.round((evento.loaded / evento.total) * 100),
      );
      onProgress({
        cargados: evento.loaded,
        total: evento.total,
        porcentaje,
      });
    };

    xhr.onerror = () => {
      rechazar(
        new ApiError(
          0,
          "No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.",
        ),
      );
    };
    xhr.onabort = () => {
      rechazar(new ApiError(0, "La carga del documento fue cancelada."));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolver(
            JSON.parse(
              xhr.responseText,
            ) as RespuestaCargaDocumentoSolicitud,
          );
        } catch {
          rechazar(
            new ApiError(
              xhr.status,
              "El servidor respondió con un formato inesperado.",
            ),
          );
        }
        return;
      }
      rechazar(errorDesdeXhr(xhr));
    };

    const formulario = new FormData();
    formulario.append("requisitoId", requisitoId);
    formulario.append("archivo", archivo, archivo.name);
    xhr.send(formulario);
  });
}

/**
 * Carga o reemplaza un documento con progreso real de subida.
 *
 * Si el token venció, renueva la sesión y reintenta una sola vez antes de
 * redirigir al login.
 */
export async function cargarDocumentoSolicitud(
  solicitudId: string,
  requisitoId: string,
  archivo: File,
  onProgress?: (progreso: ProgresoSubida) => void,
): Promise<RespuestaCargaDocumentoSolicitud> {
  try {
    return await subirDocumentoConProgreso(
      solicitudId,
      requisitoId,
      archivo,
      onProgress,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const token = await rotarSesion();
      if (token) {
        return subirDocumentoConProgreso(
          solicitudId,
          requisitoId,
          archivo,
          onProgress,
        );
      }
      limpiarSesion();
      redirigirALogin();
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Revisión documental del gestor (HU-19)                              */
/* ------------------------------------------------------------------ */

/** Lista la bandeja de revisión con filtros, orden y paginación. */
export function listarSolicitudesRevision(
  filtros: FiltrosRevisionSolicitudes = {},
): Promise<ListarSolicitudesRevisionResponse> {
  return peticion<ListarSolicitudesRevisionResponse>(
    conParametros("/gestor/solicitudes", {
      estado: filtros.estado,
      sector: filtros.sector,
      actividad: filtros.actividad,
      orden: filtros.orden,
      pagina: filtros.pagina,
      limite: filtros.limite,
    }),
  );
}

/** Opciones de sector y actividad para los filtros de la bandeja. */
export function obtenerOpcionesRevisionSolicitudes(): Promise<OpcionesRevisionSolicitudes> {
  return peticion<OpcionesRevisionSolicitudes>(
    "/gestor/solicitudes/opciones",
  );
}

/** Detalle de una solicitud para revisión, incluso en solo lectura. */
export function obtenerSolicitudRevision(
  id: string,
): Promise<SolicitudRevisionDetalle> {
  return peticion<SolicitudRevisionDetalle>(`/gestor/solicitudes/${id}`);
}

/** Toma (o renueva) el bloqueo de revisión del gestor autenticado. */
export function tomarRevisionSolicitud(
  id: string,
): Promise<RespuestaTomarRevision> {
  return peticion<RespuestaTomarRevision>(
    `/gestor/solicitudes/${id}/revision`,
    { method: "POST" },
  );
}

/** Renueva el bloqueo de revisión sin cambiar el estado de la solicitud. */
export function renovarRevisionSolicitud(
  id: string,
): Promise<RespuestaRenovarRevision> {
  return peticion<RespuestaRenovarRevision>(
    `/gestor/solicitudes/${id}/revision`,
    { method: "PATCH" },
  );
}

/** Libera el bloqueo de revisión del gestor autenticado. */
export function liberarRevisionSolicitud(
  id: string,
  token?: string,
): Promise<RespuestaLiberarRevision> {
  return peticion<RespuestaLiberarRevision>(
    conParametros(`/gestor/solicitudes/${id}/revision`, { token }),
    { method: "DELETE" },
  );
}

/** Marca un requisito como Cumple o No cumple. */
export function verificarRequisitoSolicitud(
  solicitudId: string,
  requisitoId: string,
  datos: { estado: "cumple" | "no_cumple"; observacion?: string },
): Promise<RespuestaVerificarRequisito> {
  return peticion<RespuestaVerificarRequisito>(
    `/gestor/solicitudes/${solicitudId}/requisitos/${requisitoId}/verificacion`,
    { method: "PATCH", cuerpo: datos },
  );
}

/** Devuelve la solicitud para corrección con una observación general. */
export function devolverSolicitudRevision(
  solicitudId: string,
  observacion: string,
): Promise<RespuestaCambioEstadoRevision> {
  return peticion<RespuestaCambioEstadoRevision>(
    `/gestor/solicitudes/${solicitudId}/estado`,
    {
      method: "PATCH",
      cuerpo: {
        estado: "devuelta",
        observacion,
      } satisfies SolicitudDevolucionRevision,
    },
  );
}

/** Aprueba o rechaza una solicitud revisada y asigna el espacio (HU-20). */
export function resolverSolicitudRevision(
  solicitudId: string,
  datos: DatosResolucionSolicitud,
): Promise<RespuestaResolucionSolicitud> {
  return peticion<RespuestaResolucionSolicitud>(
    `/gestor/solicitudes/${solicitudId}/resolucion`,
    { method: "PATCH", cuerpo: datos },
  );
}

/* ------------------------------------------------------------------ */
/* Ferias agroecológicas (HU-21)                                       */
/* ------------------------------------------------------------------ */

/** Zonas activas y catálogo de productos para el formulario de feria. */
export function obtenerOpcionesFeria(): Promise<OpcionesFeria> {
  return peticion<OpcionesFeria>("/ferias/zonas");
}

/** Agenda ocupada de una zona en un rango de fechas. */
export function obtenerAgendaFeria(
  zonaId: string,
  desde?: string,
  hasta?: string,
): Promise<AgendaFeria> {
  return peticion<AgendaFeria>(
    conParametros("/ferias/agenda", { zonaId, desde, hasta }),
  );
}

/** Disponibilidad de una zona para un rango y número de puestos. */
export function consultarDisponibilidadFeria(datos: {
  zonaId: string;
  fechaInicio: string;
  fechaFin: string;
  numeroPuestos?: number;
}): Promise<DisponibilidadFeria> {
  return peticion<DisponibilidadFeria>(
    conParametros("/ferias/disponibilidad", datos),
  );
}

/** Lista las ferias del organizador autenticado. */
export function listarMisFerias(
  filtros: FiltrosFerias = {},
): Promise<ListarFeriasResponse> {
  return peticion<ListarFeriasResponse>(
    conParametros("/ferias/mias", {
      estado: filtros.estado,
      pagina: filtros.pagina,
      limite: filtros.limite,
    }),
  );
}

/** Detalle de una feria propia con productos y adjuntos. */
export function obtenerMiFeria(id: string): Promise<FeriaDetalle> {
  return peticion<FeriaDetalle>(`/ferias/${id}`);
}

/** Sube la feria y sus adjuntos reportando el progreso real de la petición. */
function subirFeriaConProgreso(
  datos: DatosRadicacionFeria,
  adjuntos: File[],
  onProgress?: (progreso: ProgresoSubida) => void,
): Promise<RespuestaRadicacionFeria> {
  return new Promise((resolver, rechazar) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${URL_BASE}/ferias`);
    const token = obtenerAccessToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Accept", "application/json");

    xhr.upload.onprogress = (evento) => {
      if (!evento.lengthComputable || !onProgress) return;
      onProgress({
        cargados: evento.loaded,
        total: evento.total,
        porcentaje: Math.min(
          100,
          Math.round((evento.loaded / evento.total) * 100),
        ),
      });
    };

    xhr.onerror = () => {
      rechazar(
        new ApiError(
          0,
          "No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.",
        ),
      );
    };
    xhr.onabort = () => {
      rechazar(new ApiError(0, "La radicación de la feria fue cancelada."));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolver(JSON.parse(xhr.responseText) as RespuestaRadicacionFeria);
        } catch {
          rechazar(
            new ApiError(
              xhr.status,
              "El servidor respondió con un formato inesperado.",
            ),
          );
        }
        return;
      }
      rechazar(errorDesdeXhr(xhr));
    };

    const formulario = new FormData();
    formulario.append("datos", JSON.stringify(datos));
    for (const adjunto of adjuntos) {
      formulario.append("adjuntos", adjunto, adjunto.name);
    }
    xhr.send(formulario);
  });
}

/**
 * Radica una feria con sus adjuntos opcionales y progreso real de subida.
 *
 * Si la operación falla, el formulario conserva los datos y los archivos en
 * memoria para que el usuario pueda corregir y reintentar.
 */
export async function radicarFeria(
  datos: DatosRadicacionFeria,
  adjuntos: File[] = [],
  onProgress?: (progreso: ProgresoSubida) => void,
): Promise<RespuestaRadicacionFeria> {
  try {
    return await subirFeriaConProgreso(datos, adjuntos, onProgress);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const token = await rotarSesion();
      if (token) {
        return subirFeriaConProgreso(datos, adjuntos, onProgress);
      }
      limpiarSesion();
      redirigirALogin();
    }
    throw error;
  }
}

/** Descarga autenticada de un adjunto de la feria. */
export function descargarDocumentoFeria(
  feriaId: string,
  documentoId: string,
): Promise<RespuestaArchivo> {
  return peticionArchivo(
    `/ferias/${feriaId}/documentos/${documentoId}/archivo`,
    false,
    "application/pdf,image/jpeg,image/png,application/octet-stream",
  );
}
