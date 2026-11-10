import { AlmacenPrevisualizaciones } from './almacen-previsualizaciones';

function datos(actorId = 1n) {
  return {
    tipo: 'modulos' as const,
    actorId,
    archivo: { nombre: 'modulos.csv', bytes: 10 },
    sridOrigen: 4326,
    sridDetectado: false,
    filas: [],
    resumen: {
      total: 0,
      validas: 0,
      rechazadas: 0,
      advertencias: 0,
    },
  };
}

describe('Almacén de previsualizaciones', () => {
  it('crea una entrada con token UUID y la devuelve vigente', () => {
    const almacen = new AlmacenPrevisualizaciones();
    const entrada = almacen.crear(datos());

    expect(entrada.token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(almacen.obtener(entrada.token)).toBe(entrada);
  });

  it('elimina la entrada cuando expira', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-09T12:00:00.000Z'));

    const almacen = new AlmacenPrevisualizaciones();
    almacen.configurar(1000);
    const entrada = almacen.crear(datos());

    jest.setSystemTime(new Date('2026-11-09T12:00:01.001Z'));

    expect(almacen.obtener(entrada.token)).toBeNull();
    jest.useRealTimers();
  });

  it('expulsa la entrada más antigua al superar el máximo', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-09T12:00:00.000Z'));

    const almacen = new AlmacenPrevisualizaciones();
    almacen.configurar(60_000, 2);
    const primera = almacen.crear(datos());
    jest.setSystemTime(new Date('2026-11-09T12:00:01.000Z'));
    const segunda = almacen.crear(datos());
    jest.setSystemTime(new Date('2026-11-09T12:00:02.000Z'));
    const tercera = almacen.crear(datos());

    expect(almacen.obtener(primera.token)).toBeNull();
    expect(almacen.obtener(segunda.token)).toBe(segunda);
    expect(almacen.obtener(tercera.token)).toBe(tercera);

    jest.useRealTimers();
  });

  it('devuelve null para un token inexistente', () => {
    const almacen = new AlmacenPrevisualizaciones();
    expect(almacen.obtener('no-existe')).toBeNull();
  });
});
