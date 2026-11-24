import type { CupoParticipantes, ProductoFeria } from "@/types/api";

export interface ValoresParticipante {
  nombre: string;
  documento: string;
  productoIds: string[];
}

export type ErroresParticipante = Partial<
  Record<keyof ValoresParticipante | "general", string>
>;

export const FORMULARIO_PARTICIPANTE_VACIO: ValoresParticipante = {
  nombre: "",
  documento: "",
  productoIds: [],
};

interface ContextoValidacion {
  catalogo: ProductoFeria[];
  productosPermitidos: string[];
  cupo: CupoParticipantes;
  esEdicion: boolean;
}

/** Valida el formulario de participante antes de enviarlo. */
export function validarFormularioParticipante(
  valores: ValoresParticipante,
  contexto: ContextoValidacion,
): ErroresParticipante {
  const errores: ErroresParticipante = {};
  const nombre = valores.nombre.trim();
  const documento = valores.documento.trim();

  if (nombre.length < 3 || nombre.length > 150) {
    errores.nombre =
      "El nombre del vendedor debe tener entre 3 y 150 caracteres.";
  }

  if (documento.length > 0 && (documento.length < 3 || documento.length > 30)) {
    errores.documento = "El documento debe tener entre 3 y 30 caracteres.";
  }

  if (valores.productoIds.length === 0) {
    errores.productoIds = "Selecciona al menos un producto.";
  } else {
    const permitidos = new Set(contexto.productosPermitidos);
    const seleccionados = contexto.catalogo.filter((producto) =>
      valores.productoIds.includes(producto.id),
    );

    if (seleccionados.length !== valores.productoIds.length) {
      errores.productoIds = "Uno o más productos seleccionados no son válidos.";
    } else if (
      permitidos.size > 0 &&
      seleccionados.some((producto) => !permitidos.has(producto.nombre))
    ) {
      errores.productoIds =
        "Uno o más productos no están permitidos en la zona de la feria.";
    }
  }

  if (!contexto.esEdicion && contexto.cupo.completo) {
    errores.general = `La feria alcanzó su cupo aprobado de ${contexto.cupo.aprobado} participantes. Retira uno para agregar otro.`;
  }

  return errores;
}

/** Indica si el formulario no tiene errores. */
export function sinErroresParticipante(
  errores: ErroresParticipante,
): boolean {
  return Object.keys(errores).length === 0;
}

/** Calcula el cupo disponible a partir de los valores del servidor. */
export function calcularCupo(
  aprobado: number,
  ocupados: number,
): CupoParticipantes {
  const disponibles = Math.max(0, aprobado - ocupados);
  return {
    aprobado,
    ocupados,
    disponibles,
    completo: ocupados >= aprobado,
  };
}

/** El listado final solo se puede enviar si hay participantes y no se envió. */
export function puedeEnviarListado(
  enviado: boolean,
  totalParticipantes: number,
): boolean {
  return !enviado && totalParticipantes > 0;
}
