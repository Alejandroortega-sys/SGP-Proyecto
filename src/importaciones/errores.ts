import { HttpException } from '@nestjs/common';

/** Error de formato que afecta a todo el archivo importado. */
export class ErrorFormatoImportacion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorFormatoImportacion';
  }
}

/** Error de validación que afecta únicamente a una fila o feature. */
export class ErrorFilaImportacion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorFilaImportacion';
  }
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

/** Extrae el mensaje legible de una HttpException de Nest. */
function mensajeHttp(error: HttpException): string {
  const respuesta = error.getResponse();
  if (typeof respuesta === 'string') return respuesta;
  if (esObjeto(respuesta)) {
    const mensaje = respuesta.message;
    if (typeof mensaje === 'string') return mensaje;
    if (Array.isArray(mensaje)) {
      return mensaje.filter((item) => typeof item === 'string').join('\n');
    }
  }
  return error.message;
}

/** Recorre un error de Prisma/pg para encontrar el texto lanzado por la BD. */
function buscarTexto(error: unknown, profundidad = 0): string {
  if (profundidad > 6 || error === null || error === undefined) return '';

  if (typeof error === 'string') return error;

  if (esObjeto(error)) {
    const partes: string[] = [];
    for (const clave of ['message', 'meta', 'cause', 'driverAdapterError']) {
      if (clave in error) {
        partes.push(buscarTexto(error[clave], profundidad + 1));
      }
    }
    return partes.filter(Boolean).join('\n');
  }

  return '';
}

/**
 * Convierte el error de una fila en un motivo legible.
 *
 * Los triggers de PostGIS lanzan `RAISE EXCEPTION` (P0001). Prisma lo envuelve
 * como `P2010` y conserva el texto en `Message: ...`; también puede llegar como
 * una `HttpException` si el servicio de dominio ya lo tradujo.
 */
export function mensajeDeError(error: unknown): string {
  if (error instanceof HttpException) {
    return mensajeHttp(error);
  }

  const texto = buscarTexto(error);

  const mensajePrisma = /Message:\s*`([^`]+)`/i.exec(texto);
  if (mensajePrisma?.[1]) return mensajePrisma[1].trim();

  const mensajePostgres = /ERROR:\s*([^\n]+)/i.exec(texto);
  if (mensajePostgres?.[1]) return mensajePostgres[1].trim();

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return 'No fue posible importar la fila por un error inesperado.';
}
