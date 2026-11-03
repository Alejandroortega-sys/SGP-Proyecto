import type { GeoJsonPolygon } from '../common/geo';
import {
  calcularCambiosZona,
  geometriasIguales,
  parsearProductosVersion,
  type SnapshotZona,
} from './historial';

const POLIGONO: GeoJsonPolygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-76.196, 4.088],
      [-76.192, 4.088],
      [-76.192, 4.09],
      [-76.196, 4.09],
      [-76.196, 4.088],
    ],
  ],
};

const POLIGONO_AMPLIADO: GeoJsonPolygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-76.197, 4.087],
      [-76.192, 4.087],
      [-76.192, 4.09],
      [-76.197, 4.09],
      [-76.197, 4.087],
    ],
  ],
};

function snapshot(overrides: Partial<SnapshotZona> = {}): SnapshotZona {
  return {
    version: 1,
    accion: 'creacion',
    nombre: 'Centro - Calle 30',
    tipo: 'permitida',
    horarioInicio: '06:00',
    horarioFin: '18:00',
    aforoMaximo: 40,
    activa: true,
    geometria: POLIGONO,
    productosPermitidos: [
      { id: '1', nombre: 'Frutas frescas', activo: true },
      { id: '2', nombre: 'Verduras', activo: true },
    ],
    resumenGeometria: { vertices: 4, areaM2: 1000 },
    ...overrides,
  };
}

describe('historial de zonas', () => {
  it('no reporta cambios en la versión de creación', () => {
    expect(calcularCambiosZona(null, snapshot())).toEqual([]);
  });

  it('no reporta cambios si el estado es idéntico', () => {
    expect(calcularCambiosZona(snapshot(), snapshot())).toEqual([]);
  });

  it('reporta clasificación, horario, aforo, productos, estado y geometría', () => {
    const anterior = snapshot();
    const actual = snapshot({
      version: 2,
      accion: 'edicion',
      nombre: 'Centro renovado',
      tipo: 'restringida',
      horarioInicio: '07:00',
      horarioFin: '17:00',
      aforoMaximo: 30,
      activa: false,
      productosPermitidos: [
        { id: '2', nombre: 'Verduras', activo: true },
      ],
      geometria: POLIGONO_AMPLIADO,
      resumenGeometria: { vertices: 5, areaM2: 1500 },
    });

    const cambios = calcularCambiosZona(anterior, actual);

    expect(cambios.map((cambio) => cambio.campo)).toEqual([
      'nombre',
      'tipo',
      'horario',
      'aforoMaximo',
      'activa',
      'productosPermitidos',
      'geometria',
    ]);
    expect(cambios.find((cambio) => cambio.campo === 'aforoMaximo')).toEqual({
      campo: 'aforoMaximo',
      etiqueta: 'Aforo máximo',
      anterior: 40,
      nuevo: 30,
    });
    expect(
      cambios.find((cambio) => cambio.campo === 'productosPermitidos'),
    ).toMatchObject({
      anterior: ['Frutas frescas', 'Verduras'],
      nuevo: ['Verduras'],
    });
    expect(cambios.find((cambio) => cambio.campo === 'geometria')).toMatchObject(
      {
        anterior: { vertices: 4, areaM2: 1000 },
        nuevo: { vertices: 5, areaM2: 1500 },
      },
    );
  });

  it('detecta el borrado de horario y aforo', () => {
    const cambios = calcularCambiosZona(
      snapshot(),
      snapshot({ horarioInicio: null, horarioFin: null, aforoMaximo: null }),
    );

    expect(cambios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          campo: 'horario',
          anterior: { inicio: '06:00', fin: '18:00' },
          nuevo: { inicio: null, fin: null },
        }),
        expect.objectContaining({
          campo: 'aforoMaximo',
          anterior: 40,
          nuevo: null,
        }),
      ]),
    );
  });

  it('no considera cambio reordenar los productos', () => {
    const anterior = snapshot();
    const actual = snapshot({
      productosPermitidos: [
        { id: '2', nombre: 'Verduras', activo: true },
        { id: '1', nombre: 'Frutas frescas', activo: true },
      ],
    });

    expect(calcularCambiosZona(anterior, actual)).toEqual([]);
  });

  it('compara polígonos sin depender del punto de cierre', () => {
    expect(
      geometriasIguales(POLIGONO, {
        type: 'Polygon',
        coordinates: [
          [
            [-76.196, 4.088],
            [-76.192, 4.088],
            [-76.192, 4.09],
            [-76.196, 4.09],
          ],
        ],
      }),
    ).toBe(true);
    expect(geometriasIguales(POLIGONO, POLIGONO_AMPLIADO)).toBe(false);
  });

  it('normaliza los productos guardados en JSONB', () => {
    expect(
      parsearProductosVersion([
        { id: '1', nombre: 'Frutas frescas', activo: true },
        { id: '2', nombre: 'Verduras', activo: false },
        { id: 3, nombre: 'Inválido' },
        null,
      ]),
    ).toEqual([
      { id: '1', nombre: 'Frutas frescas', activo: true },
      { id: '2', nombre: 'Verduras', activo: false },
    ]);
    expect(parsearProductosVersion('no-es-una-lista')).toEqual([]);
  });
});
