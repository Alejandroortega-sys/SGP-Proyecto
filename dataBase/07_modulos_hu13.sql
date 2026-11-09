-- ============================================================================
--  Script 07 · HU-13: censo de módulos y puestos de comercio
--  Motor : PostgreSQL 18 + PostGIS 3.6
--  Uso   : psql -U postgres -d "sgp_tulua" -f 07_modulos_hu13.sql
--
--  Script idempotente. No agrega columnas: el sector se deriva de la zona
--  contenedora. Añade la auditoría de `modulos`, el consecutivo seguro para
--  `codigo` y la carga inicial del historial de los módulos existentes.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

\echo '=== 1/4 · Auditoría de módulos ==='
CREATE OR REPLACE FUNCTION fn_auditoria_modulos() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_registro bigint;
  v_actor    bigint;
BEGIN
  v_registro := (to_jsonb(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END) ->> 'id')::bigint;
  BEGIN
    v_actor := NULLIF(current_setting('app.actor_id', true), '')::bigint;
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  INSERT INTO auditoria (tabla, registro_id, accion, valor_anterior, valor_nuevo, actor_id)
  VALUES (
    'modulos',
    v_registro,
    lower(TG_OP),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
    COALESCE(
      v_actor,
      CASE WHEN TG_OP = 'DELETE' THEN OLD.registrado_por ELSE NEW.registrado_por END
    )
  );

  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_modulos_auditoria ON modulos;
CREATE TRIGGER trg_modulos_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON modulos
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria_modulos();

\echo '=== 2/4 · Secuencia del código de módulo ==='
CREATE SEQUENCE IF NOT EXISTS modulos_codigo_seq START WITH 1;

-- Siguiente valor = mayor consecutivo existente + 1. `false` hace que el
-- próximo nextval devuelva exactamente el valor sembrado.
SELECT setval(
  'modulos_codigo_seq',
  GREATEST(
    COALESCE(
      (
        SELECT MAX(NULLIF(regexp_replace(codigo, '\D', '', 'g'), '')::int)
          FROM modulos
      ),
      0
    ) + 1,
    1
  ),
  false
);

COMMENT ON SEQUENCE modulos_codigo_seq IS
  'Consecutivo seguro para el código legible de los módulos: MOD-0001, MOD-0002… (HU-13).';

\echo '=== 3/4 · Índices de filtros ==='
CREATE INDEX IF NOT EXISTS idx_modulos_categoria_estado
  ON modulos (categoria, estado);

\echo '=== 4/4 · Historial inicial de los módulos existentes ==='
INSERT INTO auditoria (tabla, registro_id, accion, valor_anterior, valor_nuevo, actor_id, creado_en)
SELECT
  'modulos',
  m.id,
  'insert',
  NULL,
  to_jsonb(m),
  m.registrado_por,
  m.creado_en
FROM modulos m
WHERE NOT EXISTS (
  SELECT 1
    FROM auditoria a
   WHERE a.tabla = 'modulos'
     AND a.registro_id = m.id
);

\echo 'OK (HU-13): auditoría, secuencia de códigos e índices de módulos creados.'
