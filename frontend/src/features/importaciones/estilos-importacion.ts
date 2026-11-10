import type { EstadoFilaImportacion, TipoImportacion } from "@/types/api";

/** Colores de las geometrías y marcadores de previsualización. */
export const COLORES_ESTADO_IMPORTACION: Record<
  EstadoFilaImportacion,
  string
> = {
  valida: "#059669",
  advertencia: "#d97706",
  rechazada: "#dc2626",
};

/** Etiquetas de las pestañas de importación. */
export const ETIQUETAS_TIPO_IMPORTACION: Record<TipoImportacion, string> = {
  zonas: "Zonas (GeoJSON)",
  modulos: "Módulos (CSV)",
};

/** Descripción corta de cada tipo. */
export const DESCRIPCION_TIPO_IMPORTACION: Record<TipoImportacion, string> = {
  zonas:
    "Carga un FeatureCollection de polígonos. El sistema valida la geometría, la reproyecta a EPSG:4326 y muestra el resultado antes de crear las zonas.",
  modulos:
    "Carga un CSV con encabezados categoria, actividad, latitud, longitud y titular_documento o titular_nombre. Cada fila se valida por separado.",
};
