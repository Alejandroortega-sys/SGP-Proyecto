import type {
  HorariosZona,
  TipoZona,
  ZonaGeoJsonProperties,
} from "@/types/api";

/** Centro aproximado del casco urbano de Tuluá (WGS84). */
export const CENTRO_TULUA = { lat: 4.0847, lng: -76.1954 } as const;

/** Radio que se considera «dentro de Tuluá» para el aviso de geolocalización. */
export const RADIO_TULUA_KM = 15;

export const TIPOS_ZONA: readonly TipoZona[] = [
  "permitida",
  "restringida",
  "alta_congestion",
];

export const ETIQUETAS_TIPO: Record<TipoZona, string> = {
  permitida: "Permitida",
  restringida: "Restringida",
  alta_congestion: "Alta congestión",
};

export const DESCRIPCIONES_TIPO: Record<TipoZona, string> = {
  permitida: "Se permite la actividad comercial en el horario indicado.",
  restringida: "La actividad está limitada por horario, productos o aforo.",
  alta_congestion: "Zona saturada: se recomienda evitar nuevas instalaciones.",
};

/** Estilo visual de un polígono en Leaflet. */
export interface EstiloZona {
  color: string;
  fillColor: string;
  weight: number;
  fillOpacity: number;
  /** Patrón de línea; complementa el color para no depender solo de él. */
  dashArray?: string;
}

const ESTILOS: Record<TipoZona, EstiloZona> = {
  permitida: {
    color: "#0d5f3a",
    fillColor: "#0d5f3a",
    weight: 2,
    fillOpacity: 0.18,
  },
  restringida: {
    color: "#d97706",
    fillColor: "#d97706",
    weight: 2,
    fillOpacity: 0.22,
    dashArray: "8 6",
  },
  alta_congestion: {
    color: "#b91c1c",
    fillColor: "#b91c1c",
    weight: 2,
    fillOpacity: 0.24,
    dashArray: "2 5",
  },
};

/** Devuelve el estilo del tipo de zona; ante un valor desconocido usa restringida. */
export function estiloZona(tipo: TipoZona): EstiloZona {
  return ESTILOS[tipo] ?? ESTILOS.restringida;
}

/** Comprueba si un valor desconocido es un tipo de zona válido. */
export function esTipoZona(valor: unknown): valor is TipoZona {
  return (
    typeof valor === "string" &&
    (TIPOS_ZONA as readonly string[]).includes(valor)
  );
}

/** Texto legible del horario de una zona. */
export function formatearHorario(horarios: HorariosZona): string {
  if (horarios.inicio && horarios.fin) {
    return `${horarios.inicio} a ${horarios.fin}`;
  }
  if (horarios.inicio) return `Desde ${horarios.inicio}`;
  if (horarios.fin) return `Hasta ${horarios.fin}`;
  return "Sin horario definido";
}

/** Texto legible del aforo de una zona. */
export function formatearAforo(aforo: number | null): string {
  if (aforo === null || aforo === undefined) return "Sin aforo definido";
  return `${aforo} ${aforo === 1 ? "persona" : "personas"}`;
}

/** Texto legible de los productos permitidos. */
export function formatearProductos(productos: string[]): string {
  if (productos.length === 0) return "Sin productos restringidos";
  return productos.join(", ");
}

/** Detalle listo para pintar en el popup de una zona. */
export interface DetalleZona {
  tipo: string;
  horario: string;
  aforo: string;
  productos: string;
}

export function construirDetalleZona(
  zona: ZonaGeoJsonProperties,
): DetalleZona {
  return {
    tipo: ETIQUETAS_TIPO[zona.tipo] ?? zona.tipo,
    horario: formatearHorario(zona.horarios),
    aforo: formatearAforo(zona.aforo),
    productos: formatearProductos(zona.productos),
  };
}

/** Distancia en kilómetros entre dos coordenadas (fórmula de Haversine). */
export function distanciaKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const radioTierraKm = 6371;
  const aRadianes = (grados: number) => (grados * Math.PI) / 180;

  const dLat = aRadianes(lat2 - lat1);
  const dLng = aRadianes(lng2 - lng1);
  const senoLat = Math.sin(dLat / 2);
  const senoLng = Math.sin(dLng / 2);

  const a =
    senoLat * senoLat +
    Math.cos(aRadianes(lat1)) *
      Math.cos(aRadianes(lat2)) *
      senoLng *
      senoLng;

  return 2 * radioTierraKm * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Indica si una coordenada cae dentro del radio considerado de Tuluá. */
export function estaEnTulua(lat: number, lng: number): boolean {
  return (
    distanciaKm(CENTRO_TULUA.lat, CENTRO_TULUA.lng, lat, lng) <=
    RADIO_TULUA_KM
  );
}
