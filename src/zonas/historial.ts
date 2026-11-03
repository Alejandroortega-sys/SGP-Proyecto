import type { GeoJsonPolygon } from '../common/geo';
import type { tipo_zona } from '../generated/prisma/client';

/** Acciones que puede representar una versión de zona. */
export const ACCIONES_VERSION_ZONA = [
  'creacion',
  'edicion',
  'activacion',
  'desactivacion',
] as const;

/** Acción registrada en una versión de zona. */
export type AccionVersionZona = (typeof ACCIONES_VERSION_ZONA)[number];

/** Producto permitido tal como se congela en una versión. */
export interface ProductoVersionZona {
  id: string;
  nombre: string;
  activo: boolean;
}

/** Resumen geométrico calculado por PostGIS. */
export interface ResumenGeometriaZona {
  vertices: number;
  areaM2: number | null;
}

/** Snapshot completo del estado de una zona en una versión. */
export interface SnapshotZona {
  version: number;
  accion: AccionVersionZona;
  nombre: string;
  tipo: tipo_zona;
  horarioInicio: string | null;
  horarioFin: string | null;
  aforoMaximo: number | null;
  activa: boolean;
  geometria: GeoJsonPolygon;
  productosPermitidos: ProductoVersionZona[];
  resumenGeometria: ResumenGeometriaZona;
}

/** Cambio legible entre dos versiones consecutivas. */
export interface CambioZona {
  campo: string;
  etiqueta: string;
  anterior: unknown;
  nuevo: unknown;
}

/** Etiquetas en español de los campos versionados. */
export const ETIQUETAS_CAMPO_ZONA: Record<string, string> = {
  nombre: 'Nombre',
  tipo: 'Tipo de zona',
  horario: 'Horario',
  aforoMaximo: 'Aforo máximo',
  geometria: 'Geometría',
  productosPermitidos: 'Productos permitidos',
  activa: 'Estado',
};

const EPSILON_COORDENADA = 1e-9;

function mismoPunto(
  primero: readonly [number, number],
  segundo: readonly [number, number],
): boolean {
  return (
    Math.abs(primero[0] - segundo[0]) <= EPSILON_COORDENADA &&
    Math.abs(primero[1] - segundo[1]) <= EPSILON_COORDENADA
  );
}

function anillosNormalizados(
  geometria: GeoJsonPolygon,
): Array<Array<readonly [number, number]>> {
  return geometria.coordinates.map((anillo) => {
    const posiciones = anillo.map(
      ([lng, lat]) => [lng, lat] as readonly [number, number],
    );
    if (
      posiciones.length > 1 &&
      mismoPunto(posiciones[0], posiciones[posiciones.length - 1])
    ) {
      posiciones.pop();
    }
    return posiciones;
  });
}

/**
 * Compara dos polígonos sin depender del punto de cierre ni del orden exacto
 * de los vértices dentro de una misma posición.
 */
export function geometriasIguales(
  primera: GeoJsonPolygon,
  segunda: GeoJsonPolygon,
): boolean {
  const anillosA = anillosNormalizados(primera);
  const anillosB = anillosNormalizados(segunda);
  if (anillosA.length !== anillosB.length) return false;

  return anillosA.every((anilloA, indice) => {
    const anilloB = anillosB[indice];
    return (
      anilloA.length === anilloB.length &&
      anilloA.every((punto, posicion) => mismoPunto(punto, anilloB[posicion]))
    );
  });
}

function idsProductos(productos: readonly ProductoVersionZona[]): string[] {
  return productos
    .map((producto) => producto.id)
    .sort((a, b) => a.localeCompare(b));
}

function nombresProductos(
  productos: readonly ProductoVersionZona[],
): string[] {
  return productos
    .map((producto) => producto.nombre)
    .sort((a, b) => a.localeCompare(b, 'es'));
}

function productosIguales(
  anterior: readonly ProductoVersionZona[],
  actual: readonly ProductoVersionZona[],
): boolean {
  const idsAnteriores = idsProductos(anterior);
  const idsActuales = idsProductos(actual);
  return (
    idsAnteriores.length === idsActuales.length &&
    idsAnteriores.every((id, indice) => id === idsActuales[indice])
  );
}

function horarioIgual(
  anterior: SnapshotZona,
  actual: SnapshotZona,
): boolean {
  return (
    anterior.horarioInicio === actual.horarioInicio &&
    anterior.horarioFin === actual.horarioFin
  );
}

function agregarCambio(
  cambios: CambioZona[],
  campo: string,
  anterior: unknown,
  nuevo: unknown,
): void {
  cambios.push({
    campo,
    etiqueta: ETIQUETAS_CAMPO_ZONA[campo] ?? campo,
    anterior,
    nuevo,
  });
}

/**
 * Calcula los cambios entre dos versiones consecutivas.
 *
 * `anterior` es `null` para la versión de creación. El resultado se ordena con
 * los campos de clasificación primero y la geometría al final para que la
 * línea de tiempo sea fácil de leer.
 */
export function calcularCambiosZona(
  anterior: SnapshotZona | null,
  actual: SnapshotZona,
): CambioZona[] {
  if (!anterior) return [];

  const cambios: CambioZona[] = [];

  if (anterior.nombre !== actual.nombre) {
    agregarCambio(cambios, 'nombre', anterior.nombre, actual.nombre);
  }
  if (anterior.tipo !== actual.tipo) {
    agregarCambio(cambios, 'tipo', anterior.tipo, actual.tipo);
  }
  if (!horarioIgual(anterior, actual)) {
    agregarCambio(
      cambios,
      'horario',
      {
        inicio: anterior.horarioInicio,
        fin: anterior.horarioFin,
      },
      {
        inicio: actual.horarioInicio,
        fin: actual.horarioFin,
      },
    );
  }
  if (anterior.aforoMaximo !== actual.aforoMaximo) {
    agregarCambio(
      cambios,
      'aforoMaximo',
      anterior.aforoMaximo,
      actual.aforoMaximo,
    );
  }
  if (anterior.activa !== actual.activa) {
    agregarCambio(cambios, 'activa', anterior.activa, actual.activa);
  }
  if (
    !productosIguales(
      anterior.productosPermitidos,
      actual.productosPermitidos,
    )
  ) {
    agregarCambio(
      cambios,
      'productosPermitidos',
      nombresProductos(anterior.productosPermitidos),
      nombresProductos(actual.productosPermitidos),
    );
  }
  if (!geometriasIguales(anterior.geometria, actual.geometria)) {
    agregarCambio(
      cambios,
      'geometria',
      {
        vertices: anterior.resumenGeometria.vertices,
        areaM2: anterior.resumenGeometria.areaM2,
      },
      {
        vertices: actual.resumenGeometria.vertices,
        areaM2: actual.resumenGeometria.areaM2,
      },
    );
  }

  return cambios;
}

/**
 * Normaliza el JSONB `productos` de una versión. Devuelve una lista vacía si
 * el valor no tiene la forma esperada (por ejemplo, datos migrados a mano).
 */
export function parsearProductosVersion(
  valor: unknown,
): ProductoVersionZona[] {
  if (!Array.isArray(valor)) return [];

  return valor.flatMap((elemento) => {
    if (typeof elemento !== 'object' || elemento === null) return [];
    const producto = elemento as Record<string, unknown>;
    if (
      typeof producto.id !== 'string' ||
      typeof producto.nombre !== 'string'
    ) {
      return [];
    }
    return [
      {
        id: producto.id,
        nombre: producto.nombre,
        activo: producto.activo !== false,
      },
    ];
  });
}

/** Describe la acción de una versión para mensajes de interfaz. */
export function etiquetaAccionZona(accion: AccionVersionZona): string {
  switch (accion) {
    case 'creacion':
      return 'Zona creada';
    case 'edicion':
      return 'Zona editada';
    case 'activacion':
      return 'Zona activada';
    case 'desactivacion':
      return 'Zona desactivada';
    default:
      return accion;
  }
}
