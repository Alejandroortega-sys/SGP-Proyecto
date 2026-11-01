-- ============================================================================
--  Script 05 · HU-10: filtros y disponibilidad por fecha y horario
--  Motor : PostgreSQL 18 + PostGIS 3.6
--  Uso  : psql -U postgres -d "sgp_tulua" -f 05_filtros_hu10.sql
--
--  Script idempotente. Solo agrega índices para los filtros de sector,
--  actividad y el cruce de disponibilidad con solicitudes y permisos.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

\echo '=== 1/2 · Índices de filtros de espacios ==='
CREATE INDEX IF NOT EXISTS idx_espacios_sector
  ON espacios_temporales (sector);
CREATE INDEX IF NOT EXISTS idx_espacios_actividad
  ON espacios_temporales (actividad_permitida);

\echo '=== 2/2 · Índices de disponibilidad por fecha y horario ==='
CREATE INDEX IF NOT EXISTS idx_solicitudes_espacio_estado_fechas
  ON solicitudes (espacio_id, estado, fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_permisos_espacio_estado_fechas
  ON permisos (espacio_id, estado, fecha_inicio, fecha_fin);

\echo 'OK (HU-10): índices de filtros y disponibilidad creados.'
