-- ============================================================================
--  Script 09 · HU-16: radicación de solicitudes de ubicación temporal
--  Motor : PostgreSQL 18 + PostGIS 3.6
--  Uso   : psql -U postgres -d "sgp_tulua" -f 09_solicitudes_hu16.sql
--
--  Script idempotente. Agrega:
--    · Catálogo de requisitos documentales por actividad.
--    · Metadatos de los documentos adjuntos.
--    · Historial de estados de la solicitud.
--    · Generación del número de radicado con el año en curso.
--    · Índices para detección de duplicados.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

\echo '=== 1/5 · Catálogo de requisitos documentales ==='
CREATE TABLE IF NOT EXISTS requisitos_documentales (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre         VARCHAR(100) NOT NULL,
  descripcion    VARCHAR(300),
  obligatorio    BOOLEAN NOT NULL DEFAULT FALSE,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  tipo_actividad VARCHAR(100),
  orden          INTEGER NOT NULL DEFAULT 0,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_requisitos_documentales_nombre_actividad
  ON requisitos_documentales (nombre, (COALESCE(tipo_actividad, 'TODAS')));

CREATE INDEX IF NOT EXISTS idx_requisitos_documentales_actividad
  ON requisitos_documentales (tipo_actividad, orden);

INSERT INTO requisitos_documentales
  (nombre, descripcion, obligatorio, activo, tipo_actividad, orden)
VALUES
  ('Documento de identidad',
   'Copia legible del documento de identidad del comerciante.',
   TRUE, TRUE, NULL, 10),
  ('RUT',
   'Registro Único Tributario vigente.',
   TRUE, TRUE, NULL, 20),
  ('Permiso de uso de suelo',
   'Permiso o concepto de uso de suelo, si aplica para la actividad.',
   FALSE, TRUE, NULL, 30),
  ('Concepto sanitario',
   'Concepto sanitario vigente para actividades que manipulan alimentos.',
   TRUE, TRUE, 'Venta de alimentos y frutas', 40),
  ('Concepto sanitario',
   'Concepto sanitario vigente para actividades que manipulan alimentos.',
   TRUE, TRUE, 'Comidas rápidas', 41),
  ('Cámara de comercio',
   'Certificado de existencia y representación legal, si aplica.',
   FALSE, TRUE, 'Artesanías', 50),
  ('Cámara de comercio',
   'Certificado de existencia y representación legal, si aplica.',
   FALSE, TRUE, 'Ferias y emprendimientos', 51)
ON CONFLICT (nombre, (COALESCE(tipo_actividad, 'TODAS'))) DO NOTHING;

\echo '=== 2/5 · Metadatos de documentos adjuntos ==='
ALTER TABLE solicitud_documentos
  ADD COLUMN IF NOT EXISTS requisito_id BIGINT REFERENCES requisitos_documentales(id),
  ADD COLUMN IF NOT EXISTS nombre_original VARCHAR(255),
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tamano_bytes INTEGER;

CREATE INDEX IF NOT EXISTS idx_documentos_requisito
  ON solicitud_documentos (solicitud_id, requisito_id);

\echo '=== 3/5 · Historial de estados ==='
CREATE TABLE IF NOT EXISTS solicitud_historial (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitud_id    BIGINT NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  estado_anterior estado_solicitud,
  estado_nuevo    estado_solicitud NOT NULL,
  actor_id        BIGINT REFERENCES usuarios(id),
  observacion     TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solicitud_historial_solicitud
  ON solicitud_historial (solicitud_id, creado_en);

-- Historial inicial para las solicitudes que ya existían antes de HU-16.
INSERT INTO solicitud_historial
  (solicitud_id, estado_anterior, estado_nuevo, actor_id, observacion, creado_en)
SELECT
  s.id,
  NULL,
  s.estado,
  s.comerciante_id,
  'Historial inicial migrado',
  s.creado_en
FROM solicitudes s
WHERE NOT EXISTS (
  SELECT 1 FROM solicitud_historial h WHERE h.solicitud_id = s.id
);

\echo '=== 4/5 · Número de radicado con el año en curso ==='
CREATE OR REPLACE FUNCTION fn_numero_radicado_solicitud() RETURNS text
LANGUAGE sql VOLATILE AS $$
  SELECT 'SOL-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('seq_radicado_solicitud')::text, 5, '0');
$$;

COMMENT ON FUNCTION fn_numero_radicado_solicitud() IS
  'HU-16: genera el número legible de radicado SOL-AAAA-##### con la secuencia oficial.';

ALTER TABLE solicitudes
  ALTER COLUMN numero_radicado SET DEFAULT fn_numero_radicado_solicitud();

-- El seed insertó números explícitos sin consumir la secuencia. Se sincroniza
-- con el mayor consecutivo existente para no generar un duplicado.
DO $$
DECLARE
  v_maximo    BIGINT;
  v_siguiente BIGINT;
BEGIN
  SELECT COALESCE(
           MAX((regexp_match(numero_radicado, '([0-9]+)$'))[1]::bigint),
           0
         )
    INTO v_maximo
    FROM solicitudes
   WHERE numero_radicado LIKE 'SOL-%';

  -- Nunca retrocede la secuencia: si ya se consumieron números, se conserva
  -- el siguiente valor disponible.
  SELECT GREATEST(
           (SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END
              FROM seq_radicado_solicitud),
           v_maximo + 1
         )
    INTO v_siguiente;

  PERFORM setval('seq_radicado_solicitud', v_siguiente, false);
END $$;

\echo '=== 5/5 · Índice de duplicados ==='
CREATE INDEX IF NOT EXISTS idx_solicitudes_duplicados
  ON solicitudes (comerciante_id, espacio_id, fecha_inicio, fecha_fin)
  WHERE estado IN ('radicada', 'en_revision', 'devuelta');

\echo 'OK (HU-16): requisitos documentales, historial, metadatos y radicado listos.'
