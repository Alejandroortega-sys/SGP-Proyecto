import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { enteroPositivo } from '../common/entero-positivo';

/** Tamaño máximo por defecto de una foto: 5 MB. */
export const MAX_BYTES_FOTO_POR_DEFECTO = 5 * 1024 * 1024;

/** MIME aceptados para la foto del puesto. */
export const TIPOS_MIME_FOTO = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

/** Formatos reales detectados por firma binaria. */
export type FormatoFoto = 'jpg' | 'png' | 'webp';

/** Archivo recibido por el interceptor de Multer. */
export interface ArchivoFoto {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname?: string;
}

/** Resultado de validar una foto antes de guardarla. */
export interface FotoValidada {
  formato: FormatoFoto;
  extension: string;
  mimetype: string;
  bytes: number;
}

/** Directorio raíz de archivos subidos, resuelto desde la raíz del proceso. */
export function directorioUploads(): string {
  return resolve(process.env.UPLOAD_DIR ?? 'uploads');
}

/** Límite de tamaño configurable para las fotos. */
export function limiteBytesFoto(): number {
  return enteroPositivo(
    process.env.UPLOAD_MAX_BYTES,
    MAX_BYTES_FOTO_POR_DEFECTO,
  );
}

/**
 * Detecta el formato real de una imagen por sus primeros bytes.
 *
 * No se confía únicamente en el `Content-Type` que envía el navegador:
 * cualquiera puede declarar `image/png` y adjuntar un archivo de texto.
 */
export function detectarFormatoFoto(buffer: Buffer): FormatoFoto | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }

  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length >= png.length && buffer.subarray(0, png.length).equals(png)) {
    return 'png';
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }

  return null;
}

/** Extensión y MIME canónicos de cada formato detectado. */
const DATOS_FORMATO: Record<
  FormatoFoto,
  { extension: string; mimetype: string }
> = {
  jpg: { extension: '.jpg', mimetype: 'image/jpeg' },
  png: { extension: '.png', mimetype: 'image/png' },
  webp: { extension: '.webp', mimetype: 'image/webp' },
};

/**
 * Valida el tamaño, el MIME declarado y la firma real de la foto.
 *
 * @throws BadRequestException si el archivo está vacío, supera el límite, no
 * tiene un MIME permitido o su contenido no corresponde a una imagen real.
 */
export function validarFoto(
  archivo: ArchivoFoto,
  limiteBytes = limiteBytesFoto(),
): FotoValidada {
  if (archivo.size === 0 || archivo.buffer.length === 0) {
    throw new BadRequestException('La foto del puesto está vacía');
  }

  if (archivo.size > limiteBytes || archivo.buffer.length > limiteBytes) {
    throw new BadRequestException(
      `La foto no puede superar ${Math.floor(limiteBytes / (1024 * 1024))} MB`,
    );
  }

  const mimetype = archivo.mimetype.toLowerCase().trim();
  if (!TIPOS_MIME_FOTO.includes(mimetype as (typeof TIPOS_MIME_FOTO)[number])) {
    throw new BadRequestException(
      'La foto debe ser JPG, PNG o WebP',
    );
  }

  const formato = detectarFormatoFoto(archivo.buffer);
  if (formato === null) {
    throw new BadRequestException(
      'El contenido del archivo no corresponde a una imagen JPG, PNG o WebP válida',
    );
  }

  const datos = DATOS_FORMATO[formato];

  // El MIME declarado y la firma real deben pertenecer a la misma familia.
  const familiaDeclarada = mimetype === 'image/jpg' ? 'image/jpeg' : mimetype;
  if (familiaDeclarada !== datos.mimetype) {
    throw new BadRequestException(
      'El tipo declarado de la foto no coincide con el contenido real del archivo',
    );
  }

  return {
    formato,
    extension: datos.extension,
    mimetype: datos.mimetype,
    bytes: archivo.buffer.length,
  };
}

/**
 * Guarda la foto en `uploads/modulos` con un nombre aleatorio y devuelve su
 * URL pública relativa.
 *
 * El nombre original nunca se usa para evitar rutas maliciosas y colisiones.
 */
export async function guardarFoto(
  archivo: ArchivoFoto,
  validada: FotoValidada,
  directorio = directorioUploads(),
): Promise<string> {
  const carpeta = resolve(directorio, 'modulos');
  await mkdir(carpeta, { recursive: true });

  const nombre = `${randomUUID()}${validada.extension}`;
  const destino = resolve(carpeta, nombre);
  await writeFile(destino, archivo.buffer);

  return `/uploads/modulos/${nombre}`;
}

/**
 * Elimina una foto previamente guardada por este módulo.
 *
 * Solo acepta rutas bajo `/uploads/`; ignora archivos inexistentes y rutas
 * externas o de ejemplo del seed.
 */
export async function eliminarFoto(
  url: string | null | undefined,
  directorio = directorioUploads(),
): Promise<void> {
  if (!url) return;

  const limpia = url.replace(/^\/+/, '');
  if (!limpia.startsWith('uploads/')) return;

  const relativa = limpia.slice('uploads/'.length);
  const raiz = resolve(directorio);
  const destino = resolve(raiz, relativa);

  // Defensa contra path traversal (`..`) en valores manipulados.
  if (destino !== raiz && !destino.startsWith(`${raiz}${sep}`)) return;

  try {
    await unlink(destino);
  } catch (error) {
    const codigo = (error as NodeJS.ErrnoException).code;
    if (codigo !== 'ENOENT') throw error;
  }
}

/** Extensión de una URL de foto ya guardada. */
export function extensionDeFoto(url: string | null | undefined): string | null {
  if (!url) return null;
  const extension = extname(url).toLowerCase();
  return extension === '' ? null : extension;
}
