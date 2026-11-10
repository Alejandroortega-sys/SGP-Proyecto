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
 * Elimina las zonas y módulos creados por las pruebas de importación, junto con
 * su auditoría. Las versiones de zona y los productos se eliminan en cascada.
 */
export async function eliminarImportacionesPrueba(
  prefijo: string,
): Promise<void> {
  const cliente = new Client({ connectionString: urlBaseDatos() });
  await cliente.connect();

  try {
    await cliente.query("BEGIN");

    const zonas = await cliente.query<{ id: string }>(
      "SELECT id::text AS id FROM zonas WHERE nombre LIKE $1",
      [`${prefijo}%`],
    );
    const idsZonas = zonas.rows.map((fila) => fila.id);
    if (idsZonas.length > 0) {
      await cliente.query(
        "DELETE FROM auditoria WHERE tabla = 'zonas' AND registro_id = ANY($1::bigint[])",
        [idsZonas],
      );
      await cliente.query(
        "DELETE FROM zonas WHERE id = ANY($1::bigint[])",
        [idsZonas],
      );
    }

    const modulos = await cliente.query<{ id: string }>(
      "SELECT id::text AS id FROM modulos WHERE actividad LIKE $1",
      [`${prefijo}%`],
    );
    const idsModulos = modulos.rows.map((fila) => fila.id);
    if (idsModulos.length > 0) {
      await cliente.query(
        "DELETE FROM auditoria WHERE tabla = 'modulos' AND registro_id = ANY($1::bigint[])",
        [idsModulos],
      );
      await cliente.query(
        "DELETE FROM modulos WHERE id = ANY($1::bigint[])",
        [idsModulos],
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
