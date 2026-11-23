-- ============================================================================
--  Script 13 · HU-21: solicitud de espacio para ferias agroecológicas
--  Motor : PostgreSQL 18 + PostGIS 3.6
--  Uso   : psql -U postgres -d "sgp_tulua" -f 13_ferias_hu21.sql
--
--  Script idempotente. Agrega:
--    · Documentos adjuntos de una feria (almacenamiento privado reutilizado).
--    · Índice de agenda por zona, estado y fechas.
--    · Verificación de la restricción EXCLUDE que impide cruces de agenda.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

\echo '=== 1/4 · Documentos adjuntos de la feria ==='
CREATE TABLE IF NOT EXISTS feria_documentos (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feria_id        BIGINT NOT NULL REFERENCES ferias(id) ON DELETE CASCADE,
  tipo_documento  VARCHAR(100) NOT NULL,
  archivo_url     TEXT NOT NULL,
  nombre_original VARCHAR(255),
  mime_type       VARCHAR(100),
  tamano_bytes    INT,
  cargado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feria_documentos_feria
  ON feria_documentos (feria_id, cargado_en);

COMMENT ON TABLE feria_documentos IS
  'HU-21: documentación opcional adjunta a una feria o evento agroecológico.';
COMMENT ON COLUMN feria_documentos.archivo_url IS
  'Ruta relativa dentro del directorio privado UPLOAD_PRIVATE_DIR. Nunca se sirve como archivo estático.';
COMMENT ON COLUMN feria_documentos.tipo_documento IS
  'Etiqueta legible del adjunto; en HU-21 todos los archivos son documentación del evento.';

\echo '=== 2/4 · Índice de agenda de ferias ==='
CREATE INDEX IF NOT EXISTS idx_ferias_zona_estado_fechas
  ON ferias (zona_id, estado, fecha_inicio, fecha_fin);

\echo '=== 3/4 · Sincronización del consecutivo de radicado ==='
-- El seed inserta radicados explícitos (FER-2026-00001, ...). Sin esta
-- sincronización, nextval volvería a generar un número ya usado.
DO $$
DECLARE
  max_consecutivo BIGINT;
BEGIN
  SELECT COALESCE(
           MAX((regexp_match(numero_radicado, '(\d+)$'))[1]::BIGINT),
           0
         )
    INTO max_consecutivo
    FROM ferias;

  IF max_consecutivo > 0 THEN
    PERFORM setval(
      'seq_radicado_feria',
      GREATEST(
        (SELECT last_value FROM seq_radicado_feria),
        max_consecutivo
      ),
      true
    );
  END IF;
END;
$$;

\echo '=== 4/4 · Restricción de cruces de agenda ==='
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'ferias_zona_id_daterange_excl'
       AND conrelid = 'ferias'::regclass
  ) THEN
    ALTER TABLE ferias
      ADD CONSTRAINT ferias_zona_id_daterange_excl
      EXCLUDE USING gist (
        zona_id WITH =,
        daterange(fecha_inicio, fecha_fin, '[]') WITH &&
      )
      WHERE (estado IN ('radicada', 'aprobada'));
  END IF;
END;
$$;

COMMENT ON CONSTRAINT ferias_zona_id_daterange_excl ON ferias IS
  'HU-21/HU-22: impide dos ferias activas en la misma zona con fechas solapadas.';

\echo 'OK (HU-21): documentos, índice de agenda y restricción de cruces listos.'
