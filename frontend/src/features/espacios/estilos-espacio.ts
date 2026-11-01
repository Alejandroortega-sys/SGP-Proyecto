import type {
  EstadoEspacio,
  HorarioEspacio,
  TipoEspacio,
} from "@/types/api";

export const ESTADOS_ESPACIO: readonly EstadoEspacio[] = [
  "disponible",
  "bloqueado",
  "asignado",
  "mantenimiento",
];

export const ETIQUETAS_ESTADO_ESPACIO: Record<EstadoEspacio, string> = {
  disponible: "Disponible",
  bloqueado: "Bloqueado",
  asignado: "Ocupado",
  mantenimiento: "En mantenimiento",
};

export const DESCRIPCIONES_ESTADO_ESPACIO: Record<EstadoEspacio, string> = {
  disponible: "Se puede solicitar en las fechas consultadas.",
  bloqueado: "Tiene un bloqueo de fechas o está retirado temporalmente.",
  asignado: "Ya tiene un permiso o una solicitud aprobada.",
  mantenimiento: "Está fuera de servicio por mantenimiento.",
};

export type TonoEstadoEspacio = "exitoso" | "peligro" | "info" | "neutro";

export const TONOS_ESTADO_ESPACIO: Record<EstadoEspacio, TonoEstadoEspacio> = {
  disponible: "exitoso",
  bloqueado: "peligro",
  asignado: "info",
  mantenimiento: "neutro",
};

/** Colores de los marcadores y de la leyenda. */
export const COLORES_ESTADO_ESPACIO: Record<EstadoEspacio, string> = {
  disponible: "#0d5f3a",
  bloqueado: "#b91c1c",
  asignado: "#1d4ed8",
  mantenimiento: "#64748b",
};

/** Símbolos que complementan el color para no depender solo de él. */
export const SIMBOLOS_ESTADO_ESPACIO: Record<EstadoEspacio, string> = {
  disponible: "✓",
  bloqueado: "!",
  asignado: "•",
  mantenimiento: "⚙",
};

export const ETIQUETAS_TIPO_ESPACIO: Record<TipoEspacio, string> = {
  modulo: "Módulo",
  kiosco: "Kiosco",
  puesto: "Puesto",
  espacio_movil: "Espacio móvil",
};

/** Comprueba si un valor desconocido es un estado de espacio válido. */
export function esEstadoEspacio(valor: unknown): valor is EstadoEspacio {
  return (
    typeof valor === "string" &&
    (ESTADOS_ESPACIO as readonly string[]).includes(valor)
  );
}

/** Texto legible del horario propio del espacio. */
export function formatearHorarioEspacio(horario: HorarioEspacio): string {
  if (horario.inicio && horario.fin) {
    return `${horario.inicio} a ${horario.fin}`;
  }
  if (horario.inicio) return `Desde ${horario.inicio}`;
  if (horario.fin) return `Hasta ${horario.fin}`;
  return "Sin horario definido";
}

/** Texto legible de las dimensiones registradas. */
export function formatearDimensiones(dimensiones: string | null): string {
  return dimensiones?.trim() ? dimensiones : "Sin dimensiones registradas";
}

/** Etiqueta legible de un tipo de espacio. */
export function formatearTipoEspacio(tipo: TipoEspacio | string): string {
  return ETIQUETAS_TIPO_ESPACIO[tipo as TipoEspacio] ?? tipo;
}

/** Etiqueta legible de un estado de espacio. */
export function formatearEstadoEspacio(estado: EstadoEspacio | string): string {
  return ETIQUETAS_ESTADO_ESPACIO[estado as EstadoEspacio] ?? estado;
}

/** Convierte una fecha ISO `YYYY-MM-DD` a `DD/MM/YYYY`. */
export function formatearFechaCorta(fecha: string | null | undefined): string {
  if (!fecha) return "—";
  const partes = fecha.slice(0, 10).split("-");
  if (partes.length !== 3) return fecha;
  const [anio, mes, dia] = partes;
  return `${dia}/${mes}/${anio}`;
}

/** Texto legible de un rango de fechas. */
export function formatearRangoFechas(
  inicio: string | null,
  fin: string | null,
): string {
  if (!inicio && !fin) return "Sin fechas registradas";
  if (inicio && fin) {
    return `del ${formatearFechaCorta(inicio)} al ${formatearFechaCorta(fin)}`;
  }
  return inicio
    ? `desde el ${formatearFechaCorta(inicio)}`
    : `hasta el ${formatearFechaCorta(fin)}`;
}

/** Texto de los productos permitidos por la zona. */
export function formatearProductos(productos: string[]): string {
  if (productos.length === 0) return "Sin productos restringidos";
  return productos.join(", ");
}
