import type {
  EstadoFilaImportacion,
  FilaPreviewImportacion,
  TipoImportacion,
} from "@/types/api";

/** Límite de tamaño del archivo de importación. */
export const MAX_BYTES_IMPORTACION = 10 * 1024 * 1024;

/** Extensiones aceptadas por tipo de importación. */
export const EXTENSIONES_IMPORTACION: Record<TipoImportacion, string> = {
  zonas: ".geojson,.json",
  modulos: ".csv",
};

/** Valida extensión, tamaño y contenido vacío antes de subir el archivo. */
export function validarArchivoImportacion(
  archivo: File | null,
  tipo: TipoImportacion,
): string | null {
  if (!archivo) return "Selecciona un archivo para continuar.";
  if (archivo.size === 0) return "El archivo está vacío.";

  if (archivo.size > MAX_BYTES_IMPORTACION) {
    return `El archivo supera el máximo de ${formatearBytes(MAX_BYTES_IMPORTACION)}.`;
  }

  const nombre = archivo.name.toLowerCase();
  const valido =
    tipo === "zonas"
      ? nombre.endsWith(".geojson") || nombre.endsWith(".json")
      : nombre.endsWith(".csv");

  if (!valido) {
    return tipo === "zonas"
      ? "El archivo de zonas debe ser .geojson o .json."
      : "El archivo de módulos debe ser .csv.";
  }

  return null;
}

/** Formatea un tamaño en bytes para mostrar al usuario. */
export function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Convierte un valor heterogéneo de la API en texto legible. */
export function formatearDato(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (Array.isArray(valor)) {
    return valor.length > 0 ? valor.map(formatearDato).join(", ") : "—";
  }
  if (typeof valor === "object") {
    try {
      return JSON.stringify(valor);
    } catch {
      return "—";
    }
  }
  return String(valor);
}

/** Texto principal y secundario de una fila de previsualización. */
export function resumenFilaImportacion(
  fila: FilaPreviewImportacion,
  tipo: TipoImportacion,
): { titulo: string; detalle: string } {
  if (tipo === "zonas") {
    const nombre = formatearDato(fila.datos.nombre);
    const partes = [
      `Tipo: ${formatearDato(fila.datos.tipo)}`,
      fila.datos.aforoMaximo !== null && fila.datos.aforoMaximo !== undefined
        ? `Aforo: ${formatearDato(fila.datos.aforoMaximo)}`
        : null,
      Array.isArray(fila.datos.productosPermitidos) &&
      fila.datos.productosPermitidos.length > 0
        ? `Productos: ${formatearDato(fila.datos.productosPermitidos)}`
        : null,
    ].filter((parte): parte is string => parte !== null);

    return { titulo: nombre, detalle: partes.join(" · ") };
  }

  const actividad = formatearDato(fila.datos.actividad);
  const titular =
    fila.datos.titular_nombre ??
    fila.datos.titular_documento ??
    fila.datos.titularId;
  const partes = [
    `Categoría: ${formatearDato(fila.datos.categoria)}`,
    `Titular: ${formatearDato(titular)}`,
    `${formatearDato(fila.datos.latitud)}, ${formatearDato(fila.datos.longitud)}`,
    fila.zonaContenedora
      ? `Zona: ${fila.zonaContenedora.nombre}`
      : "Fuera de zona activa",
  ];

  return { titulo: actividad, detalle: partes.join(" · ") };
}

export const ETIQUETAS_ESTADO_FILA: Record<EstadoFilaImportacion, string> = {
  valida: "Válida",
  rechazada: "Rechazada",
  advertencia: "Con advertencia",
};

export const TONO_ESTADO_FILA: Record<
  EstadoFilaImportacion,
  "exitoso" | "peligro" | "pendiente"
> = {
  valida: "exitoso",
  rechazada: "peligro",
  advertencia: "pendiente",
};

/** Plantilla CSV de módulos con BOM para Excel. */
export function crearPlantillaCsvModulos(): string {
  return (
    "\uFEFF" +
    [
      "categoria,actividad,latitud,longitud,titular_documento,titular_nombre",
      "informal,Venta de empanadas,4.0885,-76.1955,,Nelson Mina",
      "formal,Artesanías,4.0900,-76.1940,123456789,",
    ].join("\r\n") +
    "\r\n"
  );
}

/** Plantilla GeoJSON de una zona de ejemplo. */
export function crearPlantillaGeoJsonZonas(): string {
  return JSON.stringify(
    {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            nombre: "Zona de ejemplo",
            tipo: "permitida",
            horarioInicio: "06:00",
            horarioFin: "18:00",
            aforoMaximo: 20,
            productosPermitidos: "Frutas frescas; Verduras",
          },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-76.198, 4.086],
                [-76.194, 4.086],
                [-76.194, 4.09],
                [-76.198, 4.09],
                [-76.198, 4.086],
              ],
            ],
          },
        },
      ],
    },
    null,
    2,
  );
}
