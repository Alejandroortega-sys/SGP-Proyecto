import type { EstadoFeria, ZonaFeria } from "@/types/api";

/** Valores del formulario de solicitud de feria. */
export interface ValoresFeria {
  nombre: string;
  tipoFeria: string;
  zonaId: string;
  fechaInicio: string;
  fechaFin: string;
  numeroPuestos: string;
  productoIds: string[];
}

/** Errores por campo del formulario. */
export type ErroresFeria = Partial<
  Record<keyof ValoresFeria | "general" | "adjuntos", string>
>;

export const FORMULARIO_FERIA_VACIO: ValoresFeria = {
  nombre: "",
  tipoFeria: "",
  zonaId: "",
  fechaInicio: "",
  fechaFin: "",
  numeroPuestos: "",
  productoIds: [],
};

/** Fecha de hoy en formato `YYYY-MM-DD`, según la zona local del navegador. */
export function hoyISO(): string {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

/** Etiquetas visibles de los estados de una feria. */
export const ETIQUETAS_ESTADO_FERIA: Record<EstadoFeria, string> = {
  radicada: "Radicada",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  cancelada: "Cancelada",
  realizada: "Realizada",
};

/** Texto en español de un estado de feria. */
export function textoEstadoFeria(estado: EstadoFeria): string {
  return ETIQUETAS_ESTADO_FERIA[estado] ?? estado;
}

/** Valida el formulario antes de enviarlo al servidor. */
export function validarFormularioFeria(
  valores: ValoresFeria,
  zona: ZonaFeria | null,
): ErroresFeria {
  const errores: ErroresFeria = {};
  const nombre = valores.nombre.trim();
  const tipoFeria = valores.tipoFeria.trim();
  const hoy = hoyISO();

  if (nombre.length < 3 || nombre.length > 200) {
    errores.nombre = "El nombre de la feria debe tener entre 3 y 200 caracteres.";
  }
  if (tipoFeria.length < 3 || tipoFeria.length > 100) {
    errores.tipoFeria =
      "El tipo de feria debe tener entre 3 y 100 caracteres.";
  }
  if (!valores.zonaId) {
    errores.zonaId = "Selecciona la zona donde se realizará la feria.";
  }
  if (!valores.fechaInicio) {
    errores.fechaInicio = "Indica la fecha de inicio.";
  } else if (valores.fechaInicio < hoy) {
    errores.fechaInicio = "La fecha de inicio no puede ser anterior a hoy.";
  }
  if (!valores.fechaFin) {
    errores.fechaFin = "Indica la fecha de fin.";
  } else if (valores.fechaInicio && valores.fechaFin < valores.fechaInicio) {
    errores.fechaFin =
      "La fecha de fin debe ser igual o posterior a la fecha de inicio.";
  }

  const puestos = Number(valores.numeroPuestos);
  if (!Number.isInteger(puestos) || puestos <= 0) {
    errores.numeroPuestos = "El número de puestos debe ser mayor que cero.";
  } else if (zona?.aforoMaximo !== null && zona?.aforoMaximo !== undefined) {
    if (puestos > zona.aforoMaximo) {
      errores.numeroPuestos = `La zona admite máximo ${zona.aforoMaximo} puestos.`;
    }
  }

  if (zona && (zona.aforoMaximo === null || zona.aforoMaximo <= 0)) {
    errores.zonaId = "La zona seleccionada no tiene aforo definido.";
  }

  if (valores.productoIds.length === 0) {
    errores.productoIds = "Selecciona al menos un producto.";
  }

  return errores;
}

/** Indica si el formulario no tiene errores. */
export function sinErrores(errores: ErroresFeria): boolean {
  return Object.keys(errores).length === 0;
}
