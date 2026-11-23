import type { EstadoFeria, EventoAgendaFeria } from "@/types/api";
import {
  DIAS_SEMANA,
  MESES_ESPANOL,
  desplazarMes,
  diasDelMes,
  fechaISO,
  generarCuadricula,
  mesActual,
  nombreMes,
  type DiaCalendario,
  type MesCalendario,
} from "@/features/espacios-gestor/calendario-utilidades";

export {
  DIAS_SEMANA,
  MESES_ESPANOL,
  desplazarMes,
  diasDelMes,
  fechaISO,
  generarCuadricula,
  mesActual,
  nombreMes,
  type DiaCalendario,
  type MesCalendario,
};

export const ESTADOS_FERIA_ACTIVOS: EstadoFeria[] = ["radicada", "aprobada"];

export const ESTADOS_FERIA_CALENDARIO: EstadoFeria[] = [
  "radicada",
  "aprobada",
  "realizada",
  "cancelada",
  "rechazada",
];

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function aTiempo(fecha: string): number {
  const [anio, mes, dia] = fecha.slice(0, 10).split("-").map(Number);
  return Date.UTC(anio, mes - 1, dia);
}

function aFechaISO(tiempo: number): string {
  return new Date(tiempo).toISOString().slice(0, 10);
}

/** Fecha de hoy según la zona local del navegador. */
export function hoyISO(): string {
  const ahora = new Date();
  return fechaISO(
    ahora.getFullYear(),
    ahora.getMonth() + 1,
    ahora.getDate(),
  );
}

/** Suma días a una fecha ISO sin depender de la zona horaria. */
export function sumarDias(fecha: string, dias: number): string {
  return aFechaISO(aTiempo(fecha) + dias * MS_POR_DIA);
}

/** Lunes de la semana que contiene la fecha. */
export function inicioSemana(fecha: string): string {
  const tiempo = aTiempo(fecha);
  const dia = new Date(tiempo).getUTCDay();
  const desplazamiento = (dia + 6) % 7;
  return aFechaISO(tiempo - desplazamiento * MS_POR_DIA);
}

/** Desplaza una fecha de referencia en semanas completas. */
export function desplazarSemana(fecha: string, delta: number): string {
  return sumarDias(inicioSemana(fecha), delta * 7);
}

/** Siete días de la semana que empieza en la fecha indicada. */
export function diasDeSemana(fecha: string): string[] {
  const inicio = inicioSemana(fecha);
  return Array.from({ length: 7 }, (_valor, indice) =>
    sumarDias(inicio, indice),
  );
}

/** Rango inclusivo de un mes calendario. */
export function rangoMes(mes: MesCalendario): { desde: string; hasta: string } {
  return {
    desde: fechaISO(mes.anio, mes.mes, 1),
    hasta: fechaISO(mes.anio, mes.mes, diasDelMes(mes.anio, mes.mes)),
  };
}

/** Rango inclusivo de la semana que contiene la fecha. */
export function rangoSemana(fecha: string): { desde: string; hasta: string } {
  const desde = inicioSemana(fecha);
  return { desde, hasta: sumarDias(desde, 6) };
}

/** Texto legible de la semana. */
export function nombreSemana(fecha: string): string {
  const dias = diasDeSemana(fecha);
  const primero = dias[0];
  const ultimo = dias[6];
  if (!primero || !ultimo) return "";
  return `Semana del ${formatearCorta(primero)} al ${formatearCorta(ultimo)}`;
}

/** Convierte `YYYY-MM-DD` en `DD/MM/YYYY`. */
export function formatearCorta(fecha: string): string {
  const [anio, mes, dia] = fecha.slice(0, 10).split("-");
  if (!anio || !mes || !dia) return fecha;
  return `${dia}/${mes}/${anio}`;
}

/** Indica si una fecha está dentro de un rango inclusivo. */
export function estaEnRango(
  fecha: string,
  inicio: string,
  fin: string,
): boolean {
  return fecha >= inicio.slice(0, 10) && fecha <= fin.slice(0, 10);
}

/** Eventos que ocupan una fecha concreta. */
export function eventosDelDia(
  fecha: string,
  eventos: readonly EventoAgendaFeria[],
): EventoAgendaFeria[] {
  return eventos.filter((evento) =>
    estaEnRango(fecha, evento.fechaInicio, evento.fechaFin),
  );
}

/** Eventos de una zona concreta. */
export function eventosDeZona(
  eventos: readonly EventoAgendaFeria[],
  zonaId: string,
): EventoAgendaFeria[] {
  if (!zonaId) return [...eventos];
  return eventos.filter((evento) => evento.zona.id === zonaId);
}

/** Indica si un evento empieza en la fecha indicada. */
export function iniciaEnDia(evento: EventoAgendaFeria, fecha: string): boolean {
  return evento.fechaInicio.slice(0, 10) === fecha;
}

/** Clave de orden estable para un evento dentro de un día. */
export function ordenarEventos(
  eventos: readonly EventoAgendaFeria[],
): EventoAgendaFeria[] {
  return [...eventos].sort((a, b) => {
    if (a.fechaInicio !== b.fechaInicio) {
      return a.fechaInicio.localeCompare(b.fechaInicio);
    }
    return a.nombre.localeCompare(b.nombre);
  });
}

/** Cuenta eventos por estado para el resumen del calendario. */
export function contarPorEstado(
  eventos: readonly EventoAgendaFeria[],
): Record<EstadoFeria, number> {
  const conteo: Record<EstadoFeria, number> = {
    radicada: 0,
    aprobada: 0,
    rechazada: 0,
    cancelada: 0,
    realizada: 0,
  };
  for (const evento of eventos) conteo[evento.estado] += 1;
  return conteo;
}

/** Texto corto del rango de un evento. */
export function rangoEvento(evento: EventoAgendaFeria): string {
  if (evento.fechaInicio === evento.fechaFin) {
    return formatearCorta(evento.fechaInicio);
  }
  return `${formatearCorta(evento.fechaInicio)} – ${formatearCorta(
    evento.fechaFin,
  )}`;
}

/** Estado legible del evento. */
export function textoEstado(estado: EstadoFeria): string {
  return (
    {
      radicada: "Radicada",
      aprobada: "Aprobada",
      rechazada: "Rechazada",
      cancelada: "Cancelada",
      realizada: "Realizada",
    } satisfies Record<EstadoFeria, string>
  )[estado];
}
