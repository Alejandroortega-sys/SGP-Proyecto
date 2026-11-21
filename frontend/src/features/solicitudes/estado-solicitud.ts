import type { EstadoSolicitud } from "@/types/api";

export const ESTADOS_SOLICITUD: readonly EstadoSolicitud[] = [
  "borrador",
  "radicada",
  "en_revision",
  "devuelta",
  "aprobada",
  "rechazada",
  "cancelada",
];

export const ETIQUETAS_ESTADO_SOLICITUD: Record<EstadoSolicitud, string> = {
  borrador: "Borrador",
  radicada: "Radicada",
  en_revision: "En revisión",
  devuelta: "Requiere corrección",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  cancelada: "Cancelada",
};

export const DESCRIPCIONES_ESTADO_SOLICITUD: Record<EstadoSolicitud, string> = {
  borrador: "Aún no se ha radicado.",
  radicada: "Radicada y pendiente de revisión por el gestor.",
  en_revision: "El gestor está revisando la documentación.",
  devuelta: "El gestor solicitó correcciones.",
  aprobada: "La solicitud fue aprobada.",
  rechazada: "La solicitud fue rechazada.",
  cancelada: "La solicitud fue cancelada.",
};

export type TonoEstadoSolicitud = "exitoso" | "pendiente" | "peligro" | "neutro" | "info";

export const TONOS_ESTADO_SOLICITUD: Record<EstadoSolicitud, TonoEstadoSolicitud> = {
  borrador: "neutro",
  radicada: "info",
  en_revision: "pendiente",
  devuelta: "pendiente",
  aprobada: "exitoso",
  rechazada: "peligro",
  cancelada: "neutro",
};

/** Indica si el valor es un estado de solicitud válido. */
export function esEstadoSolicitud(valor: unknown): valor is EstadoSolicitud {
  return (
    typeof valor === "string" &&
    (ESTADOS_SOLICITUD as readonly string[]).includes(valor)
  );
}

/** Indica si el estado ya no admite cambios. */
export function estadoEsFinal(estado: EstadoSolicitud): boolean {
  return estado === "aprobada" || estado === "rechazada" || estado === "cancelada";
}
