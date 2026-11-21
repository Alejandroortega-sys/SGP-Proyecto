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
  faltante: "border-rose-200 bg-rose-50 text-rose-700",
  cargado: "border-sky-200 bg-sky-50 text-sky-800",
  cumple: "border-emerald-200 bg-emerald-50 text-emerald-800",
  no_cumple: "border-amber-200 bg-amber-50 text-amber-800",
};
