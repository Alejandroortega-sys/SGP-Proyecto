import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { enteroPositivo } from './entero-positivo';

/** Límite por defecto de cada archivo privado: 5 MB. */
export const MAX_BYTES_ARCHIVO_POR_DEFECTO = 5 * 1024 * 1024;

/** Cantidad máxima por defecto de archivos por trámite. */
export const MAX_ARCHIVOS_POR_DEFECTO = 10;

/**
 * Directorio privado de archivos de los trámites.
 *
 * No se sirve como archivo estático: la descarga pasa por un endpoint
 * autenticado que comprueba que el usuario tenga acceso.
 */
export function directorioArchivosPrivados(): string {
  return resolve(process.env.UPLOAD_PRIVATE_DIR ?? 'uploads-privados');
}

/** Límite de tamaño configurable para los archivos. */
export function limiteBytesArchivo(): number {
  return enteroPositivo(
    process.env.UPLOAD_DOCUMENT_MAX_BYTES,
    MAX_BYTES_ARCHIVO_POR_DEFECTO,
  );
}

/** Cantidad máxima configurable de archivos por trámite. */
export function maxArchivos(): number {
  return enteroPositivo(
    process.env.UPLOAD_DOCUMENT_MAX_FILES,
    MAX_ARCHIVOS_POR_DEFECTO,
  );
}

/**
 * Guarda un archivo en una carpeta privada y devuelve su ruta relativa.
 *
 * @param buffer Contenido binario ya validado.
 * @param extension Extensión con punto (`.pdf`, `.jpg`, `.png`).
 * @param carpetaRelativa Carpeta relativa a la raíz privada, p. ej.
 *   `ferias/12`.
 * @param directorio Raíz privada; por defecto, `UPLOAD_PRIVATE_DIR`.
 */
export async function guardarArchivoPrivado(
  buffer: Buffer,
  extension: string,
  carpetaRelativa: string,
  directorio = directorioArchivosPrivados(),
): Promise<string> {
  const carpeta = resolve(directorio, carpetaRelativa);
  await mkdir(carpeta, { recursive: true });

  const nombre = `${randomUUID()}${extension}`;
  await writeFile(resolve(carpeta, nombre), buffer);

  return `${carpetaRelativa}/${nombre}`;
}

/** Resuelve una ruta relativa y evita salir del directorio raíz. */
export function resolverRutaArchivoPrivado(
  ruta: string,
  directorio = directorioArchivosPrivados(),
): string {
  const raiz = resolve(directorio);
  const destino = resolve(raiz, ruta);
  if (destino !== raiz && !destino.startsWith(`${raiz}${sep}`)) {
    throw new BadRequestException('La ruta del archivo no es válida');
  }
  return destino;
}

/** Elimina un archivo guardado, ignorando rutas externas y ausentes. */
export async function eliminarArchivoPrivado(
  ruta: string | null | undefined,
  directorio = directorioArchivosPrivados(),
): Promise<void> {
  if (!ruta) return;

  let destino: string;
  try {
    destino = resolverRutaArchivoPrivado(ruta, directorio);
  } catch {
    return;
  }

  try {
    await unlink(destino);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
