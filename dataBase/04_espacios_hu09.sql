-- ============================================================================
--  Script 04 · HU-09: espacios disponibles y ficha detallada
--  Motor : PostgreSQL 18 + PostGIS 3.6
--  Uso  : psql -U postgres -d "sgp_tulua" -f 04_espacios_hu09.sql
--
--  Este script es idempotente. Actualiza una base creada con las versiones
--  anteriores de 01_creacion_bd.sql y 02_seed_datos_prueba.sql sin borrar
--  información existente.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

\echo '=== 1/4 · Tipo enumerado tipo_espacio ==='
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_espacio') THEN
    EXECUTE 'CREATE TYPE tipo_espacio AS ENUM (''modulo'',''kiosco'',''puesto'',''espacio_movil'')';
  END IF;
END $$;

\echo '=== 2/4 · Columnas de la ficha del espacio (HU-09) ==='
ALTER TABLE espacios_temporales
  ADD COLUMN IF NOT EXISTS tipo tipo_espacio NOT NULL DEFAULT 'puesto',
  ADD COLUMN IF NOT EXISTS sector VARCHAR(100),
  ADD COLUMN IF NOT EXISTS dimensiones VARCHAR(60),
  ADD COLUMN IF NOT EXISTS horario_inicio TIME,
  ADD COLUMN IF NOT EXISTS horario_fin TIME;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'espacios_temporales_horario_check'
  ) THEN
    ALTER TABLE espacios_temporales
      ADD CONSTRAINT espacios_temporales_horario_check
      CHECK (
        (horario_inicio IS NULL AND horario_fin IS NULL)
        OR (
          horario_inicio IS NOT NULL
          AND horario_fin IS NOT NULL
          AND horario_fin > horario_inicio
        )
      );
  END IF;
END $$;

\echo '=== 3/4 · Índices de disponibilidad ==='
CREATE INDEX IF NOT EXISTS idx_espacios_estado
  ON espacios_temporales (estado);
CREATE INDEX IF NOT EXISTS idx_bloqueos_espacio_fechas
  ON espacio_bloqueos (espacio_id, fecha_inicio, fecha_fin);

\echo '=== 4/4 · Datos de la ficha para el seed existente ==='
UPDATE espacios_temporales
   SET tipo = 'espacio_movil',
       sector = 'Centro',
       dimensiones = '3 × 2 m',
       horario_inicio = TIME '06:00',
       horario_fin = TIME '14:00'
 WHERE nombre = 'Espacio móvil Calle 30 - A';

UPDATE espacios_temporales
   SET tipo = 'espacio_movil',
       sector = 'Centro',
       dimensiones = '3 × 2 m',
       horario_inicio = TIME '06:00',
       horario_fin = TIME '14:00'
 WHERE nombre = 'Espacio móvil Calle 30 - B';

UPDATE espacios_temporales
   SET tipo = 'puesto',
       sector = 'Plaza Boyacá',
       dimensiones = '4 × 3 m',
       horario_inicio = TIME '07:00',
       horario_fin = TIME '17:00'
 WHERE nombre = 'Espacio Plaza Boyacá - Norte';

UPDATE espacios_temporales
   SET tipo = 'kiosco',
       sector = 'Parque La Guadua',
       dimensiones = '5 × 4 m',
       horario_inicio = TIME '08:00',
       horario_fin = TIME '18:00'
 WHERE nombre = 'Kiosco Parque La Guadua';

-- Espacio ocupado de demostración (HU-09): no debe aparecer como disponible.
INSERT INTO espacios_temporales (
  nombre, tipo, sector, dimensiones, zona_id, ubicacion,
  actividad_permitida, horario_inicio, horario_fin, estado, creado_por
)
SELECT
  'Espacio Plaza Boyacá - Sur',
  'puesto',
  'Plaza Boyacá',
  '4 × 3 m',
  (SELECT id FROM zonas WHERE nombre = 'Plaza Boyacá'),
  ST_SetSRID(ST_MakePoint(-76.1908, 4.0885), 4326),
  'Comidas rápidas',
  TIME '07:00',
  TIME '17:00',
  'asignado',
  (SELECT id FROM usuarios WHERE correo = 'admin@tulua.gov.co')
WHERE NOT EXISTS (
  SELECT 1 FROM espacios_temporales WHERE nombre = 'Espacio Plaza Boyacá - Sur'
);

-- Espacio en mantenimiento de demostración (HU-09): tampoco es disponible.
INSERT INTO espacios_temporales (
  nombre, tipo, sector, dimensiones, zona_id, ubicacion,
  actividad_permitida, horario_inicio, horario_fin, estado, creado_por
)
SELECT
  'Módulo Parque La Guadua - Este',
  'modulo',
  'Parque La Guadua',
  '2 × 2 m',
  (SELECT id FROM zonas WHERE nombre = 'Parque La Guadua'),
  ST_SetSRID(ST_MakePoint(-76.1878, 4.0908), 4326),
  'Artesanías',
  TIME '08:00',
  TIME '18:00',
  'mantenimiento',
  (SELECT id FROM usuarios WHERE correo = 'admin@tulua.gov.co')
WHERE NOT EXISTS (
  SELECT 1 FROM espacios_temporales WHERE nombre = 'Módulo Parque La Guadua - Este'
);

\echo 'OK (HU-09): columnas, índices y datos de espacios actualizados.'
