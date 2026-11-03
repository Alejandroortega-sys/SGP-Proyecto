import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

/**
 * Lee `DATABASE_URL` del entorno o del `.env` de la raíz. Las pruebas e2e de
 * zonas crean registros reales y este helper los elimina al terminar.
 */
function urlBaseDatos(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const archivo = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", ".env"),
  ].find((candidato) => existsSync(candidato));

  if (!archivo) {
    throw new Error("No se encontró el .env del proyecto.");
  }

  const contenido = readFileSync(archivo, "utf8");
  const linea = contenido
    .split(/\r?\n/)
    .map((valor) => valor.trim())
    .find((valor) => valor.startsWith("DATABASE_URL="));

  if (!linea) {
    throw new Error("No se encontró DATABASE_URL en el .env de la raíz.");
  }

  return linea
    .slice("DATABASE_URL=".length)
    .trim()
    .replace(/^["']|["']$/g, "");
}

/**
 * Elimina las zonas de prueba cuyo nombre empieza por `prefijo`, junto con sus
 * filas de auditoría. Las zonas tienen FK en cascada a `zona_productos`.
 */
export async function eliminarZonasPrueba(prefijo: string): Promise<void> {
  const cliente = new Client({ connectionString: urlBaseDatos() });
  await cliente.connect();

  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query<{ id: string }>(
      "SELECT id::text AS id FROM zonas WHERE nombre LIKE $1",
      [`${prefijo}%`],
    );
    const ids = rows.map((fila) => fila.id);

    if (ids.length > 0) {
      // Las versiones también se eliminarían por cascada; se borran de forma
      // explícita para que la limpieza no dependa de la FK.
      await cliente.query(
        "DELETE FROM zona_versiones WHERE zona_id = ANY($1::bigint[])",
        [ids],
      );
      await cliente.query(
        "DELETE FROM zonas WHERE id = ANY($1::bigint[])",
        [ids],
      );
      // El trigger de auditoría registra el DELETE; se limpian ambos eventos.
      await cliente.query(
        "DELETE FROM auditoria WHERE tabla = 'zonas' AND registro_id = ANY($1::bigint[])",
        [ids],
      );
    }

    await cliente.query("COMMIT");
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    await cliente.end();
  }
}
