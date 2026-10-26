-- ============================================================================
--  PLATAFORMA WEB DE GESTIÓN DEL ESPACIO PÚBLICO DE TULUÁ — EQUIPO 6
--  Script 01 · CREACIÓN DE LA ESTRUCTURA DE LA BASE DE DATOS (DDL)
--  Motor : PostgreSQL 18 + PostGIS 3.6
--  Uso  : psql -U postgres -d "sgp_tulua" -f 01_creacion_bd.sql
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

\echo '=== 1/8 · EXTENSIONES ==='
CREATE EXTENSION IF NOT EXISTS postgis;      -- geometría geoespacial (zonas, módulos, espacios)
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- restricciones de exclusión con rangos de fechas
CREATE EXTENSION IF NOT EXISTS citext;       -- correos únicos sin distinción de mayúsculas
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- bcrypt (crypt) y tokens aleatorios (gen_random_bytes)

\echo '=== 2/8 · TIPOS ENUMERADOS ==='
CREATE TYPE rol_usuario          AS ENUM ('comerciante','organizador','gestor');
CREATE TYPE estado_usuario       AS ENUM ('pendiente_activacion','activa','suspendida','inactiva');
CREATE TYPE perfil_gestor        AS ENUM ('revisor','administrador');
CREATE TYPE estado_organizacion  AS ENUM ('pendiente_validacion','activa','suspendida');
CREATE TYPE categoria_comercio   AS ENUM ('formal','informal');
CREATE TYPE tipo_zona            AS ENUM ('permitida','restringida','alta_congestion');
CREATE TYPE estado_modulo        AS ENUM ('activo','baja');
CREATE TYPE estado_espacio       AS ENUM ('disponible','bloqueado','asignado','mantenimiento');
CREATE TYPE estado_solicitud     AS ENUM ('borrador','radicada','en_revision','devuelta','aprobada','rechazada','cancelada');
CREATE TYPE estado_documento     AS ENUM ('pendiente','validado','observado');
CREATE TYPE estado_feria         AS ENUM ('radicada','aprobada','rechazada','cancelada','realizada');
CREATE TYPE regla_urbanistica    AS ENUM ('distancia_minima','producto_permitido','aforo_cuadrante');
CREATE TYPE resultado_factibilidad AS ENUM ('factible','no_factible');
CREATE TYPE estado_permiso       AS ENUM ('vigente','suspendido','revocado','vencido');
CREATE TYPE estado_cobro         AS ENUM ('pendiente','pagado','anulado');
CREATE TYPE tipo_token           AS ENUM ('activacion','recuperacion_password','invitacion_gestor');

\echo '=== 3/8 · SECUENCIAS (numeración de radicados y permisos) ==='
CREATE SEQUENCE seq_radicado_solicitud START 1;   -- SOL-2026-00001, SOL-2026-00002, ...
CREATE SEQUENCE seq_radicado_feria     START 1;   -- FER-2026-00001, FER-2026-00002, ...
CREATE SEQUENCE seq_permiso            START 1;   -- PER-2026-00001, PER-2026-00002, ...

\echo '=== 4/8 · TABLAS · Módulo 1: Seguridad y usuarios (HU-01 a HU-07) ==='

CREATE TABLE usuarios (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rol               rol_usuario NOT NULL,
  nombre            VARCHAR(150) NOT NULL,
  apellido          VARCHAR(150),
  tipo_documento    VARCHAR(30),
  documento         VARCHAR(30),
  telefono          VARCHAR(30),
  correo            CITEXT NOT NULL UNIQUE,
  password_hash     VARCHAR(255),
  estado            estado_usuario NOT NULL DEFAULT 'pendiente_activacion',
  intentos_fallidos SMALLINT NOT NULL DEFAULT 0,
  bloqueado_hasta   TIMESTAMPTZ,
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (documento),
  -- Campos obligatorios SOLO para el rol comerciante (HU-01):
  CHECK (rol <> 'comerciante' OR (documento IS NOT NULL AND telefono IS NOT NULL AND password_hash IS NOT NULL)),
  -- Ninguna cuenta activa puede existir sin contraseña:
  CHECK (estado <> 'activa' OR password_hash IS NOT NULL)
);

CREATE TABLE comerciantes (
  usuario_id          BIGINT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  actividad_comercial VARCHAR(200) NOT NULL,
  categoria           categoria_comercio NOT NULL,
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organizadores (
  usuario_id          BIGINT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre_organizacion VARCHAR(200) NOT NULL,
  nit                 VARCHAR(20) NOT NULL UNIQUE,
  representante       VARCHAR(150) NOT NULL,
  tipo_feria          VARCHAR(100) NOT NULL,
  contacto            VARCHAR(150),
  estado              estado_organizacion NOT NULL DEFAULT 'pendiente_validacion',
  validado_por        BIGINT REFERENCES usuarios(id),
  validado_en         TIMESTAMPTZ
);

CREATE TABLE gestores (
  usuario_id BIGINT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  perfil     perfil_gestor NOT NULL DEFAULT 'revisor',
  creado_por BIGINT REFERENCES usuarios(id)
);

CREATE TABLE tokens_seguridad (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo       tipo_token NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,   -- se almacena el hash, nunca el token plano
  expira_en  TIMESTAMPTZ NOT NULL,
  usado      BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HU-02/HU-06: sesiones autenticadas y refresh tokens con rotación.
-- `revocada_en` permite un logout persistente aunque el access token siga vigente.
CREATE TABLE sesiones (
  id                          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  usuario_id                  BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  refresh_token_hash          VARCHAR(255) NOT NULL UNIQUE,
  refresh_token_anterior_hash VARCHAR(255),
  refresh_expira_en           TIMESTAMPTZ NOT NULL,
  revocada_en                 TIMESTAMPTZ,
  creada_en                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en              TIMESTAMPTZ NOT NULL DEFAULT now()
);

\echo '=== 4/8 · TABLAS · Módulo 2: Espacio público GIS (HU-08 a HU-15) ==='

CREATE TABLE productos (
  id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE zonas (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre         VARCHAR(150) NOT NULL,
  tipo           tipo_zona NOT NULL,
  geometria      geometry(Polygon,4326) NOT NULL,
  horario_inicio TIME,
  horario_fin    TIME,
  aforo_maximo   INT,
  activa         BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por     BIGINT REFERENCES usuarios(id),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ST_IsValid(geometria)),                          -- HU-11: rechaza autointersecciones
  CHECK (aforo_maximo IS NULL OR aforo_maximo > 0)
);

CREATE TABLE zona_productos (
  zona_id     BIGINT NOT NULL REFERENCES zonas(id) ON DELETE CASCADE,
  producto_id BIGINT NOT NULL REFERENCES productos(id),
  PRIMARY KEY (zona_id, producto_id)
);

CREATE TABLE modulos (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo          VARCHAR(30) NOT NULL UNIQUE,
  ubicacion       geometry(Point,4326) NOT NULL,
  categoria       categoria_comercio NOT NULL,
  titular_id      BIGINT REFERENCES comerciantes(usuario_id),
  titular_nombre  VARCHAR(150),
  actividad       VARCHAR(200) NOT NULL,
  foto_url        TEXT,
  estado          estado_modulo NOT NULL DEFAULT 'activo',
  registrado_por  BIGINT NOT NULL REFERENCES usuarios(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- El censo siempre debe identificar al titular (con cuenta o por nombre):
  CHECK (titular_id IS NOT NULL OR titular_nombre IS NOT NULL)
);

CREATE TABLE espacios_temporales (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre              VARCHAR(150) NOT NULL,
  zona_id             BIGINT REFERENCES zonas(id),
  ubicacion           geometry(Point,4326) NOT NULL,
  actividad_permitida VARCHAR(100),
  estado              estado_espacio NOT NULL DEFAULT 'disponible',
  creado_por          BIGINT REFERENCES usuarios(id),
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE espacio_bloqueos (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  espacio_id   BIGINT NOT NULL REFERENCES espacios_temporales(id) ON DELETE CASCADE,
  fecha_inicio DATE NOT NULL,
  fecha_fin    DATE NOT NULL,
  motivo       VARCHAR(300),
  creado_por   BIGINT NOT NULL REFERENCES usuarios(id),
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio),
  -- HU-15: dos bloqueos del mismo espacio no pueden solaparse en fechas:
  EXCLUDE USING gist (espacio_id WITH =, daterange(fecha_inicio, fecha_fin, '[]') WITH &&)
);

CREATE TABLE parametros_motor (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clave         VARCHAR(60) NOT NULL,   -- 'distancia_minima', 'aforo_cuadrante_defecto', 'umbral_alerta'
  zona_id       BIGINT REFERENCES zonas(id),   -- NULL = parámetro global
  valor         NUMERIC(10,2) NOT NULL,
  unidad        VARCHAR(20),
  vigente_desde TIMESTAMPTZ NOT NULL DEFAULT now(),
  creado_por    BIGINT NOT NULL REFERENCES usuarios(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (valor >= 0)                    -- HU-26: rechaza valores negativos
);

\echo '=== 4/8 · TABLAS · Módulo 3: Trámites (HU-16 a HU-23) ==='

CREATE TABLE solicitudes (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero_radicado      VARCHAR(30) NOT NULL UNIQUE
                       DEFAULT 'SOL-2026-' || lpad(nextval('seq_radicado_solicitud')::text, 5, '0'),
  comerciante_id       BIGINT NOT NULL REFERENCES comerciantes(usuario_id),
  espacio_id           BIGINT REFERENCES espacios_temporales(id),
  ubicacion_solicitada geometry(Point,4326),
  actividad            VARCHAR(200) NOT NULL,
  fecha_inicio         DATE NOT NULL,
  fecha_fin            DATE NOT NULL,
  hora_inicio          TIME NOT NULL,
  hora_fin             TIME NOT NULL,
  estado               estado_solicitud NOT NULL DEFAULT 'borrador',
  revisor_id           BIGINT REFERENCES gestores(usuario_id),
  motivo_rechazo       TEXT,
  radicada_en          TIMESTAMPTZ,
  decidida_en          TIMESTAMPTZ,
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio),
  CHECK (hora_fin > hora_inicio)
);

CREATE TABLE solicitud_productos (
  solicitud_id BIGINT NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  producto_id  BIGINT NOT NULL REFERENCES productos(id),
  PRIMARY KEY (solicitud_id, producto_id)
);

CREATE TABLE solicitud_documentos (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitud_id   BIGINT NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  tipo_documento VARCHAR(100) NOT NULL,
  archivo_url    TEXT NOT NULL,
  estado         estado_documento NOT NULL DEFAULT 'pendiente',
  observacion    TEXT,
  reemplaza_a    BIGINT REFERENCES solicitud_documentos(id),  -- HU-17: versión corregida
  cargado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ferias (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero_radicado VARCHAR(30) NOT NULL UNIQUE
                  DEFAULT 'FER-2026-' || lpad(nextval('seq_radicado_feria')::text, 5, '0'),
  organizador_id  BIGINT NOT NULL REFERENCES organizadores(usuario_id),
  nombre          VARCHAR(200) NOT NULL,
  tipo_feria      VARCHAR(100) NOT NULL,
  zona_id         BIGINT NOT NULL REFERENCES zonas(id),
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE NOT NULL,
  numero_puestos  INT NOT NULL CHECK (numero_puestos > 0),
  estado          estado_feria NOT NULL DEFAULT 'radicada',
  revisor_id      BIGINT REFERENCES gestores(usuario_id),
  radicada_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio),
  -- HU-22: el calendario evita cruces de fecha y zona de ferias activas:
  EXCLUDE USING gist (zona_id WITH =, daterange(fecha_inicio, fecha_fin, '[]') WITH &&)
                      WHERE (estado IN ('radicada','aprobada'))
);

CREATE TABLE feria_productos (
  feria_id    BIGINT NOT NULL REFERENCES ferias(id) ON DELETE CASCADE,
  producto_id BIGINT NOT NULL REFERENCES productos(id),
  PRIMARY KEY (feria_id, producto_id)
);

CREATE TABLE feria_vendedores (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feria_id           BIGINT NOT NULL REFERENCES ferias(id) ON DELETE CASCADE,
  nombre_vendedor    VARCHAR(150) NOT NULL,
  documento          VARCHAR(30),
  producto_principal VARCHAR(150),
  UNIQUE (feria_id, documento)
);

\echo '=== 4/8 · TABLAS · Módulo 4: Motor de factibilidad (HU-24 a HU-30) ==='

CREATE TABLE evaluaciones_factibilidad (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitud_id  BIGINT REFERENCES solicitudes(id),          -- NULL = pre-evaluación (HU-27) o simulación (HU-28)
  comerciante_id BIGINT REFERENCES comerciantes(usuario_id),
  es_simulacion BOOLEAN NOT NULL DEFAULT FALSE,
  ubicacion     geometry(Point,4326) NOT NULL,
  producto_id   BIGINT REFERENCES productos(id),
  resultado     resultado_factibilidad NOT NULL,
  evaluado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE evaluacion_reglas (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  evaluacion_id BIGINT NOT NULL REFERENCES evaluaciones_factibilidad(id) ON DELETE CASCADE,
  regla         regla_urbanistica NOT NULL,
  cumple        BOOLEAN NOT NULL,
  detalle       VARCHAR(300)                -- HU-25: resultado y motivo por cada regla
);

CREATE TABLE excepciones_factibilidad (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  evaluacion_id BIGINT NOT NULL REFERENCES evaluaciones_factibilidad(id),
  justificacion TEXT NOT NULL,             -- HU-25: obligatoria para aprobar un «no factible»
  autorizado_por BIGINT NOT NULL REFERENCES gestores(usuario_id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

\echo '=== 4/8 · TABLAS · Módulo 5: Permisos y QR (HU-31 a HU-37) ==='

CREATE TABLE permisos (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero              VARCHAR(30) NOT NULL UNIQUE
                      DEFAULT 'PER-2026-' || lpad(nextval('seq_permiso')::text, 5, '0'),
  solicitud_id         BIGINT NOT NULL UNIQUE REFERENCES solicitudes(id),
  titular_id           BIGINT NOT NULL REFERENCES comerciantes(usuario_id),
  espacio_id           BIGINT REFERENCES espacios_temporales(id),
  ubicacion            geometry(Point,4326),
  categoria_autorizada VARCHAR(200) NOT NULL,
  fecha_inicio         DATE NOT NULL,
  fecha_fin            DATE NOT NULL,
  estado               estado_permiso NOT NULL DEFAULT 'vigente',
  qr_token             VARCHAR(64) NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  emitido_por          BIGINT NOT NULL REFERENCES gestores(usuario_id),
  emitido_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
  renovado_desde       BIGINT REFERENCES permisos(id),   -- HU-34: renovación enlazada
  CHECK (fecha_fin >= fecha_inicio),
  -- HU-20: un mismo espacio no puede asignarse dos veces en fechas solapadas:
  EXCLUDE USING gist (espacio_id WITH =, daterange(fecha_inicio, fecha_fin, '[]') WITH &&)
                      WHERE (estado = 'vigente')
);

CREATE TABLE permiso_eventos (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  permiso_id BIGINT NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
  evento     VARCHAR(30) NOT NULL,   -- emitido | vigente | suspendido | revocado | vencido
  motivo     TEXT,                   -- obligatorio en suspensión/revocación (HU-35)
  actor_id   BIGINT REFERENCES usuarios(id),
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE verificaciones_qr (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  qr_token   VARCHAR(64) NOT NULL,   -- HU-33: sin documentos ni datos personales sensibles
  resultado  VARCHAR(20) NOT NULL,  -- valido | no_vigente | no_encontrado
  ip         INET,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

\echo '=== 4/8 · TABLAS · Módulo 6: Cobros simulados (HU-36) ==='

CREATE TABLE tarifas (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  zona_id        BIGINT REFERENCES zonas(id),   -- NULL = tarifa general
  tipo_actividad VARCHAR(100) NOT NULL,
  valor          NUMERIC(12,2) NOT NULL CHECK (valor >= 0),
  vigente_desde  DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE cobros (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  permiso_id BIGINT NOT NULL UNIQUE REFERENCES permisos(id),
  tarifa_id  BIGINT REFERENCES tarifas(id),
  valor      NUMERIC(12,2) NOT NULL,
  estado     estado_cobro NOT NULL DEFAULT 'pendiente',
  pagado_en  TIMESTAMPTZ,
  recibo_url TEXT,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

\echo '=== 4/8 · TABLAS · Módulo 7: Transversales ==='

CREATE TABLE notificaciones (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo       VARCHAR(60) NOT NULL,   -- activacion | cambio_solicitud | permiso_emitido | aviso_vencimiento
  asunto     VARCHAR(200) NOT NULL,
  cuerpo     TEXT,
  canal      VARCHAR(10) NOT NULL DEFAULT 'correo',
  leida      BOOLEAN NOT NULL DEFAULT FALSE,
  creada_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE alertas_saturacion (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  zona_id       BIGINT NOT NULL REFERENCES zonas(id),
  ocupacion_pct NUMERIC(5,2) NOT NULL,
  umbral_pct    NUMERIC(5,2) NOT NULL,
  generada_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE auditoria (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tabla          VARCHAR(60) NOT NULL,
  registro_id    BIGINT NOT NULL,
  accion         VARCHAR(20) NOT NULL,   -- insert | update | delete
  valor_anterior JSONB,
  valor_nuevo    JSONB,
  actor_id       BIGINT REFERENCES usuarios(id),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

\echo '=== 5/8 · ÍNDICES ==='
CREATE INDEX idx_usuarios_rol          ON usuarios (rol);
CREATE INDEX idx_usuarios_estado       ON usuarios (estado);
CREATE INDEX idx_tokens_usuario        ON tokens_seguridad (usuario_id, tipo);
CREATE INDEX idx_sesiones_usuario      ON sesiones (usuario_id, revocada_en);
CREATE INDEX idx_sesiones_anterior     ON sesiones (refresh_token_anterior_hash);
CREATE INDEX idx_modulos_estado        ON modulos (estado);
CREATE INDEX idx_modulos_titular      ON modulos (titular_id);
CREATE INDEX idx_espacios_zona         ON espacios_temporales (zona_id);
CREATE INDEX idx_parametros_clave      ON parametros_motor (clave, vigente_desde DESC);
CREATE INDEX idx_solicitudes_comerciante ON solicitudes (comerciante_id);
CREATE INDEX idx_solicitudes_estado    ON solicitudes (estado);
CREATE INDEX idx_solicitudes_fechas    ON solicitudes (espacio_id, fecha_inicio);
CREATE INDEX idx_documentos_solicitud  ON solicitud_documentos (solicitud_id);
CREATE INDEX idx_ferias_zona           ON ferias (zona_id);
CREATE INDEX idx_evaluaciones_solicitud ON evaluaciones_factibilidad (solicitud_id);
CREATE INDEX idx_permisos_titular      ON permisos (titular_id);
CREATE INDEX idx_permisos_estado       ON permisos (estado);
CREATE INDEX idx_eventos_permiso       ON permiso_eventos (permiso_id, creado_en);
CREATE INDEX idx_verificaciones_fecha  ON verificaciones_qr (creado_en);
CREATE INDEX idx_cobros_estado         ON cobros (estado);
CREATE INDEX idx_notificaciones_usuario ON notificaciones (usuario_id, leida);
CREATE INDEX idx_auditoria_registro    ON auditoria (tabla, registro_id);
CREATE INDEX idx_auditoria_fecha       ON auditoria (creado_en);
-- Índices GIST espaciales (rendimiento del mapa, HU-08):
CREATE INDEX idx_zonas_geom       ON zonas USING GIST (geometria);
CREATE INDEX idx_modulos_geom     ON modulos USING GIST (ubicacion);
CREATE INDEX idx_espacios_geom    ON espacios_temporales USING GIST (ubicacion);
CREATE INDEX idx_evaluaciones_geom ON evaluaciones_factibilidad USING GIST (ubicacion);

\echo '=== 6/8 · FUNCIONES ==='

-- Marca de tiempo de actualización (updated_at)
CREATE OR REPLACE FUNCTION fn_marca_actualizacion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END $$;

-- Auditoría genérica: registra quién, qué y cuándo (HU-05, HU-12, HU-26)
-- El actor se toma de la variable de sesión «app.actor_id» (set_config / SET).
CREATE OR REPLACE FUNCTION fn_auditoria() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_registro bigint;
  v_actor    bigint;
BEGIN
  v_registro := (to_jsonb(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END) ->> 'id')::bigint;
  BEGIN
    v_actor := NULLIF(current_setting('app.actor_id', true), '')::bigint;
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;
  INSERT INTO auditoria (tabla, registro_id, accion, valor_anterior, valor_nuevo, actor_id)
  VALUES (TG_TABLE_NAME, v_registro, lower(TG_OP),
          CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
          CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END,
          v_actor);
  RETURN NULL;   -- trigger AFTER: el retorno se ignora
END $$;

-- Validación topológica de zonas (HU-11/12): geometría válida y sin solapes
CREATE OR REPLACE FUNCTION fn_validar_zona() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_conflicto text;
BEGIN
  IF NOT ST_IsValid(NEW.geometria) THEN
    RAISE EXCEPTION 'Geometría inválida para la zona «%»: el polígono se autointersecta', NEW.nombre;
  END IF;
  SELECT z.nombre INTO v_conflicto
    FROM zonas z
   WHERE z.id <> NEW.id AND z.activa
     AND ST_Relate(NEW.geometria, z.geometria, '2********')
   LIMIT 1;
  IF v_conflicto IS NOT NULL THEN
    RAISE EXCEPTION 'La zona «%» se solapa con la zona activa «%»: las geometrías no pueden superponerse', NEW.nombre, v_conflicto;
  END IF;
  RETURN NEW;
END $$;

-- Trazabilidad del permiso (HU-35/37): emite eventos y exige motivo al suspender/revocar.
-- El motivo se pasa en la variable de sesión «app.motivo» (set_config / SET).
CREATE OR REPLACE FUNCTION fn_permiso_trazabilidad() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_actor  bigint;
  v_motivo text;
BEGIN
  BEGIN
    v_motivo := NULLIF(current_setting('app.motivo', true), '');
    v_actor  := NULLIF(current_setting('app.actor_id', true), '')::bigint;
  EXCEPTION WHEN OTHERS THEN
    v_motivo := NULL; v_actor := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO permiso_eventos (permiso_id, evento, motivo, actor_id)
    VALUES (NEW.id, 'emitido', v_motivo, v_actor);
  ELSIF TG_OP = 'UPDATE' AND OLD.estado <> NEW.estado THEN
    IF NEW.estado IN ('suspendido','revocado') AND v_motivo IS NULL THEN
      RAISE EXCEPTION 'Suspender o revocar el permiso % exige un motivo (ejecutar SET app.motivo = ''...'')', NEW.numero;
    END IF;
    INSERT INTO permiso_eventos (permiso_id, evento, motivo, actor_id)
    VALUES (NEW.id, NEW.estado::text, v_motivo, v_actor);
  END IF;
  RETURN NULL;
END $$;

-- Motor de reglas (HU-25/27): evalúa las 3 reglas urbanísticas en un punto.
-- Devuelve una fila por regla con cumplimiento y detalle del motivo.
CREATE OR REPLACE FUNCTION fn_evaluar_factibilidad(
  p_ubicacion  geometry(Point,4326),
  p_producto_id BIGINT
) RETURNS TABLE (regla regla_urbanistica, cumple boolean, detalle text)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_zona          zonas%ROWTYPE;
  v_dist_minima   double precision;
  v_aforo_defecto numeric;
  v_producto_ok   boolean;
  v_dist_cercana  double precision;
  v_activos       bigint;
BEGIN
  -- Parámetro global: distancia mínima entre puestos (metros)
  SELECT COALESCE((SELECT valor::float8
                     FROM parametros_motor
                    WHERE clave = 'distancia_minima' AND zona_id IS NULL
                    ORDER BY vigente_desde DESC LIMIT 1), 5)
    INTO v_dist_minima;

  -- Regla 1 · Distancia mínima frente a los puestos activos del censo
  SELECT MIN(ST_Distance(m.ubicacion::geography, p_ubicacion::geography))
    INTO v_dist_cercana
    FROM modulos m
   WHERE m.estado = 'activo';

  RETURN QUERY VALUES
    ('distancia_minima'::regla_urbanistica,
     v_dist_cercana IS NULL OR v_dist_cercana >= v_dist_minima,
     format('Puesto activo más cercano a %s m; mínimo exigido: %s m',
            COALESCE(round(v_dist_cercana::numeric, 1), 0), v_dist_minima));

  -- Zona activa que contiene el punto
  SELECT * INTO v_zona
    FROM zonas z
   WHERE z.activa AND ST_Contains(z.geometria, p_ubicacion)
   ORDER BY CASE z.tipo WHEN 'permitida' THEN 1 WHEN 'alta_congestion' THEN 2 ELSE 3 END
   LIMIT 1;

  IF v_zona.id IS NULL THEN
    RETURN QUERY VALUES
      ('producto_permitido'::regla_urbanistica, false,
       'La ubicación no pertenece a ninguna zona activa del municipio'),
      ('aforo_cuadrante'::regla_urbanistica, false,
       'Sin zona activa no hay aforo disponible');
    RETURN;
  END IF;

  -- Regla 2 · Producto permitido en la zona
  SELECT EXISTS (SELECT 1 FROM zona_productos zp
                   WHERE zp.zona_id = v_zona.id AND zp.producto_id = p_producto_id)
    INTO v_producto_ok;

  RETURN QUERY VALUES
    ('producto_permitido'::regla_urbanistica, v_producto_ok,
     CASE WHEN v_producto_ok
          THEN 'Producto permitido en la zona ' || v_zona.nombre
          ELSE 'Producto NO permitido en la zona ' || v_zona.nombre END);

  -- Regla 3 · Aforo del cuadrante/zona
  SELECT COUNT(*) INTO v_activos
    FROM modulos m
   WHERE m.estado = 'activo' AND ST_Contains(v_zona.geometria, m.ubicacion);

  SELECT COALESCE((SELECT valor
                     FROM parametros_motor
                    WHERE clave = 'aforo_cuadrante_defecto' AND zona_id IS NULL
                    ORDER BY vigente_desde DESC LIMIT 1), 40)
    INTO v_aforo_defecto;

  RETURN QUERY VALUES
    ('aforo_cuadrante'::regla_urbanistica,
     v_activos < COALESCE(v_zona.aforo_maximo, v_aforo_defecto),
     format('%s puestos activos de %s permitidos en %s',
            v_activos, COALESCE(v_zona.aforo_maximo, v_aforo_defecto), v_zona.nombre));
END $$;

-- Sugerencia de ubicaciones alternativas (HU-30): espacios disponibles en un radio
-- que cumplan todas las reglas del motor.
CREATE OR REPLACE FUNCTION fn_buscar_alternativas(
  p_ubicacion   geometry(Point,4326),
  p_producto_id BIGINT,
  p_radio_m     NUMERIC DEFAULT 500
) RETURNS TABLE (espacio_id bigint, espacio_nombre text, zona_nombre text, distancia_m numeric)
LANGUAGE sql STABLE AS $$
  SELECT e.id,
         e.nombre,
         z.nombre,
         round(ST_Distance(e.ubicacion::geography, p_ubicacion::geography)::numeric, 1)
    FROM espacios_temporales e
    LEFT JOIN zonas z ON z.id = e.zona_id
   WHERE e.estado = 'disponible'
     AND ST_DWithin(e.ubicacion::geography, p_ubicacion::geography, p_radio_m)
     AND NOT EXISTS (SELECT 1
                       FROM fn_evaluar_factibilidad(e.ubicacion, p_producto_id) f
                      WHERE NOT f.cumple)
   ORDER BY ST_Distance(e.ubicacion::geography, p_ubicacion::geography);
$$;

\echo '=== 7/8 · TRIGGERS ==='
CREATE TRIGGER trg_usuarios_marca     BEFORE UPDATE ON usuarios    FOR EACH ROW EXECUTE FUNCTION fn_marca_actualizacion();
CREATE TRIGGER trg_sesiones_marca     BEFORE UPDATE ON sesiones     FOR EACH ROW EXECUTE FUNCTION fn_marca_actualizacion();
CREATE TRIGGER trg_comerciantes_marca BEFORE UPDATE ON comerciantes FOR EACH ROW EXECUTE FUNCTION fn_marca_actualizacion();
CREATE TRIGGER trg_zonas_marca        BEFORE UPDATE ON zonas        FOR EACH ROW EXECUTE FUNCTION fn_marca_actualizacion();
CREATE TRIGGER trg_solicitudes_marca  BEFORE UPDATE ON solicitudes  FOR EACH ROW EXECUTE FUNCTION fn_marca_actualizacion();

CREATE TRIGGER trg_usuarios_auditoria    AFTER INSERT OR UPDATE OR DELETE ON usuarios         FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_zonas_auditoria       AFTER INSERT OR UPDATE OR DELETE ON zonas             FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_parametros_auditoria  AFTER INSERT OR UPDATE OR DELETE ON parametros_motor  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

CREATE TRIGGER trg_zonas_validar       BEFORE INSERT OR UPDATE ON zonas    FOR EACH ROW EXECUTE FUNCTION fn_validar_zona();
CREATE TRIGGER trg_permisos_traza      AFTER INSERT OR UPDATE  ON permisos FOR EACH ROW EXECUTE FUNCTION fn_permiso_trazabilidad();

\echo '=== 8/8 · VISTAS MATERIALIZADAS (Dashboard · HU-38 a HU-44) ==='

-- HU-38/39: ocupación por sector y distribución formal/informal
CREATE MATERIALIZED VIEW mv_ocupacion_zona AS
SELECT z.id AS zona_id, z.nombre, z.tipo,
       COUNT(m.id) FILTER (WHERE m.estado = 'activo') AS puestos_activos,
       COUNT(m.id) FILTER (WHERE m.categoria = 'formal' AND m.estado = 'activo') AS formales,
       COUNT(m.id) FILTER (WHERE m.categoria = 'informal' AND m.estado = 'activo') AS informales,
       z.aforo_maximo,
       ROUND(100.0 * COUNT(m.id) FILTER (WHERE m.estado = 'activo') / NULLIF(z.aforo_maximo, 0), 2) AS ocupacion_pct
  FROM zonas z
  LEFT JOIN modulos m ON ST_Contains(z.geometria, m.ubicacion)
 WHERE z.activa
 GROUP BY z.id, z.nombre, z.tipo, z.aforo_maximo;

-- HU-41: recaudación (simulada) por periodo, zona y actividad
CREATE MATERIALIZED VIEW mv_recaudacion AS
SELECT date_trunc('month', c.pagado_en) AS periodo,
       z.nombre AS zona,
       s.actividad,
       SUM(c.valor) AS total
  FROM cobros c
  JOIN permisos p   ON c.permiso_id = p.id
  JOIN solicitudes s ON p.solicitud_id = s.id
  LEFT JOIN espacios_temporales e ON p.espacio_id = e.id
  LEFT JOIN zonas z ON e.zona_id = z.id
 WHERE c.estado = 'pagado'
 GROUP BY 1, 2, 3;

-- HU-40: puntos de saturación para el mapa de calor
CREATE MATERIALIZED VIEW mv_saturacion AS
SELECT m.id AS modulo_id, m.ubicacion, z.tipo, z.nombre AS zona, 1 AS intensidad
  FROM modulos m
  JOIN zonas z ON ST_Contains(z.geometria, m.ubicacion)
 WHERE m.estado = 'activo' AND z.activa;

-- HU-44: solicitudes por estado y tiempos de atención
CREATE MATERIALIZED VIEW mv_tiempos_atencion AS
SELECT estado, COUNT(*) AS total,
       AVG(decidida_en - radicada_en) AS tiempo_promedio
  FROM solicitudes
 WHERE radicada_en IS NOT NULL
 GROUP BY estado;

-- Índices únicos (habilitan REFRESH ... CONCURRENTLY)
CREATE UNIQUE INDEX mv_ocupacion_zona_uidx    ON mv_ocupacion_zona (zona_id);
CREATE UNIQUE INDEX mv_recaudacion_uidx       ON mv_recaudacion (periodo, zona, actividad);
CREATE UNIQUE INDEX mv_saturacion_uidx        ON mv_saturacion (modulo_id);
CREATE UNIQUE INDEX mv_tiempos_atencion_uidx  ON mv_tiempos_atencion (estado);

\echo '=== COMENTARIOS DE DOCUMENTACIÓN ==='
COMMENT ON TABLE usuarios               IS 'Cuentas de acceso unificadas de todos los roles (HU-01 a HU-07). Los campos obligatorios por rol se garantizan con CHECK.';
COMMENT ON TABLE comerciantes           IS 'Perfil comercial 1:1 con usuarios. Actividad comercial y categoría formal/informal (HU-01, HU-04).';
COMMENT ON TABLE organizadores           IS 'Organizaciones de ferias agroecológicas con NIT y representante; el gestor valida la organización (HU-07).';
COMMENT ON TABLE gestores                IS 'Gestores municipales de espacio público con perfil Revisor o Administrador (HU-03, HU-06).';
COMMENT ON TABLE tokens_seguridad        IS 'Tokens de activación, recuperación de contraseña e invitación con vigencia limitada (HU-01, HU-02, HU-06).';
COMMENT ON TABLE sesiones                 IS 'Sesiones autenticadas: hash del refresh token, rotación y revocación persistente de logout (HU-02, HU-06).';
COMMENT ON TABLE productos               IS 'Catálogo maestro de productos comerciales usado por zonas, solicitudes y ferias.';
COMMENT ON TABLE zonas                    IS 'Polígonos normativos del espacio público de Tuluá: permitidas, restringidas y de alta congestión, con horario, productos y aforo (HU-08, HU-11, HU-12).';
COMMENT ON TABLE zona_productos           IS 'Productos permitidos por zona (regla 2 del motor de factibilidad).';
COMMENT ON TABLE modulos                 IS 'Censo de módulos y puestos de comercio formal/informal con punto geográfico, titular, actividad y foto (HU-13).';
COMMENT ON TABLE espacios_temporales     IS 'Catálogo de espacios temporales disponibles para asignación (HU-09, HU-15).';
COMMENT ON TABLE espacio_bloqueos        IS 'Bloqueos de espacios por rangos de fechas sin solapamientos (HU-15).';
COMMENT ON TABLE parametros_motor       IS 'Parámetros versionados del motor de reglas: distancia mínima, aforo por defecto y umbral de alerta (HU-26, HU-29).';
COMMENT ON TABLE solicitudes             IS 'Solicitudes de uso temporal del espacio público con número de radicado, estados y trazabilidad del trámite (HU-16 a HU-20).';
COMMENT ON TABLE solicitud_productos     IS 'Productos solicitados en la solicitud (validación contra zona_productos).';
COMMENT ON TABLE solicitud_documentos    IS 'Documentos digitales adjuntos con estados de verificación y versionado de correcciones (HU-17, HU-19).';
COMMENT ON TABLE ferias                   IS 'Solicitudes de ferias y eventos agroecológicos por zona sin cruces de fechas (HU-21, HU-22).';
COMMENT ON TABLE feria_productos         IS 'Productos participantes de cada feria.';
COMMENT ON TABLE feria_vendedores         IS 'Vendedores inscritos por el organizador en su feria aprobada (HU-23).';
COMMENT ON TABLE evaluaciones_factibilidad IS 'Dictámenes del motor: evaluaciones de solicitudes, pre-evaluaciones y simulaciones que no modifican datos reales (HU-25 a HU-28).';
COMMENT ON TABLE evaluacion_reglas       IS 'Resultado y motivo por cada regla urbana evaluada (HU-25).';
COMMENT ON TABLE excepciones_factibilidad IS 'Justificación escrita obligatoria para aprobar una solicitud no factible (HU-25).';
COMMENT ON TABLE permisos                IS 'Permisos digitales con numeración consecutiva, vigencia y QR único e impredecible (HU-31, HU-34).';
COMMENT ON TABLE permiso_eventos         IS 'Trazabilidad completa del ciclo de vida del permiso: emitido, suspendido, revocado, vencido (HU-35, HU-37).';
COMMENT ON TABLE verificaciones_qr       IS 'Log de consultas públicas del QR con datos mínimos y sin información sensible (HU-33).';
COMMENT ON TABLE tarifas                  IS 'Tarifas de uso de suelo por zona y tipo de actividad (HU-36).';
COMMENT ON TABLE cobros                  IS 'Cobros con pago SIMULADO (sin transacciones reales) y recibo descargable (HU-36).';
COMMENT ON TABLE notificaciones          IS 'Notificaciones por correo/aplicación: activación, cambios de solicitud y avisos de vencimiento (HU-18, HU-34).';
COMMENT ON TABLE alertas_saturacion      IS 'Alertas cuando un sector supera el umbral de ocupación configurado (HU-29).';
COMMENT ON TABLE auditoria               IS 'Auditoría genérica de cambios (usuarios, zonas, parámetros) con valores antes/después en JSONB (HU-05, HU-12, HU-26).';

\echo '=== ESTRUCTURA CREADA: 30 tablas, 17 tipos ENUM, 4 vistas materializadas ==='
