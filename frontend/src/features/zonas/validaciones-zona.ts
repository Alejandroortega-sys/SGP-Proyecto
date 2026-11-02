import type {
  Producto,
  SolicitudZona,
  TipoZona,
  ZonaDetalle,
} from "@/types/api";
import { aGeoJsonPoligono, type Punto } from "./geometria-zona";

/** Valores editables del formulario de clasificación y restricciones. */
export interface ValoresZona {
  nombre: string;
  tipo: TipoZona;
  horarioInicio: string;
  horarioFin: string;
  aforoMaximo: string;
  productosPermitidos: string[];
}

/** Errores de validación de los campos del formulario. */
export interface ErroresValoresZona {
  nombre?: string;
  tipo?: string;
  horario?: string;
  aforo?: string;
  productos?: string;
}

const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIPOS_VALIDOS: readonly TipoZona[] = [
  "permitida",
  "restringida",
  "alta_congestion",
];

/** Valores iniciales para una zona nueva. */
export function valoresIniciales(): ValoresZona {
  return {
    nombre: "",
    tipo: "permitida",
    horarioInicio: "",
    horarioFin: "",
    aforoMaximo: "",
    productosPermitidos: [],
  };
}

/**
 * Convierte el detalle de una zona a valores del formulario. Solo conserva
 * productos activos: los inactivos se muestran aparte como advertencia.
 */
export function valoresDesdeZona(zona: ZonaDetalle): ValoresZona {
  return {
    nombre: zona.nombre,
    tipo: zona.tipo,
    horarioInicio: zona.horarioInicio ?? "",
    horarioFin: zona.horarioFin ?? "",
    aforoMaximo: zona.aforoMaximo?.toString() ?? "",
    productosPermitidos: zona.productosPermitidos
      .filter((producto) => producto.activo)
      .map((producto) => producto.id),
  };
}

function mismosProductos(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const ordenadosA = [...a].sort();
  const ordenadosB = [...b].sort();
  return ordenadosA.every((id, indice) => id === ordenadosB[indice]);
}

/** Valida los campos del formulario antes de construir la solicitud. */
export function validarValoresZona(
  valores: ValoresZona,
  productosDisponibles: readonly Producto[],
): ErroresValoresZona {
  const errores: ErroresValoresZona = {};
  const nombre = valores.nombre.trim();

  if (nombre.length < 3) {
    errores.nombre = "El nombre de la zona debe tener al menos 3 caracteres.";
  } else if (nombre.length > 150) {
    errores.nombre = "El nombre de la zona no puede superar 150 caracteres.";
  }

  if (!TIPOS_VALIDOS.includes(valores.tipo)) {
    errores.tipo = "Selecciona un tipo de zona válido.";
  }

  const inicio = valores.horarioInicio.trim();
  const fin = valores.horarioFin.trim();
  if (inicio !== "" || fin !== "") {
    if (inicio === "" || fin === "") {
      errores.horario =
        "El horario de inicio y fin deben definirse juntos.";
    } else if (!FORMATO_HORA.test(inicio) || !FORMATO_HORA.test(fin)) {
      errores.horario =
        "El horario debe tener formato HH:MM en 24 horas (por ejemplo, 06:00).";
    } else if (fin <= inicio) {
      errores.horario =
        "El horario de fin debe ser posterior al horario de inicio.";
    }
  }

  const aforo = valores.aforoMaximo.trim();
  if (aforo !== "") {
    if (!/^\d+$/.test(aforo) || Number(aforo) < 1) {
      errores.aforo =
        "El aforo máximo debe ser un número entero mayor que cero.";
    }
  }

  if (valores.productosPermitidos.length > 100) {
    errores.productos =
      "No se pueden asociar más de 100 productos a una zona.";
  } else if (
    new Set(valores.productosPermitidos).size !==
    valores.productosPermitidos.length
  ) {
    errores.productos = "No se puede repetir un producto permitido.";
  } else {
    const activos = new Set(
      productosDisponibles
        .filter((producto) => producto.activo)
        .map((producto) => producto.id),
    );
    if (valores.productosPermitidos.some((id) => !activos.has(id))) {
      errores.productos =
        "Uno o más productos seleccionados no están activos en el catálogo.";
    }
  }

  return errores;
}

/** Indica si hay al menos un error de formulario. */
export function tieneErrores(errores: ErroresValoresZona): boolean {
  return Object.values(errores).some(Boolean);
}

/** Construye el cuerpo de `POST /zonas`. */
export function construirCuerpoCreacion(
  valores: ValoresZona,
  puntos: readonly Punto[],
): SolicitudZona {
  const inicio = valores.horarioInicio.trim();
  const fin = valores.horarioFin.trim();
  const aforo = valores.aforoMaximo.trim();

  const cuerpo: SolicitudZona = {
    nombre: valores.nombre.trim(),
    tipo: valores.tipo,
    geometria: aGeoJsonPoligono(puntos),
    productosPermitidos: [...valores.productosPermitidos],
  };

  if (inicio !== "" && fin !== "") {
    cuerpo.horarioInicio = inicio;
    cuerpo.horarioFin = fin;
  }
  if (aforo !== "") {
    cuerpo.aforoMaximo = Number(aforo);
  }

  return cuerpo;
}

/**
 * Construye el cuerpo de `PATCH /zonas/:id` con los campos que cambiaron.
 * Enviar `[]` en productos reemplaza la lista completa; `null` borra horario
 * o aforo, tal como documenta el backend.
 */
export function construirCuerpoActualizacion(
  valores: ValoresZona,
  iniciales: ValoresZona,
  puntos: readonly Punto[],
  geometriaCambiada: boolean,
): Partial<SolicitudZona> {
  const cambios: Partial<SolicitudZona> = {};

  if (valores.nombre.trim() !== iniciales.nombre.trim()) {
    cambios.nombre = valores.nombre.trim();
  }
  if (valores.tipo !== iniciales.tipo) {
    cambios.tipo = valores.tipo;
  }
  if (geometriaCambiada) {
    cambios.geometria = aGeoJsonPoligono(puntos);
  }

  const inicio = valores.horarioInicio.trim();
  const fin = valores.horarioFin.trim();
  const inicioInicial = iniciales.horarioInicio.trim();
  const finInicial = iniciales.horarioFin.trim();
  const tieneHorario = inicio !== "" || fin !== "";
  const teniaHorario = inicioInicial !== "" || finInicial !== "";

  if (tieneHorario && (inicio !== inicioInicial || fin !== finInicial)) {
    cambios.horarioInicio = inicio;
    cambios.horarioFin = fin;
  } else if (!tieneHorario && teniaHorario) {
    cambios.horarioInicio = null;
    cambios.horarioFin = null;
  }

  const aforo = valores.aforoMaximo.trim();
  if (aforo !== iniciales.aforoMaximo.trim()) {
    cambios.aforoMaximo = aforo === "" ? null : Number(aforo);
  }

  if (
    !mismosProductos(
      valores.productosPermitidos,
      iniciales.productosPermitidos,
    )
  ) {
    cambios.productosPermitidos = [...valores.productosPermitidos];
  }

  return cambios;
}
