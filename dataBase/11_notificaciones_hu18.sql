-- ============================================================================
--  Script 11 · HU-18: seguimiento de solicitudes y centro de notificaciones
--  Motor : PostgreSQL 18 + PostGIS 3.6
--  Uso   : psql -U postgres -d "sgp_tulua" -f 11_notificaciones_hu18.sql
--
--  Script idempotente. Agrega la referencia opcional de una notificación a la
--  solicitud que la originó, para que el comerciante pueda abrir el detalle
--  desde el centro de notificaciones.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

\echo '=== 1/3 · Columna notificaciones.solicitud_id ==='
ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS solicitud_id BIGINT;

\echo '=== 2/3 · Clave foránea a solicitudes ==='
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'notificaciones_solicitud_id_fkey'
       AND conrelid = 'notificaciones'::regclass
  ) THEN
    ALTER TABLE notificaciones
      ADD CONSTRAINT notificaciones_solicitud_id_fkey
      FOREIGN KEY (solicitud_id)
      REFERENCES solicitudes (id)
      ON DELETE CASCADE
      ON UPDATE NO ACTION;
  END IF;
END
$$;

\echo '=== 3/3 · Índice por solicitud ==='
CREATE INDEX IF NOT EXISTS idx_notificaciones_solicitud
  ON notificaciones (solicitud_id);

COMMENT ON COLUMN notificaciones.solicitud_id IS
  'Solicitud que originó la notificación (HU-18). NULL para avisos de cuenta.';

\echo 'OK (HU-18): notificaciones enlazadas con solicitudes.'
