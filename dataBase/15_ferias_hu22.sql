-- ============================================================================
--  Script 15 · HU-22: programación y administración del calendario de ferias
--  Motor : PostgreSQL 18 + PostGIS 3.6
--  Uso   : psql -U postgres -d "sgp_tulua" -f 15_ferias_hu22.sql
--
--  Script idempotente. Agrega:
--    · Trazabilidad de aprobación y cancelación de una feria.
--    · Vínculo entre los bloqueos de espacios y la feria que los origina.
--    · Bloqueos retroactivos para ferias ya aprobadas.
--    · Triggers de actualización y auditoría de ferias.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

\echo '=== 1/6 · Campos de decisión y trazabilidad en ferias ==='
ALTER TABLE ferias
  ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT;
ALTER TABLE ferias
  ADD COLUMN IF NOT EXISTS aprobada_en TIMESTAMPTZ;
ALTER TABLE ferias
  ADD COLUMN IF NOT EXISTS cancelada_en TIMESTAMPTZ;
ALTER TABLE ferias
  ADD COLUMN IF NOT EXISTS cancelada_por BIGINT;
ALTER TABLE ferias
  ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'ferias_cancelada_por_fkey'
       AND conrelid = 'ferias'::regclass
  ) THEN
    ALTER TABLE ferias
      ADD CONSTRAINT ferias_cancelada_por_fkey
      FOREIGN KEY (cancelada_por) REFERENCES gestores(usuario_id)
      ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END;
$$;

\echo '=== 2/6 · Vínculo de bloqueos de espacios con la feria ==='
ALTER TABLE espacio_bloqueos
  ADD COLUMN IF NOT EXISTS feria_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'espacio_bloqueos_feria_id_fkey'
       AND conrelid = 'espacio_bloqueos'::regclass
  ) THEN
    ALTER TABLE espacio_bloqueos
      ADD CONSTRAINT espacio_bloqueos_feria_id_fkey
      FOREIGN KEY (feria_id) REFERENCES ferias(id)
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_bloqueos_feria
  ON espacio_bloqueos (feria_id);

\echo '=== 3/6 · Triggers de actualización y auditoría de ferias ==='
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'trg_ferias_marca'
       AND tgrelid = 'ferias'::regclass
  ) THEN
    CREATE TRIGGER trg_ferias_marca
      BEFORE UPDATE ON ferias
      FOR EACH ROW EXECUTE FUNCTION fn_marca_actualizacion();
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'trg_ferias_auditoria'
       AND tgrelid = 'ferias'::regclass
  ) THEN
    CREATE TRIGGER trg_ferias_auditoria
      AFTER INSERT OR UPDATE OR DELETE ON ferias
      FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
  END IF;
END;
$$;

\echo '=== 4/6 · Bloqueos retroactivos de ferias aprobadas ==='
-- Las ferias aprobadas antes de esta migración no tenían bloqueos de
-- espacios. Se crean solo cuando el espacio y sus fechas están libres, para
-- no chocar con permisos, solicitudes aprobadas u otros bloqueos.
UPDATE ferias
   SET aprobada_en = radicada_en
 WHERE estado = 'aprobada'
   AND aprobada_en IS NULL;
INSERT INTO espacio_bloqueos (
  espacio_id,
  fecha_inicio,
  fecha_fin,
  motivo,
  creado_por,
  feria_id
)
SELECT
  e.id,
  f.fecha_inicio,
  f.fecha_fin,
  left('Feria ' || f.numero_radicado || ' — ' || f.nombre, 300),
  COALESCE(f.revisor_id, f.organizador_id),
  f.id
FROM ferias f
JOIN espacios_temporales e ON e.zona_id = f.zona_id
WHERE f.estado = 'aprobada'
  AND NOT EXISTS (
    SELECT 1
      FROM espacio_bloqueos b
     WHERE b.espacio_id = e.id
       AND daterange(b.fecha_inicio, b.fecha_fin, '[]')
           && daterange(f.fecha_inicio, f.fecha_fin, '[]')
  )
  AND NOT EXISTS (
    SELECT 1
      FROM permisos p
     WHERE p.espacio_id = e.id
       AND p.estado = 'vigente'
       AND daterange(p.fecha_inicio, p.fecha_fin, '[]')
           && daterange(f.fecha_inicio, f.fecha_fin, '[]')
  )
  AND NOT EXISTS (
    SELECT 1
      FROM solicitudes s
     WHERE s.espacio_id = e.id
       AND s.estado = 'aprobada'
       AND daterange(s.fecha_inicio, s.fecha_fin, '[]')
           && daterange(f.fecha_inicio, f.fecha_fin, '[]')
  )
ON CONFLICT DO NOTHING;

\echo '=== 5/6 · Comentarios ==='
COMMENT ON COLUMN ferias.motivo_cancelacion IS
  'HU-22: motivo obligatorio de cancelación, visible para el organizador.';
COMMENT ON COLUMN ferias.aprobada_en IS
  'HU-22: fecha en que el gestor aprobó la feria.';
COMMENT ON COLUMN ferias.cancelada_en IS
  'HU-22: fecha en que el gestor canceló la feria.';
COMMENT ON COLUMN ferias.cancelada_por IS
  'HU-22: gestor que canceló la feria.';
COMMENT ON COLUMN ferias.actualizado_en IS
  'HU-22: última modificación de la feria (aprobación, movimiento o cancelación).';
COMMENT ON COLUMN espacio_bloqueos.feria_id IS
  'HU-22: feria aprobada que originó el bloqueo; se libera al cancelar o mover la feria.';

\echo '=== 6/6 · Verificación ==='
DO $$
DECLARE
  v_sin_bloqueo INTEGER;
BEGIN
  SELECT COUNT(*)::int
    INTO v_sin_bloqueo
    FROM ferias f
    JOIN espacios_temporales e ON e.zona_id = f.zona_id
   WHERE f.estado = 'aprobada'
     AND NOT EXISTS (
       SELECT 1
         FROM espacio_bloqueos b
        WHERE b.feria_id = f.id
          AND b.espacio_id = e.id
     );

  IF v_sin_bloqueo > 0 THEN
    RAISE NOTICE 'Aviso: % espacio(s) de ferias aprobadas no pudieron bloquearse por solapes existentes.', v_sin_bloqueo;
  END IF;
END;
$$;

\echo 'OK (HU-22): calendario, decisión y bloqueo de espacios listos.'
