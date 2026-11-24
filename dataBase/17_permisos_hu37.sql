-- ============================================================================
--  Script 17 · HU-37 (tarea 1251): índices de búsqueda de permisos
--  Motor : PostgreSQL 18 + PostGIS 3.6
--  Uso  : psql -U postgres -d "sgp_tulua" -f 17_permisos_hu37.sql
--
--  Script idempotente. La búsqueda del gestor filtra permisos por número
--  (ya cubierto por el índice UNIQUE de «numero»), por titular (nombre o
--  apellido del comerciante) y por nombre del espacio. Estas dos últimas son
--  búsquedas de texto parcial (ILIKE '%q%'), que los índices btree no sirven:
--  se agregan índices GIN de trigramas con la extensión pg_trgm.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

\echo '=== 1/2 · Extensión de trigramas (pg_trgm) ==='
CREATE EXTENSION IF NOT EXISTS pg_trgm;

\echo '=== 2/2 · Índices GIN de trigramas para la búsqueda por texto ==='
CREATE INDEX IF NOT EXISTS idx_usuarios_nombre_trgm
  ON usuarios USING gin (nombre gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_usuarios_apellido_trgm
  ON usuarios USING gin (apellido gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_espacios_nombre_trgm
  ON espacios_temporales USING gin (nombre gin_trgm_ops);

\echo 'OK (HU-37): índices de búsqueda por titular y espacio creados.'
