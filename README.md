# SGP Tuluá — Plataforma de Gestión del Espacio Público

Aplicación web responsive (PWA) para ordenar socioeconómicamente el uso del espacio público del municipio de **Tuluá, Valle del Cauca**: censo de comercio formal e informal, asignación temporal de espacios, ferias agroecológicas, permisos digitales con código QR y panel analítico para la Alcaldía.

**Equipo 6 — Alcaldía Municipal de Tuluá.**

---

## 1. Arquitectura

El repositorio contiene **dos aplicaciones independientes**, cada una con su `package.json` y su lockfile. El gestor de paquetes en todo el proyecto es **pnpm** (no mezclar con npm ni yarn).

| Aplicación | Carpeta | Stack | Puerto |
|---|---|---|---|
| API REST | `/` (raíz) | NestJS 12 · TypeScript estricto · Prisma 7 · PostgreSQL 18 + PostGIS 3.6 · JWT con refresh token · Swagger | `3000` |
| Frontend web | `frontend/` | Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · TypeScript estricto | `3001` |

Decisiones de integración:

- La API se expone **sin prefijo global**: las rutas comienzan en `/auth`, `/usuarios`, `/perfil`, `/gestor`, `/panel`, `/organizadores`, `/notificaciones`, `/zonas`, `/modulos`, `/espacios`, `/productos` e `/importaciones`.
- El backend permite por CORS el origen `http://localhost:3001` (variable `FRONTEND_URL`).
- El frontend define `NEXT_PUBLIC_API_URL=http://localhost:3000` (ver `frontend/.env.example`).
- **Todas** las peticiones HTTP del frontend pasan por un único archivo: `frontend/src/lib/api-client.ts` (header `Authorization`, renovación automática de sesión ante un `401`, control de `Retry-After` y manejo de errores).
- Documentación interactiva de la API: `http://localhost:3000/api/docs`.

---

## 2. Estructura del repositorio

```text
.
├── prisma/                 # Esquema ORM (baselining sobre el SQL real)
├── src/                    # Backend NestJS
│   ├── auth/               # Login, refresh, logout, primer acceso de gestores
│   ├── usuarios/           # Registro, activación, recuperación de contraseña
│   ├── perfil/             # Perfil de comerciante y organizador
│   ├── organizadores/      # Organización propia del organizador
│   ├── gestor/             # Cuentas, organizaciones, perfil y auditoría
│   ├── panel/              # Indicadores iniciales del gestor
│   ├── notificaciones/     # Bandeja de notificaciones
│   ├── zonas/              # Zonas normativas, GeoJSON público e historial
│   ├── modulos/            # Censo de módulos y puestos del espacio público
│   ├── espacios/           # Espacios temporales, consulta, bloqueos y estados
│   ├── productos/          # Catálogo maestro de productos permitidos
│   ├── importaciones/      # Importación de zonas GeoJSON y módulos CSV
│   ├── correo/             # Envío de códigos y credenciales temporales
│   └── common/             # Filtros de error, auditoría, serialización
├── test/                   # Tests e2e
├── docs/                   # Guías por módulo y contrato de la API
└── frontend/               # Aplicación Next.js (Sprints 1 y 2)
    └── src/
        ├── app/(publico)/  # Rutas accesibles sin sesión (incluye /mapa)
        ├── app/(comerciante)/ # Inicio, perfil y consulta de espacios
        ├── app/(organizador)/ # Inicio, perfil y organización
        ├── app/(gestor)/   # Panel, zonas, módulos, espacios, importaciones, usuarios
        ├── components/ui/  # Design system propio (botones, campos, badges…)
        ├── features/       # Módulos funcionales del frontend
        ├── lib/            # api-client, sesión, validaciones
        ├── hooks/          # useSesion, useConsultaApi
        └── types/          # Tipos derivados de docs/Uso_endpoints.md
```

---

## 3. Requisitos previos

- Node.js 20 o superior (verificado con v24).
- pnpm 11 o superior (`corepack enable` o `npm install -g pnpm`).
- PostgreSQL 18 con la extensión **PostGIS 3.6**, y la base de datos `sgp_tulua` creada con los scripts SQL de `dataBase/`.

---

## 4. Instalación y arranque

### 4.1 Backend (terminal 1)

```bash
pnpm install                 # instala las dependencias de la raíz
cp .env.example .env         # y completa DATABASE_URL, JWT_SECRET, PORT=3000,
                             # FRONTEND_URL=http://localhost:3001, etc.
pnpm start:dev               # modo watch en http://localhost:3000
```

Swagger queda disponible en `http://localhost:3000/api/docs`.

> Las credenciales reales de la base de datos viven **solo** en tu `.env` local. Nunca se commitean.

### 4.2 Frontend (terminal 2)

```bash
cd frontend
pnpm install
pnpm dev                     # http://localhost:3001
```

`frontend/.env.local` ya trae `NEXT_PUBLIC_API_URL=http://localhost:3000`.

---

## 5. Guía de comandos

### Backend (desde la raíz)

| Comando | Qué hace |
|---|---|
| `pnpm install` | Instala dependencias |
| `pnpm start:dev` | Arranca la API en modo watch (`:3000`) |
| `pnpm build` | Compila el backend (`nest build`) |
| `pnpm lint` | Lint con oxlint (`src/` y `test/`) |
| `pnpm format` | Formatea con Prettier |
| `pnpm test` | Tests unitarios (Jest) |
| `pnpm test:e2e` | Tests de integración (Supertest) |
| `pnpm test:cov` | Cobertura |

### Frontend (desde `frontend/`)

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo (`:3001`) |
| `pnpm build` | Build de producción (compila + typecheck) |
| `pnpm start` | Sirve el build de producción |
| `pnpm lint` | Lint con ESLint + `eslint-config-next` |
| `pnpm test` | Pruebas unitarias con Vitest |
| `pnpm test:e2e` | Pruebas de usabilidad con Playwright (levanta API y frontend) |

---

## 6. Cómo probar la app

### 6.1 Punto de partida

1. Levanta el backend (`pnpm start:dev`) y el frontend (`cd frontend && pnpm dev`).
2. Abre `http://localhost:3001`.

### 6.2 Los códigos de verificación salen en el log del backend

Si `MAIL_HOST` **no** está configurado en el `.env` del backend, no se envía ningún correo: el código de activación de 6 dígitos, el código de recuperación de contraseña y la contraseña temporal de los gestores **se imprimen en la consola de `pnpm start:dev`**. Es la forma de probar la activación y la recuperación desde el frontend.

### 6.3 Credenciales de prueba

| Correo | Contraseña | Rol / estado |
|---|---|---|
| `admin@tulua.gov.co` | `Admin1234` | Gestor administrador |
| `revisor@tulua.gov.co` | `Admin1234` | Gestor revisor |
| `maria.gomez@gmail.com` | `Comerciante123` | Comerciante activa |
| `jose.perez@hotmail.com` | `Comerciante123` | Comerciante activa |
| `ana.ruiz@gmail.com` | `Comerciante123` | Comerciante activa |
| `pedro.sanchez@gmail.com` | `Comerciante123` | Comerciante pendiente de activación |
| `luis.alvarez@agrovalle.org` | `Organizador123` | Organizador activo con organización activa |
| `marta.cifuentes@asocampesinos.org` | `Organizador123` | Organizador con organización pendiente de validación |

### 6.4 Flujo mínimo para validar el frontend

1. **Comerciante:** `/registro/comerciante` → crear cuenta → copiar el código del log del backend → `/activar` → iniciar sesión → el navbar muestra el nombre y el rol → cerrar sesión.
2. **Gestor:** iniciar sesión con `admin@tulua.gov.co` / `Admin1234` → debe quedar en `/gestor/panel`.
3. **Recuperación:** `/recuperar` → copiar el código del log → `/restablecer` → nueva contraseña → login con la nueva clave.
4. **Errores de seguridad:** 5 contraseñas incorrectas seguidas producen el bloqueo temporal (`423`) que el formulario muestra con los minutos restantes; el límite de peticiones por IP (`429`) muestra los segundos a esperar.

### 6.5 Verificación técnica

```bash
cd frontend
pnpm lint      # debe quedar sin errores
pnpm build     # debe compilar las 39 páginas/rutas
```

---

## 7. Estado del avance

| Sprint | Alcance | Estado |
|---|---|---|
| **1** | Autenticación y gestión de usuarios (HU-01 a HU-07) | **Completo**: backend (36 endpoints) y frontend (ver `docs/avance_frontend.md`) |
| **2** | Geo-Portal y zonas (HU-08 a HU-15) | **Completo**: mapa público; espacios con tabla, mapa, agrupación, ficha responsive y filtros; editor de zonas, baja lógica, versionado e historial; censo de módulos; administración de espacios temporales con bloqueos, estados y auditoría; importación de GeoJSON y CSV con previsualización y reporte de errores. La búsqueda de calles/barrios de HU-10 quedó fuera de alcance |
| **3** | Solicitudes y asignación de espacio | **Pendiente** (las tablas y los datos de prueba ya existen; no hay endpoints ni pantallas) |
| **4** | Simulador de factibilidad y densidad | **Pendiente** (el motor de reglas existe en PostgreSQL, pero no está expuesto en la API ni en la interfaz) |
| **5** | Permisos con QR y cobros simulados | **Pendiente** (el modelo y el seed existen; no hay endpoints ni pantallas) |
| **6** | Dashboard e indicadores | **Pendiente** (el panel solo muestra los indicadores básicos de `GET /panel`) |

### Frontend: qué está implementado hoy

El frontend tiene **39 rutas** de página y está verificado con `lint`, `build`, Vitest y Playwright.

**Públicas:** `/` · `/mapa` · `/login` · `/registro` · `/registro/comerciante` · `/registro/organizador` · `/activar` · `/recuperar` · `/restablecer` · `/primer-acceso`

**Comerciante:** `/comerciante/inicio` · `/comerciante/perfil` · `/comerciante/espacios`

**Organizador:** `/organizador/inicio` · `/organizador/perfil` · `/organizador/mi-organizacion`

**Gestor:** `/gestor/panel` · `/gestor/perfil` · `/gestor/zonas` · `/gestor/zonas/nueva` · `/gestor/zonas/[id]/editar` · `/gestor/zonas/[id]/historial` · `/gestor/modulos` · `/gestor/modulos/nuevo` · `/gestor/modulos/[id]` · `/gestor/modulos/[id]/editar` · `/gestor/espacios` · `/gestor/espacios/nuevo` · `/gestor/espacios/[id]` · `/gestor/espacios/[id]/editar` · `/gestor/importaciones` · `/gestor/usuarios` · `/gestor/usuarios/[id]` · `/gestor/comerciantes` · `/gestor/organizaciones` · `/gestor/organizaciones/[id]` · `/gestor/gestores/nuevo` · `/gestor/auditoria`

**Transversal:** `/notificaciones`

Incluye: design system mobile-first (360 px, WCAG AA), estados de carga/vacío/error/éxito, sesión con `GET /auth/me` y `POST /auth/logout` en el navbar, rotación de refresh tokens, manejo de los códigos HTTP 401/403/423/429, el Geo-Portal público con Leaflet, la consulta de espacios del comerciante en `/comerciante/espacios` (tabla, mapa con agrupación, ficha en panel lateral/hoja inferior y filtros por sector, actividad, fecha y horario), el censo de módulos, la administración completa de espacios temporales en `/gestor/espacios`, y la importación de zonas/módulos en `/gestor/importaciones` con previsualización en mapa y reporte de errores descargable.

### Frontend: qué falta

- Módulos de los Sprints 3 a 6: solicitudes, ferias, permisos QR, cobros y dashboard analítico. La consulta de espacios ya existe, pero todavía **no hay botón ni formulario para solicitar** el uso de un espacio.
- El buscador de calles/barrios de HU-10 quedó fuera de alcance.

---

## 8. Documentación de referencia

| Documento | Contenido |
|---|---|
| `docs/Manual.md` | Manual de usuario completo: qué es la plataforma, cómo funciona y cómo usarla por rol |
| `docs/Uso_endpoints.md` | Contrato de la API del Sprint 1 (el frontend se construyó sobre este documento) |
| `docs/Uso_zonas.md` | Zonas, catálogo de productos, GeoJSON público e historial versionado |
| `docs/Uso_espacios.md` | Consulta de espacios y administración municipal de espacios y bloqueos |
| `docs/Uso_modulos.md` | Censo de módulos y puestos de comercio formal e informal |
| `docs/Uso_importaciones.md` | Importación de zonas (GeoJSON) y módulos (CSV) |
| `docs/` | Guías por módulo: `baseDatos.md`, `gestor.md`, `perfil.md`, `organizadores.md`, `panel.md`, `resumen.md`, `swagger.md`, `avance_frontend.md`, `implementaciones_Sprint2.md` |
| `.opencode/AGENTS.md` | Reglas del proyecto para agentes de IA (fuente de verdad) |
