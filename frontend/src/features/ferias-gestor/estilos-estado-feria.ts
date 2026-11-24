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
    chip: "border-info-borde bg-info-suave text-info-texto",
    punto: "bg-info",
    simbolo: "◷",
    etiqueta: "Radicada",
  },
  aprobada: {
    chip: "border-exito-borde bg-exito-suave text-exito-texto",
    punto: "bg-exito",
    simbolo: "✓",
    etiqueta: "Aprobada",
  },
  rechazada: {
    chip: "border-peligro-borde bg-peligro-suave text-peligro-texto",
    punto: "bg-peligro",
    simbolo: "✕",
    etiqueta: "Rechazada",
  },
  cancelada: {
    chip: "border-borde-fuerte bg-interaccion text-titulo",
    punto: "bg-tenue",
    simbolo: "—",
    etiqueta: "Cancelada",
  },
  realizada: {
    chip: "border-realizada-borde bg-realizada-suave text-realizada-texto",
    punto: "bg-realizada",
    simbolo: "★",
    etiqueta: "Realizada",
  },
};

export function estiloEstado(estado: EstadoFeria): EstiloEstadoFeria {
  return ESTILOS_ESTADO_FERIA[estado] ?? ESTILOS_ESTADO_FERIA.radicada;
}
