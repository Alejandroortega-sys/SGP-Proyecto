import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';

function urlBaseDatos(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const archivo = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '..', '.env'),
  ].find((candidato) => existsSync(candidato));

  if (!archivo) throw new Error('No se encontró el .env del proyecto.');

  const linea = readFileSync(archivo, 'utf-8')
    .split(/\r?\n/)
    .map((valor) => valor.trim())
    .find((valor) => valor.startsWith('DATABASE_URL='));

  if (!linea) throw new Error('No se encontró DATABASE_URL en el .env.');

  return linea
    .slice('DATABASE_URL='.length)
    .trim()
    .replace(/^["']|["']$/g, '');
}

/**
 * Elimina las solicitudes de prueba de un comerciante cuyo texto de
 * actividad empieza por `prefijo`, junto con sus permisos (cobros,
 * eventos, verificaciones QR), notificaciones, documentos e historial.
 *
 * Los permisos no tienen endpoint de borrado (son la trazabilidad del
 * trámite), así que la limpieza de las pruebas de HU-31 a HU-37 va directa
 * a la BD con el mismo patrón de limpieza-solicitudes.ts.
 *
 * @returns Identificadores de las solicitudes eliminadas (para borrar sus
 *   archivos privados).
 */
export async function eliminarSolicitudesConPermisosPrueba(
  correo: string,
  prefijo: string,
): Promise<string[]> {
  const cliente = new Client({ connectionString: urlBaseDatos() });
  await cliente.connect();

  try {
    await cliente.query('BEGIN');
    const { rows: solicitudes } = await cliente.query<{
      id: string;
      espacio_id: string;
    }>(
      `SELECT s.id::text AS id, s.espacio_id::text AS espacio_id
         FROM solicitudes s
         JOIN usuarios u ON u.id = s.comerciante_id
        WHERE u.correo = $1
          AND s.actividad LIKE $2`,
      [correo, `${prefijo}%`],
    );
    const ids = solicitudes.map((fila) => fila.id);
    const espacioIds = solicitudes
      .map((fila) => fila.espacio_id)
      .filter((valor) => valor !== null);

    if (ids.length > 0) {
      // Permisos emitidos sobre esas solicitudes (y sus dependencias).
      const { rows: permisos } = await cliente.query<{
        id: string;
        qr_token: string;
      }>(
        `SELECT p.id::text AS id, p.qr_token
           FROM permisos p
          WHERE p.solicitud_id = ANY($1::bigint[])`,
        [ids],
      );
      const permisoIds = permisos.map((fila) => fila.id);
      const tokens = permisos.map((fila) => fila.qr_token);

      if (permisoIds.length > 0) {
        await cliente.query(
          'DELETE FROM cobros WHERE permiso_id = ANY($1::bigint[])',
          [permisoIds],
        );
        await cliente.query(
          'DELETE FROM permiso_eventos WHERE permiso_id = ANY($1::bigint[])',
          [permisoIds],
        );
        if (tokens.length > 0) {
          await cliente.query(
            'DELETE FROM verificaciones_qr WHERE qr_token = ANY($1::varchar[])',
            [tokens],
          );
        }
        await cliente.query(
          'DELETE FROM permisos WHERE renovado_desde = ANY($1::bigint[])',
          [permisoIds],
        );
        await cliente.query(
          'DELETE FROM permisos WHERE id = ANY($1::bigint[])',
          [permisoIds],
        );
      }

      // Notificaciones ligadas a las solicitudes (incluida la del carné).
      await cliente.query(
        'DELETE FROM notificaciones WHERE solicitud_id = ANY($1::bigint[])',
        [ids],
      );
      await cliente.query(
        'DELETE FROM solicitud_documentos WHERE solicitud_id = ANY($1::bigint[])',
        [ids],
      );
      await cliente.query(
        'DELETE FROM solicitud_historial WHERE solicitud_id = ANY($1::bigint[])',
        [ids],
      );
      await cliente.query(
        'DELETE FROM solicitud_productos WHERE solicitud_id = ANY($1::bigint[])',
        [ids],
      );
      await cliente.query(
        'DELETE FROM solicitudes WHERE id = ANY($1::bigint[])',
        [ids],
      );

      // Los triggers de estado de espacio no disparan en DELETE: se
      // recalcula a mano para devolver el espacio a «disponible» y no
      // afectar a las demás suites (fn_recalcular_estado_espacio, HU-15).
      for (const espacioId of espacioIds) {
        await cliente.query('SELECT fn_recalcular_estado_espacio($1::bigint)', [
          espacioId,
        ]);
      }
    }

    await cliente.query('COMMIT');
    return ids;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    await cliente.end();
  }
}
