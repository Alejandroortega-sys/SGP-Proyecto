# AGENTS.md — Plataforma Web de Gestión del Espacio Público de Tuluá

> Este archivo es la **fuente de verdad para agentes de IA** (OpenCode) que trabajen en este proyecto.
> Léelo completo al iniciar cada sesión. Si algo aquí contradice tu memoria o tus suposiciones, **gana este archivo**.
> Si algo no está definido aquí ni en los documentos del proyecto, **pregunta; no lo inventes**.

---

## 1. Descripción del proyecto

**Plataforma Web de Gestión del Espacio Público, Ferias Agroecológicas y Comercio Formal/Informal de Tuluá** (Equipo 6): aplicación web para ordenar socioeconómicamente el uso del espacio público del municipio de Tuluá, Valle del Cauca.

La aplicación web (PWA responsive) tiene **cuatro roles**:

- **Ciudadano:** consulta sin cuenta (mapa de zonas y verificación pública de permisos por QR).
- **Comerciante:** se registra, activa su cuenta, consulta espacios disponibles, radica solicitudes de uso temporal, recibe su permiso digital con carné y QR, y paga el uso de suelo de forma **simulada**.
- **Organizador de feria:** registra su organización (validada por un gestor), solicita espacios para ferias agroecológicas e inscribe vendedores.
- **Gestor municipal:** delimita y administra zonas normativas, censusa módulos/puestos, revisa y resuelve solicitudes, emite/suspende/revoca permisos y consulta el dashboard analítico (perfiles **revisor** y **administrador**).

**Módulos funcionales:** (1) autenticación y cuentas con roles, (2) geo-portal GIS con zonas y catálogo de espacios, (3) trámites de solicitud/asignación digital, (4) motor de factibilidad (densidad y reglas urbanas, sin IoT), (5) permisos digitales con QR, verificación ciudadana y dashboard analítico.

**El esquema real de la BD ya existe:** `01_creacion_bd.sql` (29 tablas, 16 enums, triggers, funciones, restricciones EXCLUDE y 4 vistas materializadas) es la máxima autoridad del dominio.

**Exclusiones del alcance (jamás las implementes ni las "resuelvas" sin aprobación):**
- Sin sensores/hardware/IoT: toda la simulación de flujo y ocupación es algorítmica sobre datos de BD.
- **El pago de uso de suelo es SIEMPRE simulado:** prohibido integrar pasarelas reales o pedir datos de tarjeta.
- Sin app móvil nativa (solo Web Responsive/PWA) y sin modo offline.
- Solo español (sin multilenguaje). Sin comparendos, multas ni sanciones policiales.

---

## 2. Stack tecnológico (decisiones ya tomadas)

| Capa | Tecnología | Estado |
|---|---|---|
| Base de datos | **PostgreSQL 18 + PostGIS 3.6** (extensiones `postgis`, `btree_gist`, `citext`, `pgcrypto`) | ✅ creada y verificada (`01_creacion_bd.sql`; BD local de desarrollo: `SGP-Tulua`) |
| Lenguaje | **TypeScript** (strict) | 🔴 sin crear |
| Backend | **NestJS** (API REST, prefijo `/api/v1`) | 🔴 sin crear |
| ORM | **Prisma** | 🔴 sin crear |
| Frontend | **Next.js** (App Router, en `frontend/`) | 🔴 sin crear |
| Tests (previsto) | Jest + Supertest (unit + e2e) | 🔴 sin crear |
| Lint / formato | ESLint + Prettier (configurar al crear el backend, con aprobación) | 🔴 sin crear |

**Estado real inicial:** el repositorio **solo contiene documentación y scripts SQL** — no hay `package.json`, ni código de backend, ni frontend. La BD `SGP-Tulua` ya está creada y poblada con datos de prueba; sus credenciales viven solo en el `.env` local (**jamás las escribas en un archivo del repo ni las comitees**). Las credenciales de los usuarios de prueba están documentadas en la cabecera de `02_seed_datos_prueba.sql`.

**Librerías (instalar solo con aprobación, ver §10):** `@nestjs/config`, `@nestjs/jwt`, `@nestjs/passport`, `@nestjs/swagger`, `helmet`, `class-validator`, `class-transformer`, `bcrypt` o `argon2`, y la librería de mapas del frontend.

**Puertos previstos:** API `:3000`, frontend `:3001`. No los cambies sin aprobación.

**Decisiones aún NO tomadas (pregunta antes de elegir; no las decidas tú):**
- Gestor de paquetes (`npm` vs `pnpm`): el que se elija queda fijado con su lockfile; prohibido mezclar.
- Librería de componentes UI y librería de mapas (Leaflet vs Mapbox GL JS).
- Almacenamiento de archivos (disco local vs S3…), estrategia de despliegue y forma del monorepo.

**Versiones:** no asumas versiones de memoria. Revisa `package.json` / lockfile cuando existan y usa la API de la versión instalada. Si dudas de cómo funciona algo de NestJS, Prisma, Next.js o PostGIS, revisa sus tipos en `node_modules` o la documentación oficial antes de escribir código.

---

## 3. Fuentes de verdad y orden de consulta

Antes de tocar algo, consulta en este orden:

1. **`01_creacion_bd.sql`** — script ejecutable real (tablas, enums, índices, triggers, funciones, vistas). **Máxima autoridad del esquema.**
2. **`baseDatos.md`** — especificación completa: decisiones, diagrama Mermaid, campo por campo, reglas de negocio, vistas y verificación.
3. `02_seed_datos_prueba.sql` — datos de prueba (credenciales y flujos reales; incluye pruebas automáticas de las reglas críticas).
4. `resumen.md` — resumen ejecutivo del proyecto.
5. Este archivo.

> Si en el futuro un `schema.prisma` y el SQL discrepan, **gana el SQL.** Repórtalo; no lo "arregles" en silencio.

---

## 4. Estructura del repositorio

**Propuesta** cuando se autorice crear código (no la creas sin aprobación, §10):

```
├── package.json                 # backend NestJS en la raíz
├── prisma/schema.prisma         # ORM (baselining en §7)
├── src/
│   ├── main.ts / app.module.ts
│   ├── common/                  # guards, filters, interceptors, pipes
│   └── modules/<modulo>/        # estructura por módulo (abajo)
├── test/                        # tests e2e
└── frontend/                    # app Next.js con su propio package.json
    └── src/
        ├── app/                 # App Router; route groups por rol
        ├── features/{comerciante,organizador,gestor,publico}/
        ├── components/{ui,features,mapa}/
        ├── hooks/
        ├── lib/api-client.ts    # ÚNICO punto de HTTP
        └── types/
```

Módulo NestJS estándar (archivos en `kebab-case`, nombre = tabla en singular):

```
src/modules/<modulo>/
├── <modulo>.module.ts
├── <modulo>.controller.ts
├── <modulo>.service.ts
├── dto/
└── <modulo>.service.spec.ts
```

- **No crees carpetas ni archivos raíz nuevos sin autorización** (solo los que la tarea incluya explícitamente).
- No muevas ni renombres los SQL ni los documentos de la raíz.
- El backend y el frontend son **dos apps** con su propio `package.json` y lockfile.

---

## 5. Mapa del dominio (tablas reales → módulos)

Nombres **reales** de la BD: español, `snake_case`, plural, tipos `geometry(Polygon,4326)` y `geometry(Point,4326)`. **No inventes tablas ni columnas:** si necesitas una que no existe, propónla y espera aprobación.

| Módulo NestJS | Tablas reales | Notas |
|---|---|---|
| `auth` / `usuarios` | `usuarios`, `comerciantes`, `organizadores`, `gestores`, `tokens_seguridad` | Usuario 1:1 **por rol** con CHECK; correo (`citext`) y documento únicos |
| `zonas` (GIS) | `zonas`, `zona_productos`, `productos`, `parametros_motor` | Polígonos con validación topológica; parámetros versionados por fila |
| `censo` / `espacios` | `modulos`, `espacios_temporales`, `espacio_bloqueos` | Puntos geográficos; bloques de fechas sin solaparse |
| `tramites` | `solicitudes`, `solicitud_productos`, `solicitud_documentos` | Ciclo del trámite; corrección de documentos vía `reemplaza_a` |
| `ferias` | `ferias`, `feria_productos`, `feria_vendedores` | Fecha+zona **sin cruces** (restricción de exclusión EXCLUDE) |
| `factibilidad` | `evaluaciones_factibilidad`, `evaluacion_reglas`, `excepciones_factibilidad`, `alertas_saturacion` | Dictámenes por regla y excepciones justificadas — ver §6 |
| `permisos` | `permisos`, `permiso_eventos`, `verificaciones_qr` | QR único e impredecible; trazabilidad automática por trigger |
| `cobros` | `tarifas`, `cobros` | **Pago simulado** + recibo |
| `notificaciones` | `notificaciones` | Activación, cambio de estado de trámite, avisos de vencimiento |
| `dashboard` | `mv_ocupacion_zona`, `mv_recaudacion`, `mv_saturacion`, `mv_tiempos_atencion` | **Solo lectura** + job de `REFRESH MATERIALIZED VIEW CONCURRENTLY` |
| `auditoria` | `auditoria` | Solo lectura: **solo los triggers la escriben** |

> `spatial_ref_sys` existe porque la crea PostGIS. No es del negocio: **no la toques**.

### Enums (valores exactos, verificados contra `01_creacion_bd.sql`)

```
rol_usuario:            comerciante | organizador | gestor
estado_usuario:         pendiente_activacion | activa | suspendida | inactiva
perfil_gestor:          revisor | administrador
estado_organizacion:    pendiente_validacion | activa | suspendida
categoria_comercio:     formal | informal
tipo_zona:              permitida | restringida | alta_congestion
estado_modulo:          activo | baja
estado_espacio:         disponible | bloqueado | asignado | mantenimiento
estado_solicitud:       borrador | radicada | en_revision | devuelta | aprobada | rechazada | cancelada
estado_documento:       pendiente | validado | observado
estado_feria:           radicada | aprobada | rechazada | cancelada | realizada
regla_urbanistica:      distancia_minima | producto_permitido | aforo_cuadrante
resultado_factibilidad: factible | no_factible
estado_permiso:         vigente | suspendido | revocado | vencido
estado_cobro:           pendiente | pagado | anulado
tipo_token:             activacion | recuperacion_password | invitacion_gestor
```

### Variables de sesión (contrato BD ↔ backend)

| Variable | Cuándo se setea | Para qué |
|---|---|---|
| `app.actor_id` | Al inicio de **cada transacción con escritura** en tablas auditadas (`usuarios`, `zonas`, `parametros_motor`) y en **toda acción sobre permisos** | `fn_auditoria` y `fn_permiso_trazabilidad` registran quién actuó |
| `app.motivo` | Antes de `UPDATE permisos.set estado='suspendido'|'revocado'` | El trigger exige motivo; si falta, la BD lanza excepción |

Se setean con `set_config('app.actor_id', ..., true)` **dentro de la transacción** (`is_local = true` para que vivan solo en ella).

---

## 6. Regla de oro: la lógica crítica vive en la base de datos

La BD implementa reglas de negocio con **triggers, funciones, restricciones de exclusión (EXCLUDE) y defaults**. El backend **no las reimplementa ni las evita**; las invoca y traduce sus errores.

| Situación | Qué hace la BD | Qué hace el backend |
|---|---|---|
| Registro de cuenta | `CHECK` por rol + `UNIQUE` (correo `citext`, documento) | Validar antes para dar error amigable; hashear contraseña; crear token |
| Doble asignación de espacio | Restricción de exclusión (EXCLUDE) en `permisos` mientras esté `vigente` | Solo `INSERT`; traducir `exclusion_violation` a 409 |
| Cruces de fechas de ferias | EXCLUDE en `ferias` con estado `radicada|aprobada` (zona + rango fechas) | Traducir el error; sugerir fechas libres |
| Solapes de zonas | Trigger `fn_validar_zona`: `ST_IsValid` + `ST_Relate` | Solo `INSERT`/`UPDATE`; traducir `raise_exception` |
| **Evaluación de factibilidad** | Función `fn_evaluar_factibilidad(ubicacion, producto)`: una fila por regla con `regla`, `resultado`, `cumple` y `detalle` | **LLAMARLA** (`SELECT * FROM fn_evaluar_factibilidad($1,$2)`); **jamás** recalcular distancias, aforos ni productos permitidos en TypeScript |
| Alternativas de reubicación | Función `fn_buscar_alternativas(ubicacion, producto, radio)` | Llamarla y devolver sus resultados tal cual |
| Suspensión / revocación de permiso | Trigger `fn_permiso_trazabilidad` exige `app.motivo` y registra el evento en `permiso_eventos` | Setear `app.motivo` + `UPDATE` del estado; **jamás** insertar manualmente en `permiso_eventos` |
| Auditoría | Trigger `fn_auditoria` (JSONB antes/después) en `usuarios`, `zonas` y `parametros_motor` | Setear `app.actor_id` en la transacción; leer `auditoria` para mostrar historial |
| Radicado, número y QR | `DEFAULT` con secuencias y `gen_random_bytes` (`SOL-2026-#####`, `FER-2026-#####`, `PER-2026-#####`, QR hex) | **No enviar** esos campos en el `INSERT` |
| `actualizado_en` | Trigger `fn_marca_actualizacion` | No setearlo a mano |
| Dashboard | Vistas materializadas | Consultarlas; un job programado hace el `REFRESH`; no recalcular indicadores en código |

**Validación doble:** el backend valida primero (mensajes claros en español, HTTP correcto) y la BD es la red de seguridad final. Nunca confíes solo en una de las dos capas.

### Errores de BD → HTTP

| Origen | HTTP |
|---|---|
| `23505` unique_violation / Prisma `P2002` | `409 Conflict` |
| `23P01` exclusion_violation | `409 Conflict` (con mensaje: "el espacio ya está asignado en esas fechas" / "ya existe una feria en esa zona y fechas") |
| `23503` foreign_key_violation / Prisma `P2003` | `409` o `422` según el caso |
| `23514` check_violation | `422 Unprocessable Entity` |
| `P0001` raise_exception de triggers (`fn_validar_zona`, motivo obligatorio…) | `422` con el mensaje legible que lanza la BD |
| Prisma `P2025` | `404 Not Found` |
| Error inesperado | `500` genérico, **sin filtrar detalles internos** al cliente |

---

## 7. Convenciones de Prisma (esquema + PostGIS)

> Prisma aún no existe en el repo (no hay `prisma/schema.prisma`). Esta sección se aplica al crearlo, siempre con aprobación (§10).

**Estrategia de arranque (baselining):** el esquema ya existe en SQL. Genera `schema.prisma` partiendo de la BD (`prisma db pull` sobre `SPG-Prueba`) y coloca en **migraciones SQL manuales** lo que Prisma no expresa: triggers, funciones, restricciones EXCLUDE, vistas materializadas, índices GIST y defaults con expresión (`lpad(nextval(...))`, `gen_random_bytes`). No uses `db push` como flujo normal de trabajo.

**Nomenclatura en `schema.prisma`:**
- Modelos: `PascalCase` singular en español (`Usuario`, `Zona`, `Solicitud`, `Permiso`) con `@@map` al nombre real plural de la BD (`@@map("usuarios")`, `@@map("zonas")`).
- Campos: `camelCase` con `@map` al nombre real (`@map("fecha_inicio")`).
- Enums: `PascalCase` con `@@map`; valores **idénticos** a los de la BD (§5).
- Nunca renombres tablas ni columnas de la BD para "acomodar" Prisma: mapea con `@map`/`@@map`.

**Tipos y trampas específicas de este proyecto:**
- `BIGINT` → `BigInt` de Prisma, que **no se serializa a JSON**: usa `string` en DTOs de respuesta y en la API (los IDs viajan como string; parsea en el backend si necesitas número).
- `NUMERIC` (tarifas, valores, aforos) → `Prisma.Decimal`. No lo trates como `number` ni lo casts.
- `CITEXT` (`correo`): decláralo con el tipo nativo de la versión instalada (verifica en la documentación; no lo declares a ciegas).
- **`geometry` no es nativo de Prisma:** `geometria`, `ubicacion` y `ubicacion_solicitada` quedarán como `Unsupported("geometry(...)")`.
  - **Escrituras** de filas con geometría → `$executeRaw` con `ST_SetSRID(ST_MakePoint($lon, $lat), 4326)` o `ST_GeomFromGeoJSON($1)`. (Prisma no puede enviar un campo `Unsupported NOT NULL` sin default: el INSERT de esas entidades **se hace en SQL crudo parametrizado**.)
  - **Lecturas** → `$queryRaw` con `ST_AsGeoJSON(col)`.
  - Centraliza conversiones GeoJSON en helpers (p. ej. `src/common/geo.ts`); no repitas lógica por módulo.
- Vistas materializadas: consúltalas con `$queryRaw` tipado; **nunca** modeles una vista como tabla escribible.
- `qr_token`: el default lo genera la BD (`gen_random_bytes`); jamás envíes ese campo.
- Operaciones multi-tabla (solicitud + documentos, etc.) en `prisma.$transaction`; las transacciones con escritura auditada setean `app.actor_id` antes de la primera escritura.
- **Prohibido `$queryRawUnsafe`** y concatenar strings en SQL: usa tagged templates (`$executeRaw`/`$queryRaw` con `${}` parametrizado) o `Prisma.sql` para fragmentos.
- Un único `PrismaService` inyectable; nunca instancies `new PrismaClient()` fuera de él.
- No uses `prisma migrate reset`, `db push` destructivo ni borres datos sin **confirmación explícita** del usuario.

---

## 8. Convenciones de código (TypeScript)

### Generales
- `strict: true`. **Prohibido `any`** (usa `unknown` + validación). Prohibido `@ts-ignore`/`eslint-disable` sin comentario justificativo.
- Idioma: dominio en **español** (la BD ya es así); sufijos técnicos en inglés (`Service`, `Controller`, `Dto`, `Guard`, `Module`). Comentarios y mensajes al usuario en español.
- Archivos `kebab-case`; clases `PascalCase`; variables y funciones `camelCase`; constantes `UPPER_SNAKE_CASE`.
- Imports con alias (`@/…`) si `tsconfig` lo define; prohibido rutas relativas profundas (`../../../`).
- Funciones pequeñas, una responsabilidad; usa `async/await`; sin código muerto, comentarios rotos ni `console.log` olvidados (se depuran con logger/try-catch, no con prints).

### Backend (NestJS)
- Arquitectura por módulos de dominio (§4–§5): **Controller** = HTTP y validación; **Service** = lógica; **Prisma solo desde los Services**; la BD es la autoridad final (§6).
- Validación de entrada con **DTOs** (`class-validator` + `class-transformer`) y `ValidationPipe` global con `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
- **Nunca devuelvas entidades Prisma crudas**: mapea a DTOs de respuesta explícitos que excluyan `password_hash` y `token_hash`, y filtren datos personales según quién consulta (ver §9).
- Autorización en capas: `@Roles(...)` + `RolesGuard` + `JwtAuthGuard` **y además** verificación de propiedad en el Service:
  - **Comerciante:** solo su perfil, sus solicitudes, permisos y cobros.
  - **Organizador:** solo su organización y sus ferias.
  - **Gestor:** `revisor` revisa trámites; `administrador` administra cuentas, zonas y parámetros (perfil desde `gestores.perfil`).
- API REST, prefijo `/api/v1`, recursos en plural español: `/usuarios`, `/zonas`, `/espacios`, `/solicitudes`, `/ferias`, `/permisos`, `/verificaciones`. No mezcles inglés y español en la misma ruta.
- GeoJSON para el mapa: `GET /zonas/geojson` devuelve un FeatureCollection generado con `ST_AsGeoJSON` (§7) — el frontend lo renderiza tal cual.
- HTTP correcto: `201` crear, `204` borrar, `400` validación, `401` no autenticado, `403` sin permiso, `404` no existe, `409` conflicto de unicidad/EXCLUDE, `422` regla de negocio violada. Nunca devuelvas `200` con `{error: ...}`.
- Paginación estándar: `?page=1&limit=20` → `{ data, meta: { total, page, limit } }`.
- Config por variables de entorno validadas al arranque (`@nestjs/config` con esquema de validación); prohibido leer `process.env` suelto en los módulos.
- Documenta la API con Swagger (`@nestjs/swagger`): es el **contrato** que consume el frontend.

### Frontend (Next.js)
- **App Router**; componentes de servidor por defecto; `"use client"` solo donde haga falta (formularios interactivos, mapa, escáner QR, notificaciones en vivo).
- Rutas por rol con route groups (`(publico)`, `(comerciante)`, `(organizador)`, `(gestor)`). Protege rutas con middleware **y** valida el rol en el servidor: **el frontend nunca es la barrera de seguridad**.
- Toda llamada HTTP pasa por `lib/api-client.ts` (única capa con la URL base, headers e interceptores de token); prohibido `fetch` disperso con URLs escritas a mano.
- Tipos derivados del contrato Swagger — no dupliques tipos "a ojo" desde las respuestas.
- Estados de UI obligatorios: **carga, vacío y error** en toda pantalla con datos.
- Responsive (mobile-first, se prueba en 360 px) y accesible: WCAG AA de contraste, labels para inputs, foco visible; el backlog exige áreas táctiles ≥ 44 px.
- El mapa (Leaflet/Mapbox, por decidir) consume GeoJSON de la API; jamás invoques SQL ni tipado fuerte de la BD directamente en el cliente.

### Git (GUARDA)
- **Prohibido hacer commits de ningún tipo sin autorización explícita** (ni `commit`, ni `push`, ni `merge`, ni `rebase`, ni `reset`). No ejecutes comandos de git destructivos ni de historial bajo ninguna interpretación propia.
- Nunca subas `.env`, secretos, llaves ni volcados con datos reales.

---

## 9. Seguridad (no negociable)

1. **Inyección SQL:** solo Prisma parametrizado o `Prisma.sql`. Nunca concatenar variables en consultas ni interpolar strings en SQL crudo.
2. **XSS:** al renderizar en el frontend, React lo escapa por defecto; prohibido usar `dangerouslySetInnerHTML` con contenido sin sanear (incluyendo nombres/heredados de la BD).
3. **Contraseñas:** se hashean desde la app (bcrypt o argon2, se definirá con aprobación). Jamás texto plano, jamás en logs o respuestas. El `hash` del seed usa `pgcrypto crypt()` solo para datos de prueba.
4. **Autenticación:** JWT de vida corta + refresh token; cookies `httpOnly`, `secure`, `sameSite=strict` si viajan por cookie. Rate limiting en login y registro. Bloqueo temporal del usuario tras 5 intentos fallidos (con `intentos_fallidos` y `bloqueado_hasta` — la BD o la app acumulan, siempre registra qué capa lo hizo).
5. **Verificación QR pública:** endpoint SIN autenticación con rate limiting por IP; devuelve **datos mínimos**: validez, vigencia, categoría del permiso y nombre del titular comercial. **Jamás** documento, teléfono, correo, dirección ni hashes de tokens.
6. **Datos personales:** los DTOs difieren por rol; no expongas documento ni contacto de una cuenta a otra sin que sean datos de negocio del recurso pedido. Auditoría (JSONB) solo es visible para gestores.
7. **Subida de archivos:** solo PDF/JPEG/PNG; valida el tipo real (magic bytes) además de la extensión; límite de tamaño configurable (`UPLOAD_MAX_BYTES`); nombre generado por servidor (UUID) para servir; la descarga exige autorización (dueño del documento, o gestor para sus casos).
8. **IDOR:** contrasta todo `id` que llegue del cliente con el usuario autenticado (el `titular_id` de un permiso con el comercio del JWT, etc.). El ID que sí ve el frontend no autoriza por sí mismo.
9. **Secretos y env:** secrets solo en `.env` (gitignored); `.env.example` con nombres de variables sin valores reales.
10. **CORS:** restringe el origen al frontend (puerto 3001), no `*`.
11. **Cabeceras:** `helmet` en el backend; cookies y tokens con flags de seguridad. HTTPS se presupone en despliegue.
12. **Pago simulado SIEMPRE:** prohibido integrar pasarelas de pago reales, fragmentos de SDK de pagos o pedir datos de tarjeta. El flujo termina en `estado_cobro = pagado` + recibo simulado (exclusión del alcance, ver §1).

---

## 10. Protocolo anti-alucinación (reglas duras para agentes)

### Antes de escribir código
1. **Lee antes de escribir:** los archivos reales primero (`01_creacion_bd.sql`, `baseDatos.md`, módulos, DTOs y servicios ya existentes). No modifiques nada que no hayas leído.
2. **Verifica que existe:** tabla, columna, enum, endpoint, función, componente o paquete. Si no está en el SQL ni en el código, **no lo inventes**: dilo y pregunta. La BD no tiene tablas ni campos que no estén en `01_creacion_bd.sql`.
3. **No instales nada sin autorización:** ninguna dependencia nueva se instala sin aprobación previa. Si necesitas un paquete, **propón** (nombre, motivo, alternativa) y espera. No inventes nombres de paquetes ni de versiones de memoria.
4. **No crees archivos ni carpetas sin autorización:** solo los que la tarea pida explícitamente. Nada de "de paso" crear configs, scripts, dumps ni notas sueltas.
5. **No hagas commits de ningún tipo** ni ninguna operación de git (push, merge, rebase, reset, checkout de ramas nuevas) sin autorización explícita.
6. **No adivines APIs de NestJS, Prisma, Next.js ni PostGIS:** revisa los tipos en `node_modules` o la documentación oficial de la versión instalada. Si no estás seguro de firma/parámetros, verifica antes de escribir.
7. **Declara tus suposiciones** explícitamente ("asumo X porque…") y pide confirmación si afectan el diseño.

### Mientras escribes
8. Cambios pequeños y enfocados; no refactorices ni "mejores" lo que no te pidieron.
9. No modifiques el esquema de BD, `prisma/schema.prisma` ni migraciones sin aprobación explícita.
10. **No reimplementes lo que hace la BD** (§6): factibilidad, EXCLUDE, trigger de trazabilidad, defaults (radicado, QR), `actualizado_en`, auditoría.
11. No inventes endpoints desde el frontend: consulta el controller o Swagger existentes.
12. Sin `TODO` vacíos, sin código de ejemplo que "parece" funcionar, sin mocks que no avises.
13. Sigue el patrón de los módulos existentes (nombre, DTOs, respuesta, errores) — no inventes otra convención.

### Después de escribir
14. **Verifica con comandos reales que existan**: si no hay `package.json`, no hay scripts — no inventes comandos (`typecheck`, `test`, etc.) ni los simules. Declara qué verificaste con qué comando.
15. Lee los errores completos (stack, código); no silencies errores (catch vacío, `any`, desactivar lint) para que "compile".
16. **Informe honesto:** qué hiciste, qué verificaste, qué no verificaste, qué quedó pendiente. **Nunca afirmes que algo funciona si no lo ejecutaste.**

### Cuando dudes
17. Ante ambigüedad, **pregunta** — no infieras y sigas.
18. Si una instrucción del usuario contradice un archivo (o a este AGENTS.md), **avísalo antes de actuar**.
19. Si tu contexto se vuelve confuso o muy corto, **relee** este archivo y los documentos del dominio.

### Tareas grandes
- Primero **plan** (enfoque, archivos a tocar, riesgos, orden) y pide aprobación; luego código.
- Orden de construcción previsto (respeta este orden salvo indicación contraria): Prisma + config → autenticación y roles → usuarios/perfiles → zonas GIS → censo/espacios → solicitudes y documentos → factibilidad → permisos con QR → cobros → notificaciones → dashboard → frontend.

---

## 11. Flujos de negocio de referencia

Basados en el esquema real y en las reglas de BD (§6). Si dudas de un estado o paso, confirma en `baseDatos.md`.

1. **Registro y activación de cuenta:** comerciante se registra → usuario `pendiente_activacion` + token (`tokens_seguridad`, tipo `activacion`) → enlaza/activa → `activa` (+ `comerciantes` con documento, categoría y contacto). Login → JWT; a los 5 intentos fallidos, bloqueo temporal (`bloqueado_hasta`).
2. **Organización feria:** organizador registra organización → `pendiente_validacion` → gestor valida a `activa` (o la suspende). Solo con organización activa se pueden radicaciones de ferias.
3. **Solicitud de uso temporal:** borrador → radicada (con `numero_radicado` automático) → adjunta documentos (`solicitud_documentos`, estado `pendiente`) → en revisión → o se devuelve con observaciones (documento corregido vía `reemplaza_a`), o se aprueba/rechaza. Al aprobar, el gestor evalúa factibilidad **llamando a `fn_evaluar_factibilidad`** y registra el dictamen + detalle por regla; si aprueba algo no factible, cita la excepción (`excepciones_factibilidad` con motivo).
4. **Emisión de permiso:** con solicitud aprobada → `INSERT permisos` (número automático; trigger marca `emitido`) → carné digital con QR (`qr_token`). Renovación genera nuevo permiso con referencia al anterior (`renovado_desde`).
5. **Verificación pública:** ciudadano escanea el QR → endpoint público con `qr_token` → respuesta mínima (válido / no vigente / no encontrado) + registro en `verificaciones_qr`.
6. **Suspensión / revocación:** gestor setea `app.motivo` + cambia el estado → trigger valida y escribe `permiso_eventos`. La UI muestra estos eventos como historial.
7. **Cobro (SIMULADO):** permiso → cobro `pendiente` con tarifa vigente de la categoría/zona → registrar pago simulado → `pagado` + recibo. Nunca pasarela real.
8. **Feria:** organizador activo radica feria (zona + rango de fechas + productos) → la BD garantiza ningún cruce de zona+fechas para estado `radicada|aprobada` → gestor aprueba/rechaza → inscripción de vendedores (`feria_vendedores`, solo comercios aptos según `zona_productos`).
9. **Bloqueo de espacios:** gestor bloquea un espacio temporal (feria, mantenimiento, evento) con fechas sin solapes (la BD valida que no se crucen).
10. **Dashboard:** gestor consulta indicadores desde las vistas materializadas; el job de refresco hace `REFRESH MATERIALIZED VIEW CONCURRENTLY`; anuncios cuando `alertas_saturacion` marque zonas saturadas.
11. **Notificaciones:** al crearse/actualizar un documento o cambiar estado de un trámite o permiso, se escribe una fila en `notificaciones` (es toda la lógica de "notificación" del MVP — sin correos externos salvo decisión contraria).

---

## 12. Definición de "terminado" (checklist por tarea)

Una tarea está **done** cuando:

- [ ] TypeScript compila, y lint/format ya configurados, limpios.
- [ ] Tests unitarios y e2e de la tarea en verde (si existen los runners; §10 punto 14).
- [ ] Entrada validada (DTO + ValidationPipe) y **salida mapeada** a DTOs, sin `password_hash`, sin `token_hash`, sin datos personales filtrados (§9).
- [ ] Autorización verificada: rol correcto **y** propiedad del recurso (no solo "está logueado").
- [ ] Estado de sesión: `app.actor_id` (y `app.motivo` si la operación lo necesita) seteado dentro de la transacción.
- [ ] Errores mapeados BD → HTTP según §6 (nada de 500 en violaciones de unicidad/EXCLUDE).
- [ ] Nombres y reglas coherentes con `01_creacion_bd.sql` y `baseDatos.md` (español del dominio).
- [ ] Swagger bien anotado es coherente con los DTOs reales.
- [ ] Si es frontend: estados de carga/vacío/error, responsive y accesible (§8).
- [ ] Resumen honesto: qué hiciste, qué verificaste y qué queda. Sin promesas de fases futuras no implementadas.

---

## 13. Variables de entorno

Cuando se cree el backend, crea un `.env.example` (sin valores reales) con al menos:

```bash
# Backend (NestJS)
PORT=3000
DATABASE_URL=postgresql://usuario:contrasena@localhost:5432/spg_prueba
JWT_ACCESS_SECRET=
JWT_ACCESS_EXPIRES_IN=
JWT_REFRESH_SECRET=
FRONTEND_URL=http://localhost:3001
UPLOAD_MAX_BYTES=

# Frontend (Next.js)
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

- La BD local de desarrollo es **`SPG-Prueba`** (ya creada); el usuario/contraseña reales viven solo en tu `.env` local.
- `.env` y sus variantes van en `.gitignore` desde el día uno; **jamás entran al repo**.
- No registres secretos en el código ni en el Swagger.

---

## 14. Recomendaciones de uso con OpenCode

- **Una tarea por prompt:** módulo + comportamiento + caso concreto (p. ej. "en `solicitudes`, al rechazar con detalle, guarda motivo y notifica al comerciante"). Evita "hazme el TP completo": las tareas grandes van con plan (§10).
- **Plan primero:** "propón un plan antes de codificar" para tareas multi-módulo.
- **Cita la regla exacta cuando el agente "inventa":** si genera un endpoint, tabla, columna, estado o enum que no existe, corrígelo citando la fuente (§3): p. ej. "§10 punto 2: esa tabla no existe en `01_creacion_bd.sql`".
- **Reinicia la sesión entre módulos** (auth, trámites, GIS, permisos…): cada módulo lee su propio chat, PostgreSQL, Prisma y ficheros.
- **Las decisiones pendientes (librería de mapas, UI, almacenamiento) van por módulo cuando se necesiten**; el documento de alcance contiene alternativas pero no decide.
- **Si algo te parece contradictorio o detectas un bug en el esquema**, avísalo antes de "arreglarlo": la cadena de mando es SQL → `baseDatos.md` → este archivo → código.

