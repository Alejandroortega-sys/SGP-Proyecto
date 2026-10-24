-- ============================================================================
--  PLATAFORMA WEB DE GESTIÓN DEL ESPACIO PÚBLICO DE TULUÁ — EQUIPO 6
--  Script 02 · DATOS DE PRUEBA (SEED)
--  Uso  : psql -U postgres -d "SPG-Prueba" -f 02_seed_datos_prueba.sql
--  (Ejecutar DESPUÉS de 01_creacion_bd.sql)
--
--  Contraseñas de prueba (hashes argon2id generados con la librería `argon2`):
--    admin@tulua.gov.co        -> Admin1234
--    revisor@tulua.gov.co      -> Admin1234
--    *_@gmail/hotmail/...      -> Comerciante123
--    *@*.org (organizadores)   -> Organizador123
--  PostgreSQL no genera argon2: los hashes quedan como literales. Para
--  regenerarlos con la versión instalada en el proyecto:
--    node -e "require('argon2').hash('Admin1234').then(console.log)"
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

\echo '=== 1/12 · Usuarios (2 gestores, 4 comerciantes, 2 organizadores) ==='
INSERT INTO usuarios (rol, nombre, apellido, tipo_documento, documento, telefono, correo, password_hash, estado) VALUES
  ('gestor',      'Laura',  'Martínez',  NULL,     NULL,         NULL,         'admin@tulua.gov.co',             '$argon2id$v=19$m=19456,p=1,t=2$AaTvzKel+egX7v1p9qj7aA$rbPRFYUU/QDiyIP5Zo31mRttjl8D0WuEWj/35jCHQTk', 'activa'),
  ('gestor',      'Carlos',  'Ramírez',   NULL,     NULL,         NULL,         'revisor@tulua.gov.co',           '$argon2id$v=19$m=19456,p=1,t=2$EKvrsQRpmO5Mw1zihKyW/A$BrkhKD68THGfyQzx8lLR8NM+J3VByjmJBiHxaIu89aw', 'activa'),
  ('comerciante', 'María',   'Gómez',     'CC',     '1032456789', '3214567890', 'maria.gomez@gmail.com',          '$argon2id$v=19$m=19456,p=1,t=2$ZsuI7gv2rYDydxc56UPuQA$v61N33PiEmvTI16ia9koNaF6MjW/k8Ayq6caCyEydaE', 'activa'),
  ('comerciante', 'José',    'Pérez',     'CC',     '801234567',  '3147788990', 'jose.perez@hotmail.com',         '$argon2id$v=19$m=19456,p=1,t=2$rQ+m1VELGNX7Jus4ztcW/Q$7J2s8ZVf1eQb4REJ3Sl+aQPa+3qLQkmIf757KJJ8djg', 'activa'),
  ('comerciante', 'Ana',     'Ruiz',      'CC',     '71588900',   '3126655443', 'ana.ruiz@gmail.com',             '$argon2id$v=19$m=19456,p=1,t=2$nlOGH5dgtrE5e3H+zlKbvg$pMKTUzOhDNmH1QmNe+1SZGLHJ7K5Sst1aoZ8EUSbhEI', 'activa'),
  ('comerciante', 'Pedro',   'Sánchez',   'CC',     '1029384756','3001122334', 'pedro.sanchez@gmail.com',        '$argon2id$v=19$m=19456,p=1,t=2$vpCD+0w3NHOVAVukDXd6Ig$9XN+C+zcSiZolRVqQD9X6T5m4kzNAi8QBErse3+7by8', 'pendiente_activacion'),
  ('organizador', 'Luis',    'Álvarez',   NULL,     NULL,         NULL,         'luis.alvarez@agrovalle.org',     '$argon2id$v=19$m=19456,p=1,t=2$Wl7cspreWDtWDP7D51+XIg$o0sU5dWAEnhyzC8Kwke97dZmT47USHDZCTcIzoOo9IQ', 'activa'),
  ('organizador', 'Marta',   'Cifuentes', NULL,     NULL,         NULL,         'marta.cifuentes@asocampesinos.org', '$argon2id$v=19$m=19456,p=1,t=2$77UNIQ5Ep8STYx3Wmmm0yg$Nr0ODc6CfINX4bzRgfdj1w2V3ei14mi5EhEe68ZSk18', 'activa');

\echo '=== 2/12 · Perfiles por rol ==='
INSERT INTO gestores (usuario_id, perfil, creado_por) VALUES
  ((SELECT id FROM usuarios WHERE correo = 'admin@tulua.gov.co'),   'administrador', (SELECT id FROM usuarios WHERE correo = 'admin@tulua.gov.co')),
  ((SELECT id FROM usuarios WHERE correo = 'revisor@tulua.gov.co'), 'revisor',       (SELECT id FROM usuarios WHERE correo = 'admin@tulua.gov.co'));

INSERT INTO comerciantes (usuario_id, actividad_comercial, categoria) VALUES
  ((SELECT id FROM usuarios WHERE correo = 'maria.gomez@gmail.com'),   'Venta de frutas y verduras', 'formal'),
  ((SELECT id FROM usuarios WHERE correo = 'jose.perez@hotmail.com'),  'Comidas rápidas',            'informal'),
  ((SELECT id FROM usuarios WHERE correo = 'ana.ruiz@gmail.com'),      'Artesanías',                 'formal'),
  ((SELECT id FROM usuarios WHERE correo = 'pedro.sanchez@gmail.com'), 'Venta de ropa',              'formal');

INSERT INTO organizadores (usuario_id, nombre_organizacion, nit, representante, tipo_feria, contacto, estado, validado_por, validado_en) VALUES
  ((SELECT id FROM usuarios WHERE correo = 'luis.alvarez@agrovalle.org'),
   'Fundación Agroecológica del Valle', '900123456-1', 'Luis Álvarez', 'Feria agroecológica', '3105551234',
   'activa', (SELECT id FROM usuarios WHERE correo = 'admin@tulua.gov.co'), now() - interval '20 days'),
  ((SELECT id FROM usuarios WHERE correo = 'marta.cifuentes@asocampesinos.org'),
   'Asocampesinos Tuluá', '900654321-2', 'Marta Cifuentes', 'Feria campesina', '3184432211',
   'pendiente_validacion', NULL, NULL);

\echo '=== 3/12 · Token de activación pendiente (HU-01) ==='
INSERT INTO tokens_seguridad (usuario_id, tipo, token_hash, expira_en, usado) VALUES
  ((SELECT id FROM usuarios WHERE correo = 'pedro.sanchez@gmail.com'), 'activacion',
   encode(sha256('token-activacion-demo-2026'::bytea), 'hex'), now() + interval '24 hours', FALSE);

\echo '=== 4/12 · Actor de sesión para auditoría y trazabilidad ==='
DO $$
DECLARE v_admin bigint;
BEGIN
  SELECT id INTO v_admin FROM usuarios WHERE correo = 'admin@tulua.gov.co';
  PERFORM set_config('app.actor_id', v_admin::text, false);
END $$;

\echo '=== 5/12 · Catálogo de productos ==='
INSERT INTO productos (nombre) VALUES
  ('Frutas frescas'), ('Verduras'), ('Artesanías'), ('Comidas rápidas'), ('Ropa y calzado'), ('Plantas ornamentales');

\echo '=== 6/12 · Zonas normativas de Tuluá (polígonos GeoJSON/SRID 4326) ==='
INSERT INTO zonas (nombre, tipo, geometria, horario_inicio, horario_fin, aforo_maximo, activa, creado_por) VALUES
  ('Centro - Calle 30',  'permitida',
   ST_GeomFromText('POLYGON((-76.1960 4.0880, -76.1920 4.0880, -76.1920 4.0900, -76.1960 4.0900, -76.1960 4.0880))', 4326),
   '06:00', '18:00', 40, TRUE, (SELECT id FROM usuarios WHERE correo = 'admin@tulua.gov.co')),
  ('Plaza Boyacá', 'alta_congestion',
   ST_GeomFromText('POLYGON((-76.1920 4.0880, -76.1890 4.0880, -76.1890 4.0895, -76.1920 4.0895, -76.1920 4.0880))', 4326),
   '07:00', '17:00', 15, TRUE, (SELECT id FROM usuarios WHERE correo = 'admin@tulua.gov.co')),
  ('Entorno Hospital', 'restringida',
   ST_GeomFromText('POLYGON((-76.1960 4.0900, -76.1920 4.0900, -76.1920 4.0920, -76.1960 4.0920, -76.1960 4.0900))', 4326),
   NULL, NULL, 5, TRUE, (SELECT id FROM usuarios WHERE correo = 'admin@tulua.gov.co')),
  ('Parque La Guadua', 'permitida',
   ST_GeomFromText('POLYGON((-76.1890 4.0895, -76.1860 4.0895, -76.1860 4.0915, -76.1890 4.0915, -76.1890 4.0895))', 4326),
   '06:00', '20:00', 25, TRUE, (SELECT id FROM usuarios WHERE correo = 'admin@tulua.gov.co'));

\echo '=== 7/12 · Productos permitidos por zona (regla 2 del motor) ==='
INSERT INTO zona_productos (zona_id, producto_id)
SELECT z.id, p.id
  FROM zonas z
  JOIN productos p ON (
       (z.nombre = 'Centro - Calle 30'  AND p.nombre IN ('Frutas frescas','Verduras','Ropa y calzado'))
    OR (z.nombre = 'Plaza Boyacá'       AND p.nombre IN ('Artesanías','Comidas rápidas'))
    OR (z.nombre = 'Parque La Guadua'   AND p.nombre IN ('Frutas frescas','Plantas ornamentales','Artesanías'))
  );

\echo '=== 8/12 · Censo de módulos y puestos (HU-13) ==='
INSERT INTO modulos (codigo, ubicacion, categoria, titular_id, titular_nombre, actividad, foto_url, estado, registrado_por) VALUES
  ('MOD-0001', ST_SetSRID(ST_MakePoint(-76.1955, 4.0885), 4326), 'formal',   (SELECT usuario_id FROM comerciantes WHERE usuario_id = (SELECT id FROM usuarios WHERE correo = 'maria.gomez@gmail.com')), NULL, 'Frutería La 30',   'uploads/mod-0001.jpg', 'activo', (SELECT id FROM usuarios WHERE correo = 'revisor@tulua.gov.co')),
  ('MOD-0002', ST_SetSRID(ST_MakePoint(-76.1930, 4.0895), 4326), 'informal', (SELECT usuario_id FROM comerciantes WHERE usuario_id = (SELECT id FROM usuarios WHERE correo = 'jose.perez@hotmail.com')), NULL, 'Empanadas El Sabor', 'uploads/mod-0002.jpg', 'activo', (SELECT id FROM usuarios WHERE correo = 'revisor@tulua.gov.co')),
  ('MOD-0003', ST_SetSRID(ST_MakePoint(-76.1910, 4.0887), 4326), 'informal', NULL, 'Nelson Mina',    'Artesanías Mina',    NULL,                    'activo', (SELECT id FROM usuarios WHERE correo = 'revisor@tulua.gov.co')),
  ('MOD-0004', ST_SetSRID(ST_MakePoint(-76.1905, 4.0890), 4326), 'formal',   (SELECT usuario_id FROM comerciantes WHERE usuario_id = (SELECT id FROM usuarios WHERE correo = 'ana.ruiz@gmail.com')), NULL, 'Artesanías Ana',  'uploads/mod-0004.jpg', 'activo', (SELECT id FROM usuarios WHERE correo = 'revisor@tulua.gov.co')),
  ('MOD-0005', ST_SetSRID(ST_MakePoint(-76.1880, 4.0905), 4326), 'formal',   NULL, 'Carlos Andrade', 'Vivero Andrade',    NULL,                    'activo', (SELECT id FROM usuarios WHERE correo = 'revisor@tulua.gov.co')),
  ('MOD-0006', ST_SetSRID(ST_MakePoint(-76.1875, 4.0900), 4326), 'informal', NULL, 'Rosa Betancur',  'Frutas Rosa',       NULL,                    'activo', (SELECT id FROM usuarios WHERE correo = 'revisor@tulua.gov.co'));

\echo '=== 9/12 · Espacios temporales, bloqueos y parámetros del motor ==='
INSERT INTO espacios_temporales (nombre, zona_id, ubicacion, actividad_permitida, estado, creado_por) VALUES
  ('Espacio móvil Calle 30 - A',   (SELECT id FROM zonas WHERE nombre = 'Centro - Calle 30'), ST_SetSRID(ST_MakePoint(-76.1950, 4.0890), 4326), 'Venta de alimentos y frutas', 'disponible', (SELECT id FROM usuarios WHERE correo = 'admin@tulua.gov.co')),
  ('Espacio móvil Calle 30 - B',   (SELECT id FROM zonas WHERE nombre = 'Centro - Calle 30'), ST_SetSRID(ST_MakePoint(-76.1940, 4.0888), 4326), 'Venta de alimentos y frutas', 'disponible', (SELECT id FROM usuarios WHERE correo = 'admin@tulua.gov.co')),
  ('Espacio Plaza Boyacá - Norte', (SELECT id FROM zonas WHERE nombre = 'Plaza Boyacá'),      ST_SetSRID(ST_MakePoint(-76.1905, 4.0888), 4326), 'Artesanías',                  'bloqueado',  (SELECT id FROM usuarios WHERE correo = 'admin@tulua.gov.co')),
  ('Kiosco Parque La Guadua',      (SELECT id FROM zonas WHERE nombre = 'Parque La Guadua'),  ST_SetSRID(ST_MakePoint(-76.1875, 4.0910), 4326), 'Ferias y emprendimientos',    'disponible', (SELECT id FROM usuarios WHERE correo = 'admin@tulua.gov.co'));

INSERT INTO espacio_bloqueos (espacio_id, fecha_inicio, fecha_fin, motivo, creado_por) VALUES
  ((SELECT id FROM espacios_temporales WHERE nombre = 'Espacio Plaza Boyacá - Norte'), DATE '2026-10-25', DATE '2026-10-31',
   'Mantenimiento del andén', (SELECT id FROM usuarios WHERE correo = 'admin@tulua.gov.co'));

INSERT INTO parametros_motor (clave, zona_id, valor, unidad, creado_por) VALUES
  ('distancia_minima',         NULL, 5,  'metros',  (SELECT id FROM usuarios WHERE correo = 'admin@tulua.gov.co')),
  ('aforo_cuadrante_defecto',   NULL, 40, 'puestos', (SELECT id FROM usuarios WHERE correo = 'admin@tulua.gov.co')),
  ('umbral_alerta',            NULL, 80, '%',       (SELECT id FROM usuarios WHERE correo = 'admin@tulua.gov.co'));

\echo '=== 10/12 · Solicitudes de uso temporal (HU-16 a HU-20) ==='
INSERT INTO solicitudes (numero_radicado, comerciante_id, espacio_id, ubicacion_solicitada, actividad, fecha_inicio, fecha_fin, hora_inicio, hora_fin, estado, revisor_id, motivo_rechazo, radicada_en, decidida_en) VALUES
  ('SOL-2026-00001', (SELECT usuario_id FROM comerciantes WHERE usuario_id = (SELECT id FROM usuarios WHERE correo = 'maria.gomez@gmail.com')),
   (SELECT id FROM espacios_temporales WHERE nombre = 'Espacio móvil Calle 30 - A'), ST_SetSRID(ST_MakePoint(-76.1950, 4.0890), 4326),
   'Venta de frutas y verduras', DATE '2026-11-01', DATE '2026-11-30', '06:00', '14:00', 'aprobada',
   (SELECT id FROM usuarios WHERE correo = 'revisor@tulua.gov.co'), NULL,
   now() - interval '37 days', now() - interval '35 days'),
  ('SOL-2026-00002', (SELECT usuario_id FROM comerciantes WHERE usuario_id = (SELECT id FROM usuarios WHERE correo = 'jose.perez@hotmail.com')),
   (SELECT id FROM espacios_temporales WHERE nombre = 'Espacio móvil Calle 30 - B'), ST_SetSRID(ST_MakePoint(-76.1940, 4.0888), 4326),
   'Comidas rápidas', DATE '2026-11-10', DATE '2026-11-20', '10:00', '20:00', 'radicada',
   NULL, NULL, now() - interval '3 days', NULL),
  ('SOL-2026-00003', (SELECT usuario_id FROM comerciantes WHERE usuario_id = (SELECT id FROM usuarios WHERE correo = 'ana.ruiz@gmail.com')),
   (SELECT id FROM espacios_temporales WHERE nombre = 'Kiosco Parque La Guadua'), ST_SetSRID(ST_MakePoint(-76.1875, 4.0910), 4326),
   'Artesanías', DATE '2026-12-01', DATE '2026-12-15', '08:00', '18:00', 'rechazada',
   (SELECT id FROM usuarios WHERE correo = 'revisor@tulua.gov.co'),
   'La documentación adjunta está incompleta: falta el RUT actualizado.',
   now() - interval '32 days', now() - interval '27 days'),
  ('SOL-2026-00004', (SELECT usuario_id FROM comerciantes WHERE usuario_id = (SELECT id FROM usuarios WHERE correo = 'maria.gomez@gmail.com')),
   (SELECT id FROM espacios_temporales WHERE nombre = 'Kiosco Parque La Guadua'), ST_SetSRID(ST_MakePoint(-76.1875, 4.0910), 4326),
   'Venta de frutas frescas', DATE '2027-01-05', DATE '2027-01-31', '06:00', '12:00', 'borrador',
   NULL, NULL, NULL, NULL);

INSERT INTO solicitud_productos (solicitud_id, producto_id)
SELECT s.id, p.id
  FROM solicitudes s
  JOIN productos p ON (
       (s.numero_radicado = 'SOL-2026-00001' AND p.nombre IN ('Frutas frescas','Verduras'))
    OR (s.numero_radicado = 'SOL-2026-00002' AND p.nombre = 'Comidas rápidas')
    OR (s.numero_radicado = 'SOL-2026-00003' AND p.nombre = 'Artesanías')
    OR (s.numero_radicado = 'SOL-2026-00004' AND p.nombre = 'Frutas frescas')
  );

\echo '=== 11/12 · Documentos adjuntos con corrección versionada (HU-17, HU-19) ==='
INSERT INTO solicitud_documentos (solicitud_id, tipo_documento, archivo_url, estado, observacion) VALUES
  ((SELECT id FROM solicitudes WHERE numero_radicado = 'SOL-2026-00001'), 'Cámara de comercio 2026', 'docs/sol-00001/camara.pdf', 'validado', NULL),
  ((SELECT id FROM solicitudes WHERE numero_radicado = 'SOL-2026-00001'), 'RUT',                    'docs/sol-00001/rut.pdf',    'validado', NULL),
  ((SELECT id FROM solicitudes WHERE numero_radicado = 'SOL-2026-00002'), 'RUT',                    'docs/sol-00002/rut.pdf',    'pendiente', NULL),
  ((SELECT id FROM solicitudes WHERE numero_radicado = 'SOL-2026-00003'), 'Cámara de comercio 2026', 'docs/sol-00003/camara-1.pdf', 'observado',
   'Documento ilegible. Adjunte nuevamente una copia legible.');

-- Versión corregida que reemplaza al documento observado (HU-17)
INSERT INTO solicitud_documentos (solicitud_id, tipo_documento, archivo_url, estado, observacion, reemplaza_a)
VALUES ((SELECT id FROM solicitudes WHERE numero_radicado = 'SOL-2026-00003'), 'Cámara de comercio 2026', 'docs/sol-00003/camara-2.pdf', 'validado', NULL,
        (SELECT d.id FROM solicitud_documentos d
          WHERE d.solicitud_id = (SELECT id FROM solicitudes WHERE numero_radicado = 'SOL-2026-00003')
            AND d.estado = 'observado'));

\echo '=== 12/12 · Ferias, evaluaciones, permisos, cobros y más ==='

-- Ferias (HU-21 a HU-23)
INSERT INTO ferias (numero_radicado, organizador_id, nombre, tipo_feria, zona_id, fecha_inicio, fecha_fin, numero_puestos, estado, revisor_id, radicada_en) VALUES
  ('FER-2026-00001', (SELECT usuario_id FROM organizadores WHERE usuario_id = (SELECT id FROM usuarios WHERE correo = 'luis.alvarez@agrovalle.org')),
   'Feria Agroecológica de Diciembre', 'Feria agroecológica', (SELECT id FROM zonas WHERE nombre = 'Parque La Guadua'),
   DATE '2026-12-10', DATE '2026-12-12', 20, 'aprobada', (SELECT id FROM usuarios WHERE correo = 'revisor@tulua.gov.co'), now() - interval '15 days'),
  ('FER-2026-00002', (SELECT usuario_id FROM organizadores WHERE usuario_id = (SELECT id FROM usuarios WHERE correo = 'luis.alvarez@agrovalle.org')),
   'Feria Campesina de Enero', 'Feria campesina', (SELECT id FROM zonas WHERE nombre = 'Centro - Calle 30'),
   DATE '2027-01-15', DATE '2027-01-17', 15, 'radicada', NULL, now() - interval '2 days');

INSERT INTO feria_productos (feria_id, producto_id)
SELECT f.id, p.id FROM ferias f JOIN productos p ON
     (f.numero_radicado = 'FER-2026-00001' AND p.nombre IN ('Frutas frescas','Plantas ornamentales','Artesanías'));

INSERT INTO feria_vendedores (feria_id, nombre_vendedor, documento, producto_principal) VALUES
  ((SELECT id FROM ferias WHERE numero_radicado = 'FER-2026-00001'), 'Doralice Lozano', 'CC 43789123',  'Frutas frescas'),
  ((SELECT id FROM ferias WHERE numero_radicado = 'FER-2026-00001'), 'Hernán Salazar',  'CC 52109486',  'Plantas ornamentales'),
  ((SELECT id FROM ferias WHERE numero_radicado = 'FER-2026-00001'), 'Ofelia Cano',     NULL,           'Artesanías');

-- Evaluaciones de factibilidad (HU-25 a HU-27)
INSERT INTO evaluaciones_factibilidad (solicitud_id, comerciante_id, es_simulacion, ubicacion, producto_id, resultado, evaluado_en) VALUES
  ((SELECT id FROM solicitudes WHERE numero_radicado = 'SOL-2026-00001'), NULL, FALSE,
   ST_SetSRID(ST_MakePoint(-76.1950, 4.0890), 4326), (SELECT id FROM productos WHERE nombre = 'Frutas frescas'), 'factible', now() - interval '36 days'),
  (NULL, (SELECT usuario_id FROM comerciantes WHERE usuario_id = (SELECT id FROM usuarios WHERE correo = 'jose.perez@hotmail.com')), TRUE,
   ST_SetSRID(ST_MakePoint(-76.1940, 4.0888), 4326), (SELECT id FROM productos WHERE nombre = 'Comidas rápidas'), 'no_factible', now() - interval '4 days');

INSERT INTO evaluacion_reglas (evaluacion_id, regla, cumple, detalle)
SELECT e.id, r.regla, r.cumple, r.detalle
  FROM evaluaciones_factibilidad e
  JOIN (VALUES
    ('SOL-2026-00001', 'distancia_minima'::regla_urbanistica,   TRUE,  'Puesto activo más cercano a 222 m; mínimo exigido: 5 m'),
    ('SOL-2026-00001', 'producto_permitido'::regla_urbanistica, TRUE,  'Producto permitido en la zona Centro - Calle 30'),
    ('SOL-2026-00001', 'aforo_cuadrante'::regla_urbanistica,    TRUE,  '2 puestos activos de 40 permitidos en Centro - Calle 30'),
    ('PRE-EVAL-002',   'distancia_minima'::regla_urbanistica,   TRUE,  'Puesto activo más cercano a 134 m; mínimo exigido: 5 m'),
    ('PRE-EVAL-002',   'producto_permitido'::regla_urbanistica, FALSE, 'Producto NO permitido en la zona Centro - Calle 30'),
    ('PRE-EVAL-002',   'aforo_cuadrante'::regla_urbanistica,    TRUE,  '2 puestos activos de 40 permitidos en Centro - Calle 30')
  ) AS r(ref, regla, cumple, detalle)
    ON (r.ref = 'SOL-2026-00001' AND e.solicitud_id IS NOT NULL)
    OR (r.ref = 'PRE-EVAL-002' AND e.solicitud_id IS NULL);

INSERT INTO excepciones_factibilidad (evaluacion_id, justificacion, autorizado_por)
VALUES ((SELECT id FROM evaluaciones_factibilidad WHERE solicitud_id IS NULL),
        'Autorización excepcional temporal otorgada dentro del programa municipal de formalización del comercio informal.',
        (SELECT id FROM usuarios WHERE correo = 'revisor@tulua.gov.co'));

-- Permiso digital con QR (HU-31) — el actor de sesión queda registrado en la trazabilidad
INSERT INTO permisos (solicitud_id, titular_id, espacio_id, ubicacion, categoria_autorizada, fecha_inicio, fecha_fin, estado, emitido_por) VALUES
  ((SELECT id FROM solicitudes WHERE numero_radicado = 'SOL-2026-00001'),
   (SELECT usuario_id FROM comerciantes WHERE usuario_id = (SELECT id FROM usuarios WHERE correo = 'maria.gomez@gmail.com')),
   (SELECT id FROM espacios_temporales WHERE nombre = 'Espacio móvil Calle 30 - A'),
   ST_SetSRID(ST_MakePoint(-76.1950, 4.0890), 4326),
   'Venta de frutas y verduras', DATE '2026-11-01', DATE '2026-11-30', 'vigente',
   (SELECT id FROM usuarios WHERE correo = 'revisor@tulua.gov.co'));

-- Ciclo de vida del permiso (HU-35): suspensión y reactivación con motivo obligatorio
DO $$
BEGIN
  PERFORM set_config('app.motivo', 'Reporte de inspección: horario excedido el 2026-11-15', true);
  UPDATE permisos SET estado = 'suspendido' WHERE numero = 'PER-2026-00001';
END $$;

DO $$
BEGIN
  PERFORM set_config('app.motivo', 'Levantado el reporte de inspección por la Secretaría de Gobierno', true);
  UPDATE permisos SET estado = 'vigente' WHERE numero = 'PER-2026-00001';
END $$;

-- Tarifas y cobro simulado (HU-36)
INSERT INTO tarifas (zona_id, tipo_actividad, valor, vigente_desde) VALUES
  ((SELECT id FROM zonas WHERE nombre = 'Centro - Calle 30'), 'Venta de frutas y verduras', 50000, DATE '2026-01-01'),
  (NULL, 'General', 30000, DATE '2026-01-01');

INSERT INTO cobros (permiso_id, tarifa_id, valor, estado) VALUES
  ((SELECT id FROM permisos WHERE numero = 'PER-2026-00001'),
   (SELECT id FROM tarifas WHERE tipo_actividad = 'Venta de frutas y verduras' AND zona_id IS NOT NULL),
   50000, 'pendiente');

-- Pago SIMULADO del cobro (sin transacción real)
UPDATE cobros
   SET estado = 'pagado', pagado_en = now(), recibo_url = 'recibos/REC-2026-00001.pdf'
 WHERE permiso_id = (SELECT id FROM permisos WHERE numero = 'PER-2026-00001');

-- Notificaciones (HU-18, HU-34)
INSERT INTO notificaciones (usuario_id, tipo, asunto, cuerpo, canal, leida) VALUES
  ((SELECT id FROM usuarios WHERE correo = 'maria.gomez@gmail.com'),  'cambio_solicitud', 'Su solicitud SOL-2026-00001 fue aprobada',
   'Su solicitud de uso temporal del espacio fue aprobada. El permiso PER-2026-00001 quedó emitido con su carné digital.', 'correo', TRUE),
  ((SELECT id FROM usuarios WHERE correo = 'maria.gomez@gmail.com'),  'permiso_emitido', 'Carné digital PER-2026-00001 disponible',
   'Descargue su carné con el código QR desde la sección «Mis permisos».', 'correo', FALSE),
  ((SELECT id FROM usuarios WHERE correo = 'jose.perez@hotmail.com'), 'cambio_solicitud', 'Su solicitud SOL-2026-00002 fue radicada',
   'Su solicitud quedó radicada y está pendiente de revisión documental.', 'correo', FALSE),
  ((SELECT id FROM usuarios WHERE correo = 'pedro.sanchez@gmail.com'), 'activacion', 'Active su cuenta',
   'Bienvenido a la plataforma. Active su cuenta con el enlace enviado antes de 24 horas.', 'correo', FALSE);

-- Verificaciones públicas de QR (HU-33)
INSERT INTO verificaciones_qr (qr_token, resultado, ip) VALUES
  ((SELECT qr_token FROM permisos WHERE numero = 'PER-2026-00001'), 'valido',        '186.84.10.1'),
  (encode(sha256('qr-inexistente'::bytea), 'hex'),                  'no_encontrado', '190.60.10.2');

-- Alerta de saturación (HU-29)
INSERT INTO alertas_saturacion (zona_id, ocupacion_pct, umbral_pct)
VALUES ((SELECT id FROM zonas WHERE nombre = 'Plaza Boyacá'), 86.67, 80);

\echo '=== PRUEBAS DE REGLAS DE NEGOCIO (se espera un OK por cada una) ==='

-- Prueba 1 · HU-11/12: la BD debe rechazar una zona solapada
DO $$
BEGIN
  BEGIN
    INSERT INTO zonas (nombre, tipo, geometria, aforo_maximo, activa, creado_por)
    VALUES ('Zona solapada de prueba', 'permitida',
            ST_GeomFromText('POLYGON((-76.1950 4.0895, -76.1910 4.0895, -76.1910 4.0910, -76.1950 4.0910, -76.1950 4.0895))', 4326),
            10, TRUE, (SELECT id FROM usuarios WHERE correo = 'admin@tulua.gov.co'));
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'OK (HU-11/12): la BD rechazó insertar una zona solapada';
    RETURN;
  END;
  RAISE EXCEPTION 'FALLO: el validador de solapes de zonas no funcionó';
END $$;

-- Prueba 2 · HU-20: la BD debe rechazar asignar el mismo espacio en fechas solapadas
DO $$
BEGIN
  BEGIN
    INSERT INTO permisos (solicitud_id, titular_id, espacio_id, ubicacion, categoria_autorizada, fecha_inicio, fecha_fin, estado, emitido_por)
    VALUES ((SELECT id FROM solicitudes WHERE numero_radicado = 'SOL-2026-00002'),
            (SELECT usuario_id FROM comerciantes WHERE usuario_id = (SELECT id FROM usuarios WHERE correo = 'jose.perez@hotmail.com')),
            (SELECT id FROM espacios_temporales WHERE nombre = 'Espacio móvil Calle 30 - A'),
            ST_SetSRID(ST_MakePoint(-76.1950, 4.0890), 4326),
            'Comidas rápidas', DATE '2026-11-05', DATE '2026-11-10', 'vigente',
            (SELECT id FROM usuarios WHERE correo = 'revisor@tulua.gov.co'));
  EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE 'OK (HU-20): la BD rechazó asignar el mismo espacio en fechas solapadas';
    RETURN;
  END;
  RAISE EXCEPTION 'FALLO: la restricción de doble asignación de espacios no funcionó';
END $$;

-- Prueba 3 · HU-35: la BD debe exigir motivo para suspender/revocar un permiso
DO $$
BEGIN
  BEGIN
    UPDATE permisos SET estado = 'revocado' WHERE numero = 'PER-2026-00001';
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'OK (HU-35): la BD rechazó revocar un permiso sin motivo justificado';
    RETURN;
  END;
  RAISE EXCEPTION 'FALLO: la regla de motivo obligatorio en permisos no funcionó';
END $$;

-- Prueba 4 · HU-01: la BD debe rechazar un correo duplicado
DO $$
BEGIN
  BEGIN
    INSERT INTO usuarios (rol, nombre, apellido, tipo_documento, documento, telefono, correo, password_hash, estado)
    VALUES ('comerciante', 'María', 'Gómez Duplicada', 'CC', '9999999999', '3000000000',
            'maria.gomez@gmail.com', '$argon2id$v=19$m=19456,p=1,t=2$kf3b2FkpKsGTxJgYS84tUQ$Ht3hrSXH5cZwc5BJX8gE47ImO9+dn4pjSHv6bKZR/SU', 'activa');
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'OK (HU-01): la BD rechazó un correo duplicado';
    RETURN;
  END;
  RAISE EXCEPTION 'FALLO: la unicidad de correo no funcionó';
END $$;

\echo '=== Refresco de vistas materializadas del dashboard ==='
REFRESH MATERIALIZED VIEW mv_ocupacion_zona;
REFRESH MATERIALIZED VIEW mv_recaudacion;
REFRESH MATERIALIZED VIEW mv_saturacion;
REFRESH MATERIALIZED VIEW mv_tiempos_atencion;

\echo '=== RESUMEN DE DATOS CARGADOS ==='
DO $$
DECLARE
  v_usuarios  bigint;
  v_tablas    bigint;
  v_zonas     bigint;
  v_permisos  bigint;
BEGIN
  SELECT COUNT(*) INTO v_usuarios  FROM usuarios;
  SELECT COUNT(*) INTO v_tablas    FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  SELECT COUNT(*) INTO v_zonas     FROM zonas;
  SELECT COUNT(*) INTO v_permisos  FROM permisos;
  RAISE NOTICE 'Seed completado: % usuarios, % zonas, % permisos y % tablas en el esquema public',
               v_usuarios, v_zonas, v_permisos, v_tablas;
END $$;
