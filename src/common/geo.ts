import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

/**
 * Conversión y validación de geometrías GeoJSON para las columnas PostGIS.
 *
 * El esquema real de la base de datos (`dataBase/01_creacion_bd.sql`) define
 * las columnas espaciales con un tipo concreto y SRID 4326:
 *
 * | Tabla                          | Columna                | Tipo real              |
 * |--------------------------------|------------------------|------------------------|
 * | `zonas`                        | `geometria`            | `geometry(Polygon,4326)` |
 * | `modulos`                      | `ubicacion`            | `geometry(Point,4326)`   |
 * | `espacios_temporales`          | `ubicacion`            | `geometry(Point,4326)`   |
 * | `evaluaciones_factibilidad`    | `ubicacion`            | `geometry(Point,4326)`   |
 * | `solicitudes`                  | `ubicacion_solicitada` | `geometry(Point,4326)`   |
 * | `permisos`                     | `ubicacion`            | `geometry(Point,4326)`   |
 *
 * Por eso este helper solo admite `Point` y `Polygon` en 2D. No se valida la
 * topología (autointersecciones o solapes): eso lo garantiza la propia BD con
 * `ST_IsValid` y el trigger `fn_validar_zona` (ver AGENTS.md §6).
 *
 * Las coordenadas GeoJSON siguen el orden **[longitud, latitud]**, igual que
 * `ST_MakePoint(lng, lat)`. Invertirlas es el error más común al usar PostGIS.
 */

/** Posición GeoJSON 2D: `[longitud, latitud]`. */
export type PosicionGeoJson = readonly [number, number];

/** Punto GeoJSON válido para `geometry(Point,4326)`. */
export interface GeoJsonPoint {
  type: 'Point';
  coordinates: PosicionGeoJson;
}

/** Polígono GeoJSON válido para `geometry(Polygon,4326)`. */
export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: PosicionGeoJson[][];
}

/** Geometrías admitidas por las columnas espaciales del proyecto. */
export type GeoJsonGeometria = GeoJsonPoint | GeoJsonPolygon;

/** Tipo de geometría que espera una columna de la BD. */
export type TipoGeometriaBd = 'Point' | 'Polygon';

/** Columnas espaciales escribibles del esquema. */
export type ColumnaGeometria =
  'geometria' | 'ubicacion' | 'ubicacion_solicitada';

const COLUMNAS_GEOJSON: Record<ColumnaGeometria, Prisma.Sql> = {
  geometria: Prisma.sql`geometria`,
  ubicacion: Prisma.sql`ubicacion`,
  ubicacion_solicitada: Prisma.sql`ubicacion_solicitada`,
};

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function describirTipo(tipo: unknown): string {
  return typeof tipo === 'string' ? `"${tipo}"` : 'desconocido';
}

function exigirObjeto(
  valor: unknown,
  contexto: string,
): Record<string, unknown> {
  if (!esObjeto(valor)) {
    throw new BadRequestException(`${contexto} debe ser un objeto GeoJSON`);
  }
  return valor;
}

/**
 * Rechaza un `crs` distinto de EPSG:4326. GeoJSON (RFC 7946) no lleva CRS y
 * las columnas del proyecto son siempre WGS84.
 */
function validarCrs(objeto: Record<string, unknown>, contexto: string): void {
  if (objeto.crs === undefined) {
    return;
  }

  const crs = objeto.crs;
  const propiedades = esObjeto(crs) ? crs.properties : undefined;
  const nombre = esObjeto(propiedades) ? propiedades.name : undefined;

  if (typeof nombre !== 'string' || !nombre.endsWith('4326')) {
    throw new BadRequestException(
      `${contexto} debe usar el sistema de referencia EPSG:4326 (WGS84)`,
    );
  }
}

function validarPosicion(posicion: unknown, contexto: string): PosicionGeoJson {
  if (!Array.isArray(posicion) || posicion.length !== 2) {
    throw new BadRequestException(
      `${contexto}: cada coordenada debe ser [longitud, latitud]`,
    );
  }

  const coordenadas: unknown[] = posicion;
  const [lng, lat] = coordenadas;

  if (typeof lng !== 'number' || typeof lat !== 'number') {
    throw new BadRequestException(
      `${contexto}: las coordenadas deben ser números`,
    );
  }

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new BadRequestException(
      `${contexto}: las coordenadas deben ser números finitos`,
    );
  }

  if (lng < -180 || lng > 180) {
    throw new BadRequestException(
      `${contexto}: la longitud debe estar entre -180 y 180`,
    );
  }

  if (lat < -90 || lat > 90) {
    throw new BadRequestException(
      `${contexto}: la latitud debe estar entre -90 y 90`,
    );
  }

  return [lng, lat];
}

/**
 * Valida que el valor sea un punto GeoJSON 2D y lo devuelve tipado.
 *
 * @throws BadRequestException (400) si la forma, el tipo o el rango de las
 * coordenadas no son válidos.
 */
export function validarPunto(valor: unknown): GeoJsonPoint {
  const objeto = exigirObjeto(valor, 'El punto');
  validarCrs(objeto, 'El punto');

  if (objeto.type !== 'Point') {
    throw new BadRequestException(
      `Se esperaba una geometría GeoJSON de tipo "Point" y se recibió ${describirTipo(objeto.type)}`,
    );
  }

  return {
    type: 'Point',
    coordinates: validarPosicion(objeto.coordinates, 'Punto GeoJSON'),
  };
}

/**
 * Valida que el valor sea un polígono GeoJSON 2D y lo devuelve tipado.
 *
 * Cada anillo debe tener al menos cuatro posiciones y estar cerrado (primer
 * punto igual al último). La validez topológica la comprueba PostGIS.
 *
 * @throws BadRequestException (400) si la forma, el tipo, los anillos o el
 * rango de las coordenadas no son válidos.
 */
export function validarPoligono(valor: unknown): GeoJsonPolygon {
  const objeto = exigirObjeto(valor, 'El polígono');
  validarCrs(objeto, 'El polígono');

  if (objeto.type !== 'Polygon') {
    throw new BadRequestException(
      `Se esperaba una geometría GeoJSON de tipo "Polygon" y se recibió ${describirTipo(objeto.type)}`,
    );
  }

  const anillos = objeto.coordinates;
  if (!Array.isArray(anillos) || anillos.length === 0) {
    throw new BadRequestException(
      'El polígono GeoJSON debe tener al menos un anillo',
    );
  }

  const coordenadas = anillos.map((anillo: unknown, indice: number) => {
    const numeroAnillo = indice + 1;

    if (!Array.isArray(anillo)) {
      throw new BadRequestException(
        `Polígono GeoJSON, anillo ${numeroAnillo}: debe ser una lista de posiciones`,
      );
    }

    const posiciones: unknown[] = anillo;
    if (posiciones.length < 4) {
      throw new BadRequestException(
        `Polígono GeoJSON, anillo ${numeroAnillo}: debe tener al menos cuatro posiciones`,
      );
    }

    const validadas = posiciones.map((posicion) =>
      validarPosicion(posicion, `Polígono GeoJSON, anillo ${numeroAnillo}`),
    );

    const primera = validadas[0];
    const ultima = validadas[validadas.length - 1];
    if (primera[0] !== ultima[0] || primera[1] !== ultima[1]) {
      throw new BadRequestException(
        `Polígono GeoJSON, anillo ${numeroAnillo}: el primer y el último punto deben coincidir`,
      );
    }

    return validadas;
  });

  return { type: 'Polygon', coordinates: coordenadas };
}

/**
 * Construye la expresión SQL de un punto para `geometry(Point,4326)`.
 *
 * Usa `ST_MakePoint` con los valores parametrizados (nunca concatenados):
 * `ST_SetSRID(ST_MakePoint($1, $2), 4326)`.
 */
export function puntoASql(valor: unknown): Prisma.Sql {
  const { coordinates } = validarPunto(valor);
  const [lng, lat] = coordinates;
  return Prisma.sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;
}

/**
 * Construye la expresión SQL de un polígono para `geometry(Polygon,4326)`.
 *
 * El GeoJSON viaja como parámetro:
 * `ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)`.
 */
export function poligonoASql(valor: unknown): Prisma.Sql {
  const poligono = validarPoligono(valor);
  return Prisma.sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(poligono)}), 4326)`;
}

/**
 * Convierte una geometría GeoJSON a la expresión SQL del tipo esperado.
 *
 * @param valor GeoJSON recibido (por ejemplo, de un DTO).
 * @param tipoEsperado Tipo real de la columna destino.
 */
export function geojsonASql(
  valor: unknown,
  tipoEsperado: TipoGeometriaBd,
): Prisma.Sql {
  if (tipoEsperado === 'Point') {
    return puntoASql(valor);
  }
  if (tipoEsperado === 'Polygon') {
    return poligonoASql(valor);
  }
  throw new BadRequestException(
    `Tipo de geometría no soportado: ${describirTipo(tipoEsperado)}`,
  );
}

/**
 * Fragmento SQL para leer una columna espacial como GeoJSON.
 *
 * Devuelve `ST_AsGeoJSON(<columna>)::jsonb`, que el driver entrega como objeto
 * ya parseado (ver docs/uso_db.md §3.2). Solo admite las columnas espaciales
 * del esquema; el nombre no se interpola desde la entrada del usuario.
 */
export function sqlGeoJson(columna: ColumnaGeometria): Prisma.Sql {
  const identificador = COLUMNAS_GEOJSON[columna];
  if (identificador === undefined) {
    throw new BadRequestException(
      `La columna de geometría "${String(columna)}" no es válida`,
    );
  }
  return Prisma.sql`ST_AsGeoJSON(${identificador})::jsonb`;
}

function parsearGeoJson(texto: string): unknown {
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    throw new BadRequestException(
      'La geometría recibida no contiene un JSON válido',
    );
  }
}

/**
 * Normaliza un valor leído de PostGIS (`jsonb` o texto) a geometría tipada.
 *
 * Acepta el objeto que devuelve `jsonb` y también la cadena de
 * `ST_AsGeoJSON` sin cast. Devuelve `null` para columnas espaciales nulas.
 *
 * @throws BadRequestException (400) si el valor no es un Point/Polygon válido
 * o no coincide con el tipo esperado.
 */
export function leerGeoJson(
  valor: unknown,
  tipoEsperado?: TipoGeometriaBd,
): GeoJsonGeometria | null {
  if (valor === null || valor === undefined) {
    return null;
  }

  const objeto = typeof valor === 'string' ? parsearGeoJson(valor) : valor;

  if (tipoEsperado === 'Point') {
    return validarPunto(objeto);
  }
  if (tipoEsperado === 'Polygon') {
    return validarPoligono(objeto);
  }

  const geometria = exigirObjeto(objeto, 'La geometría');
  validarCrs(geometria, 'La geometría');

  if (geometria.type === 'Point') {
    return validarPunto(geometria);
  }
  if (geometria.type === 'Polygon') {
    return validarPoligono(geometria);
  }

  throw new BadRequestException(
    `Tipo de geometría no soportado: ${describirTipo(geometria.type)}`,
  );
}
