import { ErrorFormatoImportacion } from './errores';

/** Límite de filas de datos por archivo de importación. */
export const MAX_FILAS_IMPORTACION = 5000;

/** Columnas que entiende el importador de módulos. */
export const COLUMNAS_MODULOS = [
  'categoria',
  'actividad',
  'latitud',
  'longitud',
  'titular_documento',
  'titular_nombre',
] as const;

/** Columnas obligatorias del CSV de módulos. */
export const COLUMNAS_OBLIGATORIAS_MODULOS = [
  'categoria',
  'actividad',
  'latitud',
  'longitud',
] as const;

/** Delimitadores aceptados en el CSV. */
export type DelimitadorCsv = ',' | ';';

/** Fila de datos ya asociada a sus encabezados. */
export interface FilaCsv {
  /** Número de línea física del archivo (el encabezado es la primera). */
  fila: number;
  valores: Record<string, string>;
  /** Campos que exceden el número de encabezados. */
  camposSobrantes: string[];
}

/** Resultado de leer y normalizar un CSV de módulos. */
export interface CsvLeido {
  delimitador: DelimitadorCsv;
  encabezados: string[];
  columnasExtra: string[];
  filas: FilaCsv[];
}

interface RegistroCrudo {
  linea: number;
  campos: string[];
}

/** Quita tildes, recorta y normaliza un encabezado a snake_case. */
export function normalizarEncabezado(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function primeraLineaLogica(texto: string): string {
  let enComillas = false;

  for (let indice = 0; indice < texto.length; indice += 1) {
    const caracter = texto[indice];

    if (caracter === '"') {
      if (enComillas && texto[indice + 1] === '"') {
        indice += 1;
        continue;
      }
      enComillas = !enComillas;
      continue;
    }

    if (caracter === '\n' && !enComillas) {
      return texto.slice(0, indice);
    }
  }

  return texto;
}

/** Detecta coma o punto y coma contando los separadores del encabezado. */
export function detectarDelimitador(texto: string): DelimitadorCsv {
  const linea = primeraLineaLogica(texto);
  let comas = 0;
  let puntoYComas = 0;
  let enComillas = false;

  for (let indice = 0; indice < linea.length; indice += 1) {
    const caracter = linea[indice];

    if (caracter === '"') {
      if (enComillas && linea[indice + 1] === '"') {
        indice += 1;
        continue;
      }
      enComillas = !enComillas;
      continue;
    }

    if (enComillas) continue;
    if (caracter === ',') comas += 1;
    if (caracter === ';') puntoYComas += 1;
  }

  if (comas === 0 && puntoYComas === 0) {
    throw new ErrorFormatoImportacion(
      'No se pudo detectar el delimitador del CSV. Usa coma o punto y coma.',
    );
  }

  return comas >= puntoYComas ? ',' : ';';
}

/**
 * Parser CSV basado en RFC 4180.
 *
 * Acepta comillas dobles, comillas escapadas (`""`), delimitadores y saltos de
 * línea dentro de campos, y normaliza CRLF/CR a LF antes de contar filas.
 */
export function parsearRegistrosCsv(
  texto: string,
  delimitador: DelimitadorCsv,
): RegistroCrudo[] {
  const normalizado = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const registros: RegistroCrudo[] = [];
  let campos: string[] = [];
  let campo = '';
  let enComillas = false;
  let linea = 1;
  let lineaInicio = 1;

  const cerrarCampo = (): void => {
    campos.push(campo);
    campo = '';
  };

  const cerrarRegistro = (): void => {
    cerrarCampo();
    registros.push({ linea: lineaInicio, campos });
    campos = [];
    lineaInicio = linea + 1;
  };

  for (let indice = 0; indice < normalizado.length; indice += 1) {
    const caracter = normalizado[indice];

    if (enComillas) {
      if (caracter === '"') {
        if (normalizado[indice + 1] === '"') {
          campo += '"';
          indice += 1;
          continue;
        }
        enComillas = false;
        continue;
      }

      if (caracter === '\n') {
        campo += '\n';
        linea += 1;
        continue;
      }

      campo += caracter;
      continue;
    }

    if (caracter === '"') {
      enComillas = true;
      continue;
    }

    if (caracter === delimitador) {
      cerrarCampo();
      continue;
    }

    if (caracter === '\n') {
      cerrarRegistro();
      linea += 1;
      continue;
    }

    campo += caracter;
  }

  if (enComillas) {
    throw new ErrorFormatoImportacion(
      'El CSV tiene comillas dobles sin cerrar. Revisa la fila afectada.',
    );
  }

  if (campo !== '' || campos.length > 0) {
    cerrarRegistro();
  }

  return registros;
}

function esRegistroVacio(registro: RegistroCrudo): boolean {
  return registro.campos.every((campo) => campo.trim() === '');
}

/**
 * Lee un CSV de módulos y valida su estructura general.
 *
 * Los errores de estructura (codificación, encabezados, límite de filas) se
 * lanzan como `ErrorFormatoImportacion`; los errores de cada fila se devuelven
 * al servicio para que los reporte sin abortar la importación.
 */
export function leerCsvModulos(contenido: Buffer): CsvLeido {
  let texto: string;

  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(contenido);
  } catch {
    throw new ErrorFormatoImportacion(
      'El archivo CSV debe estar codificado en UTF-8.',
    );
  }

  if (texto.charCodeAt(0) === 0xfeff) {
    texto = texto.slice(1);
  }

  if (texto.trim() === '') {
    throw new ErrorFormatoImportacion('El archivo CSV está vacío.');
  }

  const delimitador = detectarDelimitador(texto);
  const registros = parsearRegistrosCsv(texto, delimitador).filter(
    (registro) => !esRegistroVacio(registro),
  );

  const encabezado = registros[0];
  if (!encabezado) {
    throw new ErrorFormatoImportacion('El archivo CSV no tiene encabezados.');
  }

  const encabezados = encabezado.campos.map(normalizarEncabezado);

  if (encabezados.some((columna) => columna === '')) {
    throw new ErrorFormatoImportacion(
      'El encabezado del CSV contiene una columna vacía.',
    );
  }

  const repetidas = encabezados.filter(
    (columna, indice) => encabezados.indexOf(columna) !== indice,
  );
  if (repetidas.length > 0) {
    throw new ErrorFormatoImportacion(
      `El CSV repite la columna «${repetidas[0]}».`,
    );
  }

  const faltantes = COLUMNAS_OBLIGATORIAS_MODULOS.filter(
    (columna) => !encabezados.includes(columna),
  );
  if (faltantes.length > 0) {
    throw new ErrorFormatoImportacion(
      `Al CSV le faltan las columnas obligatorias: ${faltantes.join(', ')}.`,
    );
  }

  if (
    !encabezados.includes('titular_documento') &&
    !encabezados.includes('titular_nombre')
  ) {
    throw new ErrorFormatoImportacion(
      'El CSV debe incluir titular_documento o titular_nombre.',
    );
  }

  const filasCrudas = registros.slice(1);
  if (filasCrudas.length === 0) {
    throw new ErrorFormatoImportacion(
      'El archivo CSV no contiene filas de datos.',
    );
  }

  if (filasCrudas.length > MAX_FILAS_IMPORTACION) {
    throw new ErrorFormatoImportacion(
      `El archivo supera el máximo de ${MAX_FILAS_IMPORTACION} filas.`,
    );
  }

  const filas: FilaCsv[] = filasCrudas.map((registro) => {
    const valores: Record<string, string> = {};

    for (let indice = 0; indice < encabezados.length; indice += 1) {
      valores[encabezados[indice]] = registro.campos[indice]?.trim() ?? '';
    }

    return {
      fila: registro.linea,
      valores,
      camposSobrantes: registro.campos.slice(encabezados.length),
    };
  });

  const columnasExtra = encabezados.filter(
    (columna) =>
      !COLUMNAS_MODULOS.includes(
        columna as (typeof COLUMNAS_MODULOS)[number],
      ),
  );

  return {
    delimitador,
    encabezados,
    columnasExtra,
    filas,
  };
}
