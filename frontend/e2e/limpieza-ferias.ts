import { existsSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";

function urlBaseDatos(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const archivo = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", ".env"),
  ].find((candidato) => existsSync(candidato));

  if (!archivo) throw new Error("No se encontró el .env del proyecto.");

  const linea = readFileSync(archivo, "utf8")
    .split(/\r?\n/)
    .map((valor) => valor.trim())
    .find((valor) => valor.startsWith("DATABASE_URL="));

  if (!linea) throw new Error("No se encontró DATABASE_URL en el .env.");

  return linea
    .slice("DATABASE_URL=".length)
    .trim()
    .replace(/^["']|["']$/g, "");
}

function directorioSubidas(): string {
  const configurado =
    process.env.UPLOAD_PRIVATE_DIR ??
    (() => {
      const archivo = [
        resolve(process.cwd(), ".env"),
        resolve(process.cwd(), "..", ".env"),
      ].find((candidato) => existsSync(candidato));
      if (!archivo) return "uploads-privados";
      const linea = readFileSync(archivo, "utf8")
        .split(/\r?\n/)
        .map((valor) => valor.trim())
        .find((valor) => valor.startsWith("UPLOAD_PRIVATE_DIR="));
      const valor = linea
        ? linea
            .slice("UPLOAD_PRIVATE_DIR=".length)
            .trim()
            .replace(/^["']|["']$/g, "")
        : "";
      return valor || "uploads-privados";
    })();

  return resolve(process.cwd(), "..", configurado);
}

/**
 * Elimina las ferias de prueba de un organizador cuyo nombre empieza por
 * `prefijo`, junto con sus productos, documentos y avisos recientes.
 */
export async function eliminarFeriasPrueba(
  correo: string,
  prefijo: string,
): Promise<void> {
  const cliente = new Client({ connectionString: urlBaseDatos() });
  await cliente.connect();

  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query<{ id: string }>(
      `SELECT f.id::text AS id
         FROM ferias f
         JOIN organizadores o ON o.usuario_id = f.organizador_id
         JOIN usuarios u ON u.id = o.usuario_id
        WHERE u.correo = $1
          AND f.nombre LIKE $2`,
      [correo, `${prefijo}%`],
    );
    const ids = rows.map((fila) => fila.id);

    if (ids.length > 0) {
      await cliente.query(
        `DELETE FROM notificaciones
          WHERE usuario_id = (SELECT id FROM usuarios WHERE correo = $1)
            AND tipo = 'feria_radicada'
            AND creada_en > now() - interval '1 day'`,
        [correo],
      );
      await cliente.query(
        "DELETE FROM feria_documentos WHERE feria_id = ANY($1::bigint[])",
        [ids],
      );
      await cliente.query(
        "DELETE FROM feria_productos WHERE feria_id = ANY($1::bigint[])",
        [ids],
      );
      await cliente.query("DELETE FROM ferias WHERE id = ANY($1::bigint[])", [
        ids,
      ]);
    }

    await cliente.query("COMMIT");

    await Promise.all(
      ids.map((id) =>
        rm(resolve(directorioSubidas(), "ferias", id), {
          recursive: true,
          force: true,
        }),
      ),
    );
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    await cliente.end();
  }
}
