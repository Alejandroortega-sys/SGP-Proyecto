import type {
  EspacioGestorDetalle,
  GeometriaPunto,
  SolicitudEspacioGestor,
  TipoEspacio,
} from "@/types/api";

export type EstadoManualEspacio = "disponible" | "mantenimiento";

export interface ValoresEspacio {
  nombre: string;
  tipo: TipoEspacio | "";
  sector: string;
  dimensiones: string;
  actividadPermitida: string;
  horarioInicio: string;
  horarioFin: string;
  estado: EstadoManualEspacio;
  punto: GeometriaPunto | null;
}

export interface ErroresEspacio {
  nombre?: string;
  tipo?: string;
  sector?: string;
  dimensiones?: string;
  actividad?: string;
  horario?: string;
  punto?: string;
}

/** Valores iniciales de un espacio nuevo. */
export function valoresInicialesEspacio(): ValoresEspacio {
  return {
    nombre: "",
    tipo: "puesto",
    sector: "",
    dimensiones: "",
    actividadPermitida: "",
    horarioInicio: "",
    horarioFin: "",
    estado: "disponible",
    punto: null,
  };
}

/** Convierte la ficha administrativa en valores de formulario. */
export function espacioDesdeDetalle(
  espacio: EspacioGestorDetalle,
): ValoresEspacio {
  return {
    nombre: espacio.nombre,
    tipo: espacio.tipo,
    sector: espacio.sector ?? "",
    dimensiones: espacio.dimensiones ?? "",
    actividadPermitida: espacio.actividadPermitida ?? "",
    horarioInicio: espacio.horarioPropio.inicio ?? "",
    horarioFin: espacio.horarioPropio.fin ?? "",
    estado:
      espacio.estado === "mantenimiento" ? "mantenimiento" : "disponible",
    punto: espacio.ubicacion,
  };
}

function texto(valor: string): string {
  return valor.trim();
}

/** Valida el formulario antes de llamar a la API. */
export function validarValoresEspacio(
  valores: ValoresEspacio,
): ErroresEspacio {
  const errores: ErroresEspacio = {};

  const nombre = texto(valores.nombre);
  if (nombre.length === 0) {
    errores.nombre = "El nombre es obligatorio.";
  } else if (nombre.length > 150) {
    errores.nombre = "El nombre no puede superar 150 caracteres.";
  }

  if (
    valores.tipo !== "modulo" &&
    valores.tipo !== "kiosco" &&
    valores.tipo !== "puesto" &&
    valores.tipo !== "espacio_movil"
  ) {
    errores.tipo = "Selecciona un tipo de espacio.";
  }

  if (texto(valores.sector).length > 100) {
    errores.sector = "El sector no puede superar 100 caracteres.";
  }
  if (texto(valores.dimensiones).length > 60) {
    errores.dimensiones = "Las dimensiones no pueden superar 60 caracteres.";
  }
  if (texto(valores.actividadPermitida).length > 100) {
    errores.actividad =
      "La actividad permitida no puede superar 100 caracteres.";
  }

  const tieneInicio = texto(valores.horarioInicio).length > 0;
  const tieneFin = texto(valores.horarioFin).length > 0;
  if (tieneInicio !== tieneFin) {
    errores.horario = "Indica la hora de inicio y la hora de fin juntas.";
  } else if (tieneInicio && tieneFin) {
    const inicio = texto(valores.horarioInicio);
    const fin = texto(valores.horarioFin);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(inicio)) {
      errores.horario = "La hora de inicio no es válida.";
    } else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(fin)) {
      errores.horario = "La hora de fin no es válida.";
    } else if (fin <= inicio) {
      errores.horario = "La hora de fin debe ser posterior a la hora de inicio.";
    }
  }

  if (!valores.punto) {
    errores.punto = "Selecciona la ubicación del espacio en el mapa.";
  }

  return errores;
}

/** Indica si el formulario tiene errores. */
export function tieneErroresEspacio(errores: ErroresEspacio): boolean {
  return Object.values(errores).some(Boolean);
}

/** Construye el cuerpo que espera la API. */
export function construirSolicitudEspacio(
  valores: ValoresEspacio,
): SolicitudEspacioGestor {
  if (!valores.punto) {
    throw new Error("No se puede guardar un espacio sin ubicación.");
  }
  if (valores.tipo === "") {
    throw new Error("No se puede guardar un espacio sin tipo.");
  }

  const inicio = texto(valores.horarioInicio);
  const fin = texto(valores.horarioFin);

  return {
    nombre: texto(valores.nombre),
    tipo: valores.tipo,
    sector: texto(valores.sector) || null,
    dimensiones: texto(valores.dimensiones) || null,
    actividadPermitida: texto(valores.actividadPermitida) || null,
    ubicacion: valores.punto,
    horarioInicio: inicio || null,
    horarioFin: fin || null,
    estado: valores.estado,
  };
}

/** Compara dos puntos por sus coordenadas. */
export function mismoPunto(
  izquierda: GeometriaPunto | null,
  derecha: GeometriaPunto | null,
): boolean {
  if (!izquierda || !derecha) return izquierda === derecha;
  return (
    izquierda.coordinates[0] === derecha.coordinates[0] &&
    izquierda.coordinates[1] === derecha.coordinates[1]
  );
}

/** Valida un rango de bloqueo en el navegador. */
export function validarRangoBloqueo(
  inicio: string,
  fin: string,
): string | null {
  if (!inicio || !fin) {
    return "Indica la fecha de inicio y la fecha de fin.";
  }
  if (fin < inicio) {
    return "La fecha de fin debe ser igual o posterior a la fecha de inicio.";
  }
  return null;
}
