/**
 * Evento interno para sincronizar el indicador de notificaciones no leídas.
 *
 * La bandeja lo dispara al marcar una notificación o todas; `MarcoSesion`
 * escucha y vuelve a consultar el contador sin esperar a una navegación.
 */
export const EVENTO_NOTIFICACIONES_ACTUALIZADAS =
  'sgp:notificaciones-actualizadas';

/** Avisa al marco de sesión que el contador de no leídas cambió. */
export function avisarNotificacionesActualizadas(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(EVENTO_NOTIFICACIONES_ACTUALIZADAS));
}
