/** Rango de fechas inclusivo en formato `YYYY-MM-DD`. */
export interface RangoFechas {
  fechaInicio: string;
  fechaFin: string;
}

/** Rango ocupado por otra feria en la misma zona. */
export interface RangoOcupado extends RangoFechas {
  id?: string;
}

/** Sugerencia de fechas libres para la misma zona. */
export interface SugerenciaFechas extends RangoFechas {
  duracionDias: number;
}

/** Ventana de búsqueda por defecto para las sugerencias. */
export const HORIZONTE_SUGERENCIAS_DIAS = 90;

/** Cantidad máxima por defecto de sugerencias. */
export const MAX_SUGERENCIAS = 3;

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Convierte `YYYY-MM-DD` a milisegundos UTC a medianoche. */
function aTiempo(fecha: string): number {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return Date.UTC(anio, mes - 1, dia);
}

/** Convierte milisegundos UTC a `YYYY-MM-DD`. */
function aFechaISO(tiempo: number): string {
  return new Date(tiempo).toISOString().slice(0, 10);
}

/** Suma días a una fecha ISO sin depender de la zona horaria local. */
export function sumarDias(fecha: string, dias: number): string {
  return aFechaISO(aTiempo(fecha) + dias * MS_POR_DIA);
}

/** Cantidad de días inclusivos entre dos fechas ISO. */
export function diasInclusive(fechaInicio: string, fechaFin: string): number {
  return (
    Math.round((aTiempo(fechaFin) - aTiempo(fechaInicio)) / MS_POR_DIA) + 1
  );
}

/**
 * Indica si dos rangos ISO se solapan, incluyendo los extremos.
 *
 * Las fechas `YYYY-MM-DD` se pueden comparar como texto porque el formato es
 * lexicográficamente ordenable.
 */
export function rangosSolapan(
  inicioA: string,
  finA: string,
  inicioB: string,
  finB: string,
): boolean {
  return inicioA <= finB && inicioB <= finA;
}

/** Devuelve el primer rango ocupado que se cruza con el solicitado. */
export function buscarConflicto<T extends RangoFechas>(
  rango: RangoFechas,
  ocupados: readonly T[],
): T | null {
  return (
    ocupados.find((ocupado) =>
      rangosSolapan(
        rango.fechaInicio,
        rango.fechaFin,
        ocupado.fechaInicio,
        ocupado.fechaFin,
      ),
    ) ?? null
  );
}

/**
 * Busca fechas libres para la misma zona conservando la duración solicitada.
 *
 * Recorre la ventana desde la fecha de inicio solicitada, día a día, y devuelve
 * hasta `maximo` rangos que no se crucen con los ocupados ni entre sí.
 */
export function sugerirFechasLibres(
  solicitado: RangoFechas,
  ocupados: readonly RangoFechas[],
  opciones: {
    horizonteDias?: number;
    maximo?: number;
  } = {},
): SugerenciaFechas[] {
  if (!FORMATO_FECHA.test(solicitado.fechaInicio)) return [];
  if (!FORMATO_FECHA.test(solicitado.fechaFin)) return [];

  const duracionDias = diasInclusive(
    solicitado.fechaInicio,
    solicitado.fechaFin,
  );
  if (duracionDias < 1) return [];

  const horizonte = opciones.horizonteDias ?? HORIZONTE_SUGERENCIAS_DIAS;
  const maximo = opciones.maximo ?? MAX_SUGERENCIAS;
  const limite = aTiempo(solicitado.fechaInicio) + horizonte * MS_POR_DIA;

  const sugerencias: SugerenciaFechas[] = [];
  let candidato = solicitado.fechaInicio;

  while (sugerencias.length < maximo) {
    const inicio = aTiempo(candidato);
    if (inicio > limite) break;

    const fin = sumarDias(candidato, duracionDias - 1);
    const rango = { fechaInicio: candidato, fechaFin: fin };

    if (!buscarConflicto(rango, ocupados)) {
      sugerencias.push({ ...rango, duracionDias });
      // Salta el rango sugerido para no devolver alternativas pegadas.
      candidato = sumarDias(fin, 1);
    } else {
      candidato = sumarDias(candidato, 1);
    }
  }

  return sugerencias;
}
