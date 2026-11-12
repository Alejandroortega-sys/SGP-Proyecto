import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

/** Lee `DATABASE_URL` del entorno o del `.env` de la raíz. */
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
 * Elimina los espacios de prueba cuyo nombre empieza por `prefijo`, sus
 * bloqueos y las filas de auditoría asociadas.
 */
export async function eliminarEspaciosPrueba(prefijo: string): Promise<void> {
  const cliente = new Client({ connectionString: urlBaseDatos() });
  await cliente.connect();

  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query<{ id: string }>(
      "SELECT id::text AS id FROM espacios_temporales WHERE nombre LIKE $1",
      [`${prefijo}%`],
    );
    const ids = rows.map((fila) => fila.id);

    if (ids.length > 0) {
      await cliente.query(
        "DELETE FROM auditoria WHERE (tabla = 'espacios_temporales' OR tabla = 'espacio_bloqueos') AND registro_id = ANY($1::bigint[])",
        [ids],
      );
      await cliente.query(
        "DELETE FROM espacios_temporales WHERE id = ANY($1::bigint[])",
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
