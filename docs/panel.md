# Módulo de inicio de sesión por roles y panel administrativo

**Proyecto:** Plataforma Web de Gestión del Espacio Público de Tuluá (Equipo 6)
**Épicas relacionadas:** 1 (Autenticación y gestión de usuarios) · 6 (Dashboard administrativo e indicadores)
**Código:** `src/auth/` (inicio de sesión) · `src/panel/` (panel del gestor)

---

## 1. Flujo general

```
POST /auth/login (público, rate limit 10/min por IP)
  │
  ├─ gestor municipal  → JWT 30 min (HU-06) + usuario.rol = 'gestor'
  │                       + usuario.perfil = 'revisor' | 'administrador'
  ├─ comerciante       → JWT 8 h + usuario.rol = 'comerciante'
  └─ organizador       → JWT 8 h + usuario.rol = 'organizador'
  │
  ▼
GET /panel (Authorization: Bearer <token>)
  │
  ├─ rol 'gestor'     → 200: datos del gestor + indicadores de la plataforma
  ├─ otro rol         → 403: «El rol "..." no tiene permiso para este recurso»
  └─ sin token/expirado → 401: «Token de acceso inválido o expirado»
```

El JWT lleva `sub` (id), `correo`, `rol` y, para gestores, `perfil`. La decisión de a qué
vista navegar (panel administrativo vs. portal del comerciante) la toma el **frontend** con
el `rol` que devuelve el login; el backend la hace cumplir con guards.

## 2. Inicio de sesión — `POST /auth/login` (ya existente)

| Aspecto | Detalle |
|---|---|
| Cuerpo | `{ "correo": "...", "password": "..." }` |
| Contraseñas | Verificadas con argon2id |
| Vigencia del JWT | 30 min gestores (`JWT_GESTOR_EXPIRES_IN_SECONDS`) · 8 h el resto (`JWT_EXPIRES_IN_SECONDS`) |
| Bloqueo | 5 intentos fallidos → 423 con minutos restantes (`LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCK_MINUTES`) |
| Cuenta no activa | 403 con mensaje según estado (pendiente de activación, suspendida, inactiva) |
| Anti-enumeración | Correo inexistente devuelve el mismo 401 y con costo computacional similar |

## 3. Panel administrativo — `GET /panel` (nuevo)

**Acceso:** exclusivo del rol `gestor` (`@Roles('gestor')` a nivel de clase en
`PanelController`). Tanto `revisor` como `administrador` entran por ahora; la distinción
fina por perfil se hará al implementar los módulos de las Épicas 2–6.

**Guards:** no se declaran en el controlador porque son globales (`APP_GUARD` en
`AppModule`): primero `JwtAuthGuard` (valida el token, recarga el usuario de la BD y
rechaza cuentas no activas) y después `RolesGuard` (aplica `@Roles`).

### Respuesta 200

```json
{
  "gestor": {
    "id": "1",
    "nombre": "Carlos",
    "apellido": "Ramírez",
    "correo": "admin@tulua.gov.co",
    "perfil": "administrador"
  },
  "indicadores": {
    "usuarios": {
      "estados": { "total": 8, "pendientesActivacion": 1, "activas": 6, "suspendidas": 1, "inactivas": 0 },
      "roles": { "comerciante": 4, "organizador": 2, "gestor": 2 }
    },
    "solicitudes": {
      "total": 4,
      "porEstado": { "borrador": 1, "radicada": 1, "en_revision": 0, "devuelta": 0, "aprobada": 1, "rechazada": 1, "cancelada": 0 }
    },
    "permisos": { "total": 1, "porEstado": { "vigente": 1, "suspendido": 0, "revocado": 0, "vencido": 0 } },
    "ferias": { "total": 2, "porEstado": { "radicada": 1, "aprobada": 1, "rechazada": 0, "cancelada": 0, "realizada": 0 } }
  }
}
```

- `gestor` sale del usuario autenticado (`@UsuarioActual()`), recargado de la BD por el guard.
- `indicadores` salen de `PanelService` con cinco `groupBy` de Prisma lanzados en paralelo
  (usuarios por estado y por rol, solicitudes, permisos y ferias por estado). Son columnas
  escalares, así que **no** se usan queries crudas (ver `docs/uso_db.md` §3).
- Los mapas `porEstado` **siempre incluyen todas las claves** del enum correspondiente (con 0
  si no hay registros), para que el frontend no maneje valores ausentes.
- Los IDs van como `string` (parche global de BigInt, ver `docs/uso_db.md` §2).

### Errores

| HTTP | Causa |
|---|---|
| 401 | Falta el token, es inválido o expiró (el del gestor vence a los 30 min) |
| 403 | El rol del usuario no es `gestor` (comerciante u organizador) |
| 403 | La cuenta del token dejó de estar activa |
| 503 | La base de datos no está disponible (filtro global de Prisma) |

## 4. Archivos del módulo

| Archivo | Contenido |
|---|---|
| `src/panel/panel.module.ts` | Módulo Nest (registrado en `AppModule`) |
| `src/panel/panel.controller.ts` | `GET /panel` con `@Roles('gestor')` y documentación Swagger |
| `src/panel/panel.service.ts` | Indicadores con `groupBy` de Prisma en paralelo |
| `src/panel/dto/panel-response.dto.ts` | DTOs de respuesta con `@ApiProperty` |
| `src/panel/panel.controller.spec.ts` | Restricción de rol y mapeo del gestor |
| `src/panel/panel.service.spec.ts` | Agregación de conteos y estados en 0 |

## 5. Probar el flujo completo (datos del seed)

```powershell
# 1) Iniciar sesión como gestor (seed: docs/baseDatos.md §17)
$ login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth/login `
    -ContentType 'application/json' `
    -Body '{"correo":"admin@tulua.gov.co","password":"Admin1234"}'

# 2) Consultar el panel con el token (200 + indicadores)
Invoke-RestMethod -Uri http://localhost:3000/panel `
    -Headers @{ Authorization = "Bearer $($login.accessToken)" }

# 3) Con un comerciante (laura.perez@gmail.com / Comerciante123) el mismo
#    GET /panel responde 403.
```

La documentación Swagger de ambos endpoints se genera desde el código y está en
<http://localhost:3000/api/docs> (ver `docs/swagger.md`).

## 6. Evolución prevista (Épica 6, HU-38 a HU-44)

`GET /panel` es la base sobre la que crecerá el dashboard: las vistas materializadas
(`mv_ocupacion_zona`, `mv_recaudacion`, `mv_saturacion`, `mv_tiempos_atencion`) ya existen
en la BD (ver `docs/baseDatos.md` §14) y se consultarán con `$queryRaw` en nuevos endpoints
de este mismo módulo, conservando `@Roles('gestor')`.
