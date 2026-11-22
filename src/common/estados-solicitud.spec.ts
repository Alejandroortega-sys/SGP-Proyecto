import {
  ESTADOS_CAMBIO_GESTOR,
  ESTADOS_FINALES_SOLICITUD,
  etiquetaEstadoSolicitud,
  esEstadoFinalSolicitud,
  puedeCambiarEstadoSolicitud,
  tipoNotificacionSolicitud,
} from './estados-solicitud';

describe('máquina de estados de solicitud', () => {
  it('permite el flujo de revisión del gestor', () => {
    expect(puedeCambiarEstadoSolicitud('radicada', 'en_revision')).toBe(true);
    expect(puedeCambiarEstadoSolicitud('en_revision', 'devuelta')).toBe(true);
    expect(puedeCambiarEstadoSolicitud('en_revision', 'aprobada')).toBe(true);
    expect(puedeCambiarEstadoSolicitud('en_revision', 'rechazada')).toBe(true);
    expect(puedeCambiarEstadoSolicitud('devuelta', 'en_revision')).toBe(true);
  });

  it('rechaza transiciones no previstas', () => {
    expect(puedeCambiarEstadoSolicitud('radicada', 'aprobada')).toBe(false);
    expect(puedeCambiarEstadoSolicitud('devuelta', 'aprobada')).toBe(false);
    expect(puedeCambiarEstadoSolicitud('aprobada', 'en_revision')).toBe(false);
    expect(puedeCambiarEstadoSolicitud('rechazada', 'devuelta')).toBe(false);
    expect(puedeCambiarEstadoSolicitud('cancelada', 'radicada')).toBe(false);
  });

  it('marca aprobada, rechazada y cancelada como finales', () => {
    expect(ESTADOS_FINALES_SOLICITUD).toEqual([
      'aprobada',
      'rechazada',
      'cancelada',
    ]);
    for (const estado of ESTADOS_FINALES_SOLICITUD) {
      expect(esEstadoFinalSolicitud(estado)).toBe(true);
    }
    expect(esEstadoFinalSolicitud('radicada')).toBe(false);
    expect(esEstadoFinalSolicitud('devuelta')).toBe(false);
  });

  it('expone etiquetas y tipos de notificación estables', () => {
    expect(etiquetaEstadoSolicitud('devuelta')).toBe('Requiere corrección');
    expect(etiquetaEstadoSolicitud('en_revision')).toBe('En revisión');
    expect(tipoNotificacionSolicitud('aprobada')).toBe('solicitud_aprobada');
    expect(ESTADOS_CAMBIO_GESTOR).toEqual([
      'en_revision',
      'devuelta',
      'aprobada',
      'rechazada',
    ]);
  });
});
