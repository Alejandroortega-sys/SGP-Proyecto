import type { estado_feria } from '../generated/prisma/client';

/** Estados que ocupan la agenda de una zona. */
export const ESTADOS_FERIA_ACTIVA: readonly estado_feria[] = [
  'radicada',
  'aprobada',
];

/** Estados posibles de una feria, en el orden del enum de la BD. */
export const ESTADOS_FERIA: readonly estado_feria[] = [
  'radicada',
  'aprobada',
  'rechazada',
  'cancelada',
  'realizada',
];

/** Etiquetas visibles de los estados de una feria. */
export const ETIQUETAS_ESTADO_FERIA: Record<estado_feria, string> = {
  radicada: 'Radicada',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
  realizada: 'Realizada',
};

/** Estados que el gestor puede aprobar. */
export function puedeAprobarFeria(estado: estado_feria): boolean {
  return estado === 'radicada';
}

/** Estados que el gestor puede mover en el calendario. */
export function puedeMoverFeria(estado: estado_feria): boolean {
  return estado === 'radicada' || estado === 'aprobada';
}

/** Estados que el gestor puede cancelar. */
export function puedeCancelarFeria(estado: estado_feria): boolean {
  return estado === 'radicada' || estado === 'aprobada';
}

/** Valida el motivo obligatorio de cancelación. */
export function validarMotivoCancelacion(motivo: string): string | null {
  const limpio = motivo.trim();
  if (limpio.length === 0) {
    return 'Debes escribir el motivo de la cancelación.';
  }
  if (limpio.length > 2000) {
    return 'El motivo de la cancelación no puede superar 2000 caracteres.';
  }
  return null;
}

/** Devuelve la etiqueta en español de un estado de feria. */
export function etiquetaEstadoFeria(estado: estado_feria): string {
  return ETIQUETAS_ESTADO_FERIA[estado] ?? estado;
}

/**
 * Fecha de hoy en `America/Bogota` en formato `YYYY-MM-DD`.
 *
 * Se calcula con `Intl` para no depender de la zona horaria del servidor.
 */
export function hoyBogotaISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Valida el rango de fechas de una feria. */
export function validarFechasFeria(
  fechaInicio: string,
  fechaFin: string,
): string[] {
  const errores: string[] = [];
  const formato = /^\d{4}-\d{2}-\d{2}$/;

  if (!formato.test(fechaInicio)) {
    errores.push('La fecha de inicio debe tener el formato YYYY-MM-DD');
  }
  if (!formato.test(fechaFin)) {
    errores.push('La fecha de fin debe tener el formato YYYY-MM-DD');
  }
  if (errores.length > 0) return errores;

  const hoy = hoyBogotaISO();
  if (fechaInicio < hoy) {
    errores.push('La fecha de inicio no puede ser anterior a hoy');
  }
  if (fechaFin < fechaInicio) {
    errores.push(
      'La fecha de fin debe ser igual o posterior a la fecha de inicio',
    );
  }

  return errores;
}

/** Valida el número de puestos contra el aforo de la zona. */
export function validarPuestosContraAforo(
  numeroPuestos: number,
  aforoMaximo: number | null | undefined,
): string | null {
  if (!Number.isInteger(numeroPuestos) || numeroPuestos <= 0) {
    return 'El número de puestos debe ser mayor que cero';
  }

  if (aforoMaximo === null || aforoMaximo === undefined || aforoMaximo <= 0) {
    return 'La zona seleccionada no tiene un aforo máximo definido y no admite ferias';
  }

  if (numeroPuestos > aforoMaximo) {
    return `El número de puestos (${numeroPuestos}) supera el aforo máximo de la zona (${aforoMaximo})`;
  }

  return null;
}
