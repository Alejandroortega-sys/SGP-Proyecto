-- ============================================================================
--  Script 08 · HU-15: catálogo de espacios temporales, bloqueos y estados
--  Motor : PostgreSQL 18 + PostGIS 3.6
--  Uso   : psql -U postgres -d "sgp_tulua" -f 08_espacios_hu15.sql
--
--  Script idempotente. Agrega la asignación manual, la auditoría de espacios y
--  bloqueos, y mantiene sincronizado el estado del espacio con la fecha actual.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

\echo '=== 1/5 · Asignación manual del espacio ==='
ALTER TABLE espacios_temporales
  ADD COLUMN IF NOT EXISTS asignacion_manual BOOLEAN NOT NULL DEFAULT FALSE;

-- Los espacios que ya estaban asignados sin un permiso o solicitud que los
-- respalde se consideran asignaciones manuales históricas. Así el seed y los
-- datos existentes conservan su significado.
UPDATE espacios_temporales e
   SET asignacion_manual = TRUE
 WHERE e.estado = 'asignado'
   AND NOT EXISTS (
     SELECT 1
       FROM permisos p
      WHERE p.espacio_id = e.id
        AND p.estado = 'vigente'
   )
   AND NOT EXISTS (
     SELECT 1
       FROM solicitudes s
      WHERE s.espacio_id = e.id
        AND s.estado = 'aprobada'
   );

\echo '=== 2/5 · Recálculo automático del estado ==='
CREATE OR REPLACE FUNCTION fn_recalcular_estado_espacio(p_espacio_id BIGINT)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_estado   estado_espacio;
  v_manual   BOOLEAN;
  v_hoy      DATE := CURRENT_DATE;
BEGIN
  SELECT e.estado, e.asignacion_manual
    INTO v_estado, v_manual
    FROM espacios_temporales e
   WHERE e.id = p_espacio_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- El mantenimiento es una decisión manual y prevalece.
  IF v_estado = 'mantenimiento' THEN
    RETURN;
  END IF;

  -- La asignación manual se conserva hasta que el gestor la libere.
  IF v_manual THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM permisos p
     WHERE p.espacio_id = p_espacio_id
       AND p.estado = 'vigente'
       AND v_hoy BETWEEN p.fecha_inicio AND p.fecha_fin
  ) THEN
    UPDATE espacios_temporales
       SET estado = 'asignado'
     WHERE id = p_espacio_id
       AND estado <> 'asignado';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM solicitudes s
     WHERE s.espacio_id = p_espacio_id
       AND s.estado = 'aprobada'
       AND v_hoy BETWEEN s.fecha_inicio AND s.fecha_fin
  ) THEN
    UPDATE espacios_temporales
       SET estado = 'asignado'
     WHERE id = p_espacio_id
       AND estado <> 'asignado';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM espacio_bloqueos b
     WHERE b.espacio_id = p_espacio_id
       AND v_hoy BETWEEN b.fecha_inicio AND b.fecha_fin
  ) THEN
    UPDATE espacios_temporales
       SET estado = 'bloqueado'
     WHERE id = p_espacio_id
       AND estado <> 'bloqueado';
    RETURN;
  END IF;

  UPDATE espacios_temporales
     SET estado = 'disponible'
   WHERE id = p_espacio_id
     AND estado <> 'disponible';
END $$;

COMMENT ON FUNCTION fn_recalcular_estado_espacio(BIGINT) IS
  'HU-15: sincroniza espacios_temporales.estado con bloqueos, permisos y solicitudes vigentes hoy. Respeta mantenimiento y la asignación manual.';

CREATE OR REPLACE FUNCTION fn_estado_por_bloqueo() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_viejo BIGINT;
  v_nuevo BIGINT;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_viejo := OLD.espacio_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_nuevo := NEW.espacio_id;
  END IF;

  IF v_viejo IS NOT NULL THEN
    PERFORM fn_recalcular_estado_espacio(v_viejo);
  END IF;
  IF v_nuevo IS NOT NULL AND v_nuevo IS DISTINCT FROM v_viejo THEN
    PERFORM fn_recalcular_estado_espacio(v_nuevo);
  END IF;

  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION fn_estado_por_permiso() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_viejo BIGINT;
  v_nuevo BIGINT;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_viejo := OLD.espacio_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_nuevo := NEW.espacio_id;
  END IF;

  IF v_viejo IS NOT NULL THEN
    PERFORM fn_recalcular_estado_espacio(v_viejo);
  END IF;
  IF v_nuevo IS NOT NULL AND v_nuevo IS DISTINCT FROM v_viejo THEN
    PERFORM fn_recalcular_estado_espacio(v_nuevo);
  END IF;

  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION fn_estado_por_solicitud() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_viejo BIGINT;
  v_nuevo BIGINT;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_viejo := OLD.espacio_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_nuevo := NEW.espacio_id;
  END IF;

  IF v_viejo IS NOT NULL THEN
    PERFORM fn_recalcular_estado_espacio(v_viejo);
  END IF;
  IF v_nuevo IS NOT NULL AND v_nuevo IS DISTINCT FROM v_viejo THEN
    PERFORM fn_recalcular_estado_espacio(v_nuevo);
  END IF;

  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_bloqueos_estado ON espacio_bloqueos;
CREATE TRIGGER trg_bloqueos_estado
  AFTER INSERT OR UPDATE OR DELETE ON espacio_bloqueos
  FOR EACH ROW EXECUTE FUNCTION fn_estado_por_bloqueo();

DROP TRIGGER IF EXISTS trg_permisos_estado ON permisos;
CREATE TRIGGER trg_permisos_estado
  AFTER INSERT OR UPDATE OF espacio_id, estado, fecha_inicio, fecha_fin ON permisos
  FOR EACH ROW EXECUTE FUNCTION fn_estado_por_permiso();

DROP TRIGGER IF EXISTS trg_solicitudes_estado ON solicitudes;
CREATE TRIGGER trg_solicitudes_estado
  AFTER INSERT OR UPDATE OF espacio_id, estado, fecha_inicio, fecha_fin ON solicitudes
  FOR EACH ROW EXECUTE FUNCTION fn_estado_por_solicitud();

\echo '=== 3/5 · Auditoría de espacios temporales ==='
CREATE OR REPLACE FUNCTION fn_auditoria_espacios() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_registro BIGINT;
  v_actor    BIGINT;
BEGIN
  v_registro := (to_jsonb(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END) ->> 'id')::bigint;
  BEGIN
    v_actor := NULLIF(current_setting('app.actor_id', true), '')::bigint;
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  INSERT INTO auditoria (tabla, registro_id, accion, valor_anterior, valor_nuevo, actor_id)
  VALUES (
    'espacios_temporales',
    v_registro,
    lower(TG_OP),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
    COALESCE(
      v_actor,
      CASE WHEN TG_OP = 'DELETE' THEN OLD.creado_por ELSE NEW.creado_por END
    )
  );

  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_espacios_auditoria ON espacios_temporales;
CREATE TRIGGER trg_espacios_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON espacios_temporales
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria_espacios();

\echo '=== 4/5 · Auditoría de bloqueos ==='
CREATE OR REPLACE FUNCTION fn_auditoria_bloqueos() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_espacio BIGINT;
  v_actor   BIGINT;
BEGIN
  v_espacio := (to_jsonb(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END) ->> 'espacio_id')::bigint;
  BEGIN
    v_actor := NULLIF(current_setting('app.actor_id', true), '')::bigint;
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  INSERT INTO auditoria (tabla, registro_id, accion, valor_anterior, valor_nuevo, actor_id)
  VALUES (
    'espacio_bloqueos',
    v_espacio,
    lower(TG_OP),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
    COALESCE(
      v_actor,
      CASE WHEN TG_OP = 'DELETE' THEN OLD.creado_por ELSE NEW.creado_por END
    )
  );

  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_bloqueos_auditoria ON espacio_bloqueos;
CREATE TRIGGER trg_bloqueos_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON espacio_bloqueos
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria_bloqueos();

\echo '=== 5/5 · Historial inicial de los espacios existentes ==='
INSERT INTO auditoria (tabla, registro_id, accion, valor_anterior, valor_nuevo, actor_id, creado_en)
SELECT
  'espacios_temporales',
  e.id,
  'insert',
  NULL,
  to_jsonb(e),
  e.creado_por,
  e.creado_en
FROM espacios_temporales e
WHERE NOT EXISTS (
  SELECT 1
    FROM auditoria a
   WHERE a.tabla = 'espacios_temporales'
     AND a.registro_id = e.id
);

\echo 'OK (HU-15): asignación manual, recálculo de estado y auditoría de espacios y bloqueos.'
