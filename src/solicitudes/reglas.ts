import { cubreHorario, seCruzaHorario } from '../espacios/disponibilidad';

/** Formato de fecha ISO sin hora (`YYYY-MM-DD`). */
export const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Formato de hora de 24 horas (`HH:MM`). */
export const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Requisito documental mínimo que necesita el cálculo. */
export interface RequisitoDocumentalRegla {
  id: string;
  nombre: string;
  obligatorio: boolean;
}

/** Metadato de un archivo enviado en el formulario. */
export interface DocumentoMetaRegla {
  requisitoId: string;
  nombreOriginal: string;
}

/** Horario efectivo de un espacio o de su zona. */
export interface HorarioSolicitud {
  inicio: string | null;
  fin: string | null;
}

/**
 * Devuelve la fecha actual en la zona horaria de Colombia como `YYYY-MM-DD`.
 *
 * Las fechas de la solicitud son días calendario, no instantes: comparar con
 * `toISOString()` directamente podría desplazar el día en la noche.
 */
export function hoyEnBogota(fecha: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
}

/** Indica si el texto es una fecha ISO real y no solo un patrón válido. */
export function esFechaValida(fecha: string): boolean {
  if (!FORMATO_FECHA.test(fecha)) return false;
  const instante = new Date(`${fecha}T00:00:00.000Z`);
  return (
    !Number.isNaN(instante.getTime()) &&
    instante.toISOString().slice(0, 10) === fecha
  );
}

/**
 * Valida el rango de fechas de una radicación.
 *
 * - Ambas fechas deben ser días reales.
 * - La fecha final no puede ser anterior a la inicial.
 * - La fecha inicial no puede estar en el pasado.
 */
export function validarFechasRadicacion(
  fechaInicio: string,
  fechaFin: string,
  hoy: string = hoyEnBogota(),
): string[] {
  const errores: string[] = [];

  if (!esFechaValida(fechaInicio)) {
    errores.push('La fecha de inicio no es una fecha válida.');
  }
  if (!esFechaValida(fechaFin)) {
    errores.push('La fecha de fin no es una fecha válida.');
  }
  if (errores.length > 0) return errores;

  if (fechaFin < fechaInicio) {
    errores.push('La fecha de fin debe ser igual o posterior a la fecha de inicio.');
  }
  if (fechaInicio < hoy) {
    errores.push('La fecha de inicio no puede ser anterior a hoy.');
  }

  return errores;
}

/** Valida el rango horario de una radicación. */
export function validarHorasRadicacion(
  horaInicio: string,
  horaFin: string,
): string[] {
  const errores: string[] = [];

  if (!FORMATO_HORA.test(horaInicio)) {
    errores.push('La hora de inicio debe tener el formato HH:MM.');
  }
  if (!FORMATO_HORA.test(horaFin)) {
    errores.push('La hora de fin debe tener el formato HH:MM.');
  }
  if (errores.length > 0) return errores;

  if (horaFin <= horaInicio) {
    errores.push('La hora de fin debe ser posterior a la hora de inicio.');
  }

  return errores;
}

/**
 * Comprueba que el rango solicitado quepa en el horario permitido.
 *
 * Un espacio o zona sin horario no restringe la solicitud.
 */
export function validarHorarioPermitido(
  horario: HorarioSolicitud,
  horaInicio: string,
  horaFin: string,
): string | null {
  if (!cubreHorario(horario, horaInicio, horaFin)) {
    const inicio = horario.inicio ?? 'el inicio permitido';
    const fin = horario.fin ?? 'el fin permitido';
    return `El horario debe estar entre ${inicio} y ${fin}, según el horario permitido del espacio o de su zona.`;
  }
  return null;
}

/** Indica si dos rangos de fechas se solapan, incluyendo los extremos. */
export function seCruzanFechas(
  inicioA: string,
  finA: string,
  inicioB: string,
  finB: string,
): boolean {
  return inicioA <= finB && inicioB <= finA;
}

/** Indica si dos rangos horarios se cruzan. */
export function seCruzanHoras(
  inicioA: string,
  finA: string,
  inicioB: string,
  finB: string,
): boolean {
  return seCruzaHorario(inicioA, finA, inicioB, finB);
}

/** Devuelve los requisitos obligatorios que no tienen archivo asociado. */
export function documentosFaltantes(
  requisitos: readonly RequisitoDocumentalRegla[],
  metas: readonly DocumentoMetaRegla[],
): string[] {
  const cargados = new Set(metas.map((meta) => meta.requisitoId));
  return requisitos
    .filter((requisito) => requisito.obligatorio && !cargados.has(requisito.id))
    .map((requisito) => requisito.nombre);
}

/** Formatea una fecha `YYYY-MM-DD` como `DD/MM/YYYY`. */
export function formatearFechaCorta(fecha: string): string {
  const partes = fecha.slice(0, 10).split('-');
  if (partes.length !== 3) return fecha;
  const [anio, mes, dia] = partes;
  return `${dia}/${mes}/${anio}`;
}

/** Texto legible de un rango de fechas. */
export function formatearRangoFechas(inicio: string, fin: string): string {
  return `del ${formatearFechaCorta(inicio)} al ${formatearFechaCorta(fin)}`;
}
