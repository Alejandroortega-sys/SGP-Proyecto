import { existsSync, readFileSync } from "node:fs";
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

/**
 * Elimina las solicitudes de prueba de un comerciante cuyo texto de actividad
 * empieza por `prefijo`, junto con sus documentos, historial, productos y
 * notificaciones recientes. Devuelve los identificadores eliminados para que
 * la prueba pueda borrar los archivos privados.
 */
export async function eliminarSolicitudesPrueba(
  correo: string,
  prefijo: string,
): Promise<string[]> {
  const cliente = new Client({ connectionString: urlBaseDatos() });
  await cliente.connect();

  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query<{ id: string }>(
      `SELECT s.id::text AS id
         FROM solicitudes s
         JOIN usuarios u ON u.id = s.comerciante_id
        WHERE u.correo = $1
          AND s.actividad LIKE $2`,
      [correo, `${prefijo}%`],
    );
    const ids = rows.map((fila) => fila.id);

    if (ids.length > 0) {
      await cliente.query(
        `DELETE FROM notificaciones
          WHERE usuario_id = (SELECT id FROM usuarios WHERE correo = $1)
            AND tipo = 'solicitud_radicada'
            AND creada_en > now() - interval '1 day'`,
        [correo],
      );
      await cliente.query(
        "DELETE FROM solicitud_documentos WHERE solicitud_id = ANY($1::bigint[])",
        [ids],
      );
      await cliente.query(
        "DELETE FROM solicitud_historial WHERE solicitud_id = ANY($1::bigint[])",
        [ids],
      );
      await cliente.query(
        "DELETE FROM solicitud_productos WHERE solicitud_id = ANY($1::bigint[])",
        [ids],
      );
      await cliente.query(
        "DELETE FROM solicitudes WHERE id = ANY($1::bigint[])",
        [ids],
      );
    }

    await cliente.query("COMMIT");
    return ids;
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    await cliente.end();
  }
}
