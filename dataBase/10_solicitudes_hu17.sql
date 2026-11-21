-- ============================================================================
--  Script 10 · HU-17: versionado de documentos de la solicitud
--  Motor : PostgreSQL 18 + PostGIS 3.6
--  Uso   : psql -U postgres -d "sgp_tulua" -f 10_solicitudes_hu17.sql
--
--  Script idempotente. No agrega columnas: la columna reemplaza_a ya existe
--  desde 01_creacion_bd.sql. Solo agrega el índice que usa la consulta de
--  versiones vigentes e historial.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

\echo '=== 1/1 · Índice de versiones documentales ==='
CREATE INDEX IF NOT EXISTS idx_documentos_reemplazo
  ON solicitud_documentos (solicitud_id, requisito_id, reemplaza_a);

\echo 'OK (HU-17): índice de versiones documentales listo.'
