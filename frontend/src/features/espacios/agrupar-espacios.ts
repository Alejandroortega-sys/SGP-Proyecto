import type { EstadoEspacio } from "@/types/api";
import { ESTADOS_ESPACIO } from "./estilos-espacio";

/** Punto mínimo que necesita el agrupador. */
export interface PuntoEspacio {
  id: string;
  lat: number;
  lng: number;
  estado: EstadoEspacio;
  disponible: boolean;
}

/** Grupo de marcadores que se dibuja como un solo elemento. */
export interface GrupoEspacios {
  id: string;
  lat: number;
  lng: number;
  espacios: PuntoEspacio[];
  estados: Record<EstadoEspacio, number>;
}

/** Tamaño de la celda de agrupación en píxeles. */
export const TAMANO_CELDA_PX = 64;

/**
 * Proyecta una coordenada WGS84 a píxeles Web Mercator para un zoom dado.
 *
 * Se implementa aquí (en vez de depender de `map.project`) para que la
 * agrupación sea una función pura y se pueda probar sin un mapa real.
 */
export function proyectarMercator(
  lat: number,
  lng: number,
  zoom: number,
): { x: number; y: number } {
  const escala = 256 * 2 ** zoom;
  const x = ((lng + 180) / 360) * escala;
  const seno = Math.sin((lat * Math.PI) / 180);
  const y =
    (0.5 - Math.log((1 + seno) / (1 - seno)) / (4 * Math.PI)) * escala;
  return { x, y };
}

function conteoVacio(): Record<EstadoEspacio, number> {
  return ESTADOS_ESPACIO.reduce(
    (conteo, estado) => ({ ...conteo, [estado]: 0 }),
    {} as Record<EstadoEspacio, number>,
  );
}

/**
 * Agrupa los espacios en celdas de `tamanoCelda` píxeles según el zoom.
 *
 * Cuanto menor es el zoom, más puntos caen en la misma celda y más se agrupan.
 * Al acercar, la celda representa menos metros y los marcadores se separan.
 */
export function agruparEspacios(
  espacios: readonly PuntoEspacio[],
  zoom: number,
  tamanoCelda: number = TAMANO_CELDA_PX,
): GrupoEspacios[] {
  const celdas = new Map<string, PuntoEspacio[]>();

  for (const espacio of espacios) {
    if (
      !Number.isFinite(espacio.lat) ||
      !Number.isFinite(espacio.lng) ||
      !Number.isFinite(zoom)
    ) {
      continue;
    }
    const { x, y } = proyectarMercator(espacio.lat, espacio.lng, zoom);
    const clave = `${Math.floor(x / tamanoCelda)}:${Math.floor(y / tamanoCelda)}`;
    const actuales = celdas.get(clave);
    if (actuales) {
      actuales.push(espacio);
    } else {
      celdas.set(clave, [espacio]);
    }
  }

  return [...celdas.entries()]
    .map(([clave, puntos]) => {
      const lat =
        puntos.reduce((suma, punto) => suma + punto.lat, 0) / puntos.length;
      const lng =
        puntos.reduce((suma, punto) => suma + punto.lng, 0) / puntos.length;
      const estados = conteoVacio();
      for (const punto of puntos) {
        estados[punto.estado] += 1;
      }
      return {
        id: puntos.length === 1 ? `e:${puntos[0].id}` : `g:${zoom}:${clave}`,
        lat,
        lng,
        espacios: [...puntos].sort((a, b) => a.id.localeCompare(b.id, "es")),
        estados,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id, "es"));
}
