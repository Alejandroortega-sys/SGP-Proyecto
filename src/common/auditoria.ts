import { Prisma } from '../generated/prisma/client';

/**
 * Fija la variable de sesión «app.actor_id» para la auditoría de la BD.
 *
 * Los triggers de auditoría (`fn_auditoria` sobre `usuarios`, `zonas` y
 * `parametros_motor`) registran quién hizo cada cambio leyendo esta variable
 * (ver docs/baseDatos.md §2). Debe fijarse **dentro de la transacción** en la
 * que ocurre el cambio:
 *
 * - `set_config(..., true)` (tercer argumento) la vuelve local a la
 *   transacción: el `UPDATE` que sigue corre en la misma conexión y el
 *   trigger la ve, pero no queda en la conexión del pool para otras
 *   peticiones.
 * - Fijarla a nivel de sesión (`false`) sería incorrecto aquí: el pool de
 *   conexiones de `@prisma/adapter-pg` reutiliza conexiones entre peticiones
 *   y el actor podría filtrarse a operaciones de otros usuarios.
 *
 * @param tx Cliente de la transacción abierta (`$transaction` interactivo).
 * @param actorId Identificador del usuario autenticado que realiza el cambio.
 */
export async function fijarActorAuditoria(
  tx: Prisma.TransactionClient,
  actorId: bigint | string,
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.actor_id', ${actorId.toString()}, true)`;
}
