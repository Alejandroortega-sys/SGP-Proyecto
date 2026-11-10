import {
  leerDocumentoGeoJson,
  leerSridDeclarado,
  normalizarPoligonoImportado,
  normalizarZonaImportada,
  validarRangoWgs84,
} from './geojson';
import { ErrorFilaImportacion, ErrorFormatoImportacion } from './errores';

const POLIGONO = {
  type: 'Polygon',
  coordinates: [
    [
      [-76.2, 4.08],
      [-76.19, 4.08],
      [-76.19, 4.09],
      [-76.2, 4.09],
      [-76.2, 4.08],
    ],
  ],
};

function feature(properties: Record<string, unknown>, geometry: unknown = POLIGONO) {
  return { type: 'Feature', properties, geometry };
}

function coleccion(features: unknown[], extra: Record<string, unknown> = {}) {
  return Buffer.from(
    JSON.stringify({ type: 'FeatureCollection', features, ...extra }),
    'utf8',
  );
}

describe('Lector GeoJSON de zonas', () => {
  it('lee un FeatureCollection y asume EPSG:4326 sin crs', () => {
    const documento = leerDocumentoGeoJson(
      coleccion([feature({ nombre: 'Zona nueva', tipo: 'permitida' })]),
    );

    expect(documento.sridOrigen).toBe(4326);
    expect(documento.sridDetectado).toBe(false);
    expect(documento.features).toHaveLength(1);
  });

  it('lee un único Feature', () => {
    const documento = leerDocumentoGeoJson(
      Buffer.from(
        JSON.stringify(
          feature({ nombre: 'Zona única', tipo: 'restringida' }),
        ),
        'utf8',
      ),
    );

    expect(documento.features).toHaveLength(1);
  });

  it('interpreta el miembro crs antiguo', () => {
    expect(
      leerSridDeclarado({
        type: 'name',
        properties: { name: 'urn:ogc:def:crs:EPSG::3857' },
      }),
    ).toBe(3857);
    expect(
      leerSridDeclarado({
        type: 'name',
        properties: { name: 'EPSG:3116' },
      }),
    ).toBe(3116);
  });

  it('acepta el CRS declarado y rechaza una selección contradictoria', () => {
    const contenido = coleccion(
      [feature({ nombre: 'Zona nueva', tipo: 'permitida' })],
      {
        crs: {
          type: 'name',
          properties: { name: 'urn:ogc:def:crs:EPSG::3857' },
        },
      },
    );

    expect(leerDocumentoGeoJson(contenido).sridOrigen).toBe(3857);
    expect(() => leerDocumentoGeoJson(contenido, 4326)).toThrow(
      ErrorFormatoImportacion,
    );
  });

  it('rechaza JSON inválido y raíces que no son Feature', () => {
    expect(() =>
      leerDocumentoGeoJson(Buffer.from('{ no es json', 'utf8')),
    ).toThrow(/JSON válido/i);

    expect(() =>
      leerDocumentoGeoJson(Buffer.from('[]', 'utf8')),
    ).toThrow(/objeto en la raíz/i);

    expect(() =>
      leerDocumentoGeoJson(Buffer.from('{"type":"Polygon"}', 'utf8')),
    ).toThrow(/FeatureCollection o un Feature/i);
  });

  it('rechaza una colección vacía', () => {
    expect(() => leerDocumentoGeoJson(coleccion([]))).toThrow(
      /no contiene features/i,
    );
  });

  it('normaliza un polígono y descarta la altitud', () => {
    const poligono = normalizarPoligonoImportado({
      type: 'Polygon',
      coordinates: [
        [
          [-76.2, 4.08, 900],
          [-76.19, 4.08, 900],
          [-76.19, 4.09, 900],
          [-76.2, 4.09, 900],
          [-76.2, 4.08, 900],
        ],
      ],
    });

    expect(poligono.coordinates[0]?.[0]).toEqual([-76.2, 4.08]);
  });

  it('rechaza MultiPolygon, anillos abiertos y menos de cuatro puntos', () => {
    expect(() =>
      normalizarPoligonoImportado({ type: 'MultiPolygon', coordinates: [] }),
    ).toThrow(/Polygon/i);

    expect(() =>
      normalizarPoligonoImportado({
        type: 'Polygon',
        coordinates: [
          [
            [-76.2, 4.08],
            [-76.19, 4.08],
            [-76.19, 4.09],
            [-76.2, 4.09],
          ],
        ],
      }),
    ).toThrow(/cerrado/i);

    expect(() =>
      normalizarPoligonoImportado({
        type: 'Polygon',
        coordinates: [
          [
            [-76.2, 4.08],
            [-76.19, 4.08],
            [-76.2, 4.08],
          ],
        ],
      }),
    ).toThrow(/cuatro posiciones/i);
  });

  it('normaliza las propiedades de una zona', () => {
    const zona = normalizarZonaImportada(
      feature({
        nombre: 'Zona nueva',
        tipo: 'permitida',
        horarioInicio: '06:00',
        horarioFin: '18:00',
        aforoMaximo: 20,
        productosPermitidos: 'Frutas frescas; Verduras;Frutas frescas',
      }),
    );

    expect(zona).toMatchObject({
      nombre: 'Zona nueva',
      tipo: 'permitida',
      horarioInicio: '06:00',
      horarioFin: '18:00',
      aforoMaximo: 20,
      productosPermitidos: ['Frutas frescas', 'Verduras'],
    });
  });

  it('rechaza propiedades obligatorias y horarios incoherentes', () => {
    expect(() =>
      normalizarZonaImportada(feature({ tipo: 'permitida' })),
    ).toThrow(/nombre/i);

    expect(() =>
      normalizarZonaImportada(
        feature({ nombre: 'Zona nueva', tipo: 'desconocida' }),
      ),
    ).toThrow(/tipo/i);

    expect(() =>
      normalizarZonaImportada(
        feature({
          nombre: 'Zona nueva',
          tipo: 'permitida',
          horarioInicio: '06:00',
        }),
      ),
    ).toThrow(/juntos/i);

    expect(() =>
      normalizarZonaImportada(
        feature({
          nombre: 'Zona nueva',
          tipo: 'permitida',
          horarioInicio: '18:00',
          horarioFin: '06:00',
        }),
      ),
    ).toThrow(/posterior/i);
  });

  it('valida los rangos geográficos transformados', () => {
    expect(() =>
      validarRangoWgs84({
        type: 'Polygon',
        coordinates: [
          [
            [-200, 4.08],
            [-76.19, 4.08],
            [-76.19, 4.09],
            [-200, 4.08],
          ],
        ],
      }),
    ).toThrow(ErrorFilaImportacion);
  });
});
