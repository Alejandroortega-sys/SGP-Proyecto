import { BadRequestException } from '@nestjs/common';

/**
 * Convierte un identificador recibido por HTTP (string) a `bigint` para las
 * llaves BIGINT de Prisma, validando el formato antes (patrón de
 * docs/uso_db.md §2.3).
 *
 * @param id Identificador tal como llega en la URL o en el usuario autenticado.
 * @throws BadRequestException (400) si el string no es un entero positivo.
 */
export function parseIdBigint(id: string): bigint {
  if (!/^\d+$/.test(id)) {
    throw new BadRequestException(`El identificador "${id}" no es válido`);
  }
  return BigInt(id);
}
