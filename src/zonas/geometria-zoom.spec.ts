import { opcionesGeometriaZoom } from './geometria-zoom';

describe('opcionesGeometriaZoom', () => {
  it('conserva la geometría completa sin zoom', () => {
    expect(opcionesGeometriaZoom()).toEqual({
      tolerancia: null,
      decimales: 9,
    });
    expect(opcionesGeometriaZoom(null)).toEqual({
      tolerancia: null,
      decimales: 9,
    });
  });

  it.each([
    [0, 0.0005, 4],
    [8, 0.0005, 4],
    [11, 0.0005, 4],
    [12, 0.0002, 4],
    [13, 0.0002, 4],
    [14, 0.00005, 5],
    [15, 0.00005, 5],
    [16, null, 6],
    [17, null, 6],
    [18, null, 7],
    [22, null, 7],
  ])(
    'con zoom %i devuelve tolerancia %p y %i decimales',
    (zoom, tolerancia, decimales) => {
      expect(opcionesGeometriaZoom(zoom)).toEqual({ tolerancia, decimales });
    },
  );
});
