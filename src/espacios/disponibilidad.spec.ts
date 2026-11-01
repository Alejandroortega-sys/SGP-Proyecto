import {
  calcularDisponibilidad,
  cubreHorario,
  formatearFechaCorta,
  formatearRangoFechas,
  seCruzaHorario,
} from './disponibilidad';

const BLOQUEO = {
  fechaInicio: '2026-10-25',
  fechaFin: '2026-10-31',
  motivo: 'Mantenimiento del andén',
  activo: true,
};

const PERMISO = {
  numero: 'PER-2026-00001',
  fechaInicio: '2026-11-01',
  fechaFin: '2026-11-30',
};

const SOLICITUD = {
  numeroRadicado: 'SOL-2026-00002',
  fechaInicio: '2026-11-10',
  fechaFin: '2026-11-20',
};

describe('disponibilidad de espacios', () => {
  it('deja disponible un espacio sin bloqueos ni ocupaciones', () => {
    expect(calcularDisponibilidad({ estado: 'disponible' })).toEqual({
      estadoEfectivo: 'disponible',
      disponible: true,
      motivoEstado: null,
    });
  });

  it('respeta el estado bloqueado registrado en la BD', () => {
    const resultado = calcularDisponibilidad({
      estado: 'bloqueado',
      bloqueo: { ...BLOQUEO, activo: false },
    });

    expect(resultado.estadoEfectivo).toBe('bloqueado');
    expect(resultado.disponible).toBe(false);
    expect(resultado.motivoEstado).toContain('Mantenimiento del andén');
  });

  it('convierte en bloqueado un espacio disponible con bloqueo activo', () => {
    const resultado = calcularDisponibilidad({
      estado: 'disponible',
      bloqueo: BLOQUEO,
    });

    expect(resultado.estadoEfectivo).toBe('bloqueado');
    expect(resultado.disponible).toBe(false);
    expect(resultado.motivoEstado).toContain('25/10/2026');
    expect(resultado.motivoEstado).toContain('31/10/2026');
  });

  it('marca como ocupado un espacio con permiso vigente', () => {
    const resultado = calcularDisponibilidad({
      estado: 'disponible',
      permiso: PERMISO,
    });

    expect(resultado.estadoEfectivo).toBe('asignado');
    expect(resultado.disponible).toBe(false);
    expect(resultado.motivoEstado).toContain('PER-2026-00001');
  });

  it('marca como ocupado un espacio con solicitud aprobada', () => {
    const resultado = calcularDisponibilidad({
      estado: 'disponible',
      solicitud: SOLICITUD,
    });

    expect(resultado.estadoEfectivo).toBe('asignado');
    expect(resultado.disponible).toBe(false);
    expect(resultado.motivoEstado).toContain('SOL-2026-00002');
  });

  it('prioriza el bloqueo sobre una ocupación', () => {
    const resultado = calcularDisponibilidad({
      estado: 'disponible',
      bloqueo: BLOQUEO,
      permiso: PERMISO,
    });

    expect(resultado.estadoEfectivo).toBe('bloqueado');
  });

  it('mantiene el estado de mantenimiento aunque exista un permiso', () => {
    const resultado = calcularDisponibilidad({
      estado: 'mantenimiento',
      permiso: PERMISO,
    });

    expect(resultado.estadoEfectivo).toBe('mantenimiento');
    expect(resultado.disponible).toBe(false);
  });

  it('respeta el estado asignado registrado sin permiso activo', () => {
    const resultado = calcularDisponibilidad({ estado: 'asignado' });

    expect(resultado.estadoEfectivo).toBe('asignado');
    expect(resultado.disponible).toBe(false);
  });

  it('formatea fechas y rangos sin desfase de zona horaria', () => {
    expect(formatearFechaCorta('2026-10-31')).toBe('31/10/2026');
    expect(formatearRangoFechas('2026-10-25', '2026-10-31')).toBe(
      'del 25/10/2026 al 31/10/2026',
    );
  });

  it('valida si un rango cabe dentro del horario permitido', () => {
    const horario = { inicio: '06:00', fin: '14:00' };

    expect(cubreHorario(horario, '06:00', '14:00')).toBe(true);
    expect(cubreHorario(horario, '08:00', '12:00')).toBe(true);
    expect(cubreHorario(horario, '05:00', '12:00')).toBe(false);
    expect(cubreHorario(horario, '10:00', '15:00')).toBe(false);
    expect(cubreHorario({ inicio: null, fin: null }, '10:00', '15:00')).toBe(
      true,
    );
    expect(cubreHorario(horario, null, null)).toBe(true);
  });

  it('detecta cruces de horarios con intervalos [inicio, fin)', () => {
    expect(seCruzaHorario('10:00', '12:00', '11:00', '13:00')).toBe(true);
    expect(seCruzaHorario('10:00', '12:00', '12:00', '14:00')).toBe(false);
    expect(seCruzaHorario('10:00', '12:00', '06:00', '10:00')).toBe(false);
    expect(seCruzaHorario('10:00', '12:00', '09:00', '11:00')).toBe(true);
  });
});
