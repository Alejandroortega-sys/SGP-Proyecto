/**
 * Simplificación de las geometrías de zonas según el nivel de zoom del mapa.
 *
 * El mapa público pide `GET /zonas/geojson?zoom=N`. Cuanto menor es el zoom,
 * menos píxeles ocupa cada zona y más se puede simplificar el polígono sin que
 * el usuario note la diferencia. La tolerancia se expresa en grados (SRID
 * 4326); 1 grado de latitud equivale aproximadamente a 111 km.
 *
 * Las tolerancias son deliberadamente conservadoras: las zonas del seed miden
 * cientos de metros y una simplificación agresiva las deformaría o las dejaría
 * vacías. Para zoom 16 o superior se devuelve la geometría completa y solo se
 * reducen los decimales del GeoJSON.
 */

/** Opciones de conversión de una geometría a GeoJSON. */
export interface OpcionesGeometriaZoom {
  /** Tolerancia de `ST_SimplifyPreserveTopology`; `null` no simplifica. */
  tolerancia: number | null;
  /** Decimales máximos que conserva `ST_AsGeoJSON`. */
  decimales: number;
}

/** Zoom mínimo aceptado por la API (igual que el de Leaflet). */
export const ZOOM_MINIMO = 0;

/** Zoom máximo aceptado por la API (igual que el de Leaflet). */
export const ZOOM_MAXIMO = 22;

/**
 * Devuelve la tolerancia y los decimales que corresponden a un nivel de zoom.
 *
 * Sin `zoom` se conserva el comportamiento histórico: geometría completa y
 * nueve decimales (el valor por defecto de `ST_AsGeoJSON`).
 */
export function opcionesGeometriaZoom(zoom?: number | null): OpcionesGeometriaZoom {
  if (zoom === undefined || zoom === null) {
    return { tolerancia: null, decimales: 9 };
  }

  if (zoom <= 11) {
    return { tolerancia: 0.0005, decimales: 4 };
  }
  if (zoom <= 13) {
    return { tolerancia: 0.0002, decimales: 4 };
  }
  if (zoom <= 15) {
    return { tolerancia: 0.00005, decimales: 5 };
  }
  if (zoom <= 17) {
    return { tolerancia: null, decimales: 6 };
  }
  return { tolerancia: null, decimales: 7 };
}
