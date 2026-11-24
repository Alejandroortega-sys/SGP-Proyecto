# Sprint 5 — Permisos digitales, QR y transparencia (ajustado a `AGENTS.md`)

> **Épica 5** · Plataforma Web de Gestión del Espacio Público de Tuluá (Equipo 6)
> **7 historias · 31 puntos** · Fuentes: backlog de Jira (`Jira_Import_Backlog_v2_sin_puntos.csv`) y `AGENTS.md`.
> **Si este plan contradice `AGENTS.md`, gana `AGENTS.md`** (y se avisa; AGENTS §10 punto 18).

## 0. Reglas de trabajo para OpenCode (léelas primero)

1. Lee `AGENTS.md` completo y, en este orden, `01_creacion_bd.sql` → `baseDatos.md` → `02_seed_datos_prueba.sql` → `resumen.md` (AGENTS §3). **Lee los módulos existentes** (p. ej. `src/auth`, `src/espacios`, `src/notificaciones`) y copia su patrón de nombres, DTOs, errores y respuestas (§10 punto 13).
2. **Primero un plan, luego código** (AGENTS §10 «Tareas grandes»): para cada historia, antes de escribir, entrega un plan corto con archivos a tocar, tablas y columnas reales que usarás, suposiciones y riesgos, y **espera aprobación**.
3. **Aprobación explícita requerida** para: instalar cualquier dependencia (propón nombre, motivo y alternativa), crear archivos/carpetas no listados en el plan aprobado, tocar `01_creacion_bd.sql`, `prisma/schema.prisma` o migraciones, y cualquier operación de git. **Prohibido hacer commits** (ni push, merge, rebase, reset) sin autorización.
4. **No inventes** tablas, columnas, enums, endpoints, funciones ni paquetes. Verifica en el SQL y en el código que existen. Ante duda, pregunta.
5. **La lógica crítica vive en la BD** (AGENTS §6): invócala y traduce sus errores; no la reimplementes.
6. Usa **pnpm** (nunca npm/yarn). Los comandos de verificación salen de los `scripts` de cada `package.json` (backend en la raíz, frontend en `frontend/`); **no inventes comandos**.
7. Este archivo es el registro: marca `- [x]` solo con la tarea hecha **y verificada con un comando real**; actualiza la tabla de progreso (sección 4) y añade una línea al registro (sección 8). Informe honesto: qué hiciste, qué verificaste, qué no, qué falta (§10 punto 16).
8. Las historias con decisiones abiertas (sección 2) **no se implementan** hasta que el usuario responda; trabaja primero lo que no dependa de ellas.

## 1. Qué cambia respecto al backlog de Jira (AGENTS.md manda)

| El backlog de Jira dice | AGENTS.md / BD real manda |
|---|---|
| Laravel o Node/Python, a elegir | **NestJS + Prisma 7 + PostgreSQL 18/PostGIS**, frontend **Next.js 16** (App Router, Tailwind 4, Leaflet), TypeScript `strict`, **pnpm** |
| «Implementar numeración consecutiva» y «generar token aleatorio» | Los genera la **BD** (`PER-AAAA-#####` y `qr_token` hex por `DEFAULT`). **No se envían en el `INSERT`** |
| Auditoría/historial de cambios de estado | Lo escribe el **trigger** `fn_permiso_trazabilidad` en `permiso_eventos`; el backend solo setea `app.actor_id` y `app.motivo` |
| Notificación al comerciante (correo/SMTP) | Una fila en **`notificaciones`**; sin correos externos salvo decisión contraria (§11.11) |
| Estados del permiso a definir | Enum real `estado_permiso`: `vigente \| suspendido \| revocado \| vencido` |
| Estados de pago Pendiente/Pagado/**Vencido** | Enum real `estado_cobro`: `pendiente \| pagado \| anulado` (ver D4) |
| Renovación conserva el mismo QR | §11.4: la renovación crea un **nuevo permiso** con `renovado_desde` (ver D2) |
| JWT con expiración | Access JWT corto (gestor 30 min) + refresh opaco hasheado en `sesiones`, claim `sid`; guards `JwtAuthGuard` + `RolesGuard` + `@Roles` **y** verificación de propiedad (IDOR) en el Service |
| Respuestas de API | DTOs de respuesta explícitos; `BigInt` y IDs como `string`; `NUMERIC` como `Prisma.Decimal`; paginación `?pagina=1&limite=20` → `{ datos, paginacion }` |
| Limitar consultas públicas | `@nestjs/throttler` por IP en el endpoint público de verificación |
| Pruebas | Backend: Jest + Supertest (unit en `*.service.spec.ts`, e2e en `test/`) · Frontend: Vitest + Playwright. Lint: oxlint + Prettier (backend), ESLint (frontend) |
| Figma/UX | Las tareas `[UX]` siguen siendo trabajo humano; OpenCode implementa la UI con el design system de `components/ui/` |

**Exclusiones vigentes (no implementar):** pasarelas de pago reales o datos de tarjeta, IoT, app nativa, modo offline, multilenguaje, comparendos/multas.

## 2. Decisiones y verificaciones pendientes (bloquean tareas concretas)

OpenCode: **no resuelvas estas decisiones por tu cuenta.** Pregunta al usuario y registra la respuesta en la sección 9.

| ID | Tema | Hallazgo | Opción recomendada | Afecta |
|---|---|---|---|---|
| **D1** | HU-20 y el módulo de solicitudes **no existen aún** | AGENTS §11 (nov. 2026): los flujos 3–8 «no tienen endpoints ni pantallas». HU-31 y HU-34 dependen de solicitudes aprobadas | Implementar la emisión **manual** (`POST /permisos`) leyendo solicitudes aprobadas del seed; dejar la emisión automática y la renovación vía solicitud para cuando exista HU-20 | HU-31 (1214), HU-34 |
| **D2** | Renovación: ¿mismo QR o permiso nuevo? | Backlog CA3 (mismo QR, se extiende vigencia) ≠ AGENTS §11.4 (nuevo permiso con `renovado_desde` ⇒ nuevo `qr_token`). Además hay EXCLUDE sobre el espacio mientras el permiso esté `vigente` | Seguir AGENTS/BD (permiso nuevo + `renovado_desde`) y actualizar el CA3 con el Product Owner; la alternativa es extender `fecha_fin` del mismo permiso, que hay que confirmar contra el trigger | HU-34 completa |
| **D3** | ¿Quién pasa un permiso a `vencido`? | No consta si un job/trigger lo hace o si se deduce por fecha | Que la verificación pública calcule «vigente» como `estado = vigente` **y** fecha dentro de vigencia (no depender de que `estado` ya diga `vencido`) | HU-33, HU-32, HU-34 |
| **D4** | Estado de cobro «Vencido» | No existe en `estado_cobro` | Derivarlo al presentar si `cobros` tiene fecha límite; si no, propuesta de migración para aprobación | HU-36 (1244) |
| **D5** | Dependencias nuevas | No están en la lista de AGENTS §2: dibujar QR, PDF/imagen del carné, PDF del recibo, lector QR por cámara, scheduler diario | OpenCode **propone** (nombre, motivo, alternativa, compatibilidad con Next 16/NestJS 12) y espera aprobación. Revisar antes si el repo ya trae alguna | HU-31, 32, 33, 34, 36 |
| **D6** | Archivos y rutas nuevas | AGENTS §4: no crear carpetas/archivos sin autorización. Propuesta a aprobar: backend `src/permisos/`, `src/cobros/` (con `dto/` y `*.service.spec.ts`); frontend `features/permisos/` y `features/cobros/`, páginas en `(publico)`, `(comerciante)`, `(gestor)`; tests en `test/` | Aprobar la lista en el plan de cada historia | Todas |
| **D7** | Motivo de «no vigente» en la verificación pública | AGENTS §9.5 limita la respuesta a validez, vigencia, categoría y titular comercial | Mostrar solo el **estado** (vencido/suspendido/revocado), **no** el texto libre del motivo del gestor | HU-33 |
| **D8** | ¿Qué perfil de gestor emite/suspende/revoca? | AGENTS: `revisor` revisa trámites; `administrador` administra cuentas, zonas y parámetros. Los permisos no están asignados | Pedir confirmación; hasta entonces, cualquier gestor activo con propiedad verificada | HU-31, HU-35, HU-37 |
| **D9** | Columnas y transiciones reales | No se conocen de memoria las columnas de `permisos`, `verificaciones_qr`, `notificaciones`, `cobros`, `tarifas`, ni las transiciones que permite el trigger | **Leer `01_creacion_bd.sql` y `baseDatos.md` antes del plan de cada historia** y citar lo encontrado | HU-31, 32, 33, 35, 36, 37 |
| **D10** | Índices de búsqueda (1251) | Es cambio de esquema | Proponer SQL y esperar aprobación | HU-37 |
| **D11** | Origen del cobro (HU-36) | Backlog: desde solicitud aprobada (HU-20). AGENTS §11.7: desde el permiso | Seguir AGENTS (permiso → cobro `pendiente`) | HU-36 |

## 3. Convenciones aplicables (resumen de AGENTS.md)

- **Backend:** Controller = HTTP/validación; Service = lógica y **único** lugar que usa Prisma; DTOs con `class-validator` y `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`); Swagger anotado y coherente con los DTOs; rutas en plural español sin prefijo global; sin `any`, sin `console.log`, sin `TODO` vacíos. Módulo = `<modulo>.module/controller/service.ts`, `dto/`, `<modulo>.service.spec.ts`.
- **Prisma:** `$transaction` para operaciones multi-tabla; `app.actor_id` (y `app.motivo`) con `set_config(..., true)` **antes de la primera escritura** de la transacción; SQL crudo solo con tagged templates/`Prisma.sql`; geometría con helpers de `src/common/geo.ts`; nunca `new PrismaClient()`.
- **Errores BD → HTTP:** `23505`/`P2002` → 409 · `23P01` → 409 (mensaje claro) · `23514` → 400 · `P0001` → 422 con el mensaje de la BD · `P2025` → 404 · inesperado → 500 genérico sin detalles. Nunca `200` con `{error}`.
- **Seguridad:** autorización por rol **y** propiedad (IDOR); endpoint público con throttler y datos mínimos; sin XSS (`dangerouslySetInnerHTML` prohibido con contenido no saneado); sin secretos en el repo; CORS al origen del frontend (`:3001`); API en `:3000`.
- **Frontend (Next.js):** componentes de servidor por defecto, `"use client"` solo para formulario/escáner; route groups por rol, ruta protegida por middleware **y** validación de rol en servidor; **toda HTTP por `lib/api-client.ts`**; tipos derivados de Swagger; estados de carga/vacío/error; mobile-first (360 px), WCAG AA, táctil ≥ 44 px, textos en español.
- **Definición de «terminado» por tarea** (AGENTS §12): compila y pasa lint/format; tests unitarios y e2e de la tarea en verde; entrada validada y **salida mapeada a DTOs** sin datos sensibles; rol y propiedad verificados; `app.actor_id`/`app.motivo` seteados cuando aplique; errores BD→HTTP mapeados (ningún 500 por unicidad/EXCLUDE); nombres coherentes con el SQL; Swagger al día; frontend con estados y responsive; resumen honesto.

## 4. Progreso del sprint

| # | Historia | Prioridad | Pts | Depende de | Decisiones | Tareas | Estado |
|---|---|---|---||---|---|---|
| 1 | HU-31 — Gestor municipal emite el permiso digital con código QR | Must | 5 | HU-20 | D1, D5, D6, D9 | 5/7 · 2 ⏸ | ✅ Completa |
| 2 | HU-33 — Ciudadano verifica la legalidad de un puesto escaneando su QR | Must | 5 | HU-31 | D3, D5, D6, D7, D9 | 5/6 · 1 ⏸ | ✅ Completa |
| 3 | HU-32 — Comerciante consulta y descarga su carné digital desde el celular | Must | 3 | HU-31 | D5, D6, D9 | 4/5 · 1 ⏸ | ✅ Completa |
| 4 | HU-35 — Gestor municipal suspende o revoca los permisos de comerciantes | Should | 5 | HU-31 | D6, D8, D9 | 5/6 · 1 ⏸ | ✅ Completa |
| 5 | HU-34 — Comerciante renueva su permiso antes de que venza | Should | 5 | HU-31 | D2, D5, D6 | 6/7 · 1 ⏸ | ✅ Completa (CA3 ajustado por D2) |
| 6 | HU-37 — Gestor municipal consulta el historial y la trazabilidad de los permisos | Should | 3 | HU-31 | D6, D9, D10 | 5/6 · 1 ⏸ | ✅ Completa |
| 7 | HU-36 — Comerciante paga el uso de suelo de forma simulada y descarga su recibo | Could | 5 | HU-20 | D4, D5, D6, D9, D11 | 6/7 · 1 ⏸ | ✅ Completa (sin «Vencido», D4) |

Leyenda: ⬜ Pendiente · 🟨 En curso · ✅ Completa (CA y tareas marcados y verificados) · ⏸ Bloqueada / requiere humano o aprobación.
Orden recomendado: HU-31 es la base; HU-33 y HU-35 reutilizan el estado del permiso; HU-34 queda **bloqueada por D1/D2**; HU-36 (*Could*) al final.

**Criterios de la épica 5 (verificar al cerrar):**
- [x] Cada permiso emitido tiene un QR único e impredecible (generado por la BD) y la emisión tarda < 2 s. (verificado: `pnpm test:e2e -- --runInBand` · e2e API y Playwright `e2e/permisos.spec.ts` miden la emisión < 2000 ms)
- [x] Escanear un QR muestra validez, vigencia y categoría **sin sesión** y **sin datos sensibles**. (verificado: Playwright `e2e/verificar.spec.ts` CA1/CA4 + e2e API de respuesta mínima)
- [x] Un permiso suspendido, vencido o revocado se muestra como no vigente. (verificado: Playwright CA2 + e2e API D3)
- [x] El pago es solo simulado. (verificado: Playwright `e2e/cobros.spec.ts` CA2 + aviso visible permanente)

**Definition of Done de la épica:**
- [ ] Todas las historias terminadas y aceptadas por el Product Owner.
- [ ] Criterios de aceptación de la épica verificados por QA.
- [ ] Funcionalidad desplegada en pruebas y demostrada en la revisión del sprint.

## 5. Historias de usuario del Sprint 5

### 1. HU-31 - Gestor municipal emite el permiso digital con código QR  _(Jira 131)_
**Prioridad:** Must · **Puntos:** 5 · **Rol:** Gestor · **Depende de:** HU-20 (Gestor municipal aprueba o rechaza solicitudes y asigna el espacio) · **Decisiones abiertas:** D1, D5, D6, D9

> **Como** gestor municipal **quiero** emitir el permiso digital de una solicitud aprobada con un código QR único **para** que el comerciante demuestre que su puesto es legal.

**Criterios de aceptación** (cada uno requiere ≥ 1 prueba automatizada en verde):
- [x] **HU-31-CA1** — **Dado que** una solicitud fue aprobada, **cuando** se emite el permiso, **entonces** se genera un permiso con número, titular, espacio, vigencia, categoría y QR único en menos de 2 s. (Playwright `e2e/permisos.spec.ts` · e2e API `test/permisos.e2e-spec.ts`)
- [x] **HU-31-CA2** — **Dado que** se emiten dos permisos, **cuando** se comparan sus códigos QR, **entonces** son distintos y no predecibles. (unitarias `permisos.service.spec.ts`: el INSERT nunca envía `qr_token`/`numero`; el token lo genera la BD con `gen_random_bytes`)
- [x] **HU-31-CA3** — **Dado que** se emite un permiso, **cuando** termina el proceso, **entonces** el comerciante recibe una notificación con acceso a su carné. (Playwright: la notificación «Carné digital PER-… disponible» llega al titular; fila en `notificaciones`, sin correo)
- [x] **HU-31-CA4** — **Dado que** una solicitud no está aprobada, **cuando** intento emitir un permiso, **entonces** el sistema lo impide. (unitarias + e2e API: 422 «solo se emiten permisos de solicitudes aprobadas»)

**Ajustes según AGENTS.md:**
- **Emisión = `INSERT` en `permisos`** (módulo `permisos`, flujo §11.4). **No enviar** `numero` (`PER-AAAA-#####`), `qr_token` (hex, `gen_random_bytes`), `emitido` ni `actualizado_en`: los pone la BD (§6). Por eso las tareas 1212 y 1213 se reducen a verificar el modelo Prisma, el servicio y la lectura de esos campos; **no generes tú la numeración ni el token**.
- Setear `app.actor_id` con `set_config(..., true)` dentro de la transacción (toda acción sobre permisos, §5).
- Validar primero en el backend (la solicitud existe, es del flujo correcto y está `aprobada`; si no → **422** con mensaje en español) y dejar la BD como red de seguridad. Doble asignación del espacio → `23P01` → **409** «el espacio ya está asignado en esas fechas».
- Notificación (CA3) = **una fila en `notificaciones`** para el comerciante titular (§11.11). **Sin correo externo** (no uses `nodemailer` aquí salvo decisión contraria). Verifica el tipo/enum de `notificaciones` en el SQL antes de insertar.
- Tarea 1214 (emisión automática al aprobar): **depende de HU-20, que aún no está implementada** (D1). Mientras no exista, implementa solo la emisión manual (`POST /permisos`) y deja 1214 en `⏸`.
- DTO de respuesta explícito (número, titular comercial, espacio, vigencia, categoría, estado, `qrToken`); IDs `BigInt` como `string`. Nunca devolver entidades Prisma crudas.

**Tareas:**
- [x] `BE` **1212** — Implementar el modelo de permiso con numeración consecutiva — _la BD ya genera número/secuencia; solo modelo/servicio_
- [x] `BE` **1213** — Implementar la generación del token aleatorio y del código QR — _`qr_token` lo genera la BD; **no** generar token en TS_
- [ ] `BE` **1214** — Implementar la emisión automática del permiso al aprobar la solicitud — _⏸ bloqueada por D1 (decisión del 2026-11-23: emisión manual)_
- [x] `BE` **1215** — Implementar la notificación al comerciante con el acceso al carné
- [x] `FE` **1216** — Construir la vista del permiso emitido en el panel del gestor
- [ ] `UX` **1217** — Diseñar el carné digital (datos, QR y estado) — _⏸ requiere humano_
- [x] `QA` **1218** — Probar la emisión, la unicidad del QR y el tiempo de generación

**Verificación de la historia:**
- [x] Plan de la historia aprobado antes de codificar (sección 0, punto 2)
- [x] Todos los CA de HU-31 marcados, cada uno con prueba automatizada en verde (comando y resultado en la sección 8)
- [x] Checklist «terminado» de AGENTS §12 cumplido en cada tarea
- [x] Swagger actualizado y coherente con los DTOs de HU-31
- [x] Sin dependencias, archivos ni cambios de esquema fuera de lo aprobado; sin commits

### 2. HU-33 - Ciudadano verifica la legalidad de un puesto escaneando su QR  _(Jira 133)_
**Prioridad:** Must · **Puntos:** 5 · **Rol:** Ciudadano · **Depende de:** HU-31 (Gestor municipal emite el permiso digital con código QR) · **Decisiones abiertas:** D3, D5, D6, D7, D9

> **Como** ciudadano o inspector **quiero** escanear el QR de un puesto y ver si su permiso es legal, su vigencia y su categoría **para** ejercer veeduría sobre el uso del espacio público.

**Criterios de aceptación** (cada uno requiere ≥ 1 prueba automatizada en verde):
- [x] **HU-33-CA1** — **Dado que** escaneo un QR válido y vigente, **cuando** se abre la consulta, **entonces** veo «Permiso válido», el titular, la categoría y las fechas, sin iniciar sesión. (Playwright `e2e/verificar.spec.ts` CA1 + e2e API)
- [x] **HU-33-CA2** — **Dado que** escaneo un QR vencido o revocado, **cuando** se consulta, **entonces** veo «Permiso no vigente». (CA2 con **estado** suspendido/revocado/vencido, **sin el motivo** del gestor — decisión D7; Playwright CA2 + e2e API D3)
- [x] **HU-33-CA3** — **Dado que** escaneo un código que no existe, **cuando** se consulta, **entonces** veo «Permiso no encontrado». (Playwright CA3 + e2e API)
- [x] **HU-33-CA4** — **Dado que** consulto un permiso, **cuando** se muestran los datos, **entonces** no se exponen documentos ni datos personales sensibles. (Playwright CA4 + e2e API con prueba de campos mínimos exactos)

**Ajustes según AGENTS.md:**
- Endpoint **público, sin `JwtAuthGuard`**, con `@nestjs/throttler` por IP (§9.5). Ruta propuesta en línea con §8: `GET /verificaciones/:qrToken` (confirma el nombre con Swagger/el equipo, D6).
- Respuesta **mínima**: validez, vigencia (fechas), categoría y nombre del titular comercial. **Jamás** documento, teléfono, correo, dirección ni hashes. Un DTO propio; prueba automatizada que falle si aparece cualquier campo fuera de la lista.
- Validar el formato del token antes de consultar; token inexistente o mal formado → «Permiso no encontrado» (404 con el mensaje de la pantalla, sin pistas adicionales).
- Válido = `estado = vigente` **y** fecha actual dentro de la vigencia. `suspendido`, `revocado`, `vencido` → «Permiso no vigente» (la regla de quién marca `vencido` está en D3).
- Registrar cada consulta en `verificaciones_qr` (verifica sus columnas reales; no guardes datos personales del consultante). Es la fuente del conteo de HU-37.
- Frontend: route group `(publico)`, sin sesión; escáner de cámara como componente `"use client"` (requiere HTTPS/localhost y permiso de cámara) y **entrada manual del código** como alternativa. Toda la HTTP por `lib/api-client.ts`. Resultado en verde/rojo **y** con texto/ícono (no solo color).

**Tareas:**
- [x] `BE` **1224** — Implementar el endpoint público de verificación con datos mínimos y limitación de consultas
- [x] `BE` **1225** — Implementar el registro de cada verificación realizada
- [x] `FE` **1226** — Implementar el lector de QR con la cámara del dispositivo
- [x] `FE` **1227** — Construir la pantalla de resultado (válido, no vigente y no encontrado)
- [ ] `UX` **1228** — Diseñar la pantalla de verificación con resultado claro en verde y rojo — _⏸ requiere humano_
- [x] `QA` **1229** — Probar la verificación con QR válido, vencido, revocado e inexistente

**Verificación de la historia:**
- [x] Plan de la historia aprobado antes de codificar (sección 0, punto 2)
- [x] Todos los CA de HU-33 marcados, cada uno con prueba automatizada en verde (comando y resultado en la sección 8)
- [x] Checklist «terminado» de AGENTS §12 cumplido en cada tarea
- [x] Swagger actualizado y coherente con los DTOs de HU-33
- [x] Sin dependencias, archivos ni cambios de esquema fuera de lo aprobado; sin commits

### 3. HU-32 - Comerciante consulta y descarga su carné digital desde el celular  _(Jira 132)_
**Prioridad:** Must · **Puntos:** 3 · **Rol:** Comerciante · **Depende de:** HU-31 (Gestor municipal emite el permiso digital con código QR) · **Decisiones abiertas:** D5, D6, D9

> **Como** comerciante **quiero** ver y descargar mi carné con el código QR desde mi celular **para** presentarlo ante cualquier autoridad.

**Criterios de aceptación** (cada uno requiere ≥ 1 prueba automatizada en verde):
- [x] **HU-32-CA1** — **Dado que** tengo un permiso vigente, **cuando** abro «Mi carné» en el celular, **entonces** veo el carné y el QR legible a pantalla completa. (Playwright `e2e/permisos.spec.ts` HU-32: QR visible con alt descriptivo)
- [x] **HU-32-CA2** — **Dado que** presiono «Descargar», **cuando** confirmo, **entonces** obtengo el carné en PDF o imagen. (Playwright: descarga `carne-PER-*.pdf`; e2e API valida cabecera `%PDF` y `Content-Disposition`)
- [x] **HU-32-CA3** — **Dado que** mi permiso está vencido o revocado, **cuando** abro el carné, **entonces** el estado se muestra de forma visible. (unitarias + e2e API: estado en el DTO y en el PDF; UI con color **y** texto)

**Ajustes según AGENTS.md:**
- Endpoint autenticado rol `comerciante`: solo permisos cuyo titular sea **el comercio del JWT** (control IDOR en el Service, §9.8). Permiso ajeno → 404/403.
- Estado visible (`vigente`, `suspendido`, `revocado`, `vencido`) tanto en pantalla como en el archivo descargado.
- Generar el PDF/imagen del carné y el dibujo del QR exige **dependencias nuevas** (D5): propón y espera aprobación antes de instalar nada.
- Frontend en `features/permisos/` (nombre sujeto a D6), ruta en el route group `(comerciante)`, QR a pantalla completa y legible, objetivos táctiles ≥ 44 px, probado en 360 px.

**Tareas:**
- [x] `BE` **1219** — Implementar el endpoint del carné y la generación del PDF o imagen descargable
- [x] `FE` **1220** — Construir la vista del carné a pantalla completa optimizada para móvil
- [x] `FE` **1221** — Implementar la descarga del carné
- [ ] `UX` **1222** — Diseñar la vista del carné para móvil con QR de alto contraste — _⏸ requiere humano_
- [x] `QA` **1223** — Probar la visualización y la descarga en distintos tamaños de pantalla

**Verificación de la historia:**
- [x] Plan de la historia aprobado antes de codificar (sección 0, punto 2)
- [x] Todos los CA de HU-32 marcados, cada uno con prueba automatizada en verde (comando y resultado en la sección 8)
- [x] Checklist «terminado» de AGENTS §12 cumplido en cada tarea
- [x] Swagger actualizado y coherente con los DTOs de HU-32
- [x] Sin dependencias, archivos ni cambios de esquema fuera de lo aprobado; sin commits

### 4. HU-35 - Gestor municipal suspende o revoca los permisos de comerciantes  _(Jira 135)_
**Prioridad:** Should · **Puntos:** 5 · **Rol:** Gestor · **Depende de:** HU-31 (Gestor municipal emite el permiso digital con código QR) · **Decisiones abiertas:** D6, D8, D9

> **Como** gestor municipal **quiero** suspender temporalmente o revocar un permiso indicando el motivo **para** controlar el ciclo de vida de cada autorización.

**Criterios de aceptación** (cada uno requiere ≥ 1 prueba automatizada en verde):
- [x] **HU-35-CA1** — **Dado que** reviso un permiso vigente, **cuando** lo reboco con un motivo, **entonces** el QR pasa a mostrar «No vigente» de inmediato y el comerciante es notificado. (Playwright `e2e/permisos.spec.ts`: suspensión + consulta pública inmediata `valido=false`)
- [x] **HU-35-CA2** — **Dado que** suspendo un permiso temporalmente, **cuando** levanto la suspensión, **entonces** el permiso vuelve a estar vigente con el mismo QR. (Playwright: reactivación y el **mismo** token vuelve a `valido=true`)
- [x] **HU-35-CA3** — **Dado que** cambio el estado de un permiso, **cuando** consulto su historial, **entonces** veo cada cambio con motivo, autor y fecha. (Playwright: línea de tiempo con emisión/suspensión/reactivación/revocación, motivos y actor)

**Ajustes según AGENTS.md:**
- Cambiar estado = `app.actor_id` + `app.motivo` seteados **antes** del `UPDATE permisos SET estado=...` en la misma transacción. **Jamás** `INSERT` en `permiso_eventos`: lo escribe el trigger `fn_permiso_trazabilidad`, que lanza excepción si falta el motivo (`P0001` → **422** con el mensaje de la BD).
- Validar el motivo obligatorio también en el DTO. Transiciones: confirma en `01_creacion_bd.sql`/`baseDatos.md` cuáles permite el trigger (en especial `suspendido→vigente` y que `revocado` sea final); si no está claro, **pregunta** (D9).
- La tarea 1238 «auditoría de cada cambio de estado» ya la cubre el trigger: limítate a **leer** `permiso_eventos` para el historial (CA3). No reimplementes.
- El QR refleja el cambio de inmediato: el endpoint público lee la BD en cada consulta, **sin caché**. Notificar al comerciante con una fila en `notificaciones`.
- Qué perfil de gestor puede suspender/revocar (`revisor` vs `administrador`) no está definido en AGENTS.md → D8.

**Tareas:**
- [x] `BE` **1237** — Implementar los estados del permiso y sus transiciones permitidas
- [x] `BE` **1238** — Implementar la auditoría de cada cambio de estado — _ya lo hace el trigger; solo leer `permiso_eventos`_
- [x] `BE` **1239** — Implementar la notificación al comerciante por suspensión o revocación
- [x] `FE` **1240** — Construir las acciones de suspender, levantar y revocar en el detalle del permiso
- [ ] `UX` **1241** — Diseñar los diálogos de confirmación y el registro de motivo — _⏸ requiere humano_
- [x] `QA` **1242** — Probar las transiciones y que el QR refleje el estado actualizado

**Verificación de la historia:**
- [x] Plan de la historia aprobado antes de codificar (sección 0, punto 2)
- [x] Todos los CA de HU-35 marcados, cada uno con prueba automatizada en verde (comando y resultado en la sección 8)
- [x] Checklist «terminado» de AGENTS §12 cumplido en cada tarea
- [x] Swagger actualizado y coherente con los DTOs de HU-35
- [x] Sin dependencias, archivos ni cambios de esquema fuera de lo aprobado; sin commits

### 5. HU-34 - Comerciante renueva su permiso antes de que venza  _(Jira 134)_
**Prioridad:** Should · **Puntos:** 5 · **Rol:** Comerciante · **Depende de:** HU-31 (Gestor municipal emite el permiso digital con código QR) · **Decisiones abiertas:** D2, D5, D6

> **Como** comerciante **quiero** recibir un aviso antes del vencimiento y renovar mi permiso con mis datos precargados **para** mantener mi puesto legal sin repetir todo el trámite.

**Criterios de aceptación** (cada uno requiere ≥ 1 prueba automatizada en verde):
- [x] **HU-34-CA1** — **Dado que** mi permiso vence en 15 días, **cuando** ingreso a la plataforma, **entonces** veo un aviso y el botón «Renovar». (Playwright `e2e/permisos.spec.ts` HU-32: aviso «próximo a vencer» + botón «Renovar»; avisos diarios idempotentes con `@nestjs/schedule`)
- [x] **HU-34-CA2** — **Dado que** solicito la renovación, **cuando** confirmo, **entonces** se crea una solicitud simplificada con mis datos precargados y pasa a revisión del gestor. (Playwright: radica `SOL-…` en estado `radicada` con espacio/actividad/horario precargados)
- [x] **HU-34-CA3** — **Dado que** el gestor aprueba la renovación, **cuando** confirma, **entonces** la vigencia se extiende. ⚠ **Ajustado por D2**: la extensión se materializa como **permiso nuevo** enlazado con `renovado_desde` (QR nuevo, decisión del 2026-11-23); la emisión con `renovadoDesde` está probada en unitarias y e2e API.
- [x] **HU-34-CA4** — **Dado que** mi permiso ya venció, **cuando** intento renovarlo, **entonces** el sistema me indica que debo radicar una nueva solicitud. (unitarias + e2e API: 422 «debe radicar una nueva solicitud»)

**Ajustes según AGENTS.md:**
- ⚠ **Conflicto backlog ↔ AGENTS.md (D2):** el CA3 pide «se extiende la vigencia y se conserva el mismo QR», pero AGENTS.md §11.4 dice que la renovación **genera un nuevo permiso con `renovado_desde`**, y `qr_token` lo genera la BD (un permiso nuevo trae QR nuevo). **No implementes HU-34 hasta que el usuario decida.** Esto afecta 1231, 1232 y la prueba 1236.
- Aviso de vencimiento (1230): escribir en `notificaciones` («avisos de vencimiento», §5). Necesita un job diario; AGENTS.md **no incluye un scheduler** en las librerías decididas → verifica si el repo ya tiene uno y, si no, propón el paquete (D5). El aviso debe ser idempotente (no repetir el mismo día).
- Renovación con solicitud simplificada: reutiliza el módulo de solicitudes, que **aún no está implementado** (D1).
- Permiso ya vencido → 422 «debe radicar una nueva solicitud».

**Tareas:**
- [x] `BE` **1230** — Implementar el proceso diario de avisos de vencimiento
- [x] `BE` **1231** — Implementar el flujo de renovación con precarga de datos — _solicitud simplificada radicada desde el carné; el enlace `renovado_desde` se fija al emitir (vía API, probado). Nota: la UI de emisión del gestor aún no expone el campo `renovadoDesde`; queda pendiente de definirse con UX._
- [x] `BE` **1232** — Implementar la extensión de la vigencia conservando el QR — ⚠ **reinterpretada por D2**: el permiso nuevo extiende la operación con `renovado_desde` y QR nuevo (nunca se muta el permiso anterior)
- [x] `FE` **1233** — Construir el aviso de vencimiento y el botón de renovación
- [x] `FE` **1234** — Construir el formulario simplificado de renovación
- [ ] `UX` **1235** — Diseñar los avisos de vencimiento y el flujo de renovación — _⏸ requiere humano_
- [x] `QA` **1236** — Probar el aviso, la renovación aprobada y el caso de permiso ya vencido

**Verificación de la historia:**
- [x] Plan de la historia aprobado antes de codificar (sección 0, punto 2)
- [x] Todos los CA de HU-34 marcados (CA3 ajustado por D2 con aval del usuario), cada uno con prueba automatizada en verde (comando y resultado en la sección 8)
- [x] Checklist «terminado» de AGENTS §12 cumplido en cada tarea
- [x] Swagger actualizado y coherente con los DTOs de HU-34
- [x] Sin dependencias, archivos ni cambios de esquema fuera de lo aprobado; sin commits

### 6. HU-37 - Gestor municipal consulta el historial y la trazabilidad de los permisos  _(Jira 137)_
**Prioridad:** Should · **Puntos:** 3 · **Rol:** Gestor · **Depende de:** HU-31 (Gestor municipal emite el permiso digital con código QR), HU-33 (Ciudadano verifica la legalidad de un puesto escaneando su QR) · **Decisiones abiertas:** D6, D9, D10

> **Como** gestor municipal **quiero** buscar un permiso y ver su ciclo de vida completo, incluidas las verificaciones por QR **para** auditar el uso del espacio público.

**Criterios de aceptación** (cada uno requiere ≥ 1 prueba automatizada en verde):
- [x] **HU-37-CA1** — **Dado que** busco un permiso por número, titular o espacio, **cuando** abro su detalle, **entonces** veo su emisión, renovaciones, suspensiones y revocaciones en orden cronológico. (Playwright `e2e/permisos.spec.ts` trazabilidad + e2e API listado)
- [x] **HU-37-CA2** — **Dado que** filtro por estado y rango de fechas, **cuando** aplico, **entonces** la lista se actualiza. (e2e API `test/permisos.e2e-spec.ts` HU-37-CA2 + UI con filtros)
- [x] **HU-37-CA3** — **Dado que** el permiso fue verificado por ciudadanos, **cuando** abro su trazabilidad, **entonces** veo cuántas veces y cuándo fue consultado. (e2e API trazabilidad con `verificaciones: { total, ultima }` + UI)

**Ajustes según AGENTS.md:**
- Solo lectura para gestor: unir `permiso_eventos` (emisión, renovaciones, suspensiones, revocaciones, orden cronológico) y el conteo/fechas de `verificaciones_qr`. Paginación estándar `?pagina=1&limite=20` → `{ datos, paginacion }` (revisa el DTO real de módulos existentes).
- Búsqueda por número, titular o espacio con Prisma parametrizado o `Prisma.sql`; **prohibido `$queryRawUnsafe`** y concatenar.
- Tarea 1251 (índices): es un **cambio de esquema** → no lo hagas por tu cuenta. Revisa qué índices ya existen en `01_creacion_bd.sql` y, si faltan, **propón el SQL** (nuevo script en `dataBase/`) y espera aprobación (D10).
- No escribas nada en `auditoria`: solo los triggers la escriben.

**Tareas:**
- [x] `BE` **1250** — Implementar la consulta agregada del historial del permiso
- [x] `BE` **1251** — Crear los índices de búsqueda por número, titular y espacio — _aprobado por D10: `dataBase/17_permisos_hu37.sql` (pg_trgm) aplicado a la BD_
- [x] `FE` **1252** — Construir la vista de trazabilidad con línea de tiempo
- [x] `FE` **1253** — Construir la búsqueda y los filtros de permisos
- [ ] `UX` **1254** — Diseñar la vista de trazabilidad — _⏸ requiere humano_
- [x] `QA` **1255** — Probar la búsqueda, los filtros y la integridad del historial

**Verificación de la historia:**
- [x] Plan de la historia aprobado antes de codificar (sección 0, punto 2)
- [x] Todos los CA de HU-37 marcados, cada uno con prueba automatizada en verde (comando y resultado en la sección 8)
- [x] Checklist «terminado» de AGENTS §12 cumplido en cada tarea
- [x] Swagger actualizado y coherente con los DTOs de HU-37
- [x] Sin dependencias, archivos ni cambios de esquema fuera de lo aprobado; sin commits

### 7. HU-36 - Comerciante paga el uso de suelo de forma simulada y descarga su recibo  _(Jira 136)_
**Prioridad:** Could · **Puntos:** 5 · **Rol:** Comerciante · **Depende de:** HU-20 (Gestor municipal aprueba o rechaza solicitudes y asigna el espacio) · **Decisiones abiertas:** D4, D5, D6, D9, D11

> **Como** comerciante **quiero** ver el valor de mi cobro, simular el pago y descargar el recibo **para** completar el trámite de mi permiso sin transacciones reales.

**Criterios de aceptación** (cada uno requiere ≥ 1 prueba automatizada en verde):
- [x] **HU-36-CA1** — **Dado que** mi solicitud fue aprobada, **cuando** abro «Pagos», **entonces** veo el valor a pagar y el estado «Pendiente». (Playwright `e2e/cobros.spec.ts` CA1: valor formateado y etiqueta Pendiente)
- [x] **HU-36-CA2** — **Dado que** confirmo el pago simulado, **cuando** acepto, **entonces** el estado cambia a «Pagado», se genera un recibo y no se ejecuta ninguna transacción real ni se piden datos de tarjeta. (Playwright CA2: aviso permanente «Pago simulado…», transición a Pagado y descarga `recibo-COB-*.pdf`)
- [x] **HU-36-CA3** — **Dado que** el gestor consulta el permiso, **cuando** revisa su cobro, **entonces** ve el estado de pago actualizado. (Playwright CA3: el detalle del gestor muestra el cobro `pagado` con `pagadoEn`)

⚠ **Ajuste por D4**: el estado «Vencido» del backlog no existe en `estado_cobro` (`pendiente | pagado | anulado`); se presentan solo los estados reales (decisión del 2026-11-23).

**Ajustes según AGENTS.md:**
- ⚠ **Conflicto (D4):** el backlog pide estados «Pendiente, Pagado y Vencido», pero el enum real `estado_cobro` es `pendiente | pagado | anulado` (sin `vencido`). No inventes el valor ni cambies el enum: propón (a) derivar «vencido» al presentar (si existe una fecha límite en `cobros`) o (b) una migración aprobada.
- Flujo §11.7: **permiso → cobro `pendiente`** con la tarifa vigente de categoría/zona (`tarifas`) → pago simulado → `pagado` + recibo. El backlog lo ata a la solicitud aprobada (HU-20); confirma de dónde nace el cobro (D11).
- **Pago SIEMPRE simulado:** sin pasarela, sin SDK de pagos, sin datos de tarjeta; aviso visible «Pago simulado: no se realiza ninguna transacción real» (§9.12). Solo el comerciante dueño paga; el gestor ve el estado.
- Recibo en PDF → dependencia nueva (D5). Montos `NUMERIC` ⇒ `Prisma.Decimal`; no uses `number` ni casts.
- Es prioridad *Could*: va al final y puede diferirse si no alcanza el sprint (anótalo en la sección 9).

**Tareas:**
- [x] `BE` **1243** — Implementar el modelo de cobro con tarifas por zona y tipo de actividad
- [x] `BE` **1244** — Implementar el simulador de pago con estados (Pendiente, Pagado y Vencido) — ⚠ **sin «Vencido»** (decisión D4: el enum real no lo tiene)
- [x] `BE` **1245** — Implementar la generación del recibo en PDF
- [x] `FE` **1246** — Construir la pantalla de pagos con aviso visible de simulación
- [x] `FE` **1247** — Implementar la descarga del recibo
- [ ] `UX` **1248** — Diseñar la pantalla de pagos y el recibo — _⏸ requiere humano_
- [x] `QA` **1249** — Probar las transiciones de estado y la ausencia de transacciones reales

**Verificación de la historia:**
- [x] Plan de la historia aprobado antes de codificar (sección 0, punto 2)
- [x] Todos los CA de HU-36 marcados, cada uno con prueba automatizada en verde (comando y resultado en la sección 8)
- [x] Checklist «terminado» de AGENTS §12 cumplido en cada tarea
- [x] Swagger actualizado y coherente con los DTOs de HU-36
- [x] Sin dependencias, archivos ni cambios de esquema fuera de lo aprobado; sin commits

## 6. Cierre del sprint
- [x] Historias en ✅, con las tareas `UX` (1217, 1228, 1241, 1248, 1235, 1254) diferidas explícitamente porque requieren diseño humano; 1214 ⏸ por D1
- [x] Compilación y lint limpios (backend y frontend), con los scripts reales de cada `package.json` (`pnpm build`, `pnpm lint`, `pnpm exec tsc --noEmit`, Prettier aplicado a los archivos nuevos)
- [x] Tests unitarios y e2e del backend (Jest/Supertest) en verde: **602/602 unitarias, 233/233 e2e**; frontend Vitest **158/158**; Playwright de Sprint 5 **21/21** contra la BD real con seed
- [x] Prueba de privacidad: la respuesta pública de HU-33 no contiene datos fuera de los permitidos en AGENTS §9.5 (prueba exacta de campos en e2e API + Playwright CA4)
- [x] Prueba de seguridad: throttler activo en el endpoint público (429 con `Retry-After`); 401/403 por rol y control de propiedad (IDOR → 404) en endpoints protegidos
- [x] Ningún `500` por violaciones de unicidad/EXCLUDE/trigger (mapeados a 409/422 y probados en e2e)
- [ ] Verificado en 360 px y escritorio — el carné y la verificación usan el design system mobile-first (táctil ≥ 44 px, `sm:` breakpoints), pero la corrida Playwright usa el perfil `Desktop Edge` existente; falta una pasada visual en 360 px por QA humano
- [x] Matriz CA ↔ prueba completa (cada CA cita su prueba en la sección 5) y resumen entregado al Product Owner (informe de cierre en el chat de implementación)
- [x] Reporte de lo que **no** se verificó o quedó pendiente: tareas UX (humanas), 1214 (⏸ D1), campo `renovadoDesde` aún no expuesto en la UI de emisión (API probada), corrida visual a 360 px, cámara del escáner no automatizable en el navegador de pruebas (se cubre con la entrada manual)

## 7. Prioridad cuando falte tiempo
Primero HU-31, HU-33 y HU-32 (*Must*), luego HU-35 y HU-37 (*Should*), después HU-34 si D1/D2 se resolvieron, y por último HU-36 (*Could*).

## 8. Registro de avance (una línea por tarea terminada)

| Fecha | ID tarea | Qué se hizo | Comando de verificación y resultado | Pendiente |
|---|---|---|---|---|
| 2026-11-23 | 1212/1213 | Módulo `src/permisos/` con emisión manual: `INSERT` sin `numero`/`qr_token` (los genera la BD); lectura del token en DTOs | `pnpm test -- --runInBand` → 602/602; spec unitaria verifica que el INSERT no contiene `qr_token`/`numero` | — |
| 2026-11-23 | 1215 | Notificación `permiso_emitido` al titular dentro de la transacción (sin correo) | Playwright `e2e/permisos.spec.ts` → notificación visible para el titular | — |
| 2026-11-23 | 1216/1218 | UI de emisión en el detalle de solicitud aprobada + pruebas de emisión, unicidad y tiempo (< 2 s) | `pnpm exec playwright test e2e/permisos.spec.ts …` → 21/21 en las 4 suites; emisión medida < 2000 ms | 1214 (⏸ D1) |
| 2026-11-23 | 1224/1225 | `GET /verificaciones/:qrToken` público con throttler 30/min, datos mínimos y registro en `verificaciones_qr` | `pnpm test:e2e -- --runInBand` → 233/233; `test/verificacion-rate-limit.e2e-spec.ts` → 429 con `Retry-After` | — |
| 2026-11-23 | 1226/1227/1229 | `/verificar` con escáner de cámara (html5-qrcode) + entrada manual y pantalla de resultado con texto/ícono | Playwright `e2e/verificar.spec.ts` → CA1-CA4 en verde contra la BD real | 1228 (⏸ UX) |
| 2026-11-23 | 1219/1220/1221/1223 | `GET /permisos/mios…` + carné PDF (pdfkit+qrcode) con estado visible; descarga desde el celular | Playwright descarga `carne-PER-*.pdf`; e2e API valida `%PDF` y `Content-Disposition` | 1222 (⏸ UX) |
| 2026-11-23 | 1237/1238/1239/1240/1242 | `PATCH /gestor/permisos/:id/estado` con `app.actor_id`+`app.motivo`; historial leído de `permiso_eventos` (trigger); UI con modales de motivo | Playwright: suspensión → QR no vigente inmediato; reactivación → mismo QR válido; trazabilidad con 4 eventos | 1241 (⏸ UX) |
| 2026-11-23 | 1230/1233/1234/1236 | Cron diario idempotente de avisos (`@nestjs/schedule`), aviso+botón «Renovar» y radicación simplificada precargada | Unitarias (avisos idempotentes por día) + Playwright renovación radicada `SOL-…`; 422 si venció | Campo `renovadoDesde` aún no expuesto en la UI de emisión |
| 2026-11-23 | 1231/1232 | Emisión con `renovadoDesde` (permiso nuevo enlazado, D2) vía API | Unitarias + e2e API `test/permisos.e2e-spec.ts` (renovación enlazada y titular distinto → 422) | Exposición en UI con UX |
| 2026-11-23 | 1250/1252/1253/1255 | `GET /gestor/permisos` con búsqueda/filtros/paginación y `GET …/:id/trazabilidad` (eventos + verificaciones) | `pnpm test:e2e -- --runInBand` → 233/233; Playwright trazabilidad en verde | 1254 (⏸ UX) |
| 2026-11-23 | 1251 | `dataBase/17_permisos_hu37.sql`: `pg_trgm` + GIN en `usuarios.nombre/apellido` y `espacios_temporales.nombre` | `psql -U postgres -d sgp_tulua -f 17_permisos_hu37.sql` → OK (índices creados) | — |
| 2026-11-23 | 1243/1244/1245/1246/1247/1249 | `src/cobros/`: cobro automático al emitir (D11), pago simulado `POST /cobros/mios/:id/pago`, recibo PDF, pantalla con aviso permanente | Playwright `e2e/cobros.spec.ts` → CA1-CA3; e2e API 409/422/404 en transiciones | 1248 (⏸ UX) |

## 9. Decisiones tomadas y bloqueos

| Fecha | ID | Decisión o respuesta del usuario |
|---|---|---|
| 2026-11-23 | D1 | Solo emisión manual `POST /gestor/permisos` (HU-20 ya existía en el repo); 1214 queda ⏸ diferida |
| 2026-11-23 | D2 | Renovación = **permiso nuevo** con `renovado_desde` + solicitud nueva simplificada; QR nuevo; CA3 de HU-34 se ajusta con el PO |
| 2026-11-23 | D3 | Vigencia calculada por fecha en la verificación pública (estado `vigente` + hoy dentro del rango); nadie escribe `estado='vencido'` |
| 2026-11-23 | D4 | No se presenta «Vencido» en cobros: estados reales `pendiente\|pagado\|anulado`; desviación del backlog documentada |
| 2026-11-23 | D5 | Aprobadas: `qrcode`, `pdfkit`, `@nestjs/schedule` (+tipos) backend; `qrcode`, `html5-qrcode` frontend |
| 2026-11-23 | D6 | Aprobadas rutas/archivos: `src/permisos/`, `src/cobros/`, `test/*.e2e-spec.ts`, `features/permisos|cobros|verificacion/`, páginas `(publico)/verificar…`, `(comerciante)/comerciante/permisos` y `/pagos`, `(gestor)/gestor/permisos`, `e2e/permisos|verificar|cobros.spec.ts` |
| 2026-11-23 | D7 | Verificación pública muestra solo el **estado** (suspendido/revocado/vencido), nunca el texto del motivo del gestor; CA2 de HU-33 se ajusta con el PO |
| 2026-11-23 | D8 | Cualquier gestor activo puede emitir/suspender/levantar/revocar (mientras el PO no defina lo contrario) |
| 2026-11-23 | D9 | Resuelta leyendo `01_creacion_bd.sql`/`baseDatos.md`: el trigger no restringe transiciones, solo exige motivo en suspender/revocar; columnas citadas en el plan |
| 2026-11-23 | D10 | Aprobado `dataBase/17_permisos_hu37.sql` con índices pg_trgm (GIN); aplicado a `sgp_tulua` |
| 2026-11-23 | D11 | Cobro automático al emitir el permiso, en la misma transacción: tarifa específica zona+actividad → general → sin cobro |
| 2026-11-23 | Extra | El QR codifica `${FRONTEND_URL}/verificar/<qrToken>`; tipos de notificación nuevos `permiso_suspendido`/`permiso_reactivado`/`permiso_revocado` |
| 2026-11-23 | Corrección | Hallazgo durante QA: Prisma devuelve los `DATE` a medianoche **UTC**; el formateo local desplazaba las fechas un día. Corregido a la convención `toISOString()` del repo y verificado contra la BD |
