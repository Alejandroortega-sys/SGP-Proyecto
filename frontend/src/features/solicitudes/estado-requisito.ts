import type { EstadoRequisitoDocumental } from "@/types/api";

export const ETIQUETAS_ESTADO_REQUISITO: Record<
  EstadoRequisitoDocumental,
  string
> = {
  faltante: "Faltante",
  cargado: "Cargado",
  cumple: "Cumple",
  no_cumple: "No cumple",
};

export const DESCRIPCIONES_ESTADO_REQUISITO: Record<
  EstadoRequisitoDocumental,
  string
> = {
  faltante: "Todavía no has adjuntado este documento.",
  cargado: "El documento está cargado y pendiente de revisión.",
  cumple: "El gestor verificó que el documento cumple.",
  no_cumple: "El gestor encontró un problema en este documento.",
};

export const CLASES_ESTADO_REQUISITO: Record<
  EstadoRequisitoDocumental,
  string
> = {
  faltante: "border-peligro-borde bg-peligro-suave text-peligro-texto",
  cargado: "border-info-borde bg-info-suave text-info-texto",
  cumple: "border-exito-borde bg-exito-suave text-exito-texto",
  no_cumple: "border-advertencia-borde bg-advertencia-suave text-advertencia-texto",
};
