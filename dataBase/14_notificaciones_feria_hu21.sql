-- ============================================================================
--  Script 14 · HU-21: enlace de notificaciones con ferias
--  Motor : PostgreSQL 18 + PostGIS 3.6
--  Uso   : psql -U postgres -d "sgp_tulua" -f 14_notificaciones_feria_hu21.sql
--
--  Script idempotente. Permite que el aviso de radicación de una feria
--  enlace al detalle de la feria en la bandeja del organizador.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

\echo '=== 1/2 · Columna feria_id en notificaciones ==='
ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS feria_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'notificaciones_feria_id_fkey'
       AND conrelid = 'notificaciones'::regclass
  ) THEN
    ALTER TABLE notificaciones
      ADD CONSTRAINT notificaciones_feria_id_fkey
      FOREIGN KEY (feria_id) REFERENCES ferias(id)
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END;
$$;

\echo '=== 2/2 · Índice por feria ==='
CREATE INDEX IF NOT EXISTS idx_notificaciones_feria
  ON notificaciones (feria_id);

COMMENT ON COLUMN notificaciones.feria_id IS
  'HU-21: feria relacionada con el aviso; permite enlazar al detalle desde la bandeja.';

\echo 'OK (HU-21): notificaciones enlazadas con ferias.'
