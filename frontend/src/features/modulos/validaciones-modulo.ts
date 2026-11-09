import type {
  CategoriaComercio,
  GeometriaPunto,
  SolicitudModulo,
} from "@/types/api";

/** Tamaño máximo que también valida el backend. */
export const MAX_BYTES_FOTO = 5 * 1024 * 1024;

export const TIPOS_FOTO_PERMITIDOS = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const EXTENSIONES_FOTO_PERMITIDAS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
] as const;

export const ACEPTAR_TIPOS_FOTO =
  "image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export type ModoTitular = "registrado" | "libre";

export interface ValoresModulo {
  categoria: CategoriaComercio | "";
  actividad: string;
  titularModo: ModoTitular;
  titularId: string;
  titularNombre: string;
  punto: GeometriaPunto | null;
}

export interface ArchivoSeleccionable {
  name: string;
  type: string;
  size: number;
}

export interface ErroresModulo {
  categoria?: string;
  actividad?: string;
  titular?: string;
  punto?: string;
  foto?: string;
  advertencia?: string;
}

/** Valores iniciales para un censo nuevo. */
export function valoresInicialesModulo(): ValoresModulo {
  return {
    categoria: "informal",
    actividad: "",
    titularModo: "libre",
    titularId: "",
    titularNombre: "",
    punto: null,
  };
}

/** Valida la foto en el navegador antes de enviarla. */
export function validarArchivoFoto(
  archivo: ArchivoSeleccionable | null | undefined,
): string | null {
  if (!archivo) return null;

  if (archivo.size <= 0) {
    return "La foto seleccionada está vacía.";
  }
  if (archivo.size > MAX_BYTES_FOTO) {
    return "La foto no puede superar 5 MB.";
  }

  const tipo = archivo.type.toLowerCase();
  const nombre = archivo.name.toLowerCase();
  const tipoValido = TIPOS_FOTO_PERMITIDOS.includes(
    tipo as (typeof TIPOS_FOTO_PERMITIDOS)[number],
  );
  const extensionValida = EXTENSIONES_FOTO_PERMITIDAS.some((extension) =>
    nombre.endsWith(extension),
  );

  if (!tipoValido && !extensionValida) {
    return "La foto debe ser JPG, PNG o WebP.";
  }

  return null;
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

/** Indica si este guardado necesita aceptar la advertencia de zona. */
export function requiereAceptacionEfectiva(
  requiereConfirmacion: boolean,
  esEdicion: boolean,
  puntoInicial: GeometriaPunto | null,
  puntoActual: GeometriaPunto | null,
): boolean {
  if (!requiereConfirmacion) return false;
  if (!esEdicion) return true;
  return !mismoPunto(puntoInicial, puntoActual);
}

/** Valida el formulario antes de llamar a la API. */
export function validarValoresModulo(
  valores: ValoresModulo,
  opciones: {
    foto?: ArchivoSeleccionable | null;
    requiereConfirmacion: boolean;
    aceptaAdvertencia: boolean;
    esEdicion?: boolean;
    puntoInicial?: GeometriaPunto | null;
  },
): ErroresModulo {
  const errores: ErroresModulo = {};

  if (valores.categoria !== "formal" && valores.categoria !== "informal") {
    errores.categoria = "Selecciona la categoría formal o informal.";
  }

  const actividad = valores.actividad.trim();
  if (actividad.length === 0) {
    errores.actividad = "La actividad es obligatoria.";
  } else if (actividad.length > 200) {
    errores.actividad = "La actividad no puede superar 200 caracteres.";
  }

  if (valores.titularModo === "registrado" && valores.titularId.trim() === "") {
    errores.titular = "Selecciona un comerciante registrado como titular.";
  }
  if (valores.titularModo === "libre") {
    const nombre = valores.titularNombre.trim();
    if (nombre.length === 0) {
      errores.titular = "Escribe el nombre del titular.";
    } else if (nombre.length > 150) {
      errores.titular = "El nombre del titular no puede superar 150 caracteres.";
    }
  }

  if (!valores.punto) {
    errores.punto = "Selecciona el punto del módulo sobre el mapa.";
  }

  const errorFoto = validarArchivoFoto(opciones.foto);
  if (errorFoto) errores.foto = errorFoto;

  const requiere = requiereAceptacionEfectiva(
    opciones.requiereConfirmacion,
    opciones.esEdicion ?? false,
    opciones.puntoInicial ?? null,
    valores.punto,
  );
  if (requiere && !opciones.aceptaAdvertencia) {
    errores.advertencia =
      "Debes confirmar que conoces la restricción de la zona para continuar.";
  }

  return errores;
}

/** Indica si el objeto de errores tiene al menos un mensaje. */
export function tieneErroresModulo(errores: ErroresModulo): boolean {
  return Object.values(errores).some(Boolean);
}

/** Construye el cuerpo que espera el cliente multipart. */
export function construirSolicitudModulo(
  valores: ValoresModulo,
  aceptaAdvertencia: boolean,
): SolicitudModulo {
  if (!valores.punto) {
    throw new Error("No se puede construir el censo sin un punto.");
  }
  if (valores.categoria !== "formal" && valores.categoria !== "informal") {
    throw new Error("No se puede construir el censo sin categoría.");
  }

  const solicitud: SolicitudModulo = {
    categoria: valores.categoria,
    actividad: valores.actividad.trim(),
    ubicacion: valores.punto,
  };

  if (valores.titularModo === "registrado") {
    solicitud.titularId = valores.titularId.trim();
  } else {
    solicitud.titularNombre = valores.titularNombre.trim();
  }

  if (aceptaAdvertencia) {
    solicitud.aceptaAdvertencia = true;
  }

  return solicitud;
}
