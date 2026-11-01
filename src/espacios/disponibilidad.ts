import type { estado_espacio } from '../generated/prisma/client';

/** Bloqueo de fechas asociado a un espacio. */
export interface BloqueoDisponibilidad {
  fechaInicio: string;
  fechaFin: string;
  motivo: string | null;
  activo: boolean;
}

/** Permiso vigente que ocupa un espacio. */
export interface PermisoDisponibilidad {
  numero: string;
  fechaInicio: string;
  fechaFin: string;
}

/** Solicitud aprobada que ocupa un espacio sin permiso emitido todavía. */
export interface SolicitudDisponibilidad {
  numeroRadicado: string;
  fechaInicio: string;
  fechaFin: string;
}

/** Contexto necesario para calcular el estado efectivo de un espacio. */
export interface ContextoDisponibilidad {
  estado: estado_espacio;
  bloqueo?: BloqueoDisponibilidad | null;
  permiso?: PermisoDisponibilidad | null;
  solicitud?: SolicitudDisponibilidad | null;
}

/** Resultado del cálculo de disponibilidad. */
export interface ResultadoDisponibilidad {
  estadoEfectivo: estado_espacio;
  disponible: boolean;
  motivoEstado: string | null;
}

/** Convierte una fecha ISO `YYYY-MM-DD` a `DD/MM/YYYY` sin zonas horarias. */
export function formatearFechaCorta(fecha: string): string {
  const partes = fecha.slice(0, 10).split('-');
  if (partes.length !== 3) return fecha;
  const [anio, mes, dia] = partes;
  return `${dia}/${mes}/${anio}`;
}

/** Texto legible del rango de fechas de un bloqueo o permiso. */
export function formatearRangoFechas(inicio: string, fin: string): string {
  return `del ${formatearFechaCorta(inicio)} al ${formatearFechaCorta(fin)}`;
}

/**
 * Calcula el estado que debe mostrarse al comerciante.
 *
 * Reglas (HU-09):
 * - `mantenimiento` siempre prevalece.
 * - Un bloqueo activo convierte el espacio en `bloqueado`.
 * - Un permiso vigente o una solicitud aprobada lo convierten en `asignado`.
 * - Si la BD lo registra como `bloqueado` o `asignado`, se respeta aunque no
 *   haya un registro auxiliar activo (la BD es la fuente de verdad).
 * - Solo un espacio `disponible` sin bloqueos ni ocupaciones es asignable.
 */
export function calcularDisponibilidad(
  contexto: ContextoDisponibilidad,
): ResultadoDisponibilidad {
  const { estado, bloqueo, permiso, solicitud } = contexto;

  if (estado === 'mantenimiento') {
    return {
      estadoEfectivo: 'mantenimiento',
      disponible: false,
      motivoEstado: 'El espacio está en mantenimiento.',
    };
  }

  if (bloqueo?.activo) {
    const detalle = bloqueo.motivo
      ? `«${bloqueo.motivo}»`
      : 'sin motivo registrado';
    return {
      estadoEfectivo: 'bloqueado',
      disponible: false,
      motivoEstado: `Bloqueado por ${detalle} ${formatearRangoFechas(
        bloqueo.fechaInicio,
        bloqueo.fechaFin,
      )}.`,
    };
  }

  if (permiso) {
    return {
      estadoEfectivo: 'asignado',
      disponible: false,
      motivoEstado: `Ocupado por el permiso ${permiso.numero} ${formatearRangoFechas(
        permiso.fechaInicio,
        permiso.fechaFin,
      )}.`,
    };
  }

  if (solicitud) {
    return {
      estadoEfectivo: 'asignado',
      disponible: false,
      motivoEstado: `Asignado a la solicitud aprobada ${solicitud.numeroRadicado} ${formatearRangoFechas(
        solicitud.fechaInicio,
        solicitud.fechaFin,
      )}.`,
    };
  }

  if (estado === 'bloqueado') {
    const motivo = bloqueo?.motivo
      ? `por «${bloqueo.motivo}»`
      : 'sin motivo registrado';
    const rango = bloqueo
      ? ` ${formatearRangoFechas(bloqueo.fechaInicio, bloqueo.fechaFin)}`
      : '';
    return {
      estadoEfectivo: 'bloqueado',
      disponible: false,
      motivoEstado: `Bloqueado ${motivo}${rango}.`,
    };
  }

  if (estado === 'asignado') {
    return {
      estadoEfectivo: 'asignado',
      disponible: false,
      motivoEstado: 'El espacio está asignado a un permiso o solicitud.',
    };
  }

  return {
    estadoEfectivo: 'disponible',
    disponible: true,
    motivoEstado: null,
  };
}
