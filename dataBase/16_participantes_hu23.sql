-- ============================================================================
--  Script 16 · HU-23: participantes (vendedores) de una feria aprobada
--  Motor : PostgreSQL 18 + PostGIS 3.6
--  Uso   : psql -U postgres -d "sgp_tulua" -f 16_participantes_hu23.sql
--
--  Script idempotente. Agrega:
--    · Estado de envío del listado final en `ferias`.
--    · Baja lógica y marcas de tiempo en `feria_vendedores`.
--    · Relación N:M `feria_vendedor_productos`.
--    · Relleno de productos de los vendedores existentes.
--    · Validación de estado y cupo en la base de datos.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

\echo '=== 1/7 · Envío del listado final en ferias ==='
ALTER TABLE ferias
  ADD COLUMN IF NOT EXISTS participantes_enviados_en TIMESTAMPTZ;

COMMENT ON COLUMN ferias.participantes_enviados_en IS
  'HU-23: fecha en que el organizador envió el listado final de participantes. NULL = borrador.';

\echo '=== 2/7 · Baja lógica y marcas de tiempo en feria_vendedores ==='
ALTER TABLE feria_vendedores
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE feria_vendedores
  ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE feria_vendedores
  ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE feria_vendedores
  ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'feria_vendedores_baja_check'
       AND conrelid = 'feria_vendedores'::regclass
  ) THEN
    ALTER TABLE feria_vendedores
      ADD CONSTRAINT feria_vendedores_baja_check
      CHECK (
        (activo = TRUE AND eliminado_en IS NULL)
        OR (activo = FALSE AND eliminado_en IS NOT NULL)
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_feria_vendedores_feria_activo
  ON feria_vendedores (feria_id, activo);

COMMENT ON COLUMN feria_vendedores.activo IS
  'HU-23: FALSE indica una baja lógica; el vendedor no aparece ni ocupa cupo.';
COMMENT ON COLUMN feria_vendedores.eliminado_en IS
  'HU-23: fecha de la baja lógica.';

\echo '=== 3/7 · Productos por participante ==='
CREATE TABLE IF NOT EXISTS feria_vendedor_productos (
  vendedor_id BIGINT NOT NULL REFERENCES feria_vendedores(id) ON DELETE CASCADE,
  producto_id BIGINT NOT NULL REFERENCES productos(id),
  PRIMARY KEY (vendedor_id, producto_id)
);

CREATE INDEX IF NOT EXISTS idx_feria_vendedor_productos_producto
  ON feria_vendedor_productos (producto_id);

COMMENT ON TABLE feria_vendedor_productos IS
  'HU-23: productos que vende cada participante de la feria.';

\echo '=== 4/7 · Relleno de productos desde producto_principal ==='
-- Los vendedores del seed y cualquier dato previo tienen un solo producto en
-- texto. Se traslada al catálogo cuando el nombre coincide exactamente.
INSERT INTO feria_vendedor_productos (vendedor_id, producto_id)
SELECT v.id, p.id
  FROM feria_vendedores v
  JOIN productos p ON p.nombre = v.producto_principal
ON CONFLICT DO NOTHING;

\echo '=== 5/7 · Trigger de actualización de feria_vendedores ==='
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'trg_feria_vendedores_marca'
       AND tgrelid = 'feria_vendedores'::regclass
  ) THEN
    CREATE TRIGGER trg_feria_vendedores_marca
      BEFORE UPDATE ON feria_vendedores
      FOR EACH ROW EXECUTE FUNCTION fn_marca_actualizacion();
  END IF;
END;
$$;

\echo '=== 6/7 · Validación de estado y cupo en la base de datos ==='
CREATE OR REPLACE FUNCTION fn_validar_cupo_vendedor() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_estado estado_feria;
  v_cupo   INTEGER;
  v_ocupados INTEGER;
BEGIN
  -- Las bajas lógicas no ocupan cupo ni exigen feria aprobada.
  IF NOT NEW.activo THEN
    RETURN NEW;
  END IF;

  -- Las ediciones que no reactivan ni cambian de feria no alteran el cupo.
  IF TG_OP = 'UPDATE'
     AND OLD.activo = TRUE
     AND OLD.feria_id = NEW.feria_id THEN
    RETURN NEW;
  END IF;

  SELECT estado, numero_puestos
    INTO v_estado, v_cupo
    FROM ferias
   WHERE id = NEW.feria_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La feria del participante no existe'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_estado <> 'aprobada' THEN
    RAISE EXCEPTION 'Solo se pueden registrar participantes en ferias aprobadas'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*)
    INTO v_ocupados
    FROM feria_vendedores
   WHERE feria_id = NEW.feria_id
     AND activo = TRUE
     AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_ocupados >= v_cupo THEN
    RAISE EXCEPTION 'La feria alcanzó su cupo aprobado de % participantes', v_cupo
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'trg_feria_vendedores_cupo'
       AND tgrelid = 'feria_vendedores'::regclass
  ) THEN
    CREATE TRIGGER trg_feria_vendedores_cupo
      BEFORE INSERT OR UPDATE OF feria_id, activo ON feria_vendedores
      FOR EACH ROW EXECUTE FUNCTION fn_validar_cupo_vendedor();
  END IF;
END;
$$;

\echo '=== 7/7 · Verificación ==='
DO $$
DECLARE
  v_sin_producto INTEGER;
BEGIN
  SELECT COUNT(*)::int
    INTO v_sin_producto
    FROM feria_vendedores v
   WHERE v.activo = TRUE
     AND NOT EXISTS (
       SELECT 1
         FROM feria_vendedor_productos vp
        WHERE vp.vendedor_id = v.id
     );

  IF v_sin_producto > 0 THEN
    RAISE NOTICE 'Aviso: % vendedor(es) existente(s) quedaron sin producto porque producto_principal no coincide con el catálogo.', v_sin_producto;
  END IF;
END;
$$;

\echo 'OK (HU-23): participantes, productos, cupo y envío del listado final listos.'
