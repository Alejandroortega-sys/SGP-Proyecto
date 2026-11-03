import {
  ETIQUETAS_TIPO,
  formatearAforo,
  formatearHorario,
} from "@/features/mapa/estilos-zona";
import { resumirValor } from "@/lib/formato";
import type { AccionVersionZona, CambioZonaVersion } from "@/types/api";

const ETIQUETAS_ACCION: Record<AccionVersionZona, string> = {
  creacion: "Zona creada",
  edicion: "Zona editada",
  activacion: "Zona activada",
  desactivacion: "Zona desactivada",
};

/** Etiqueta legible de la acción de una versión. */
export function textoAccionVersion(accion: AccionVersionZona): string {
  return ETIQUETAS_ACCION[accion] ?? accion;
}

/** Formatea un área en metros cuadrados. */
export function formatearArea(areaM2: number | null | undefined): string {
  if (areaM2 === null || areaM2 === undefined) return "sin área";
  return `${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(areaM2)} m²`;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

/** Formatea el valor anterior/nuevo de un campo del historial. */
export function formatearValorCambio(
  campo: string,
  valor: unknown,
): string {
  if (valor === null || valor === undefined) return "—";

  switch (campo) {
    case "tipo": {
      const tipo = valor as keyof typeof ETIQUETAS_TIPO;
      return ETIQUETAS_TIPO[tipo] ?? String(valor);
    }
    case "horario": {
      if (!esObjeto(valor)) return "—";
      return formatearHorario({
        inicio:
          typeof valor.inicio === "string" ? valor.inicio : null,
        fin: typeof valor.fin === "string" ? valor.fin : null,
      });
    }
    case "aforoMaximo":
      return formatearAforo(typeof valor === "number" ? valor : null);
    case "activa":
      return valor === true ? "Activa" : "Inactiva";
    case "productosPermitidos": {
      if (!Array.isArray(valor) || valor.length === 0) {
        return "Sin productos permitidos";
      }
      return valor.map((producto) => String(producto)).join(", ");
    }
    case "geometria": {
      if (!esObjeto(valor)) return "—";
      const vertices =
        typeof valor.vertices === "number" ? valor.vertices : null;
      const areaM2 =
        typeof valor.areaM2 === "number" ? valor.areaM2 : null;
      if (vertices === null) return formatearArea(areaM2);
      return `${vertices} vértice${vertices === 1 ? "" : "s"} · ${formatearArea(areaM2)}`;
    }
    default:
      return resumirValor(valor);
  }
}

/** Descripción textual de un cambio para la línea de tiempo. */
export function describirCambio(cambio: CambioZonaVersion): string {
  return `${cambio.etiqueta}: ${formatearValorCambio(
    cambio.campo,
    cambio.anterior,
  )} → ${formatearValorCambio(cambio.campo, cambio.nuevo)}`;
}

/** Clases de color según la acción versionada. */
export function clasesAccionVersion(accion: AccionVersionZona): string {
  switch (accion) {
    case "creacion":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "edicion":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "activacion":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "desactivacion":
      return "border-rose-200 bg-rose-50 text-rose-800";
    default:
      return "border-borde bg-fondo text-texto";
  }
}
