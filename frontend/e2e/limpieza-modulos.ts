import { existsSync, readFileSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";

/**
 * Lee `DATABASE_URL` del entorno o del `.env` de la raíz. Las pruebas e2e del
 * censo crean módulos reales y este helper los elimina al terminar.
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

function directorioUploads(): string {
  const configurado = process.env.UPLOAD_DIR ?? "uploads";
  return resolve(process.cwd(), "..", configurado);
}

/** Elimina los módulos de prueba, su auditoría y las fotos subidas. */
export async function eliminarModulosPrueba(prefijo: string): Promise<void> {
  const cliente = new Client({ connectionString: urlBaseDatos() });
  await cliente.connect();

  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query<{
      id: string;
      foto_url: string | null;
    }>(
      "SELECT id::text AS id, foto_url FROM modulos WHERE actividad LIKE $1",
      [`${prefijo}%`],
    );
    const ids = rows.map((fila) => fila.id);

    if (ids.length > 0) {
      await cliente.query(
        "DELETE FROM auditoria WHERE tabla = 'modulos' AND registro_id = ANY($1::bigint[])",
        [ids],
      );
      await cliente.query(
        "DELETE FROM modulos WHERE id = ANY($1::bigint[])",
        [ids],
      );
    }

    await cliente.query("COMMIT");

    for (const fila of rows) {
      if (!fila.foto_url || !fila.foto_url.startsWith("/uploads/")) continue;
      const relativa = fila.foto_url.replace(/^\/?uploads\//, "");
      const archivo = resolve(directorioUploads(), relativa);
      try {
        await unlink(archivo);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    await cliente.end();
  }
}
