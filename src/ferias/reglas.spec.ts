import { sumarDias } from './agenda';
import {
  ESTADOS_FERIA_ACTIVA,
  etiquetaEstadoFeria,
  hoyBogotaISO,
  validarFechasFeria,
  validarPuestosContraAforo,
} from './reglas';

describe('reglas de feria', () => {
  describe('validarFechasFeria', () => {
    const hoy = hoyBogotaISO();

    it('acepta un rango de hoy en adelante', () => {
      expect(validarFechasFeria(hoy, sumarDias(hoy, 2))).toEqual([]);
    });

    it('rechaza una fecha de inicio anterior a hoy', () => {
      const errores = validarFechasFeria(sumarDias(hoy, -1), hoy);
      expect(errores).toContain(
        'La fecha de inicio no puede ser anterior a hoy',
      );
    });

    it('rechaza una fecha de fin anterior a la de inicio', () => {
      const errores = validarFechasFeria(sumarDias(hoy, 5), sumarDias(hoy, 2));
      expect(errores).toContain(
        'La fecha de fin debe ser igual o posterior a la fecha de inicio',
      );
    });

    it('rechaza formatos inválidos', () => {
      expect(validarFechasFeria('10/12/2026', '2026-12-12')).not.toEqual([]);
    });
  });

  describe('validarPuestosContraAforo', () => {
    it('acepta un número de puestos dentro del aforo', () => {
      expect(validarPuestosContraAforo(25, 25)).toBeNull();
      expect(validarPuestosContraAforo(1, 25)).toBeNull();
    });

    it('rechaza superar el aforo', () => {
      expect(validarPuestosContraAforo(26, 25)).toContain('supera el aforo');
    });

    it('rechaza una zona sin aforo definido', () => {
      expect(validarPuestosContraAforo(10, null)).toContain(
        'no tiene un aforo máximo definido',
      );
      expect(validarPuestosContraAforo(10, 0)).toContain(
        'no tiene un aforo máximo definido',
      );
    });

    it('rechaza cantidades no positivas', () => {
      expect(validarPuestosContraAforo(0, 25)).toContain(
        'debe ser mayor que cero',
      );
    });
  });

  it('solo radicada y aprobada ocupan la agenda', () => {
    expect(ESTADOS_FERIA_ACTIVA).toEqual(['radicada', 'aprobada']);
  });

  it('traduce los estados a etiquetas en español', () => {
    expect(etiquetaEstadoFeria('radicada')).toBe('Radicada');
    expect(etiquetaEstadoFeria('aprobada')).toBe('Aprobada');
    expect(etiquetaEstadoFeria('cancelada')).toBe('Cancelada');
  });
});
