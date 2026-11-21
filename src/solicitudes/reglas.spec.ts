import {
  documentosFaltantes,
  esFechaValida,
  formatearRangoFechas,
  hoyEnBogota,
  seCruzanFechas,
  validarFechasRadicacion,
  validarHorarioPermitido,
  validarHorasRadicacion,
} from './reglas';

describe('reglas de solicitudes', () => {
  it('calcula la fecha de hoy en la zona de Colombia', () => {
    expect(hoyEnBogota(new Date('2026-11-21T03:00:00.000Z'))).toBe(
      '2026-11-20',
    );
  });

  it('reconoce fechas ISO reales y rechaza fechas imposibles', () => {
    expect(esFechaValida('2026-12-01')).toBe(true);
    expect(esFechaValida('2026-02-30')).toBe(false);
    expect(esFechaValida('01/12/2026')).toBe(false);
  });

  it('valida el rango de fechas contra hoy', () => {
    expect(
      validarFechasRadicacion('2026-12-01', '2026-12-15', '2026-11-20'),
    ).toEqual([]);
    expect(
      validarFechasRadicacion('2026-11-01', '2026-12-15', '2026-11-20'),
    ).toEqual(['La fecha de inicio no puede ser anterior a hoy.']);
    expect(
      validarFechasRadicacion('2026-12-15', '2026-12-01', '2026-11-20'),
    ).toEqual([
      'La fecha de fin debe ser igual o posterior a la fecha de inicio.',
    ]);
  });

  it('valida el rango horario', () => {
    expect(validarHorasRadicacion('08:00', '12:00')).toEqual([]);
    expect(validarHorasRadicacion('12:00', '12:00')).toEqual([
      'La hora de fin debe ser posterior a la hora de inicio.',
    ]);
    expect(validarHorasRadicacion('25:00', '12:00')).toEqual([
      'La hora de inicio debe tener el formato HH:MM.',
    ]);
  });

  it('valida que el horario quepa en el horario permitido', () => {
    expect(
      validarHorarioPermitido(
        { inicio: '08:00', fin: '18:00' },
        '09:00',
        '12:00',
      ),
    ).toBeNull();
    expect(
      validarHorarioPermitido(
        { inicio: '08:00', fin: '18:00' },
        '07:00',
        '12:00',
      ),
    ).toContain('08:00');
    expect(
      validarHorarioPermitido({ inicio: null, fin: null }, '00:00', '23:59'),
    ).toBeNull();
  });

  it('detecta cruces de fechas incluyendo los extremos', () => {
    expect(seCruzanFechas('2026-12-01', '2026-12-10', '2026-12-10', '2026-12-20')).toBe(
      true,
    );
    expect(seCruzanFechas('2026-12-01', '2026-12-10', '2026-12-11', '2026-12-20')).toBe(
      false,
    );
  });

  it('identifica los documentos obligatorios faltantes', () => {
    expect(
      documentosFaltantes(
        [
          { id: '1', nombre: 'Documento de identidad', obligatorio: true },
          { id: '2', nombre: 'RUT', obligatorio: true },
          { id: '3', nombre: 'Cámara de comercio', obligatorio: false },
        ],
        [{ requisitoId: '1', nombreOriginal: 'cedula.pdf' }],
      ),
    ).toEqual(['RUT']);
  });

  it('formatea un rango de fechas para los mensajes', () => {
    expect(formatearRangoFechas('2026-12-01', '2026-12-15')).toBe(
      'del 01/12/2026 al 15/12/2026',
    );
  });
});
