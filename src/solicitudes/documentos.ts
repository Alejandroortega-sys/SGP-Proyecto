import { BadRequestException } from '@nestjs/common';
import { basename } from 'node:path';
import {
  MAX_ARCHIVOS_POR_DEFECTO,
  MAX_BYTES_ARCHIVO_POR_DEFECTO,
  directorioArchivosPrivados,
  eliminarArchivoPrivado,
  guardarArchivoPrivado,
  limiteBytesArchivo,
  maxArchivos,
  resolverRutaArchivoPrivado,
} from '../common/almacenamiento-archivos';
import type { estado_documento } from '../generated/prisma/client';

/** Límite por defecto de cada documento: 5 MB. */
export const MAX_BYTES_DOCUMENTO_POR_DEFECTO = MAX_BYTES_ARCHIVO_POR_DEFECTO;

/** Cantidad máxima por defecto de documentos por solicitud. */
export const MAX_DOCUMENTOS_POR_DEFECTO = MAX_ARCHIVOS_POR_DEFECTO;

/** MIME aceptados para los documentos de la solicitud. */
export const TIPOS_MIME_DOCUMENTO = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
] as const;

/** Formatos reales detectados por firma binaria. */
export type FormatoDocumento = 'pdf' | 'jpg' | 'png';

/** Archivo recibido por el interceptor de Multer. */
export interface ArchivoDocumento {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname?: string;
}

/** Resultado de validar un documento antes de guardarlo. */
export interface DocumentoValidado {
  formato: FormatoDocumento;
  extension: string;
  mimetype: string;
  bytes: number;
}

/** Estado resumido que ve el comerciante en la lista de requisitos. */
export type EstadoRequisitoDocumental =
  | 'faltante'
  | 'cargado'
  | 'cumple'
  | 'no_cumple';

/** Estados de solicitud en los que el comerciante puede cargar documentos. */
export const ESTADOS_CARGA_DOCUMENTOS = ['radicada', 'devuelta'] as const;

/** Indica si la solicitud admite cargar o reemplazar documentos. */
export function puedeCargarDocumentos(estado: string): boolean {
  return estado === 'radicada' || estado === 'devuelta';
}

/** Traduce el estado almacenado del documento al estado visible del requisito. */
export function estadoRequisitoDocumental(
  estadoDocumento: estado_documento | null | undefined,
  tieneDocumento: boolean,
): EstadoRequisitoDocumental {
  if (!tieneDocumento) return 'faltante';
  if (estadoDocumento === 'validado') return 'cumple';
  if (estadoDocumento === 'observado') return 'no_cumple';
  return 'cargado';
}

/** Fila mínima de un documento para calcular sus versiones. */
export interface FilaVersionDocumento {
  id: bigint | string;
  reemplaza_a: bigint | string | null;
  cargado_en: Date | string;
}

/** Versión de un documento con su número y marca de versión vigente. */
export interface DocumentoVersionAgrupada<T extends FilaVersionDocumento> {
  fila: T;
  numeroVersion: number;
  esActual: boolean;
}

/**
 * Agrupa documentos de un mismo requisito y calcula la versión vigente.
 *
 * La versión vigente es la que no fue reemplazada por otra dentro del mismo
 * grupo. Las versiones se devuelven de la más reciente a la más antigua.
 */
export function agruparVersionesDocumento<T extends FilaVersionDocumento>(
  filas: readonly T[],
): {
  actual: T | null;
  versiones: DocumentoVersionAgrupada<T>[];
} {
  const reemplazados = new Set(
    filas
      .map((fila) => fila.reemplaza_a?.toString())
      .filter((id): id is string => Boolean(id)),
  );
  const vigentes = filas.filter(
    (fila) => !reemplazados.has(fila.id.toString()),
  );
  const actual =
    [...vigentes].sort((a, b) => tiempoDocumento(b) - tiempoDocumento(a))[0] ??
    null;

  const ordenadas = [...filas].sort(
    (a, b) =>
      tiempoDocumento(a) - tiempoDocumento(b) ||
      a.id.toString().localeCompare(b.id.toString()),
  );
  const idActual = actual?.id.toString() ?? null;

  return {
    actual,
    versiones: ordenadas
      .map((fila, indice) => ({
        fila,
        numeroVersion: indice + 1,
        esActual: fila.id.toString() === idActual,
      }))
      .reverse(),
  };
}

function tiempoDocumento(fila: FilaVersionDocumento): number {
  if (fila.cargado_en instanceof Date) return fila.cargado_en.getTime();
  return new Date(fila.cargado_en).getTime();
}

/**
 * Directorio privado de documentos de solicitudes.
 *
 * No se sirve como archivo estático: la descarga pasa por un endpoint
 * autenticado que comprueba que el usuario sea el dueño o un gestor.
 */
export function directorioDocumentosSolicitud(): string {
  return directorioArchivosPrivados();
}

/** Límite de tamaño configurable para los documentos. */
export function limiteBytesDocumento(): number {
  return limiteBytesArchivo();
}

/** Cantidad máxima configurable de documentos por solicitud. */
export function maxDocumentos(): number {
  return maxArchivos();
}

/** Detecta el formato real de un documento por sus primeros bytes. */
export function detectarFormatoDocumento(
  buffer: Buffer,
): FormatoDocumento | null {
  if (
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString('ascii') === '%PDF-'
  ) {
    return 'pdf';
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'jpg';
  }

  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length >= png.length && buffer.subarray(0, png.length).equals(png)) {
    return 'png';
  }

  return null;
}

const DATOS_FORMATO: Record<
  FormatoDocumento,
  { extension: string; mimetype: string }
> = {
  pdf: { extension: '.pdf', mimetype: 'application/pdf' },
  jpg: { extension: '.jpg', mimetype: 'image/jpeg' },
  png: { extension: '.png', mimetype: 'image/png' },
};

/**
 * Valida tamaño, MIME declarado y firma real del documento.
 *
 * @throws BadRequestException si el archivo está vacío, supera el límite, no
 * tiene un MIME permitido o su contenido no coincide con el formato.
 */
export function validarDocumento(
  archivo: ArchivoDocumento,
  limiteBytes = limiteBytesDocumento(),
): DocumentoValidado {
  if (archivo.size === 0 || archivo.buffer.length === 0) {
    throw new BadRequestException('El documento está vacío');
  }

  if (archivo.size > limiteBytes || archivo.buffer.length > limiteBytes) {
    throw new BadRequestException(
      `Cada documento no puede superar ${Math.floor(limiteBytes / (1024 * 1024))} MB`,
    );
  }

  const mimetype = archivo.mimetype.toLowerCase().trim();
  if (
    !TIPOS_MIME_DOCUMENTO.includes(
      mimetype as (typeof TIPOS_MIME_DOCUMENTO)[number],
    )
  ) {
    throw new BadRequestException('Los documentos deben ser PDF, JPG o PNG');
  }

  const formato = detectarFormatoDocumento(archivo.buffer);
  if (formato === null) {
    throw new BadRequestException(
      'El contenido del archivo no corresponde a un PDF, JPG o PNG válido',
    );
  }

  const datos = DATOS_FORMATO[formato];
  const familiaDeclarada = mimetype === 'image/jpg' ? 'image/jpeg' : mimetype;
  if (familiaDeclarada !== datos.mimetype) {
    throw new BadRequestException(
      'El tipo declarado del documento no coincide con el contenido real del archivo',
    );
  }

  return {
    formato,
    extension: datos.extension,
    mimetype: datos.mimetype,
    bytes: archivo.buffer.length,
  };
}

/** Limpia el nombre original para usarlo en encabezados de descarga. */
export function nombreArchivoSeguro(nombre: string | null | undefined): string {
  const base = basename(nombre?.trim() || 'documento');
  // eslint-disable-next-line no-control-regex -- se eliminan controles del nombre original
  return base.replace(/[\u0000-\u001f\u007f"\\/:*?<>|]/g, '_').slice(0, 200);
}

/** Guarda un documento en el directorio privado y devuelve su ruta relativa. */
export async function guardarDocumentoSolicitud(
  archivo: ArchivoDocumento,
  validado: DocumentoValidado,
  solicitudId: bigint | string,
  directorio = directorioDocumentosSolicitud(),
): Promise<string> {
  return guardarArchivoPrivado(
    archivo.buffer,
    validado.extension,
    `solicitudes/${solicitudId.toString()}`,
    directorio,
  );
}

/** Resuelve una ruta relativa de documento y evita salir del directorio raíz. */
export function resolverRutaDocumento(
  ruta: string,
  directorio = directorioDocumentosSolicitud(),
): string {
  return resolverRutaArchivoPrivado(ruta, directorio);
}

/** Elimina un documento guardado, ignorando rutas externas y archivos ausentes. */
export async function eliminarDocumentoSolicitud(
  ruta: string | null | undefined,
  directorio = directorioDocumentosSolicitud(),
): Promise<void> {
  return eliminarArchivoPrivado(ruta, directorio);
}

/** MIME de un documento a partir de su extensión almacenada. */
export function mimePorRuta(ruta: string | null | undefined): string {
  const minuscula = (ruta ?? '').toLowerCase();
  if (minuscula.endsWith('.pdf')) return 'application/pdf';
  if (minuscula.endsWith('.png')) return 'image/png';
  if (minuscula.endsWith('.jpg') || minuscula.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  return 'application/octet-stream';
}

/** Extensión de un documento almacenado. */
export function extensionDeDocumento(ruta: string | null | undefined): string {
  const minuscula = (ruta ?? '').toLowerCase();
  if (minuscula.endsWith('.pdf')) return '.pdf';
  if (minuscula.endsWith('.png')) return '.png';
  if (minuscula.endsWith('.jpg')) return '.jpg';
  return '';
}
