import type { estado_solicitud } from '../generated/prisma/client';

/**
 * Estados del trámite de una solicitud de uso temporal (HU-16 a HU-20).
 *
 * Este archivo es la única fuente de verdad del backend para etiquetas,
 * estados finales y transiciones permitidas. El frontend mantiene sus propias
 * etiquetas visibles, pero las reglas del servidor salen de aquí.
 */
export const ETIQUETAS_ESTADO_SOLICITUD: Record<estado_solicitud, string> = {
  borrador: 'Borrador',
  radicada: 'Radicada',
  en_revision: 'En revisión',
  devuelta: 'Requiere corrección',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
};

/** Estados desde los que ya no se admite ninguna transición. */
export const ESTADOS_FINALES_SOLICITUD: readonly estado_solicitud[] = [
  'aprobada',
  'rechazada',
  'cancelada',
];

/**
 * Transiciones válidas del trámite.
 *
 * - `radicada → en_revision`: el gestor inicia la revisión.
 * - `en_revision → devuelta`: el gestor devuelve con observaciones.
 * - `en_revision → aprobada`: el gestor aprueba.
 * - `en_revision → rechazada`: el gestor rechaza con motivo obligatorio.
 * - `devuelta → en_revision`: el comerciante corrige los documentos.
 */
export const TRANSICIONES_ESTADO_SOLICITUD: Record<
  estado_solicitud,
  readonly estado_solicitud[]
> = {
  borrador: ['radicada'],
  radicada: ['en_revision'],
  en_revision: ['devuelta', 'aprobada', 'rechazada'],
  devuelta: ['en_revision'],
  aprobada: [],
  rechazada: [],
  cancelada: [],
};

/** Estados que el gestor puede solicitar mediante el endpoint de HU-18. */
export const ESTADOS_CAMBIO_GESTOR: readonly estado_solicitud[] = [
  'en_revision',
  'devuelta',
  'aprobada',
  'rechazada',
];

/** Devuelve la etiqueta legible de un estado. */
export function etiquetaEstadoSolicitud(estado: estado_solicitud): string {
  return ETIQUETAS_ESTADO_SOLICITUD[estado] ?? estado;
}

/** Indica si el estado es terminal. */
export function esEstadoFinalSolicitud(estado: estado_solicitud): boolean {
  return ESTADOS_FINALES_SOLICITUD.includes(estado);
}

/** Indica si la transición está permitida por la máquina de estados. */
export function puedeCambiarEstadoSolicitud(
  estadoActual: estado_solicitud,
  estadoNuevo: estado_solicitud,
): boolean {
  return TRANSICIONES_ESTADO_SOLICITUD[estadoActual].includes(estadoNuevo);
}

/** Tipo de notificación asociado a un estado de la solicitud. */
export function tipoNotificacionSolicitud(
  estado: estado_solicitud,
): `solicitud_${estado_solicitud}` {
  return `solicitud_${estado}`;
}
