-- ============================================================================
--  Script 06 · HU-12: versionado e historial de zonas
--  Motor : PostgreSQL 18 + PostGIS 3.6
--  Uso   : psql -U postgres -d "sgp_tulua" -f 06_zonas_hu12.sql
--
--  Script idempotente. Crea el historial inmutable de cambios de zonas
--  (geometría, clasificación y restricciones), registra una versión inicial
--  para las zonas existentes y expone una función para que la aplicación
--  agregue nuevas versiones dentro de la misma transacción del cambio.
--
--  La tabla `auditoria` se conserva como registro genérico de bajo nivel.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

\echo '=== 1/4 · Tabla de versiones de zonas ==='
CREATE TABLE IF NOT EXISTS zona_versiones (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  zona_id        BIGINT NOT NULL REFERENCES zonas(id) ON DELETE CASCADE,
  version        INTEGER NOT NULL,
  accion         VARCHAR(20) NOT NULL,
  nombre         VARCHAR(150) NOT NULL,
  tipo           tipo_zona NOT NULL,
  geometria      geometry(Polygon,4326) NOT NULL,
  horario_inicio TIME,
  horario_fin    TIME,
  aforo_maximo   INTEGER,
  activa         BOOLEAN NOT NULL,
  productos      JSONB NOT NULL DEFAULT '[]'::jsonb,
  actor_id       BIGINT REFERENCES usuarios(id),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT zona_versiones_zona_version_key UNIQUE (zona_id, version),
  CONSTRAINT zona_versiones_accion_check
    CHECK (accion IN ('creacion', 'edicion', 'activacion', 'desactivacion')),
  CONSTRAINT zona_versiones_aforo_check
    CHECK (aforo_maximo IS NULL OR aforo_maximo > 0),
  CONSTRAINT zona_versiones_geometria_check
    CHECK (ST_IsValid(geometria)),
  CONSTRAINT zona_versiones_productos_check
    CHECK (jsonb_typeof(productos) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_zona_versiones_zona
  ON zona_versiones (zona_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_zona_versiones_fecha
  ON zona_versiones (creado_en DESC);

\echo '=== 2/4 · Función para registrar una versión ==='
CREATE OR REPLACE FUNCTION fn_registrar_version_zona(
  p_zona_id BIGINT,
  p_accion TEXT,
  p_actor_id BIGINT DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  v_version INTEGER;
  v_actor   BIGINT;
  v_accion  TEXT := lower(trim(p_accion));
BEGIN
  IF v_accion NOT IN ('creacion', 'edicion', 'activacion', 'desactivacion') THEN
    RAISE EXCEPTION 'Acción de versión de zona no válida: %', p_accion;
  END IF;

  -- Serializa las escrituras concurrentes sobre la misma zona.
  PERFORM 1 FROM zonas WHERE id = p_zona_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_actor := p_actor_id;
  IF v_actor IS NULL THEN
    BEGIN
      v_actor := NULLIF(current_setting('app.actor_id', true), '')::bigint;
    EXCEPTION WHEN OTHERS THEN
      v_actor := NULL;
    END;
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1
    INTO v_version
    FROM zona_versiones
   WHERE zona_id = p_zona_id;

  INSERT INTO zona_versiones (
    zona_id,
    version,
    accion,
    nombre,
    tipo,
    geometria,
    horario_inicio,
    horario_fin,
    aforo_maximo,
    activa,
    productos,
    actor_id
  )
  SELECT
    z.id,
    v_version,
    v_accion,
    z.nombre,
    z.tipo,
    z.geometria,
    z.horario_inicio,
    z.horario_fin,
    z.aforo_maximo,
    z.activa,
    COALESCE(
      (
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'id', p.id::text,
                   'nombre', p.nombre,
                   'activo', p.activo
                 )
                 ORDER BY p.nombre, p.id
               )
          FROM zona_productos zp
          JOIN productos p ON p.id = zp.producto_id
         WHERE zp.zona_id = z.id
      ),
      '[]'::jsonb
    ),
    v_actor
  FROM zonas z
  WHERE z.id = p_zona_id;

  RETURN v_version;
END $$;

\echo '=== 3/4 · Versión inicial de las zonas existentes ==='
INSERT INTO zona_versiones (
  zona_id,
  version,
  accion,
  nombre,
  tipo,
  geometria,
  horario_inicio,
  horario_fin,
  aforo_maximo,
  activa,
  productos,
  actor_id,
  creado_en
)
SELECT
  z.id,
  1,
  'creacion',
  z.nombre,
  z.tipo,
  z.geometria,
  z.horario_inicio,
  z.horario_fin,
  z.aforo_maximo,
  z.activa,
  COALESCE(
    (
      SELECT jsonb_agg(
               jsonb_build_object(
                 'id', p.id::text,
                 'nombre', p.nombre,
                 'activo', p.activo
               )
               ORDER BY p.nombre, p.id
             )
        FROM zona_productos zp
        JOIN productos p ON p.id = zp.producto_id
       WHERE zp.zona_id = z.id
    ),
    '[]'::jsonb
  ),
  z.creado_por,
  z.creado_en
FROM zonas z
WHERE NOT EXISTS (
  SELECT 1 FROM zona_versiones v WHERE v.zona_id = z.id
);

\echo '=== 4/4 · Comentarios ==='
COMMENT ON TABLE zona_versiones IS
  'Historial inmutable de zonas: una fila por cambio, con geometría, clasificación, restricciones, productos y actor (HU-12).';
COMMENT ON COLUMN zona_versiones.version IS
  'Número consecutivo por zona; la versión 1 es la creación o el estado inicial migrado.';
COMMENT ON COLUMN zona_versiones.accion IS
  'creacion, edicion, activacion o desactivacion.';
COMMENT ON COLUMN zona_versiones.productos IS
  'Snapshot JSON de los productos permitidos al momento de la versión: [{id, nombre, activo}].';
COMMENT ON FUNCTION fn_registrar_version_zona(BIGINT, TEXT, BIGINT) IS
  'Registra un snapshot inmutable del estado actual de una zona y devuelve el número de versión (HU-12).';

\echo 'OK (HU-12): tabla zona_versiones, función e historial inicial creados.'
