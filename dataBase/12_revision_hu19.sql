-- ============================================================================
--  Script 12 · HU-19: revisión documental y bloqueo concurrente del gestor
--  Motor : PostgreSQL 18 + PostGIS 3.6
--  Uso   : psql -U postgres -d "sgp_tulua" -f 12_revision_hu19.sql
--
--  Script idempotente. Agrega:
--    · Bloqueo de revisión por solicitud (lease con expiración).
--    · Metadatos de quién y cuándo verificó cada documento/requisito.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

\echo '=== 1/2 · Bloqueo de revisión concurrente ==='
CREATE TABLE IF NOT EXISTS solicitud_revisiones (
  solicitud_id     BIGINT PRIMARY KEY REFERENCES solicitudes(id) ON DELETE CASCADE,
  gestor_id        BIGINT NOT NULL REFERENCES gestores(usuario_id) ON DELETE CASCADE,
  token            UUID NOT NULL DEFAULT gen_random_uuid(),
  iniciada_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultima_actividad TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_en        TIMESTAMPTZ NOT NULL,
  CHECK (expira_en > ultima_actividad)
);

ALTER TABLE solicitud_revisiones
  ADD COLUMN IF NOT EXISTS token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_solicitud_revisiones_expira
  ON solicitud_revisiones (expira_en);

COMMENT ON TABLE solicitud_revisiones IS
  'HU-19: bloqueo temporal de revisión por gestor, con expiración por inactividad.';
COMMENT ON COLUMN solicitud_revisiones.expira_en IS
  'Fin del bloqueo. Un bloqueo vencido puede ser tomado por otro gestor.';

\echo '=== 2/2 · Trazabilidad de la verificación por requisito ==='
ALTER TABLE solicitud_documentos
  ADD COLUMN IF NOT EXISTS verificado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verificado_en TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_documentos_verificado_por
  ON solicitud_documentos (verificado_por);

COMMENT ON COLUMN solicitud_documentos.verificado_por IS
  'HU-19: gestor que marcó el documento como Cumple o No cumple.';
COMMENT ON COLUMN solicitud_documentos.verificado_en IS
  'HU-19: fecha de la última verificación del documento vigente.';

\echo 'OK (HU-19): bloqueo de revisión y trazabilidad de verificación listos.'
