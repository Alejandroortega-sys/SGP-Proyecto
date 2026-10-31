# Avance del frontend — Sprint 1 completo

**Fecha:** octubre de 2026
**Alcance:** conectar en Next.js todos los endpoints del Sprint 1 documentados en
`docs/Uso_endpoints.md`.
**Estado:** implementado, con `tsc`, ESLint y `next build` en verde; pruebas unitarias y
e2e del backend en verde.

---

## 1. Resumen

Antes de este avance, el frontend solo tenía las pantallas públicas (bienvenida, login,
registro, activación, recuperación y primer acceso). Ahora incluye:

- Paneles protegidos por rol para **comerciante**, **organizador** y **gestor**.
- Redirección por rol después del login y del primer acceso.
- Guard de sesión y rol en el cliente.
- Todas las vistas que consumen los **36 endpoints** del Sprint 1 (incluido el endpoint
  de salud, que corresponde a la página de bienvenida).
- Bandeja de notificaciones compartida.
- Componentes reutilizables de tabla, paginación, modal de confirmación, estados vacíos,
  carga y error.

---

## 2. Rutas nuevas

### Comerciante

| Ruta | Endpoints |
|---|---|
| `/comerciante/inicio` | `GET /perfil`, `GET /auth/me`, `GET /notificaciones` |
| `/comerciante/perfil` | `GET /perfil`, `PATCH /perfil`, `PATCH /perfil/password` |

### Organizador

| Ruta | Endpoints |
|---|---|
| `/organizador/inicio` | `GET /perfil`, `GET /auth/me`, `GET /notificaciones` |
| `/organizador/perfil` | `GET /perfil`, `PATCH /perfil`, `PATCH /perfil/password` |
| `/organizador/mi-organizacion` | `POST/GET/PATCH /organizadores/mi-organizacion` |

### Gestor

| Ruta | Endpoints |
|---|---|
| `/gestor/panel` | `GET /panel` |
| `/gestor/perfil` | `GET/PATCH /gestor/perfil`, `PATCH /gestor/perfil/password` |
| `/gestor/usuarios` | `GET /gestor/usuarios` |
| `/gestor/usuarios/[id]` | `GET /gestor/usuarios/:id`, `PATCH /gestor/usuarios/:id/estado`, `PATCH /usuarios/:id/comerciante`, `POST /gestor/gestores/:id/reenviar-invitacion` |
| `/gestor/comerciantes` | `GET /gestor/comerciantes` |
| `/gestor/organizaciones` | `GET /gestor/organizaciones` |
| `/gestor/organizaciones/[id]` | `GET /gestor/organizaciones/:id`, `PATCH /gestor/organizaciones/:id/estado` |
| `/gestor/gestores/nuevo` | `POST /gestor/gestores` |
| `/gestor/auditoria` | `GET /gestor/auditoria` (solo administrador) |

### Transversal

| Ruta | Endpoints |
|---|---|
| `/notificaciones` | `GET /notificaciones`, `PATCH /notificaciones/:id/leida`, `PATCH /notificaciones/leer-todas` |
| Cualquier página autenticada | `GET /auth/me`, `POST /auth/logout`, `POST /auth/refresh` |

---

## 3. Cobertura de endpoints

| # | Endpoint | Vista / integración |
|---|---|---|
| 1 | `GET /` | `/` (bienvenida estática; el endpoint no se consume) |
| 2 | `POST /auth/login` | `/login` |
| 3 | `POST /auth/gestor/primer-acceso` | `/primer-acceso` |
| 4 | `POST /usuarios/comerciantes` | `/registro/comerciante` |
| 5 | `POST /usuarios/organizadores` | `/registro/organizador` |
| 6 | `POST /usuarios/activacion` | `/activar` |
| 7 | `POST /usuarios/activacion/reenviar` | `/activar` |
| 8 | `POST /usuarios/password/recuperar` | `/recuperar` |
| 9 | `POST /usuarios/password/restablecer` | `/restablecer` |
| 10 | `GET /perfil` | `/comerciante/perfil`, `/organizador/perfil`, inicios |
| 11 | `PATCH /perfil` | perfiles de comerciante y organizador |
| 12 | `PATCH /perfil/password` | perfiles de comerciante y organizador |
| 13 | `GET /panel` | `/gestor/panel` |
| 14 | `POST /gestor/gestores` | `/gestor/gestores/nuevo` |
| 15 | `GET /gestor/usuarios` | `/gestor/usuarios` |
| 16 | `GET /gestor/comerciantes` | `/gestor/comerciantes` |
| 17 | `GET /gestor/usuarios/:id` | `/gestor/usuarios/[id]` |
| 18 | `PATCH /gestor/usuarios/:id/estado` | detalle de usuario, modal de confirmación |
| 19 | `GET /gestor/organizaciones` | `/gestor/organizaciones` |
| 20 | `GET /gestor/organizaciones/:id` | `/gestor/organizaciones/[id]` |
| 21 | `PATCH /gestor/organizaciones/:id/estado` | detalle de organización |
| 22 | `POST /organizadores/mi-organizacion` | `/organizador/mi-organizacion` |
| 23 | `GET /organizadores/mi-organizacion` | `/organizador/mi-organizacion` |
| 24 | `PATCH /organizadores/mi-organizacion` | `/organizador/mi-organizacion` |
| 25 | `PATCH /usuarios/:id/comerciante` | corrección dentro del detalle de usuario |
| 26 | `GET /auth/me` | `useSesion()` + guard de roles |
| 27 | `POST /auth/logout` | barra de sesión |
| 28 | `GET /gestor/perfil` | `/gestor/perfil` |
| 29 | `PATCH /gestor/perfil` | `/gestor/perfil` |
| 30 | `PATCH /gestor/perfil/password` | `/gestor/perfil` |
| 31 | `POST /gestor/gestores/:id/reenviar-invitacion` | detalle de usuario (gestor pendiente) |
| 32 | `GET /notificaciones` | `/notificaciones` y contador de la barra |
| 33 | `PATCH /notificaciones/:id/leida` | `/notificaciones` |
| 34 | `PATCH /notificaciones/leer-todas` | `/notificaciones` |
| 35 | `GET /gestor/auditoria` | `/gestor/auditoria` |
| 36 | `POST /auth/refresh` | `api-client.ts` (renovación automática) |

---

## 4. Arquitectura implementada

### 4.1 Tipos y cliente HTTP

- `frontend/src/types/api.ts`: contrato completo del Sprint 1 (perfil, panel, listados,
  detalle, organizaciones, notificaciones, auditoría y cuerpos de solicitud).
- `frontend/src/lib/api-client.ts`: **único punto de HTTP**. Se añadieron funciones para
  todos los endpoints y un helper `conParametros` para query strings. Mantiene el manejo
  central de token, refresh con rotación, errores `string | string[]` y redirección al
  login ante `401`.

### 4.2 Sesión y roles

- `frontend/src/lib/rutas.ts`: `rutaInicio(usuario)` decide el destino por rol.
- `frontend/src/features/sesion/guardia-rol.tsx`: guard de cliente; redirige a `/login`
  sin sesión y al inicio del rol si se intenta abrir una ruta ajena.
- `frontend/src/features/sesion/marco-sesion.tsx`: barra de navegación por rol, badge de
  notificaciones no leídas, menú móvil y cierre de sesión.

### 4.3 Layouts

| Archivo | Rol |
|---|---|
| `app/(comerciante)/layout.tsx` | Solo comerciante |
| `app/(organizador)/layout.tsx` | Solo organizador |
| `app/(gestor)/layout.tsx` | Solo gestor |
| `app/(sesion)/layout.tsx` | Cualquier rol autenticado (notificaciones) |

### 4.4 Componentes nuevos

- `components/ui/tabla.tsx`
- `components/ui/paginacion.tsx`
- `components/ui/modal.tsx` (`Modal` y `AccionesModal`)
- `components/ui/estado-vacio.tsx` (`EstadoVacio` y `Cargando`)
- `components/ui/bloque-error.tsx`
- `hooks/use-consulta-api.ts`: estados de carga/error/éxito y `recargar()`.

### 4.5 Reglas de UI aplicadas

- El **revisor** no ve “Crear gestor”, no ve los filtros de rol gestor/perfil y no tiene
  botones de cambio de estado ni validación de organizaciones.
- El administrador no puede cambiar el estado de su propia cuenta.
- Los gestores en `pendiente_activacion` no muestran botones de estado; en su lugar
  aparece “Reenviar invitación”.
- El detalle de usuario tiene pestañas **Datos / Solicitudes / Permisos**.
- La corrección de documento, tipo de documento, actividad y categoría está disponible
  dentro del detalle de un comerciante.
- Todas las pantallas de datos tienen estados de carga, vacío, error y éxito.
- Las mutaciones muestran alertas de éxito o el mensaje del backend.

---

## 5. Pruebas y verificación

### 5.1 Frameworks elegidos

| Nivel | Framework | Motivo |
|---|---|---|
| Unitarias del frontend | **Vitest 5** | Rápido, compatible con TypeScript/ESM y sin necesidad de DOM para las funciones puras. |
| Usabilidad / e2e de interfaz | **Playwright 1.64** | Recorre la aplicación real en un navegador, con selectores accesibles, capturas y trazas. Usa **Microsoft Edge** ya instalado (`channel: "msedge"`), sin descargar navegadores. |
| Unitarias del backend | **Jest** (existente) | Se mantiene el runner del proyecto NestJS. |
| E2E de API | **Jest + Supertest** (existente) | Se mantiene la suite del backend. |

Configuración:

- `frontend/vitest.config.mts`
- `frontend/playwright.config.ts`
- `frontend/e2e/helpers.ts`

Playwright levanta automáticamente:

1. La API NestJS en `http://localhost:3000`.
2. El frontend compilado en `http://localhost:3001` (`pnpm build && pnpm start`).

Para evitar falsos `429` por el rate limit de login, el servidor de pruebas recibe
`LOGIN_RATE_LIMIT_MAX=200`. Los scripts `dev` y `start` del frontend ya fijan el puerto
**3001**, que es el origen permitido por CORS.

### 5.2 Comandos

```text
frontend: pnpm test                       → Vitest (unitarias)
frontend: pnpm test:e2e                   → Playwright (usabilidad)
frontend: pnpm test:e2e:headed            → Playwright con navegador visible
frontend: pnpm exec tsc --noEmit          → typecheck
frontend: pnpm lint                       → ESLint
frontend: pnpm build                      → build de producción
backend:  pnpm test -- --runInBand        → unitarias
backend:  pnpm test:e2e -- --runInBand    → e2e de API
```

### 5.3 Resultados obtenidos

```text
frontend: tsc --noEmit                    → sin errores
frontend: eslint                          → sin errores
frontend: next build                      → 27 rutas generadas
frontend: vitest run                      → 3 archivos, 15 pruebas aprobadas
frontend: playwright test                 → 26 pruebas aprobadas (1.2 min)
backend:  jest --runInBand                → 20 suites, 190 pruebas aprobadas
backend:  jest e2e --runInBand            → 6 suites, 35 pruebas aprobadas
```

### 5.4 Cobertura de usabilidad (Playwright)

| Archivo | Flujos cubiertos |
|---|---|
| `e2e/auth.spec.ts` | Login de comerciante, organizador, administrador y revisor; credenciales inválidas; cierre de sesión. |
| `e2e/publico.spec.ts` | Validación del registro, correo duplicado, recuperación de contraseña, formulario de activación y primer acceso de gestor. |
| `e2e/comerciante.spec.ts` | Inicio, perfil, edición de teléfono, validación de cambio de contraseña y acceso a notificaciones. |
| `e2e/organizador.spec.ts` | Inicio, estado de la organización, perfil y edición del contacto de la organización. |
| `e2e/gestor.spec.ts` | Panel, listado/filtros de cuentas, detalle con pestañas, suspensión/reactivación, corrección de comerciante, creación de gestor, reenvío de invitación, organizaciones, auditoría y restricciones del revisor. |
| `e2e/notificaciones.spec.ts` | Marcar una notificación como leída, marcar todas y filtro de no leídas. |

Las pruebas restauran los datos que modifican (teléfono, contacto, actividad, estado de
cuenta y estado de organización) mediante la API al finalizar cada flujo. La cuenta
`e2e.gestor@tulua.gov.co` se crea una sola vez y se reutiliza en ejecuciones posteriores
para probar el reenvío de invitación.

### 5.5 Correcciones derivadas de las pruebas

1. **Sesión ante errores de red/abortos:** `useSesion` borraba los tokens ante cualquier
   error, incluida una petición abortada por navegación. Ahora solo cierra la sesión ante
   `401/403`; ante un error de red conserva el usuario guardado.
2. **Puerto del frontend:** `pnpm dev` y `pnpm start` usan `-p 3001`, alineados con
   `FRONTEND_URL` y CORS.
3. **Jest del backend:** se excluyó `/frontend/` del `testRegex` para que no intente
   ejecutar los specs de Playwright.

### Cómo probar manualmente

1. Backend en `http://localhost:3000` con la base `sgp_tulua` y el seed aplicado.
2. Frontend en `http://localhost:3001` (`cd frontend && pnpm dev`).
3. Credenciales del seed (ver `docs/Uso_endpoints.md`, sección 11):

| Correo | Contraseña | Rol |
|---|---|---|
| `admin@tulua.gov.co` | `Admin1234` | Gestor administrador |
| `revisor@tulua.gov.co` | `Admin1234` | Gestor revisor |
| `maria.gomez@gmail.com` | `Comerciante123` | Comerciante |
| `luis.alvarez@agrovalle.org` | `Organizador123` | Organizador |

4. Flujos mínimos:
   - Admin: login → panel → usuarios → detalle → cambiar estado → corregir comerciante →
     crear gestor → auditoría.
   - Revisor: login → panel → usuarios → comprobar que no aparecen acciones de escritura.
   - Comerciante: login → inicio → perfil → editar teléfono → cambiar contraseña.
   - Organizador: login → mi organización → editar → ver estado de validación.
   - Notificaciones: abrir bandeja, marcar una y marcar todas.

---

## 6. Pendientes y recomendaciones

### 6.1 Pendientes funcionales (fuera del Sprint 1)

| Tema | Estado |
|---|---|
| Cambio de correo | El backend lo mantiene fuera de alcance; la UI lo muestra deshabilitado. |
| Documentos de la organización | El modelo no tiene tabla de documentos. |
| Administración de sesiones por dispositivo | No hay endpoint expuesto. |
| Módulos de Sprints 2–6 | Se muestran como “Próximamente”; no se consumen endpoints inexistentes. |

### 6.2 Deuda técnica del frontend

1. **Pruebas del frontend:** ya existen Vitest para funciones puras y Playwright para los
   flujos de interfaz. Falta añadir pruebas de componentes con Testing Library y ampliar
   la cobertura a estados de error, paginación vacía y accesibilidad.
2. **Protección de rutas en servidor:** el guard actual es de cliente. Next.js 16
   reemplazó `middleware.ts` por `proxy.ts`; se puede añadir una comprobación optimista,
   recordando que la autorización real la hace el backend.
3. **Llamadas duplicadas a `GET /auth/me`:** `GuardiaRol` y `MarcoSesion` usan `useSesion`
   por separado. Conviene mover la sesión a un contexto/react-query para una sola carga.
4. **Badge de notificaciones:** se actualiza al navegar. Después de marcar una
   notificación como leída, el contador de la barra se refresca en la siguiente
   navegación; se puede elevar el estado a un contexto.
5. **Listado de gestores:** se obtiene con `GET /gestor/usuarios?rol=gestor`; no existe un
   endpoint dedicado. Se puede añadir un acceso rápido “Gestores” que preseleccione el
   filtro.
6. **Validaciones espejo:** las reglas del frontend están en `lib/validaciones.ts`; si el
   backend cambia un DTO, hay que actualizarlas. `NIT_RE` ya se alineó a 8–10 dígitos.
7. **Manejo de `403` en detalle:** si un revisor abre por URL el detalle de un gestor, el
   backend responde `403` y la vista muestra el error. Es el comportamiento esperado,
   pero se puede mejorar el mensaje.
8. **Accesibilidad:** se mantuvieron etiquetas, foco visible, `aria-*` y tamaños táctiles;
   falta una auditoría formal con axe/Lighthouse.

---

## 7. Archivos principales creados o modificados

```text
frontend/src/types/api.ts                          (contrato completo)
frontend/src/lib/api-client.ts                     (36 endpoints)
frontend/src/lib/rutas.ts                          (redirección por rol)
frontend/src/lib/formato.ts                        (fechas, textos, resúmenes)
frontend/src/hooks/use-consulta-api.ts             (carga/error/recarga)
frontend/src/features/sesion/guardia-rol.tsx
frontend/src/features/sesion/marco-sesion.tsx
frontend/src/features/inicio/inicio-usuario.tsx
frontend/src/features/perfil/perfil-usuario.tsx
frontend/src/features/organizador/gestion-organizacion.tsx
frontend/src/features/notificaciones/bandeja-notificaciones.tsx
frontend/src/features/gestor/panel-gestor.tsx
frontend/src/features/gestor/perfil-gestor.tsx
frontend/src/features/gestor/lista-usuarios.tsx
frontend/src/features/gestor/detalle-usuario.tsx
frontend/src/features/gestor/lista-comerciantes.tsx
frontend/src/features/gestor/lista-organizaciones.tsx
frontend/src/features/gestor/detalle-organizacion.tsx
frontend/src/features/gestor/crear-gestor.tsx
frontend/src/features/gestor/auditoria.tsx
frontend/src/components/ui/{tabla,paginacion,modal,estado-vacio,bloque-error}.tsx
frontend/src/app/(comerciante)/...
frontend/src/app/(organizador)/...
frontend/src/app/(gestor)/...
frontend/src/app/(sesion)/notificaciones/page.tsx
frontend/src/features/publico/formulario-login.tsx        (redirección por rol)
frontend/src/features/publico/formulario-primer-acceso.tsx (redirección por rol)
frontend/src/hooks/use-sesion.ts                          (resiliencia ante abortos de red)
frontend/vitest.config.mts                                (Vitest)
frontend/playwright.config.ts                             (Playwright + webServer)
frontend/e2e/{auth,publico,comerciante,organizador,gestor,notificaciones}.spec.ts
frontend/e2e/helpers.ts                                   (login, API y limpieza)
frontend/src/lib/{validaciones,rutas,formato}.test.ts     (unitarias)
jest.config.ts                                            (excluye frontend de Jest)
```

---

## 8. Cómo continuar en otra sesión

1. Leer este documento y `docs/Uso_endpoints.md`.
2. Ejecutar `cd frontend && pnpm install && pnpm dev` y el backend con `pnpm start:dev`.
3. Revisar los pendientes de la sección 6 y priorizar:
   - pruebas de componentes con Testing Library,
   - contexto de sesión único,
   - `proxy.ts` para protección optimista,
   - auditoría de accesibilidad con axe/Lighthouse.
4. Para ejecutar todo el sistema de pruebas:
   ```powershell
   cd frontend
   pnpm test
   pnpm test:e2e
   cd ..
   pnpm test -- --runInBand
   pnpm test:e2e -- --runInBand
   ```
5. No crear endpoints nuevos para los Sprints 2–6 hasta que existan en `src/`.
