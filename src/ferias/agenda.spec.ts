import {
  buscarConflicto,
  buscarTodosLosConflictos,
  diasInclusive,
  rangosSolapan,
  sugerirFechasLibres,
  sumarDias,
  unirRangos,
} from './agenda';

describe('agenda de ferias', () => {
  describe('rangosSolapan', () => {
    it('detecta el solape en los extremos porque el rango es inclusivo', () => {
      expect(
        rangosSolapan('2026-12-10', '2026-12-12', '2026-12-12', '2026-12-15'),
      ).toBe(true);
      expect(
        rangosSolapan('2026-12-10', '2026-12-12', '2026-12-08', '2026-12-10'),
      ).toBe(true);
    });

    it('detecta un rango contenido y un rango que contiene', () => {
      expect(
        rangosSolapan('2026-12-10', '2026-12-12', '2026-12-11', '2026-12-11'),
      ).toBe(true);
      expect(
        rangosSolapan('2026-12-01', '2026-12-31', '2026-12-10', '2026-12-12'),
      ).toBe(true);
    });

    it('no considera solape cuando los rangos son contiguos pero no se tocan', () => {
      expect(
        rangosSolapan('2026-12-10', '2026-12-12', '2026-12-13', '2026-12-15'),
      ).toBe(false);
    });
  });

  describe('buscarConflicto', () => {
    it('devuelve el primer rango ocupado que se cruza', () => {
      const conflicto = buscarConflicto(
        { fechaInicio: '2026-12-11', fechaFin: '2026-12-13' },
        [
          { fechaInicio: '2026-12-01', fechaFin: '2026-12-02' },
          { fechaInicio: '2026-12-12', fechaFin: '2026-12-14' },
        ],
      );

      expect(conflicto).toEqual({
        fechaInicio: '2026-12-12',
        fechaFin: '2026-12-14',
      });
    });

    it('devuelve null cuando no hay cruce', () => {
      expect(
        buscarConflicto({ fechaInicio: '2026-12-20', fechaFin: '2026-12-21' }, [
          { fechaInicio: '2026-12-10', fechaFin: '2026-12-12' },
        ]),
      ).toBeNull();
    });
  });

  describe('buscarTodosLosConflictos', () => {
    it('devuelve todos los cruces y no solo el primero', () => {
      const conflictos = buscarTodosLosConflictos(
        { fechaInicio: '2026-12-10', fechaFin: '2026-12-15' },
        [
          { fechaInicio: '2026-12-01', fechaFin: '2026-12-10' },
          { fechaInicio: '2026-12-12', fechaFin: '2026-12-13' },
          { fechaInicio: '2026-12-20', fechaFin: '2026-12-21' },
        ],
      );

      expect(conflictos).toHaveLength(2);
    });
  });

  describe('unirRangos', () => {
    it('une rangos solapados y contiguos sin alterar los separados', () => {
      expect(
        unirRangos([
          { fechaInicio: '2026-12-13', fechaFin: '2026-12-15' },
          { fechaInicio: '2026-12-10', fechaFin: '2026-12-12' },
          { fechaInicio: '2026-12-14', fechaFin: '2026-12-16' },
          { fechaInicio: '2026-12-20', fechaFin: '2026-12-21' },
        ]),
      ).toEqual([
        { fechaInicio: '2026-12-10', fechaFin: '2026-12-16' },
        { fechaInicio: '2026-12-20', fechaFin: '2026-12-21' },
      ]);
    });
  });

  describe('sugerirFechasLibres', () => {
    it('conserva la duración y salta los rangos ocupados', () => {
      const sugerencias = sugerirFechasLibres(
        { fechaInicio: '2026-12-10', fechaFin: '2026-12-12' },
        [
          { fechaInicio: '2026-12-10', fechaFin: '2026-12-12' },
          { fechaInicio: '2026-12-13', fechaFin: '2026-12-15' },
        ],
      );

      expect(sugerencias).toEqual([
        {
          fechaInicio: '2026-12-16',
          fechaFin: '2026-12-18',
          duracionDias: 3,
        },
        {
          fechaInicio: '2026-12-19',
          fechaFin: '2026-12-21',
          duracionDias: 3,
        },
        {
          fechaInicio: '2026-12-22',
          fechaFin: '2026-12-24',
          duracionDias: 3,
        },
      ]);
    });

    it('respeta el máximo y el horizonte configurados', () => {
      const sugerencias = sugerirFechasLibres(
        { fechaInicio: '2026-12-10', fechaFin: '2026-12-11' },
        [],
        { horizonteDias: 3, maximo: 5 },
      );

      expect(sugerencias).toHaveLength(2);
      expect(sugerencias[0]?.fechaInicio).toBe('2026-12-10');
      expect(sugerencias[1]?.fechaInicio).toBe('2026-12-12');
    });

    it('devuelve una lista vacía si el rango inicial es inválido', () => {
      expect(
        sugerirFechasLibres(
          { fechaInicio: '2026-12-12', fechaFin: '2026-12-10' },
          [],
        ),
      ).toEqual([]);
    });
  });

  it('calcula días inclusivos y suma días sin desfase de zona horaria', () => {
    expect(diasInclusive('2026-12-10', '2026-12-12')).toBe(3);
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
  });
});
