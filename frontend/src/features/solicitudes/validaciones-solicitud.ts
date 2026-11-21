import type {
  DatosRadicacionSolicitud,
  DisponibilidadSolicitud,
  HorarioEspacio,
  RequisitoDocumental,
} from "@/types/api";

export const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
export const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
export const TAMANO_MAXIMO_DOCUMENTO = 5 * 1024 * 1024;
export const TIPOS_DOCUMENTO_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export interface ArchivoAdjuntoSolicitud {
  requisitoId: string;
  archivo: File;
  nombre: string;
  tipo: string;
  tamano: number;
}

export interface ErroresSolicitud {
  espacio?: string;
  actividad?: string;
  productos?: string;
  fechas?: string;
  horas?: string;
  documentos?: string;
  disponibilidad?: string;
  general?: string;
}

/** Fecha actual en Colombia como `YYYY-MM-DD`. */
export function hoyISO(fecha: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

/** Indica si el texto es una fecha ISO real. */
export function esFechaISO(valor: string): boolean {
  if (!FORMATO_FECHA.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00.000Z`);
  return (
    !Number.isNaN(fecha.getTime()) &&
    fecha.toISOString().slice(0, 10) === valor
  );
}

/** Valida el paso de ubicación. */
export function validarPasoUbicacion(
  valores: DatosRadicacionSolicitud,
): ErroresSolicitud {
  if (!valores.espacioId) {
    return {
      espacio: "Selecciona el espacio que quieres solicitar desde el mapa.",
    };
  }
  return {};
}

/** Valida actividad y productos. */
export function validarPasoActividad(
  valores: DatosRadicacionSolicitud,
  productosPermitidos: string[] = [],
): ErroresSolicitud {
  const errores: ErroresSolicitud = {};
  const actividad = valores.actividad.trim();

  if (actividad.length < 3) {
    errores.actividad = "Describe la actividad con al menos 3 caracteres.";
  } else if (actividad.length > 200) {
    errores.actividad = "La actividad no puede superar 200 caracteres.";
  }

  if (valores.productoIds.length === 0) {
    errores.productos = "Selecciona al menos un producto.";
  } else if (productosPermitidos.length > 0) {
    const noPermitidos = valores.productoIds.filter(
      (id) => !productosPermitidos.includes(id),
    );
    if (noPermitidos.length > 0) {
      errores.productos =
        "Uno de los productos seleccionados no está permitido en la zona.";
    }
  }

  return errores;
}

/** Valida que estén los documentos obligatorios. */
export function validarPasoDocumentos(
  requisitos: RequisitoDocumental[],
  adjuntos: ArchivoAdjuntoSolicitud[],
): ErroresSolicitud {
  const cargados = new Set(adjuntos.map((adjunto) => adjunto.requisitoId));
  const faltantes = requisitos
    .filter((requisito) => requisito.obligatorio && !cargados.has(requisito.id))
    .map((requisito) => requisito.nombre);

  if (faltantes.length > 0) {
    return {
      documentos: `Faltan documentos obligatorios: ${faltantes.join(", ")}.`,
    };
  }

  const invalido = adjuntos.find(
    (adjunto) => validarArchivoDocumento(adjunto.archivo) !== null,
  );
  if (invalido) {
    return {
      documentos:
        validarArchivoDocumento(invalido.archivo) ??
        "Uno de los documentos no es válido.",
    };
  }

  return {};
}

/** Valida fechas, horas y horario permitido. */
export function validarPasoHorario(
  valores: DatosRadicacionSolicitud,
  horario: HorarioEspacio,
  disponibilidad: DisponibilidadSolicitud | null,
): ErroresSolicitud {
  const errores: ErroresSolicitud = {};
  const hoy = hoyISO();

  if (!valores.fechaInicio) {
    errores.fechas = "Indica la fecha de inicio.";
  } else if (!esFechaISO(valores.fechaInicio)) {
    errores.fechas = "La fecha de inicio no es válida.";
  } else if (valores.fechaInicio < hoy) {
    errores.fechas = "La fecha de inicio no puede ser anterior a hoy.";
  } else if (!valores.fechaFin) {
    errores.fechas = "Indica la fecha de fin.";
  } else if (!esFechaISO(valores.fechaFin)) {
    errores.fechas = "La fecha de fin no es válida.";
  } else if (valores.fechaFin < valores.fechaInicio) {
    errores.fechas =
      "La fecha de fin debe ser igual o posterior a la fecha de inicio.";
  }

  if (!FORMATO_HORA.test(valores.horaInicio)) {
    errores.horas = "La hora de inicio debe tener el formato HH:MM.";
  } else if (!FORMATO_HORA.test(valores.horaFin)) {
    errores.horas = "La hora de fin debe tener el formato HH:MM.";
  } else if (valores.horaFin <= valores.horaInicio) {
    errores.horas = "La hora de fin debe ser posterior a la hora de inicio.";
  } else if (
    (horario.inicio && valores.horaInicio < horario.inicio) ||
    (horario.fin && valores.horaFin > horario.fin)
  ) {
    errores.horas = `El horario debe estar entre ${
      horario.inicio ?? "el inicio permitido"
    } y ${horario.fin ?? "el fin permitido"}, según el horario permitido del espacio o de su zona.`;
  }

  if (!errores.fechas && !errores.horas && disponibilidad && !disponibilidad.disponible) {
    errores.disponibilidad =
      disponibilidad.motivo ?? "El espacio no está disponible en esas fechas y horas.";
  }

  return errores;
}

/** Valida el formulario completo antes de radicar. */
export function validarSolicitudCompleta(
  valores: DatosRadicacionSolicitud,
  requisitos: RequisitoDocumental[],
  adjuntos: ArchivoAdjuntoSolicitud[],
  horario: HorarioEspacio,
  disponibilidad: DisponibilidadSolicitud | null,
  productosPermitidos: string[],
): ErroresSolicitud {
  return {
    ...validarPasoUbicacion(valores),
    ...validarPasoActividad(valores, productosPermitidos),
    ...validarPasoDocumentos(requisitos, adjuntos),
    ...validarPasoHorario(valores, horario, disponibilidad),
  };
}

/** Indica si hay al menos un error. */
export function hayErrores(errores: ErroresSolicitud): boolean {
  return Object.values(errores).some(Boolean);
}

/** Valida tipo y tamaño de un archivo antes de adjuntarlo. */
export function validarArchivoDocumento(archivo: File): string | null {
  const tipo = archivo.type.toLowerCase();
  if (
    !TIPOS_DOCUMENTO_PERMITIDOS.includes(
      tipo as (typeof TIPOS_DOCUMENTO_PERMITIDOS)[number],
    )
  ) {
    return "El documento debe ser PDF, JPG o PNG.";
  }
  if (archivo.size === 0) {
    return "El documento está vacío.";
  }
  if (archivo.size > TAMANO_MAXIMO_DOCUMENTO) {
    return "Cada documento no puede superar 5 MB.";
  }
  return null;
}

/** Formatea un tamaño en bytes para mostrarlo en la interfaz. */
export function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
