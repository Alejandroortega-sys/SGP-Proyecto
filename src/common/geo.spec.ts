import { BadRequestException } from '@nestjs/common';
import {
  ColumnaGeometria,
  GeoJsonPolygon,
  geojsonASql,
  leerGeoJson,
  poligonoASql,
  puntoASql,
  sqlGeoJson,
  sqlGeoJsonSimplificado,
  validarPoligono,
  validarPunto,
} from './geo';

const PUNTO = {
  type: 'Point',
  coordinates: [-76.302, 4.084],
} as const;

const POLIGONO: GeoJsonPolygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-76.31, 4.08],
      [-76.29, 4.08],
      [-76.29, 4.09],
      [-76.31, 4.09],
      [-76.31, 4.08],
    ],
  ],
};

describe('validarPunto', () => {
  it('devuelve el punto tipado con [longitud, latitud]', () => {
    expect(validarPunto(PUNTO)).toEqual(PUNTO);
  });

  it('rechaza tipos distintos de Point', () => {
    expect(() => validarPunto(POLIGONO)).toThrow(BadRequestException);
    expect(() => validarPunto(POLIGONO)).toThrow(/tipo "Point"/);
  });

  it('rechaza coordenadas que no sean [longitud, latitud]', () => {
    expect(() => validarPunto({ type: 'Point', coordinates: [4.084] })).toThrow(
      /\[longitud, latitud\]/,
    );
    expect(() =>
      validarPunto({ type: 'Point', coordinates: [-76.3, 4.08, 100] }),
    ).toThrow(/\[longitud, latitud\]/);
  });

  it('rechaza coordenadas no numéricas o no finitas', () => {
    expect(() =>
      validarPunto({ type: 'Point', coordinates: ['-76.3', 4.08] }),
    ).toThrow(/deben ser números/);
    expect(() =>
      validarPunto({ type: 'Point', coordinates: [Number.NaN, 4.08] }),
    ).toThrow(/números finitos/);
    expect(() =>
      validarPunto({
        type: 'Point',
        coordinates: [Number.POSITIVE_INFINITY, 4.08],
      }),
    ).toThrow(/números finitos/);
  });

  it('rechaza coordenadas fuera de rango', () => {
    expect(() =>
      validarPunto({ type: 'Point', coordinates: [181, 4.08] }),
    ).toThrow(/longitud debe estar entre -180 y 180/);
    expect(() =>
      validarPunto({ type: 'Point', coordinates: [-76.3, -91] }),
    ).toThrow(/latitud debe estar entre -90 y 90/);
  });

  it('rechaza un CRS distinto de EPSG:4326', () => {
    expect(() =>
      validarPunto({
        ...PUNTO,
        crs: { type: 'name', properties: { name: 'EPSG:3857' } },
      }),
    ).toThrow(/EPSG:4326/);
  });

  it('acepta un CRS EPSG:4326 explícito', () => {
    const punto = {
      ...PUNTO,
      crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::4326' } },
    };
    expect(validarPunto(punto)).toEqual(PUNTO);
  });

  it('rechaza valores que no son objetos', () => {
    expect(() => validarPunto(null)).toThrow(BadRequestException);
    expect(() => validarPunto('POINT(-76.3 4.08)')).toThrow(
      BadRequestException,
    );
    expect(() => validarPunto([-76.3, 4.08])).toThrow(BadRequestException);
  });
});

describe('validarPoligono', () => {
  it('devuelve el polígono tipado', () => {
    expect(validarPoligono(POLIGONO)).toEqual(POLIGONO);
  });

  it('rechaza tipos distintos de Polygon', () => {
    expect(() => validarPoligono(PUNTO)).toThrow(/tipo "Polygon"/);
  });

  it('rechaza polígonos sin anillos', () => {
    expect(() => validarPoligono({ type: 'Polygon', coordinates: [] })).toThrow(
      /al menos un anillo/,
    );
  });

  it('rechaza anillos con menos de cuatro posiciones', () => {
    expect(() =>
      validarPoligono({
        type: 'Polygon',
        coordinates: [
          [
            [-76.31, 4.08],
            [-76.29, 4.08],
            [-76.31, 4.08],
          ],
        ],
      }),
    ).toThrow(/al menos cuatro posiciones/);
  });

  it('rechaza anillos que no están cerrados', () => {
    expect(() =>
      validarPoligono({
        type: 'Polygon',
        coordinates: [
          [
            [-76.31, 4.08],
            [-76.29, 4.08],
            [-76.29, 4.09],
            [-76.31, 4.09],
          ],
        ],
      }),
    ).toThrow(/primer y el último punto deben coincidir/);
  });

  it('valida los anillos interiores', () => {
    const poligono: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [
        POLIGONO.coordinates[0],
        [
          [-76.305, 4.083],
          [-76.301, 4.083],
          [-76.301, 4.087],
          [-76.305, 4.083],
        ],
      ],
    };

    expect(validarPoligono(poligono)).toEqual(poligono);
  });
});

describe('puntoASql', () => {
  it('genera ST_MakePoint parametrizado con longitud y latitud en orden', () => {
    const fragmento = puntoASql(PUNTO);

    expect(fragmento.sql).toBe('ST_SetSRID(ST_MakePoint(?, ?), 4326)');
    expect(fragmento.values).toEqual([-76.302, 4.084]);
  });

  it('no interpola el valor en el texto SQL', () => {
    const fragmento = puntoASql(PUNTO);

    expect(fragmento.sql).not.toContain('76.302');
    expect(fragmento.values).toHaveLength(2);
  });

  it('rechaza puntos inválidos antes de construir el SQL', () => {
    expect(() =>
      puntoASql({ type: 'Point', coordinates: [-76.302, 91] }),
    ).toThrow(/latitud debe estar entre -90 y 90/);
  });
});

describe('poligonoASql', () => {
  it('genera ST_GeomFromGeoJSON parametrizado con SRID 4326', () => {
    const fragmento = poligonoASql(POLIGONO);

    expect(fragmento.sql).toBe('ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)');
    expect(fragmento.values).toEqual([JSON.stringify(POLIGONO)]);
  });
});

describe('geojsonASql', () => {
  it('delega en puntoASql para el tipo Point', () => {
    expect(geojsonASql(PUNTO, 'Point').sql).toBe(
      'ST_SetSRID(ST_MakePoint(?, ?), 4326)',
    );
  });

  it('delega en poligonoASql para el tipo Polygon', () => {
    expect(geojsonASql(POLIGONO, 'Polygon').sql).toBe(
      'ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)',
    );
  });

  it('rechaza un GeoJSON que no coincide con el tipo esperado', () => {
    expect(() => geojsonASql(PUNTO, 'Polygon')).toThrow(BadRequestException);
    expect(() => geojsonASql(POLIGONO, 'Point')).toThrow(BadRequestException);
  });
});

describe('sqlGeoJson', () => {
  it.each<ColumnaGeometria>(['geometria', 'ubicacion', 'ubicacion_solicitada'])(
    'genera ST_AsGeoJSON para la columna %s',
    (columna) => {
      const fragmento = sqlGeoJson(columna);

      expect(fragmento.sql).toBe(`ST_AsGeoJSON(${columna})::jsonb`);
      expect(fragmento.values).toEqual([]);
    },
  );

  it('rechaza una columna no permitida', () => {
    expect(() => sqlGeoJson('otra' as ColumnaGeometria)).toThrow(
      /no es válida/,
    );
  });
});

describe('sqlGeoJsonSimplificado', () => {
  it('solo reduce decimales cuando no hay tolerancia', () => {
    const fragmento = sqlGeoJsonSimplificado('geometria', {
      tolerancia: null,
      decimales: 6,
    });

    expect(fragmento.sql).toContain('ST_AsGeoJSON');
    expect(fragmento.sql).not.toContain('ST_SimplifyPreserveTopology');
    expect(fragmento.sql).toContain('::int');
  });

  it('simplifica y protege contra geometrías vacías', () => {
    const fragmento = sqlGeoJsonSimplificado('geometria', {
      tolerancia: 0.0005,
      decimales: 4,
    });

    expect(fragmento.sql).toContain('ST_SimplifyPreserveTopology');
    expect(fragmento.sql).toContain('ST_IsEmpty');
    expect(fragmento.sql).toContain('CASE');
    expect(fragmento.sql).toContain('::float8');
  });

  it('rechaza una columna no permitida', () => {
    expect(() =>
      sqlGeoJsonSimplificado('otra' as ColumnaGeometria, {
        tolerancia: null,
        decimales: 6,
      }),
    ).toThrow(/no es válida/);
  });
});

describe('leerGeoJson', () => {
  it('devuelve null para columnas nulas', () => {
    expect(leerGeoJson(null)).toBeNull();
    expect(leerGeoJson(undefined)).toBeNull();
  });

  it('acepta el objeto JSONB que devuelve el driver', () => {
    expect(leerGeoJson(PUNTO)).toEqual(PUNTO);
    expect(leerGeoJson(POLIGONO)).toEqual(POLIGONO);
  });

  it('acepta la cadena de ST_AsGeoJSON sin cast a jsonb', () => {
    expect(leerGeoJson(JSON.stringify(PUNTO))).toEqual(PUNTO);
    expect(leerGeoJson(JSON.stringify(POLIGONO))).toEqual(POLIGONO);
  });

  it('valida el tipo esperado', () => {
    expect(leerGeoJson(PUNTO, 'Point')).toEqual(PUNTO);
    expect(() => leerGeoJson(PUNTO, 'Polygon')).toThrow(BadRequestException);
  });

  it('rechaza JSON malformado y geometrías no soportadas', () => {
    expect(() => leerGeoJson('{no-es-json')).toThrow(/JSON válido/);
    expect(() => leerGeoJson({ type: 'LineString', coordinates: [] })).toThrow(
      /Tipo de geometría no soportado/,
    );
  });
});
