import type { EstadoFeria } from "@/types/api";

export interface EstiloEstadoFeria {
  chip: string;
  punto: string;
  simbolo: string;
  etiqueta: string;
}

/** Colores, símbolos y etiquetas accesibles para el calendario. */
export const ESTILOS_ESTADO_FERIA: Record<EstadoFeria, EstiloEstadoFeria> = {
  radicada: {
    chip: "border-sky-300 bg-sky-50 text-sky-900",
    punto: "bg-sky-500",
    simbolo: "◷",
    etiqueta: "Radicada",
  },
  aprobada: {
    chip: "border-emerald-300 bg-emerald-50 text-emerald-900",
    punto: "bg-emerald-500",
    simbolo: "✓",
    etiqueta: "Aprobada",
  },
  rechazada: {
    chip: "border-rose-300 bg-rose-50 text-rose-900",
    punto: "bg-rose-500",
    simbolo: "✕",
    etiqueta: "Rechazada",
  },
  cancelada: {
    chip: "border-slate-300 bg-slate-100 text-slate-800",
    punto: "bg-slate-500",
    simbolo: "—",
    etiqueta: "Cancelada",
  },
  realizada: {
    chip: "border-violet-300 bg-violet-50 text-violet-900",
    punto: "bg-violet-500",
    simbolo: "★",
    etiqueta: "Realizada",
  },
};

export function estiloEstado(estado: EstadoFeria): EstiloEstadoFeria {
  return ESTILOS_ESTADO_FERIA[estado] ?? ESTILOS_ESTADO_FERIA.radicada;
}
