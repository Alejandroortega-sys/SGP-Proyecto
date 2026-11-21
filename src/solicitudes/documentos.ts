import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, resolve, sep } from 'node:path';
import { enteroPositivo } from '../common/entero-positivo';

/** Límite por defecto de cada documento: 5 MB. */
export const MAX_BYTES_DOCUMENTO_POR_DEFECTO = 5 * 1024 * 1024;

/** Cantidad máxima por defecto de documentos por solicitud. */
export const MAX_DOCUMENTOS_POR_DEFECTO = 10;

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

/**
 * Directorio privado de documentos de solicitudes.
 *
 * No se sirve como archivo estático: la descarga pasa por un endpoint
 * autenticado que comprueba que el usuario sea el dueño o un gestor.
 */
export function directorioDocumentosSolicitud(): string {
  return resolve(process.env.UPLOAD_PRIVATE_DIR ?? 'uploads-privados');
}

/** Límite de tamaño configurable para los documentos. */
export function limiteBytesDocumento(): number {
  return enteroPositivo(
    process.env.UPLOAD_DOCUMENT_MAX_BYTES,
    MAX_BYTES_DOCUMENTO_POR_DEFECTO,
  );
}

/** Cantidad máxima configurable de documentos por solicitud. */
export function maxDocumentos(): number {
  return enteroPositivo(
    process.env.UPLOAD_DOCUMENT_MAX_FILES,
    MAX_DOCUMENTOS_POR_DEFECTO,
  );
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
  const carpetaRelativa = `solicitudes/${solicitudId.toString()}`;
  const carpeta = resolve(directorio, carpetaRelativa);
  await mkdir(carpeta, { recursive: true });

  const nombre = `${randomUUID()}${validado.extension}`;
  await writeFile(resolve(carpeta, nombre), archivo.buffer);

  return `${carpetaRelativa}/${nombre}`;
}

/** Resuelve una ruta relativa de documento y evita salir del directorio raíz. */
export function resolverRutaDocumento(
  ruta: string,
  directorio = directorioDocumentosSolicitud(),
): string {
  const raiz = resolve(directorio);
  const destino = resolve(raiz, ruta);
  if (destino !== raiz && !destino.startsWith(`${raiz}${sep}`)) {
    throw new BadRequestException('La ruta del documento no es válida');
  }
  return destino;
}

/** Elimina un documento guardado, ignorando rutas externas y archivos ausentes. */
export async function eliminarDocumentoSolicitud(
  ruta: string | null | undefined,
  directorio = directorioDocumentosSolicitud(),
): Promise<void> {
  if (!ruta) return;

  let destino: string;
  try {
    destino = resolverRutaDocumento(ruta, directorio);
  } catch {
    return;
  }

  try {
    await unlink(destino);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
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
