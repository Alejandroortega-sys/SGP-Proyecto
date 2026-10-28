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
| `pnpm start` | Sirve el build de producción |
| `pnpm lint` | Lint con ESLint y `eslint-config-next` |

---

## Estructura

```text
src/
├── app/
│   ├── layout.tsx              # Layout raíz (tipografía Inter, metadata)
│   ├── globals.css             # Design system (tokens de color institucionales)
│   └── (publico)/              # Route group de rutas sin sesión
│       ├── page.tsx            # /              bienvenida
│       ├── login/              # /login         inicio de sesión
│       ├── registro/           # /registro, /registro/comerciante, /registro/organizador
│       ├── activar/            # /activar       código OTP de 6 dígitos
│       ├── recuperar/          # /recuperar     solicitar código
│       ├── restablecer/        # /restablecer   nueva contraseña
│       └── primer-acceso/      # /primer-acceso gestor invitado
├── components/ui/              # Design system propio: boton, tarjeta, campo,
│                               # alerta, etiqueta (badges), spinner, iconos
├── features/publico/           # Navbar, footer y formularios
├── hooks/use-sesion.ts         # Restaura la sesión con GET /auth/me
├── lib/
│   ├── api-client.ts           # ÚNICO punto de HTTP (token, refresh, errores)
│   ├── sesion.ts               # accessToken / refreshToken / usuario
│   └── validaciones.ts         # Reglas espejo de los DTOs del backend
└── types/api.ts                # Tipos derivados de docs/Uso_endpoints.md
```

---

## Reglas de integración

- **Prohibido** hacer `fetch` con URLs absolutas fuera de `src/lib/api-client.ts`.
- Los IDs (`BIGINT`) llegan como **string**: comparar siempre `id === "1"`, nunca convertirlos a número.
- El backend responde `message` como `string | string[]`; el cliente los normaliza antes de mostrarlos.
- Ante un `401` con sesión se intenta **una sola vez** `POST /auth/refresh`; si falla, se borran los tokens y se redirige a `/login`.
- Los tokens viven en `sessionStorage` (recomendación del contrato del Sprint 1).
- Las rutas de los roles (`/comerciante/*`, `/organizador/*`, `/gestor/*`) **aún no existen**: tras el login se redirige a `/`.

---

## Rutas implementadas (Sprint 1, públicas)

`/` · `/login` · `/registro` · `/registro/comerciante` · `/registro/organizador` · `/activar` · `/recuperar` · `/restablecer` · `/primer-acceso`

Los módulos de mapa, solicitudes, ferias, permisos QR, cobros y dashboard (Sprints 2 a 6) se muestran como "Próximamente" y no consumen endpoints inexistentes.

---

## Verificación

```bash
pnpm lint      # ESLint sin errores
pnpm build     # build verde (10 rutas)
```

Para probar los flujos contra la API real, consulta la sección *"Cómo probar la app"* del README de la raíz (los códigos de activación salen en el log del backend si `MAIL_HOST` está vacío).
