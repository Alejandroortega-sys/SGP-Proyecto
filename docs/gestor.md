# Módulo del gestor municipal

**Proyecto:** Plataforma Web de Gestión del Espacio Público de Tuluá (Equipo 6)
**Épicas relacionadas:** 1 (Autenticación y gestión de usuarios) · 6 (Panel administrativo)
**Código:** `src/gestor/` · **Guards:** `src/auth/guards/perfil-gestor.guard.ts`

---

## 1. Flujo general

```
POST /auth/login (público, rate limit 10/min por IP)
  │  admin@tulua.gov.co   → JWT 30 min + usuario.perfil = "administrador"
  │  revisor@tulua.gov.co → JWT 30 min + usuario.perfil = "revisor"
  │
  ▼
Authorization: Bearer <token>
  │
  ├─ GET  /gestor/usuarios              → admin: cualquier cuenta
  │                                       revisor: comerciantes y organizadores
  ├─ GET  /gestor/comerciantes          → revisor y administrador
  ├─ GET  /gestor/usuarios/:id          → admin: cualquier cuenta
  │                                       revisor: comerciantes y organizadores
  ├─ POST /gestor/gestores              → solo administrador
  └─ PATCH /gestor/usuarios/:id/estado  → solo administrador
```

El login es el ya existente: no hay un endpoint duplicado para gestores. El JWT
incluye `rol` y `perfil`; `JwtAuthGuard` recarga la cuenta de la base de datos en
cada petición, de modo que una suspensión o un cambio de perfil se aplican de
inmediato. `RolesGuard` exige `rol = gestor` y `PerfilGestorGuard` exige
`perfil = administrador` en los endpoints exclusivos.

### Alcance por perfil

| Perfil | Alcance |
|---|---|
| `revisor` | Consulta comerciantes y organizadores. No crea gestores ni cambia estados. |
| `administrador` | Consulta cualquier cuenta, crea gestores y activa/suspende/inactiva cuentas. |

Un revisor que intente:

- filtrar el listado general por `rol=gestor` o por `perfil` de gestor → `403`.
- consultar el detalle de una cuenta con rol gestor → `403`.
- crear un gestor o cambiar un estado → `403` (lo aplica `PerfilGestorGuard`).

---

## 2. Crear gestores — `POST /gestor/gestores`

**Acceso:** exclusivo de gestores con perfil `administrador`.

### Cuerpo

```json
{
  "nombre": "Ana",
  "apellido": "López",
  "correo": "ana.lopez@tulua.gov.co",
  "perfil": "revisor"
}
```

`perfil` acepta `revisor` o `administrador`.

### Comportamiento

1. Genera una contraseña temporal aleatoria y la hashea con argon2.
2. En una transacción:
   - Crea `usuarios` con `rol='gestor'` y `estado='pendiente_activacion'`.
   - Crea la fila en `gestores` con `perfil` y `creado_por` del administrador.
   - Crea la notificación interna.
   - Fija `app.actor_id` con el administrador.
   - Registra manualmente en `auditoria` la creación de `gestores` (esa tabla no
     tiene trigger).
3. Envía un correo con:
   - El mensaje de creación de la cuenta.
   - El perfil asignado.
   - La contraseña temporal.
   - El enlace al login (`FRONTEND_URL/login`).
   - La instrucción de cambiarla obligatoriamente en el primer acceso.
4. Responde `201` sin devolver la contraseña temporal.

### Respuesta 201

```json
{
  "id": "9",
  "nombre": "Ana",
  "apellido": "López",
  "correo": "ana.lopez@tulua.gov.co",
  "perfil": "revisor",
  "estado": "pendiente_activacion",
  "mensaje": "Cuenta de gestor creada. Enviamos la contraseña temporal al correo; debe cambiarla en el primer inicio de sesión."
}
```

Si el correo falla después de crear la cuenta, responde `503`; la cuenta queda
creada en estado pendiente.

---

## 3. Primer inicio de sesión del gestor

### Paso 1: `POST /auth/login`

El gestor usa el correo y la **contraseña temporal** recibidos. Si la cuenta
está en `pendiente_activacion`, la respuesta no incluye JWT de acceso:

```json
{
  "requiereCambioPassword": true,
  "correo": "ana.lopez@tulua.gov.co",
  "nombre": "Ana",
  "perfil": "revisor",
  "mensaje": "Debes cambiar tu contraseña para activar la cuenta y acceder a la plataforma."
}
```

Mientras no cambie la contraseña, la cuenta sigue en `pendiente_activacion` y no
puede usar el resto de la API.

### Paso 2: `POST /auth/gestor/primer-acceso`

Endpoint público con rate limit.

```json
{
  "correo": "ana.lopez@tulua.gov.co",
  "passwordActual": "Temporal123",
  "password": "NuevaClave456",
  "confirmarPassword": "NuevaClave456"
}
```

Reglas:

- Verifica que sea gestor y que esté en `pendiente_activacion`.
- Vuelve a validar la contraseña temporal.
- Aplica la política de contraseña del registro (8–128 caracteres y al menos un
  número).
- Actualiza `password_hash` y pasa la cuenta a `activa`.
- Limpia bloqueos e intentos fallidos.
- Registra el cambio en `auditoria` con el propio gestor como actor.
- Crea una notificación interna.
- Devuelve la respuesta normal del login con JWT.

---

## 4. Listado general de cuentas — `GET /gestor/usuarios`

**Acceso:** ambos perfiles, con alcance diferente.

| Parámetro | Tipo | Descripción |
|---|---|---|
| `busqueda` | texto (máx. 150) | Nombre, apellido, correo, documento, actividad comercial o nombre de la organización. |
| `rol` | enum | `comerciante`, `organizador` o `gestor`. El revisor solo puede usar los dos primeros. |
| `estado` | enum | `pendiente_activacion`, `activa`, `suspendida`, `inactiva`. |
| `perfil` | enum | `revisor` o `administrador`. Solo el administrador puede usarlo. |
| `pagina` | entero ≥ 1 | Por defecto `1`. |
| `limite` | entero 1–100 | Por defecto `20`. |

Respuesta:

```json
{
  "datos": [
    {
      "id": "7",
      "nombre": "Luis",
      "apellido": "Álvarez",
      "correo": "luis.alvarez@agrovalle.org",
      "documento": null,
      "telefono": null,
      "rol": "organizador",
      "estado": "activa",
      "perfil": null,
      "categoria": null,
      "actividadComercial": null,
      "nombreOrganizacion": "Fundación Agroecológica del Valle",
      "creadoEn": "2026-09-15T14:30:00.000Z"
    }
  ],
  "paginacion": {
    "pagina": 1,
    "limite": 20,
    "total": 1,
    "totalPaginas": 1
  }
}
```

### Listado de comerciantes — `GET /gestor/comerciantes`

Se mantiene para ambos perfiles, con búsqueda por nombre, apellido, correo,
documento o actividad, filtros de `estado` y `categoria`, y paginación.

---

## 5. Detalle de una cuenta — `GET /gestor/usuarios/:id`

- **Administrador:** cualquier cuenta.
- **Revisor:** solo comerciantes y organizadores.

Devuelve los datos de la cuenta, su perfil según el rol, todas sus solicitudes y
todos sus permisos, ordenados del más reciente al más antiguo, más los totales.

Notas:

- Para organizadores se incluye `organizacion` y las listas de solicitudes y
  permisos quedan vacías (sus ferias no forman parte de este endpoint).
- Para gestores se incluye `perfilGestor`.
- No se expone el hash de la contraseña ni el `qr_token`.
- Los valores `DECIMAL` se devuelven como `string`.

---

## 6. Activar, suspender o inactivar — `PATCH /gestor/usuarios/:id/estado`

**Acceso:** exclusivo de gestores con perfil `administrador`.

```json
{ "estado": "suspendida" }
```

Valores: `activa`, `suspendida` o `inactiva`.

### Reglas

| Caso | Resultado |
|---|---|
| El administrador intenta cambiar su propia cuenta | `403` |
| La cuenta objetivo es un gestor en `pendiente_activacion` | `409`: debe completar el primer acceso |
| La cuenta objetivo es otro administrador activo | Solo si existen al menos dos administradores activos |
| La cuenta objetivo es revisor, comerciante u organizador | Se permite el cambio normal |
| La cuenta ya está en el estado solicitado | `409` |
| La cuenta no existe | `404` |
| Se activa una cuenta | Se limpian `intentos_fallidos` y `bloqueado_hasta` |

La comprobación del último administrador se hace dentro de una transacción: se
bloquean las filas de administradores activos con
`SELECT ... FOR UPDATE` y se cuentan. Así se evita que dos administradores se
desactiven mutuamente y dejen el sistema sin administradores activos.

### Auditoría

La transacción fija `app.actor_id` con el administrador; el trigger
`fn_auditoria` de `usuarios` inserta en `auditoria` el `valor_anterior`, el
`valor_nuevo`, el actor y la fecha.

---

## 7. Seguridad

| Guard | Alcance | Qué valida |
|---|---|---|
| `JwtAuthGuard` | Global | Token válido y cuenta en estado `activa`; recarga `request.usuario` |
| `RolesGuard` | Global | `@Roles('gestor')` del controlador |
| `PerfilGestorGuard` | Global | `@PerfilGestor('administrador')` en creación y cambio de estado |

Errores habituales:

| HTTP | Causa |
|---|---|
| 400 | Parámetros o cuerpo inválidos |
| 401 | Falta el token, es inválido o expiró |
| 403 | Rol/perfil sin permiso, revisor consultando un gestor o cambio de la propia cuenta |
| 404 | La cuenta solicitada no existe |
| 409 | Estado repetido, gestor pendiente de primer acceso o último administrador |
| 503 | Fallo al enviar el correo de invitación o base de datos no disponible |

---

## 8. Archivos del módulo

| Archivo | Contenido |
|---|---|
| `src/gestor/gestor.module.ts` | Módulo; importa `CorreoModule` |
| `src/gestor/gestor.controller.ts` | Endpoints y Swagger |
| `src/gestor/gestor.service.ts` | Creación, listados, detalle y cambio de estado |
| `src/gestor/dto/crear-gestor.dto.ts` | Cuerpo y respuesta de creación |
| `src/gestor/dto/listar-usuarios-query.dto.ts` | Filtros del listado general |
| `src/gestor/dto/listar-usuarios-response.dto.ts` | Respuesta del listado general |
| `src/gestor/dto/listar-comerciantes-*.dto.ts` | Listado de comerciantes |
| `src/gestor/dto/usuario-detalle-response.dto.ts` | Detalle |
| `src/gestor/dto/cambiar-estado-usuario.dto.ts` | Cambio de estado |
| `src/auth/decorators/perfil-gestor.decorator.ts` | `@PerfilGestor(...)` |
| `src/auth/guards/perfil-gestor.guard.ts` | Guard por perfil |
| `src/auth/dto/primer-acceso-gestor.dto.ts` | Primer acceso |
| `src/auth/dto/login-response.dto.ts` | Respuestas de login |
| `src/correo/correo.service.ts` | Correo con la contraseña temporal |
| `src/gestor/*.spec.ts` · `src/auth/auth.service.spec.ts` · `test/gestor.e2e-spec.ts` | Pruebas |

---

## 9. Probar el flujo (datos del seed)

```powershell
# 1) Login como administrador
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth/login `
    -ContentType 'application/json' `
    -Body '{"correo":"admin@tulua.gov.co","password":"Admin1234"}'

# 2) Listado general de cuentas
Invoke-RestMethod -Uri 'http://localhost:3000/gestor/usuarios?pagina=1&limite=20' `
    -Headers @{ Authorization = "Bearer $($login.accessToken)" }

# 3) Crear un gestor revisor
Invoke-RestMethod -Method Post -Uri http://localhost:3000/gestor/gestores `
    -Headers @{ Authorization = "Bearer $($login.accessToken)" } `
    -ContentType 'application/json' `
    -Body '{"nombre":"Ana","apellido":"López","correo":"ana.lopez@tulua.gov.co","perfil":"revisor"}'

# 4) Con el revisor (revisor@tulua.gov.co / Admin1234):
#    GET /gestor/usuarios y /gestor/usuarios/:id de organizadores funcionan;
#    los gestores y los cambios de estado responden 403.
```

La documentación Swagger se genera en <http://localhost:3000/api/docs>
(etiqueta `gestor`).

---

## 10. Verificación

```powershell
pnpm lint
pnpm test -- --runInBand
pnpm test:e2e -- --runInBand
pnpm build
```
