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

- La API se expone **sin prefijo global**: las rutas comienzan en `/auth`, `/usuarios`, `/perfil`, `/gestor`, `/panel`, `/organizadores`, `/notificaciones`.
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
│   ├── gestor/             # Administración de cuentas, organizaciones, auditoría
│   ├── panel/              # Indicadores iniciales del gestor
│   ├── notificaciones/     # Bandeja de notificaciones
│   ├── correo/             # Envío de códigos y credenciales temporales
│   └── common/             # Filtros de error, auditoría, serialización
├── test/                   # Tests e2e
├── docs/                   # Guías por módulo y contrato de la API
└── frontend/               # Aplicación Next.js (Sprint 1)
    └── src/
        ├── app/(publico)/  # Rutas accesibles sin sesión
        ├── components/ui/  # Design system propio (botones, campos, badges…)
        ├── features/publico/ # Navbar, footer y formularios públicos
        ├── lib/            # api-client, sesión, validaciones
        ├── hooks/          # useSesion
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
| `pedro.sanchez@gmail.com` | `Comerciante123` | Comerciante pendiente de activación |
| `luis.alvarez@agrovalle.org` | `Organizador123` | Organizador activo con organización activa |
| `marta.cifuentes@asocampesinos.org` | `Organizador123` | Organizador con organización pendiente de validación |

### 6.4 Flujo mínimo para validar el frontend

1. **Comerciante:** `/registro/comerciante` → crear cuenta → copiar el código del log del backend → `/activar` → iniciar sesión → el navbar muestra el nombre y el rol → cerrar sesión.
2. **Gestor:** iniciar sesión con `admin@tulua.gov.co` / `Admin1234` → debe quedar en `/gestor/panel`.
3. **Recuperación:** `/recuperar` → copiar el código del log → `/restablecer` → nueva contraseña → login con la nueva clave.
4. **Errores de seguridad:** 3 contraseñas incorrectas seguidas producen el bloqueo temporal (`423`) que el formulario muestra con los minutos restantes; el límite de peticiones por IP (`429`) muestra los segundos a esperar.

### 6.5 Verificación técnica

```bash
cd frontend
pnpm lint      # debe quedar sin errores
pnpm build     # debe compilar las 10 rutas
```

---

## 7. Estado del avance

| Sprint | Alcance | Estado |
|---|---|---|
| **1** | Autenticación y gestión de usuarios (HU-01 a HU-07) | Backend **completo** (36 endpoints); frontend implementado (ver `docs/avance_frontend.md`) |
| **2** | Geo-Portal y zonas (HU-08 a HU-15) | **HU-08 implementada** (mapa Leaflet, GeoJSON con zoom y geolocalización) y backend de zonas completo; faltan HU-09, HU-10, HU-13, HU-14, HU-15 y la UI de HU-11/HU-12 |
| **3** | Solicitudes y asignación de espacio | Pendiente |
| **4** | Simulador de factibilidad y densidad | Pendiente |
| **5** | Permisos con QR y cobros simulados | Pendiente |
| **6** | Dashboard e indicadores | Pendiente |

### Frontend: qué está implementado hoy

Rutas públicas funcionales, verificadas con `lint`, `build` y render HTTP 200:

`/` · `/mapa` · `/login` · `/registro` · `/registro/comerciante` · `/registro/organizador` · `/activar` · `/recuperar` · `/restablecer` · `/primer-acceso`

Además, paneles protegidos por rol: `/comerciante/*`, `/organizador/*` y `/gestor/*`.

Incluye: design system mobile-first (360 px, WCAG AA), estados de carga/vacío/error/éxito, sesión con `GET /auth/me` y `POST /auth/logout` en el navbar, rotación de refresh tokens, manejo de los códigos HTTP 401/403/423/429 y el Geo-Portal público con Leaflet.

### Frontend: qué falta

- Módulos de los Sprints 3 a 6: solicitudes, ferias, permisos QR, cobros y dashboard analítico.
- Del Sprint 2: catálogo de espacios (HU-09), filtros y búsqueda (HU-10), censo de módulos (HU-13), importación (HU-14), espacios temporales y bloqueos (HU-15), y la interfaz de administración de zonas (HU-11/HU-12).

---

## 8. Documentación de referencia

| Documento | Contenido |
|---|---|
| `docs/Uso_endpoints.md` | Contrato completo de la API del Sprint 1 (el frontend se construyó sobre este documento) |
| `docs/` | Guías por módulo: `baseDatos.md`, `gestor.md`, `perfil.md`, `organizadores.md`, `panel.md`, `resumen.md`, `swagger.md` |
| `.opencode/AGENTS.md` | Reglas del proyecto para agentes de IA (fuente de verdad) |
