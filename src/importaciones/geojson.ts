import type { GeoJsonPolygon, PosicionGeoJson } from '../common/geo';
import type { tipo_zona } from '../generated/prisma/client';
import { ErrorFilaImportacion, ErrorFormatoImportacion } from './errores';

/** SRID por defecto de las columnas PostGIS del proyecto. */
export const SRID_DESTINO = 4326;

/** Tope de features de un GeoJSON de zonas. */
export const MAX_FEATURES_GEOJSON = 5000;

/** Opciones de CRS que la interfaz ofrece por defecto. */
export const SRIDS_COMUNES = [
  { srid: 4326, etiqueta: 'WGS 84 (EPSG:4326)' },
  { srid: 3857, etiqueta: 'Web Mercator (EPSG:3857)' },
  { srid: 3114, etiqueta: 'MAGNA-SIRGAS Colombia Far West (EPSG:3114)' },
  { srid: 3115, etiqueta: 'MAGNA-SIRGAS Colombia West (EPSG:3115)' },
  { srid: 3116, etiqueta: 'MAGNA-SIRGAS Colombia Bogotá (EPSG:3116)' },
  { srid: 3117, etiqueta: 'MAGNA-SIRGAS Colombia East Central (EPSG:3117)' },
  { srid: 3118, etiqueta: 'MAGNA-SIRGAS Colombia East (EPSG:3118)' },
  { srid: 4686, etiqueta: 'MAGNA-SIRGAS geográfico (EPSG:4686)' },
] as const;

/** Tipos de zona admitidos por el enum `tipo_zona`. */
export const TIPOS_ZONA_IMPORTACION: readonly tipo_zona[] = [
  'permitida',
  'restringida',
  'alta_congestion',
];

const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Feature GeoJSON todavía sin validar. */
export interface FeatureGeoJson {
  properties: Record<string, unknown>;
  geometry: unknown;
}

/** Documento GeoJSON leído y con su SRID de origen resuelto. */
export interface DocumentoGeoJson {
  features: FeatureGeoJson[];
  sridOrigen: number;
  sridDetectado: boolean;
}

/** Zona normalizada a partir de un feature. */
export interface ZonaImportada {
  nombre: string;
  tipo: tipo_zona;
  horarioInicio: string | null;
  horarioFin: string | null;
  aforoMaximo: number | null;
  productosPermitidos: string[];
  geometria: GeoJsonPolygon;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function textoRecortado(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

/** Valida que un SRID sea un entero positivo. */
export function validarSrid(valor: number): number {
  if (!Number.isInteger(valor) || valor <= 0 || valor > 999999) {
    throw new ErrorFormatoImportacion(
      'El SRID de origen debe ser un número entero válido.',
    );
  }
  return valor;
}

/** Extrae el SRID declarado en el miembro `crs` de un GeoJSON antiguo. */
export function leerSridDeclarado(crs: unknown): number | null {
  if (crs === undefined || crs === null) return null;

  let nombre: string | null = null;

  if (typeof crs === 'string') {
    nombre = crs;
  } else if (esObjeto(crs)) {
    const propiedades = crs.properties;
    if (esObjeto(propiedades) && typeof propiedades.name === 'string') {
      nombre = propiedades.name;
    }
  }

  if (nombre === null) {
    throw new ErrorFormatoImportacion(
      'El miembro «crs» del GeoJSON no tiene un nombre de sistema de referencia válido.',
    );
  }

  if (/CRS\s*:?\s*84/i.test(nombre)) {
    return 4326;
  }

  if (/WGS\s*84/i.test(nombre) && !/\d/.test(nombre)) {
    return 4326;
  }

  const coincidencia = /(\d+)\s*$/.exec(nombre.trim());
  if (!coincidencia?.[1]) {
    throw new ErrorFormatoImportacion(
      `No se pudo interpretar el sistema de referencia «${nombre}».`,
    );
  }

  return validarSrid(Number(coincidencia[1]));
}

function extraerFeatures(objeto: Record<string, unknown>): FeatureGeoJson[] {
  if (objeto.type === 'FeatureCollection') {
    if (!Array.isArray(objeto.features)) {
      throw new ErrorFormatoImportacion(
        'El FeatureCollection no contiene una lista de features.',
      );
    }
    if (objeto.features.length === 0) {
      throw new ErrorFormatoImportacion(
        'El archivo GeoJSON no contiene features.',
      );
    }
    if (objeto.features.length > MAX_FEATURES_GEOJSON) {
      throw new ErrorFormatoImportacion(
        `El archivo supera el máximo de ${MAX_FEATURES_GEOJSON} features.`,
      );
    }
    return objeto.features.map((feature, indice) => {
      if (!esObjeto(feature) || feature.type !== 'Feature') {
        throw new ErrorFormatoImportacion(
          `El elemento ${indice + 1} del FeatureCollection no es un Feature GeoJSON.`,
        );
      }
      const properties = feature.properties;
      return {
        properties: esObjeto(properties) ? properties : {},
        geometry: feature.geometry,
      };
    });
  }

  if (objeto.type === 'Feature') {
    const properties = objeto.properties;
    return [
      {
        properties: esObjeto(properties) ? properties : {},
        geometry: objeto.geometry,
      },
    ];
  }

  throw new ErrorFormatoImportacion(
    'El archivo debe ser un FeatureCollection o un Feature GeoJSON.',
  );
}

/**
 * Lee un GeoJSON de zonas y resuelve el SRID de origen.
 *
 * El SRID puede venir en el miembro `crs` (GeoJSON anterior a RFC 7946) o
 * seleccionarse en la interfaz. Si ambos existen deben coincidir.
 */
export function leerDocumentoGeoJson(
  contenido: Buffer,
  sridSeleccionado?: number,
): DocumentoGeoJson {
  let texto: string;

  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(contenido);
  } catch {
    throw new ErrorFormatoImportacion(
      'El archivo GeoJSON debe estar codificado en UTF-8.',
    );
  }

  if (texto.charCodeAt(0) === 0xfeff) {
    texto = texto.slice(1);
  }

  let parseado: unknown;
  try {
    parseado = JSON.parse(texto) as unknown;
  } catch {
    throw new ErrorFormatoImportacion(
      'El archivo no contiene un JSON válido.',
    );
  }

  if (!esObjeto(parseado)) {
    throw new ErrorFormatoImportacion(
      'El archivo GeoJSON debe contener un objeto en la raíz.',
    );
  }

  const sridDeclarado = leerSridDeclarado(parseado.crs);
  const sridSeleccionadoValidado =
    sridSeleccionado === undefined
      ? null
      : validarSrid(sridSeleccionado);

  if (
    sridDeclarado !== null &&
    sridSeleccionadoValidado !== null &&
    sridDeclarado !== sridSeleccionadoValidado
  ) {
    throw new ErrorFormatoImportacion(
      `El archivo declara EPSG:${sridDeclarado}, pero seleccionaste EPSG:${sridSeleccionadoValidado}. Corrige la selección.`,
    );
  }

  return {
    features: extraerFeatures(parseado),
    sridOrigen:
      sridDeclarado ?? sridSeleccionadoValidado ?? SRID_DESTINO,
    sridDetectado:
      sridDeclarado !== null || sridSeleccionadoValidado !== null,
  };
}

function normalizarPosicion(
  valor: unknown,
  contexto: string,
): PosicionGeoJson {
  if (!Array.isArray(valor) || (valor.length !== 2 && valor.length !== 3)) {
    throw new ErrorFilaImportacion(
      `${contexto}: cada posición debe ser [longitud, latitud] (la altitud opcional se descarta).`,
    );
  }

  const longitud = valor[0];
  const latitud = valor[1];

  if (
    typeof longitud !== 'number' ||
    typeof latitud !== 'number' ||
    !Number.isFinite(longitud) ||
    !Number.isFinite(latitud)
  ) {
    throw new ErrorFilaImportacion(
      `${contexto}: las coordenadas deben ser números finitos.`,
    );
  }

  return [longitud, latitud];
}

/** Valida la estructura de un polígono y descarta la altitud si existe. */
export function normalizarPoligonoImportado(valor: unknown): GeoJsonPolygon {
  if (!esObjeto(valor)) {
    throw new ErrorFilaImportacion('La geometría debe ser un objeto GeoJSON.');
  }

  if (valor.type !== 'Polygon') {
    throw new ErrorFilaImportacion(
      'La geometría debe ser de tipo Polygon. Los MultiPolygon y las colecciones no se admiten.',
    );
  }

  if (!Array.isArray(valor.coordinates) || valor.coordinates.length === 0) {
    throw new ErrorFilaImportacion(
      'El polígono debe tener al menos un anillo de coordenadas.',
    );
  }

  const anillos = valor.coordinates.map((anillo, indice) => {
    const numero = indice + 1;

    if (!Array.isArray(anillo)) {
      throw new ErrorFilaImportacion(
        `El anillo ${numero} debe ser una lista de posiciones.`,
      );
    }

    if (anillo.length < 4) {
      throw new ErrorFilaImportacion(
        `El anillo ${numero} debe tener al menos cuatro posiciones.`,
      );
    }

    const posiciones = anillo.map((posicion) =>
      normalizarPosicion(posicion, `Anillo ${numero}`),
    );

    const primera = posiciones[0];
    const ultima = posiciones[posiciones.length - 1];
    if (primera[0] !== ultima[0] || primera[1] !== ultima[1]) {
      throw new ErrorFilaImportacion(
        `El anillo ${numero} debe estar cerrado: el primer y el último punto deben coincidir.`,
      );
    }

    return posiciones;
  });

  return { type: 'Polygon', coordinates: anillos };
}

/** Comprueba que un polígono ya esté en el rango geográfico de WGS84. */
export function validarRangoWgs84(geometria: GeoJsonPolygon): void {
  for (const anillo of geometria.coordinates) {
    for (const [longitud, latitud] of anillo) {
      if (longitud < -180 || longitud > 180) {
        throw new ErrorFilaImportacion(
          'La longitud transformada debe estar entre -180 y 180.',
        );
      }
      if (latitud < -90 || latitud > 90) {
        throw new ErrorFilaImportacion(
          'La latitud transformada debe estar entre -90 y 90.',
        );
      }
    }
  }
}

function leerProductos(valor: unknown): string[] {
  if (valor === undefined || valor === null) return [];

  const candidatos = Array.isArray(valor)
    ? valor
    : typeof valor === 'string'
      ? valor.split(';')
      : null;

  if (candidatos === null) {
    throw new ErrorFilaImportacion(
      'productosPermitidos debe ser una lista o un texto separado por punto y coma.',
    );
  }

  const productos = candidatos
    .map((item) => textoRecortado(item))
    .filter((item) => item !== '');

  const unicos = [...new Set(productos)];

  if (unicos.length > 100) {
    throw new ErrorFilaImportacion(
      'Una zona no puede importar más de 100 productos permitidos.',
    );
  }

  return unicos;
}

function leerHorario(valor: unknown, campo: string): string | null {
  if (valor === undefined || valor === null || valor === '') return null;
  const texto = textoRecortado(valor);
  if (!FORMATO_HORA.test(texto)) {
    throw new ErrorFilaImportacion(
      `${campo} debe tener formato HH:MM en 24 horas.`,
    );
  }
  return texto;
}

function leerAforo(valor: unknown): number | null {
  if (valor === undefined || valor === null || valor === '') return null;
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isInteger(numero) || numero < 1) {
    throw new ErrorFilaImportacion(
      'aforoMaximo debe ser un número entero mayor que cero.',
    );
  }
  return numero;
}

/**
 * Valida las propiedades y la geometría de un feature de zona.
 *
 * @throws ErrorFilaImportacion con el motivo legible para el reporte.
 */
export function normalizarZonaImportada(
  feature: FeatureGeoJson,
): ZonaImportada {
  const propiedades = feature.properties;

  const nombre = textoRecortado(propiedades.nombre);
  if (nombre.length < 3 || nombre.length > 150) {
    throw new ErrorFilaImportacion(
      'La propiedad «nombre» debe tener entre 3 y 150 caracteres.',
    );
  }

  const tipo = textoRecortado(propiedades.tipo);
  if (!TIPOS_ZONA_IMPORTACION.includes(tipo as tipo_zona)) {
    throw new ErrorFilaImportacion(
      'La propiedad «tipo» debe ser permitida, restringida o alta_congestion.',
    );
  }

  const horarioInicio = leerHorario(
    propiedades.horarioInicio,
    'horarioInicio',
  );
  const horarioFin = leerHorario(propiedades.horarioFin, 'horarioFin');

  if ((horarioInicio === null) !== (horarioFin === null)) {
    throw new ErrorFilaImportacion(
      'horarioInicio y horarioFin deben enviarse juntos o ambos vacíos.',
    );
  }

  if (horarioInicio !== null && horarioFin !== null && horarioFin <= horarioInicio) {
    throw new ErrorFilaImportacion(
      'horarioFin debe ser posterior a horarioInicio.',
    );
  }

  return {
    nombre,
    tipo: tipo as tipo_zona,
    horarioInicio,
    horarioFin,
    aforoMaximo: leerAforo(propiedades.aforoMaximo),
    productosPermitidos: leerProductos(propiedades.productosPermitidos),
    geometria: normalizarPoligonoImportado(feature.geometry),
  };
}
