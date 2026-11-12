import type { BloqueoEspacioGestor } from "@/types/api";

export interface MesCalendario {
  anio: number;
  mes: number;
}

export interface DiaCalendario {
  fecha: string;
  dia: number;
  delMes: boolean;
}

export const MESES_ESPANOL = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export const DIAS_SEMANA = [
  "Lun",
  "Mar",
  "Mié",
  "Jue",
  "Vie",
  "Sáb",
  "Dom",
] as const;

function dosDigitos(valor: number): string {
  return valor.toString().padStart(2, "0");
}

/** Construye una fecha ISO `YYYY-MM-DD` sin zona horaria. */
export function fechaISO(anio: number, mes: number, dia: number): string {
  return `${anio}-${dosDigitos(mes)}-${dosDigitos(dia)}`;
}

/** Mes actual del navegador. */
export function mesActual(): MesCalendario {
  const hoy = new Date();
  return { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 };
}

/** Avanza o retrocede meses sin desbordar el año. */
export function desplazarMes(
  actual: MesCalendario,
  delta: number,
): MesCalendario {
  const indice = actual.anio * 12 + (actual.mes - 1) + delta;
  return {
    anio: Math.floor(indice / 12),
    mes: (indice % 12) + 1,
  };
}

/** Texto legible del mes. */
export function nombreMes(mes: MesCalendario): string {
  return `${MESES_ESPANOL[mes.mes - 1]} ${mes.anio}`;
}

/** Cantidad de días del mes. */
export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/**
 * Genera una cuadrícula de 6 semanas (42 días) que empieza en lunes.
 * Incluye los días de los meses vecinos para completar la cuadrícula.
 */
export function generarCuadricula(mes: MesCalendario): DiaCalendario[] {
  const primerDia = new Date(Date.UTC(mes.anio, mes.mes - 1, 1));
  const diaSemana = (primerDia.getUTCDay() + 6) % 7; // lunes = 0
  const inicio = new Date(
    Date.UTC(mes.anio, mes.mes - 1, 1 - diaSemana),
  );
  const celdas: DiaCalendario[] = [];

  for (let indice = 0; indice < 42; indice += 1) {
    const fecha = new Date(inicio);
    fecha.setUTCDate(inicio.getUTCDate() + indice);
    const anio = fecha.getUTCFullYear();
    const numeroMes = fecha.getUTCMonth() + 1;
    celdas.push({
      fecha: fechaISO(anio, numeroMes, fecha.getUTCDate()),
      dia: fecha.getUTCDate(),
      delMes: anio === mes.anio && numeroMes === mes.mes,
    });
  }

  return celdas;
}

/** Indica si una fecha ISO está dentro de un rango inclusivo. */
export function estaEnRango(
  fecha: string,
  inicio: string,
  fin: string,
): boolean {
  return fecha >= inicio.slice(0, 10) && fecha <= fin.slice(0, 10);
}

/** Bloqueos que cubren una fecha concreta. */
export function bloqueosDelDia(
  fecha: string,
  bloqueos: BloqueoEspacioGestor[],
): BloqueoEspacioGestor[] {
  return bloqueos.filter((bloqueo) =>
    estaEnRango(fecha, bloqueo.fechaInicio, bloqueo.fechaFin),
  );
}

/** Texto corto del rango de un bloqueo. */
export function resumirRango(inicio: string, fin: string): string {
  if (inicio === fin) return inicio;
  return `${inicio} a ${fin}`;
}
