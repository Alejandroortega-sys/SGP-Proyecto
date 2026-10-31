# SGP Tuluá — Frontend

Interfaz web de la **Plataforma de Gestión del Espacio Público, Ferias Agroecológicas y Comercio Formal/Informal de Tuluá** (Alcaldía de Tuluá, Equipo 6).

Aplicación **Next.js 16 (App Router)** con React 19, Tailwind CSS 4 y TypeScript estricto, corriendo en el puerto **3001**.

> El README completo del proyecto (arquitectura, estados por sprint, credenciales de prueba y guía de comandos) está en la [raíz del repositorio](../README.md).

---

## Requisitos

- pnpm 11 o superior (este proyecto no usa npm ni yarn).
- El backend NestJS de la raíz corriendo en `http://localhost:3000` para poder iniciar sesión o registrarse.

---

## Arranque

```bash
cd frontend
pnpm install
pnpm dev        # http://localhost:3001
```

La variable `NEXT_PUBLIC_API_URL` (en `.env.local`, con ejemplo en `.env.example`) apunta a la API:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

El backend debe tener `FRONTEND_URL=http://localhost:3001` para aceptar el origen por CORS.

---

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo en `http://localhost:3001` |
| `pnpm build` | Build de producción: compila y ejecuta el typecheck de TypeScript |
| `pnpm start` | Sirve el build de producción en `http://localhost:3001` |
| `pnpm lint` | Lint con ESLint y `eslint-config-next` |
| `pnpm test` | Pruebas unitarias con Vitest |
| `pnpm test:e2e` | Pruebas de usabilidad con Playwright (levanta API y frontend) |
| `pnpm test:e2e:headed` | Playwright con navegador visible |

---

## Estructura

```text
src/
├── app/
│   ├── layout.tsx              # Layout raíz (tipografía Inter, metadata)
│   ├── globals.css             # Design system (tokens de color institucionales)
│   ├── (publico)/              # Rutas sin sesión
│   │   ├── page.tsx            # /              bienvenida
│   │   ├── login/              # /login
│   │   ├── registro/           # /registro, comerciante y organizador
│   │   ├── activar/            # /activar       código OTP de 6 dígitos
│   │   ├── recuperar/          # /recuperar
│   │   ├── restablecer/        # /restablecer
│   │   └── primer-acceso/      # /primer-acceso gestor invitado
│   ├── (comerciante)/          # /comerciante/inicio y /comerciante/perfil
│   ├── (organizador)/          # inicio, perfil y mi-organizacion
│   ├── (gestor)/               # panel, usuarios, comerciantes,
│   │                           # organizaciones, gestores, auditoría y perfil
│   └── (sesion)/               # /notificaciones para cualquier rol
├── components/ui/              # Design system: boton, tarjeta, campo, tabla,
│                               # paginación, modal, alerta, etiqueta, spinner
├── features/
│   ├── publico/                # Navbar, footer y formularios públicos
│   ├── sesion/                 # GuardiaRol y MarcoSesion (navbar por rol)
│   ├── inicio/                 # Resumen de comerciante y organizador
│   ├── perfil/                 # Perfil editable + cambio de contraseña
│   ├── organizador/            # Onboarding y edición de la organización
│   ├── gestor/                 # Panel, listados, detalles, auditoría
│   └── notificaciones/         # Bandeja de notificaciones
├── hooks/
│   ├── use-sesion.ts           # Restaura la sesión con GET /auth/me
│   └── use-consulta-api.ts     # Carga, error y recarga de consultas
├── lib/
│   ├── api-client.ts           # ÚNICO punto de HTTP (36 endpoints)
│   ├── sesion.ts               # accessToken / refreshToken / usuario
│   ├── rutas.ts                # Redirección por rol
│   ├── formato.ts              # Fechas, roles, categorías y resúmenes
│   └── validaciones.ts         # Reglas espejo de los DTOs del backend
└── types/api.ts                # Contrato completo del Sprint 1
```

---

## Reglas de integración

- **Prohibido** hacer `fetch` con URLs absolutas fuera de `src/lib/api-client.ts`.
- Los IDs (`BIGINT`) llegan como **string**: comparar siempre `id === "1"`, nunca convertirlos a número.
- El backend responde `message` como `string | string[]`; el cliente los normaliza antes de mostrarlos.
- Ante un `401` con sesión se intenta **una sola vez** `POST /auth/refresh`; si falla, se borran los tokens y se redirige a `/login`.
- Los tokens viven en `sessionStorage` (recomendación del contrato del Sprint 1).
- Tras el login se redirige según el rol: `/comerciante/inicio`, `/organizador/inicio` o `/gestor/panel`.
- Los layouts de rol usan `GuardiaRol`; el backend sigue siendo la barrera real de autorización.

---

## Rutas implementadas (Sprint 1 completo)

**Públicas:** `/` · `/login` · `/registro` · `/registro/comerciante` · `/registro/organizador` · `/activar` · `/recuperar` · `/restablecer` · `/primer-acceso`

**Comerciante:** `/comerciante/inicio` · `/comerciante/perfil`

**Organizador:** `/organizador/inicio` · `/organizador/perfil` · `/organizador/mi-organizacion`

**Gestor:** `/gestor/panel` · `/gestor/perfil` · `/gestor/usuarios` · `/gestor/usuarios/[id]` · `/gestor/comerciantes` · `/gestor/organizaciones` · `/gestor/organizaciones/[id]` · `/gestor/gestores/nuevo` · `/gestor/auditoria`

**Transversal:** `/notificaciones`

Los módulos de mapa, solicitudes, ferias, permisos QR, cobros y dashboard (Sprints 2 a 6) se muestran como "Próximamente" y no consumen endpoints inexistentes. El detalle del avance y los pendientes está en [`docs/avance_frontend.md`](../docs/avance_frontend.md).

---

## Verificación

```bash
pnpm lint      # ESLint sin errores
pnpm test      # Vitest: funciones de rutas, formato y validaciones
pnpm test:e2e  # Playwright: flujos reales de todos los módulos
pnpm build     # build verde (27 rutas)
```

Las pruebas e2e usan **Microsoft Edge** (`channel: "msedge"`) y levantan la API y el
frontend automáticamente. Requieren la base de datos `sgp_tulua` con el seed aplicado.
El detalle de cobertura y resultados está en [`docs/avance_frontend.md`](../docs/avance_frontend.md).

Para probar los flujos contra la API real, consulta la sección *"Cómo probar la app"* del README de la raíz (los códigos de activación salen en el log del backend si `MAIL_HOST` está vacío).
