import type { FiltrosEspacios } from "@/types/api";

/** Estado del formulario de filtros antes de aplicarlo. */
export interface FiltrosFormulario {
  sector: string;
  actividad: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

/** Formulario vacío. */
export const FILTROS_FORMULARIO_VACIOS: FiltrosFormulario = {
  sector: "",
  actividad: "",
  fecha: "",
  horaInicio: "",
  horaFin: "",
};

/** Errores de validación del formulario. */
export interface ErroresFiltros {
  fecha?: string;
  horario?: string;
}

/** Cuenta los filtros activos (sin contar el toggle de no disponibles). */
export function contarFiltrosActivos(filtros: FiltrosFormulario): number {
  let total = 0;
  if (filtros.sector.trim()) total += 1;
  if (filtros.actividad.trim()) total += 1;
  if (filtros.fecha) total += 1;
  if (filtros.horaInicio && filtros.horaFin) total += 1;
  return total;
}

/** Indica si hay al menos un filtro activo. */
export function hayFiltrosActivos(filtros: FiltrosFormulario): boolean {
  return contarFiltrosActivos(filtros) > 0;
}

/**
 * Valida el formulario.
 *
 * - Las horas se envían juntas.
 * - El horario exige una fecha.
 * - La hora de fin debe ser posterior a la de inicio.
 */
export function validarFiltros(
  filtros: FiltrosFormulario,
): ErroresFiltros {
  const errores: ErroresFiltros = {};
  const tieneInicio = Boolean(filtros.horaInicio);
  const tieneFin = Boolean(filtros.horaFin);

  if (tieneInicio !== tieneFin) {
    errores.horario =
      "Completa la hora de inicio y la hora de fin para filtrar por horario.";
  } else if (tieneInicio && tieneFin) {
    if (!filtros.fecha) {
      errores.fecha =
        "Selecciona una fecha para consultar la disponibilidad por horario.";
    }
    if (filtros.horaFin <= filtros.horaInicio) {
      errores.horario =
        "La hora de fin debe ser posterior a la hora de inicio.";
    }
  }

  return errores;
}

/** Indica si la validación produjo errores. */
export function tieneErrores(errores: ErroresFiltros): boolean {
  return Boolean(errores.fecha || errores.horario);
}

/** Convierte el formulario al contrato de la API. */
export function filtrosParaApi(
  filtros: FiltrosFormulario,
  incluirNoDisponibles: boolean,
): FiltrosEspacios {
  return {
    incluirNoDisponibles,
    sector: filtros.sector.trim() || undefined,
    actividad: filtros.actividad.trim() || undefined,
    fecha: filtros.fecha || undefined,
    horaInicio: filtros.horaInicio || undefined,
    horaFin: filtros.horaFin || undefined,
  };
}

/** Texto legible del rango horario. */
export function formatearRangoHorario(
  inicio: string,
  fin: string,
): string {
  if (!inicio && !fin) return "";
  return `${inicio || "—"} a ${fin || "—"}`;
}
