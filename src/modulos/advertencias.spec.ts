import { calcularAdvertenciasZona, exigeConfirmacion } from './advertencias';

describe('advertencias de zona del censo', () => {
  it('no advierte en una zona permitida', () => {
    const advertencias = calcularAdvertenciasZona({
      id: '1',
      nombre: 'Centro - Calle 30',
      tipo: 'permitida',
    });

    expect(advertencias).toEqual([]);
    expect(exigeConfirmacion(advertencias)).toBe(false);
  });

  it('exige confirmación en una zona restringida', () => {
    const advertencias = calcularAdvertenciasZona({
      id: '3',
      nombre: 'Entorno Hospital',
      tipo: 'restringida',
    });

    expect(advertencias).toEqual([
      expect.objectContaining({
        tipo: 'zona_restringida',
        requiereConfirmacion: true,
      }),
    ]);
    expect(advertencias[0].mensaje).toContain('Entorno Hospital');
    expect(exigeConfirmacion(advertencias)).toBe(true);
  });

  it('advierte la alta congestión sin exigir confirmación', () => {
    const advertencias = calcularAdvertenciasZona({
      id: '2',
      nombre: 'Plaza Boyacá',
      tipo: 'alta_congestion',
    });

    expect(advertencias[0]).toMatchObject({
      tipo: 'alta_congestion',
      requiereConfirmacion: false,
    });
    expect(exigeConfirmacion(advertencias)).toBe(false);
  });

  it('advierte cuando el punto está fuera de toda zona activa', () => {
    const advertencias = calcularAdvertenciasZona(null);

    expect(advertencias[0]).toMatchObject({
      tipo: 'fuera_de_zona',
      requiereConfirmacion: false,
    });
    expect(exigeConfirmacion(advertencias)).toBe(false);
  });
});
