import type {
  AdvertenciaModulo,
  CategoriaComercio,
  EstadoModulo,
  ModuloListado,
  TipoAdvertenciaModulo,
} from "@/types/api";
import {
  formatearAforo,
  formatearHorario,
  formatearProductos,
} from "@/features/mapa/estilos-zona";

export const ETIQUETAS_CATEGORIA: Record<CategoriaComercio, string> = {
  formal: "Formal",
  informal: "Informal",
};

export const TONO_CATEGORIA: Record<
  CategoriaComercio,
  "exitoso" | "pendiente"
> = {
  formal: "exitoso",
  informal: "pendiente",
};

export const ETIQUETAS_ESTADO_MODULO: Record<EstadoModulo, string> = {
  activo: "Activo",
  baja: "Dado de baja",
};

export const TONO_ESTADO_MODULO: Record<EstadoModulo, "exitoso" | "neutro"> = {
  activo: "exitoso",
  baja: "neutro",
};

export const ETIQUETAS_ADVERTENCIA: Record<TipoAdvertenciaModulo, string> = {
  zona_restringida: "Zona restringida",
  alta_congestion: "Alta congestión",
  fuera_de_zona: "Fuera de zona",
};

export const TONO_ADVERTENCIA: Record<
  TipoAdvertenciaModulo,
  "advertencia" | "informacion"
> = {
  zona_restringida: "advertencia",
  alta_congestion: "advertencia",
  fuera_de_zona: "informacion",
};

/** Texto del sector derivado de la zona contenedora. */
export function formatearSector(sector: string | null): string {
  return sector ?? "Sin zona";
}

/** Nombre visible del titular, sea cuenta registrada o nombre libre. */
export function nombreTitular(
  modulo: Pick<ModuloListado, "titular" | "titularNombre">,
): string {
  if (modulo.titular) {
    return [modulo.titular.nombre, modulo.titular.apellido]
      .filter(Boolean)
      .join(" ");
  }
  return modulo.titularNombre ?? "Sin titular";
}

/** Resumen de restricciones de la zona contenedora. */
export function resumenZona(
  zona: Pick<
    NonNullable<ModuloListado["zonaContenedora"]>,
    "nombre" | "tipo" | "horarioInicio" | "horarioFin" | "aforoMaximo" | "productos"
  > | null,
): string {
  if (!zona) return "El punto no está dentro de una zona activa.";
  return [
    zona.nombre,
    formatearHorario({ inicio: zona.horarioInicio, fin: zona.horarioFin }),
    formatearAforo(zona.aforoMaximo),
    formatearProductos(zona.productos),
  ].join(" · ");
}

/** Indica si alguna advertencia exige confirmación. */
export function tieneConfirmacion(
  advertencias: readonly AdvertenciaModulo[],
): boolean {
  return advertencias.some((advertencia) => advertencia.requiereConfirmacion);
}
