import type { TipoImportacion } from './almacen-previsualizaciones';

/** Datos de una fila rechazada que se incluye en el reporte. */
export interface FilaReporte {
  fila: number;
  motivo: string;
  datos: Record<string, unknown>;
}

/** Contenido completo del reporte descargable. */
export interface ReporteImportacion {
  tipo: TipoImportacion;
  archivo: string;
  fecha: Date;
  total: number;
  importados: number;
  rechazados: number;
  filas: FilaReporte[];
}

const ENCABEZADOS: Record<TipoImportacion, string[]> = {
  zonas: ['fila', 'nombre', 'tipo', 'motivo'],
  modulos: [
    'fila',
    'categoria',
    'actividad',
    'latitud',
    'longitud',
    'titular_documento',
    'titular_nombre',
    'motivo',
  ],
};

/** Convierte un valor en una celda CSV segura. */
export function celdaCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return '';

  let texto: string;
  if (valor instanceof Date) {
    texto = valor.toISOString();
  } else if (typeof valor === 'string') {
    texto = valor;
  } else if (
    typeof valor === 'number' ||
    typeof valor === 'boolean' ||
    typeof valor === 'bigint'
  ) {
    texto = String(valor);
  } else if (typeof valor === 'object') {
    texto = JSON.stringify(valor);
  } else {
    texto = '';
  }

  // Evita que Excel interprete el contenido como una fórmula. Un número
  // negativo es un dato legítimo y no debe llevar apóstrofo.
  if (
    /^[=+@]/.test(texto) ||
    (texto.startsWith('-') && !/^-\d+(?:\.\d+)?$/.test(texto))
  ) {
    texto = `'${texto}`;
  }

  if (/[",\r\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }

  return texto;
}

function valorDeFila(
  tipo: TipoImportacion,
  fila: FilaReporte,
  encabezado: string,
): unknown {
  if (encabezado === 'fila') return fila.fila;
  if (encabezado === 'motivo') return fila.motivo;
  return fila.datos[encabezado];
}

/**
 * Genera el CSV de errores con BOM UTF-8.
 *
 * Incluye un resumen inicial y una fila por cada registro rechazado.
 */
export function generarReporteCsv(reporte: ReporteImportacion): string {
  const nombreTipo = reporte.tipo === 'zonas' ? 'zonas' : 'módulos';
  const encabezados = ENCABEZADOS[reporte.tipo];

  const lineas = [
    `Reporte de importación de ${nombreTipo}`,
    `Fecha: ${reporte.fecha.toISOString()}`,
    `Archivo: ${reporte.archivo}`,
    `Total de registros: ${reporte.total}`,
    `Importados: ${reporte.importados}`,
    `Rechazados: ${reporte.rechazados}`,
    '',
    encabezados.map(celdaCsv).join(','),
    ...reporte.filas.map((fila) =>
      encabezados
        .map((encabezado) => celdaCsv(valorDeFila(reporte.tipo, fila, encabezado)))
        .join(','),
    ),
  ];

  return `\uFEFF${lineas.join('\r\n')}\r\n`;
}
