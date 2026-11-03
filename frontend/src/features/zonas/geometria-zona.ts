import type {
  GeometriaPoligono,
  TipoZona,
  ZonaFeature,
} from "@/types/api";

/** Posición GeoJSON 2D: `[longitud, latitud]`. */
export type Punto = readonly [number, number];

/** Anillo de un polígono, sin el punto de cierre duplicado. */
export type Anillo = Punto[];

/** Zona activa que se usa como contexto del editor. */
export interface PoligonoZona {
  id: string;
  nombre: string;
  tipo: TipoZona;
  anillos: Anillo[];
}

/** Zona existente con la que se solapa el dibujo actual. */
export interface ConflictoSolape {
  zonaId: string;
  zonaNombre: string;
}

/** Resultado de validar la topología de un polígono. */
export interface ResultadoGeometria {
  valido: boolean;
  errores: string[];
  conflicto: ConflictoSolape | null;
}

/** tolerancia para comparar coordenadas (grados). */
const EPSILON = 1e-9;
/** tolerancia para el área de un polígono (grados²). */
const EPSILON_AREA = 1e-14;
/** tolerancia para el producto cruzado en orientaciones. */
const EPSILON_ORIENTACION = 1e-12;

/** Indica si dos coordenadas son el mismo punto. */
export function mismoPunto(a: Punto, b: Punto): boolean {
  return Math.abs(a[0] - b[0]) <= EPSILON && Math.abs(a[1] - b[1]) <= EPSILON;
}

/**
 * Normaliza los vértices de un anillo: quita el punto de cierre si el último
 * coincide con el primero. Devuelve una copia.
 */
export function normalizarPuntos(puntos: readonly Punto[]): Anillo {
  const copia = puntos.map(([lng, lat]) => [lng, lat] as Punto);
  if (copia.length > 1 && mismoPunto(copia[0], copia[copia.length - 1])) {
    copia.pop();
  }
  return copia;
}

/** Añade el primer vértice al final para cerrar el anillo GeoJSON. */
export function cerrarAnillo(puntos: readonly Punto[]): Anillo {
  const normalizados = normalizarPuntos(puntos);
  if (normalizados.length === 0) return [];
  return [...normalizados, normalizados[0]];
}

/** Convierte los vértices del editor a un `Polygon` GeoJSON. */
export function aGeoJsonPoligono(
  puntos: readonly Punto[],
): GeometriaPoligono {
  return {
    type: "Polygon",
    coordinates: [
      cerrarAnillo(puntos).map(([lng, lat]) => [lng, lat] as number[]),
    ],
  };
}

/** Extrae el anillo exterior de un `Polygon` GeoJSON. */
export function desdeGeoJsonPoligono(
  geometria: GeometriaPoligono,
): Anillo {
  const anillo = geometria.coordinates[0] ?? [];
  return normalizarPuntos(
    anillo.map(([lng, lat]) => [lng, lat] as Punto),
  );
}

/**
 * Convierte los features activos del GeoJSON público a polígonos de contexto,
 * excluyendo la zona que se está editando.
 */
export function poligonosDesdeZonas(
  features: readonly ZonaFeature[],
  idExcluido?: string,
): PoligonoZona[] {
  return features
    .filter((feature) => feature.properties.id !== idExcluido)
    .map((feature) => ({
      id: feature.properties.id,
      nombre: feature.properties.nombre,
      tipo: feature.properties.tipo,
      anillos: feature.geometry.coordinates
        .map((anillo) =>
          normalizarPuntos(
            anillo.map(([lng, lat]) => [lng, lat] as Punto),
          ),
        )
        .filter((anillo) => anillo.length >= 3),
    }))
    .filter((zona) => zona.anillos.length > 0);
}

/** Área absoluta de un polígono (fórmula del material). */
export function areaPoligono(puntos: readonly Punto[]): number {
  const anillo = normalizarPuntos(puntos);
  if (anillo.length < 3) return 0;

  let suma = 0;
  for (let i = 0; i < anillo.length; i += 1) {
    const [x1, y1] = anillo[i];
    const [x2, y2] = anillo[(i + 1) % anillo.length];
    suma += x1 * y2 - x2 * y1;
  }
  return Math.abs(suma) / 2;
}

/**
 * Área aproximada en metros cuadrados. Proyecta cada grado a metros usando la
 * latitud media del polígono; es suficiente para mostrar el tamaño de una zona
 * urbana y no sustituye el cálculo oficial de PostGIS.
 */
export function areaAproximadaM2(puntos: readonly Punto[]): number {
  const anillo = normalizarPuntos(puntos);
  if (anillo.length < 3) return 0;

  const latitudMedia =
    anillo.reduce((suma, [, lat]) => suma + lat, 0) / anillo.length;
  const metrosLatitud = 110_574;
  const metrosLongitud =
    111_320 * Math.cos((latitudMedia * Math.PI) / 180);

  let suma = 0;
  for (let i = 0; i < anillo.length; i += 1) {
    const [lng1, lat1] = anillo[i];
    const [lng2, lat2] = anillo[(i + 1) % anillo.length];
    const x1 = lng1 * metrosLongitud;
    const y1 = lat1 * metrosLatitud;
    const x2 = lng2 * metrosLongitud;
    const y2 = lat2 * metrosLatitud;
    suma += x1 * y2 - x2 * y1;
  }
  return Math.abs(suma) / 2;
}

function orientacion(a: Punto, b: Punto, c: Punto): number {
  return (
    (b[0] - a[0]) * (c[1] - a[1]) -
    (b[1] - a[1]) * (c[0] - a[0])
  );
}

/** Indica si `p` está sobre el segmento `a-b`, incluidos los extremos. */
function puntoEnSegmento(p: Punto, a: Punto, b: Punto): boolean {
  if (Math.abs(orientacion(a, b, p)) > EPSILON_ORIENTACION) {
    return false;
  }
  return (
    p[0] >= Math.min(a[0], b[0]) - EPSILON &&
    p[0] <= Math.max(a[0], b[0]) + EPSILON &&
    p[1] >= Math.min(a[1], b[1]) - EPSILON &&
    p[1] <= Math.max(a[1], b[1]) + EPSILON
  );
}

function puntoMedio(a: Punto, b: Punto): Punto {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/** Cruce propio de dos segmentos (sin contar toques en extremos). */
function interseccionPropia(
  a: Punto,
  b: Punto,
  c: Punto,
  d: Punto,
): boolean {
  const o1 = orientacion(a, b, c);
  const o2 = orientacion(a, b, d);
  const o3 = orientacion(c, d, a);
  const o4 = orientacion(c, d, b);

  return (
    ((o1 > EPSILON_ORIENTACION && o2 < -EPSILON_ORIENTACION) ||
      (o1 < -EPSILON_ORIENTACION && o2 > EPSILON_ORIENTACION)) &&
    ((o3 > EPSILON_ORIENTACION && o4 < -EPSILON_ORIENTACION) ||
      (o3 < -EPSILON_ORIENTACION && o4 > EPSILON_ORIENTACION))
  );
}

/**
 * Comprueba si dos segmentos se tocan o se cruzan. Se usa para detectar
 * autointersecciones: un vértice que toca otro lado también invalida el anillo.
 */
function segmentosSeCruzanParaAuto(
  a: Punto,
  b: Punto,
  c: Punto,
  d: Punto,
): boolean {
  if (interseccionPropia(a, b, c, d)) return true;
  return (
    puntoEnSegmento(c, a, b) ||
    puntoEnSegmento(d, a, b) ||
    puntoEnSegmento(a, c, d) ||
    puntoEnSegmento(b, c, d)
  );
}

/** Indica si el anillo se cruza a sí mismo o tiene vértices repetidos. */
export function esAutointersectado(puntos: readonly Punto[]): boolean {
  const anillo = normalizarPuntos(puntos);
  if (anillo.length < 4) return false;

  // Un vértice repetido (no consecutivo) genera un anillo inválido.
  for (let i = 0; i < anillo.length; i += 1) {
    for (let j = i + 1; j < anillo.length; j += 1) {
      if (mismoPunto(anillo[i], anillo[j])) return true;
    }
  }

  const total = anillo.length;
  for (let i = 0; i < total; i += 1) {
    const a = anillo[i];
    const b = anillo[(i + 1) % total];

    for (let j = i + 1; j < total; j += 1) {
      if (j === i + 1 || (i === 0 && j === total - 1)) continue;

      const c = anillo[j];
      const d = anillo[(j + 1) % total];
      if (segmentosSeCruzanParaAuto(a, b, c, d)) return true;
    }
  }

  return false;
}

/**
 * Determina si un punto está dentro, fuera o sobre el borde de un anillo.
 * Se usa para detectar contención entre zonas.
 */
export function puntoEnPoligono(
  punto: Punto,
  anillo: readonly Punto[],
): "dentro" | "fuera" | "borde" {
  const poligono = normalizarPuntos(anillo);
  if (poligono.length < 3) return "fuera";

  for (let i = 0; i < poligono.length; i += 1) {
    const a = poligono[i];
    const b = poligono[(i + 1) % poligono.length];
    if (puntoEnSegmento(punto, a, b)) return "borde";
  }

  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i, i += 1) {
    const [xi, yi] = poligono[i];
    const [xj, yj] = poligono[j];
    const cruza =
      yi > punto[1] !== yj > punto[1] &&
      punto[0] < ((xj - xi) * (punto[1] - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }

  return dentro ? "dentro" : "fuera";
}

/**
 * Detecta si dos polígonos simples comparten área. Los bordes compartidos no
 * cuentan como solape, igual que `ST_Relate(..., '2********')` en PostGIS.
 */
export function poligonosSeSolapan(
  primero: readonly Punto[],
  segundo: readonly Punto[],
): boolean {
  const a = normalizarPuntos(primero);
  const b = normalizarPuntos(segundo);
  if (a.length < 3 || b.length < 3) return false;

  // 1) Cruces propios de aristas.
  for (let i = 0; i < a.length; i += 1) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j += 1) {
      const b1 = b[j];
      const b2 = b[(j + 1) % b.length];
      if (interseccionPropia(a1, a2, b1, b2)) return true;
    }
  }

  // 2) Un vértice estrictamente dentro del otro polígono (contención).
  if (a.some((punto) => puntoEnPoligono(punto, b) === "dentro")) {
    return true;
  }
  if (b.some((punto) => puntoEnPoligono(punto, a) === "dentro")) {
    return true;
  }

  // 3) El punto medio de una arista dentro del otro polígono. Cubre solapes
  //    parciales en los que los bordes se tocan sin un cruce propio.
  for (let i = 0; i < a.length; i += 1) {
    const medio = puntoMedio(a[i], a[(i + 1) % a.length]);
    if (puntoEnPoligono(medio, b) === "dentro") return true;
  }
  for (let i = 0; i < b.length; i += 1) {
    const medio = puntoMedio(b[i], b[(i + 1) % b.length]);
    if (puntoEnPoligono(medio, a) === "dentro") return true;
  }

  return false;
}

/** Busca la primera zona activa con la que se solapa el dibujo. */
export function buscarSolape(
  puntos: readonly Punto[],
  zonas: readonly PoligonoZona[],
): ConflictoSolape | null {
  for (const zona of zonas) {
    const anillo = zona.anillos[0];
    if (anillo && poligonosSeSolapan(puntos, anillo)) {
      return { zonaId: zona.id, zonaNombre: zona.nombre };
    }
  }
  return null;
}

/**
 * Valida la geometría dibujada: mínimo de vértices, área, autointersección y
 * solape con zonas activas.
 */
export function validarGeometriaZona(
  puntos: readonly Punto[],
  zonas: readonly PoligonoZona[],
  idExcluido?: string,
): ResultadoGeometria {
  const anillo = normalizarPuntos(puntos);
  const errores: string[] = [];

  if (anillo.length < 3) {
    errores.push("Dibuja al menos tres vértices para formar un polígono.");
  } else if (esAutointersectado(anillo)) {
    errores.push("El polígono se cruza a sí mismo. Corrige los vértices marcados.");
  } else if (areaPoligono(anillo) <= EPSILON_AREA) {
    errores.push("El polígono no encierra un área válida.");
  }

  let conflicto: ConflictoSolape | null = null;
  if (errores.length === 0) {
    const zonasComparar = idExcluido
      ? zonas.filter((zona) => zona.id !== idExcluido)
      : zonas;
    conflicto = buscarSolape(anillo, zonasComparar);
    if (conflicto) {
      errores.push(
        `La zona se solapa con «${conflicto.zonaNombre}». Las geometrías no pueden superponerse.`,
      );
    }
  }

  return {
    valido: errores.length === 0,
    errores,
    conflicto,
  };
}

/** Compara dos polígonos sin depender del cierre ni de la orientación exacta. */
export function poligonosIguales(
  puntos: readonly Punto[],
  geometria: GeometriaPoligono,
): boolean {
  const actuales = normalizarPuntos(puntos);
  const originales = desdeGeoJsonPoligono(geometria);
  if (actuales.length !== originales.length) return false;

  return actuales.every((punto, indice) => mismoPunto(punto, originales[indice]));
}
