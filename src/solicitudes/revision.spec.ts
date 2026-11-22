import {
  calcularProgresoRevision,
  documentosVigentesRevision,
  estadoDocumentoPorVerificacion,
  estadoRequisitoRevision,
  estaBloqueoVigente,
  minutosBloqueoRevision,
  minutosRestantesBloqueo,
  puedeTomarRevision,
  puedeVerificarRevision,
  validarObservacionVerificacion,
} from './revision';

describe('revision helpers', () => {
  afterEach(() => {
    delete process.env.REVISION_LOCK_MINUTES;
  });

  it('usa 15 minutos de bloqueo por defecto', () => {
    expect(minutosBloqueoRevision()).toBe(15);
  });

  it('lee el bloqueo configurado en minutos', () => {
    process.env.REVISION_LOCK_MINUTES = '30';
    expect(minutosBloqueoRevision()).toBe(30);
  });

  it('ignora una configuración inválida', () => {
    process.env.REVISION_LOCK_MINUTES = '0';
    expect(minutosBloqueoRevision()).toBe(15);
  });

  it('solo admite revisión en radicada y en revisión', () => {
    expect(puedeTomarRevision('radicada')).toBe(true);
    expect(puedeTomarRevision('en_revision')).toBe(true);
    expect(puedeTomarRevision('devuelta')).toBe(false);
    expect(puedeTomarRevision('aprobada')).toBe(false);
    expect(puedeVerificarRevision('en_revision')).toBe(true);
    expect(puedeVerificarRevision('radicada')).toBe(false);
  });

  it('detecta bloqueos vigentes y vencidos', () => {
    const ahora = new Date('2026-11-21T10:00:00.000Z');
    expect(estaBloqueoVigente('2026-11-21T10:15:00.000Z', ahora)).toBe(true);
    expect(estaBloqueoVigente('2026-11-21T09:59:00.000Z', ahora)).toBe(false);
  });

  it('traduce la verificación al estado del documento', () => {
    expect(estadoDocumentoPorVerificacion('cumple')).toBe('validado');
    expect(estadoDocumentoPorVerificacion('no_cumple')).toBe('observado');
  });

  it('calcula el estado visible del requisito', () => {
    expect(estadoRequisitoRevision(null, false)).toBe('faltante');
    expect(estadoRequisitoRevision('pendiente', true)).toBe('cargado');
    expect(estadoRequisitoRevision('validado', true)).toBe('cumple');
    expect(estadoRequisitoRevision('observado', true)).toBe('no_cumple');
  });

  it('calcula el progreso de la verificación', () => {
    expect(
      calcularProgresoRevision([
        { estado: 'cumple' },
        { estado: 'no_cumple' },
        { estado: 'cargado' },
        { estado: 'faltante' },
      ]),
    ).toEqual({
      total: 4,
      pendientes: 2,
      verificados: 2,
      cumple: 1,
      noCumple: 1,
    });
  });

  it('deja solo la versión vigente de cada documento', () => {
    const filas = [
      { id: 1n, reemplaza_a: null },
      { id: 2n, reemplaza_a: 1n },
      { id: 3n, reemplaza_a: null },
    ];
    expect(documentosVigentesRevision(filas).map((fila) => fila.id)).toEqual([
      2n,
      3n,
    ]);
  });

  it('exige observación al marcar No cumple', () => {
    expect(validarObservacionVerificacion('no_cumple', '')).toContain(
      'observación',
    );
    expect(validarObservacionVerificacion('no_cumple', 'RUT vencido')).toBeNull();
    expect(validarObservacionVerificacion('cumple', null)).toBeNull();
  });

  it('calcula los minutos restantes del bloqueo', () => {
    const ahora = new Date('2026-11-21T10:00:00.000Z');
    expect(
      minutosRestantesBloqueo('2026-11-21T10:10:00.000Z', ahora),
    ).toBe(10);
    expect(
      minutosRestantesBloqueo('2026-11-21T09:50:00.000Z', ahora),
    ).toBe(0);
  });
});
