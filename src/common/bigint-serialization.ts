/**
 * Serialización global de `BigInt` a `string` para respuestas JSON.
 *
 * Todas las llaves primarias de la base de datos son `BIGINT`, que el cliente
 * de Prisma devuelve como `bigint` nativo de JavaScript. `JSON.stringify`
 * lanza `TypeError: Do not know how to serialize a BigInt` cuando un objeto
 * con un `bigint` llega a `res.json()`.
 *
 * Este parche hace que todo `bigint` se serialice como `string` (mismo
 * comportamiento que el driver `pg` en queries crudos), preservando la
 * precisión de 64 bits. Ver `docs/uso_db.md` (sección BigInt) para más
 * detalles.
 */
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function (this: bigint): string {
  return this.toString();
};

export {};
