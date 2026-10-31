# Uso de endpoints — Sprint 1: Autenticación y gestión de usuarios

**Proyecto:** Plataforma Web de Gestión del Espacio Público, Ferias Agroecológicas y Comercio Formal/Informal de Tuluá (Equipo 6)
**Documento:** estado de la API para construir el frontend en Next.js
**Alcance:** únicamente el **Sprint 1** (Épica 1, HU-01 a HU-07)
**Fecha:** octubre de 2026
**Fuente de verdad:** código actual en `src/` + `docs/` + `prisma/schema.prisma`

> Este documento describe **lo que ya existe** y **lo que falta** para cerrar el Sprint 1.
> Los módulos de los Sprints 2 a 6 (zonas, ferias, solicitudes, factibilidad, permisos QR,
> cobros y dashboard analítico) no forman parte de este resumen: se documentarán al
> finalizar cada sprint.

---

## 1. Estado actual del proyecto

### 1.1 Backend construido

| Aspecto | Estado |
|---|---|
| Framework | NestJS 12 + TypeScript estricto |
| Base de datos | PostgreSQL + PostGIS, accedida con Prisma 7 |
| Autenticación | JWT con `@nestjs/jwt`; contraseñas con argon2id |
| Documentación | Swagger/OpenAPI generado desde el código |
| Validación | `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` y `transform` |
| Errores de BD | Traducidos a HTTP por `PrismaExceptionFilter` |
| Correo | Nodemailer; sin SMTP escribe el contenido en el log en desarrollo |
| Rate limit | Login, registro, activación y recuperación de contraseña, por IP |
| Frontend | **Implementado para el Sprint 1** (Next.js 16): rutas públicas, paneles por rol, notificaciones y auditoría. Ver `docs/avance_frontend.md` |

### 1.2 Módulos del backend relacionados con el Sprint 1

| Módulo | Ruta base | Responsabilidad |
|---|---|---|
| `auth` | `/auth` | Login y primer acceso de gestores |
| `usuarios` | `/usuarios` | Registro, activación, recuperación y corrección por gestor |
| `perfil` | `/perfil` | Perfil de comerciantes y organizadores |
| `organizadores` | `/organizadores` | Organización propia del organizador |
| `gestor` | `/gestor` | Administración de cuentas, comerciantes, organizaciones, perfil y auditoría |
| `notificaciones` | `/notificaciones` | Bandeja de notificaciones del usuario autenticado |
| `panel` | `/panel` | Resumen inicial del gestor |
| `correo` | — | Envío de códigos, credenciales temporales y avisos |
| `common` | — | Filtro de errores, auditoría, parseo de IDs y serialización de BigInt |

### 1.3 Cobertura funcional del Sprint 1

Según la correspondencia documentada en `docs/`:

| HU | Funcionalidad | Estado backend |
|---|---|---|
| HU-01 | Registro y activación de comerciante | **Implementado** |
| HU-02 | Login seguro, intentos fallidos y bloqueo | **Implementado** |
| HU-03 | Creación de gestores municipales con invitación | **Implementado** |
| HU-04 | Perfil en tres secciones y cambio de contraseña | **Implementado para comerciante y organizador** |
| HU-05 | Activación, suspensión e inactivación con auditoría | **Implementado; el motivo se envía por correo** |
| HU-06 | Roles, permisos y acceso al panel | **Implementado** |
| HU-07 | Registro de organización y validación por gestor | **Implementado** |

**Conclusión:** no falta ningún endpoint funcional de las siete historias documentadas.
Lo que falta son **endpoints de soporte** y **ajustes de infraestructura** necesarios para
que el frontend pueda operar el Sprint 1 completo. Se detallan en la sección 8.

---

## 2. Convenciones para el frontend

### 2.1 URL base

La API se expone actualmente **sin prefijo global**:

```text
http://localhost:3000
```

Ejemplos reales:

```text
POST http://localhost:3000/auth/login
GET  http://localhost:3000/perfil
GET  http://localhost:3000/gestor/usuarios
```

> **Decisión cerrada:** la API se mantiene **sin prefijo global**. Las rutas reales
> comienzan directamente en `/auth`, `/perfil`, `/gestor`, etc. No se usará
> `app.setGlobalPrefix('api/v1')` en este sprint.

Variable para Next.js:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 2.2 CORS: habilitado para el frontend

El backend ya habilita CORS en `src/main.ts` para el origen configurado en
`FRONTEND_URL` (por defecto `http://localhost:3001`). La configuración permite
los métodos `GET`, `POST`, `PATCH`, `PUT`, `DELETE` y `OPTIONS`, y los encabezados
`Content-Type` y `Authorization`.

```ts
app.enableCors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3001',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
});
```

No se usa `origin: '*'`: el frontend debe ejecutarse en el origen permitido.

### 2.3 Documentación interactiva

| Recurso | URL |
|---|---|
| Swagger UI | `http://localhost:3000/api/docs` |
| OpenAPI JSON | `http://localhost:3000/api/docs-json` |

El JSON se puede importar en Postman o Insomnia.

### 2.4 Autenticación

Los endpoints protegidos esperan:

```http
Authorization: Bearer <accessToken>
```

El token se obtiene en `POST /auth/login` o en `POST /auth/gestor/primer-acceso`.

| Rol | Vigencia del token |
|---|---|
| Gestor (`revisor` o `administrador`) | 30 minutos (`expiresIn: 1800`) |
| Comerciante | 8 horas (`expiresIn: 28800`) |
| Organizador | 8 horas (`expiresIn: 28800`) |

**La autenticación usa access token + refresh token.** El access token dura 30
minutos para gestores y 8 horas para comerciantes/organizadores. El refresh token
dura 7 días por defecto (`JWT_REFRESH_EXPIRES_IN_SECONDS=604800`) y se guarda
hasheado en la tabla `sesiones`.

Cuando el access token expira, el frontend llama a `POST /auth/refresh` con el
refresh token. El backend rota el refresh: el anterior queda invalidado y se
emiten dos tokens nuevos. Si el refresh no es válido, está revocado, expiró o se
reutiliza el anterior, responde `401`.

`POST /auth/logout` marca `sesiones.revocada_en` en la base de datos. El access
token deja de servir inmediatamente y el refresh tampoco puede rotarse. La
revocación es persistente: sobrevive a reinicios del servidor. Opcionalmente se
puede enviar `{ "todas": true }` para cerrar todas las sesiones del usuario.

> Los access tokens emitidos antes de la introducción de `sesiones` no tienen el
> claim `sid` y serán rechazados con `401`. Tras el despliegue, todos los usuarios
> deben iniciar sesión una vez.

La recomendación de almacenamiento para el MVP es `sessionStorage` o memoria; si se usa
`localStorage`, debe asumirse el riesgo de XSS y aplicarse una política estricta de
contenido. Una cookie `httpOnly` requeriría un BFF o un cambio de contrato del backend.

### 2.5 Tipos de datos

| Tipo | Representación en JSON |
|---|---|
| IDs (`BIGINT`) | **String**: `"1"`, `"25"` |
| Fechas y horas | ISO 8601: `"2026-09-15T14:30:00.000Z"` |
| Fechas sin hora | ISO: `"2026-10-01"` |
| Horas de trámite | `"08:00"` |
| Decimales (`NUMERIC`) | **String**: `"50000.00"` |
| Booleanos | `true` / `false` |
| Enums | Valores exactos en minúsculas y `snake_case` |

**Regla para el frontend:** comparar IDs siempre como strings (`usuario.id === "5"`).
No convertirlos a `Number` para evitar pérdida de precisión.

### 2.6 Enums del Sprint 1

```text
rol_usuario:
  comerciante | organizador | gestor

estado_usuario:
  pendiente_activacion | activa | suspendida | inactiva

perfil_gestor:
  revisor | administrador

estado_organizacion:
  pendiente_validacion | activa | suspendida

categoria_comercio:
  formal | informal
```

### 2.7 Formato de errores

Los errores de NestJS y del filtro global usan el cuerpo estándar:

```json
{
  "statusCode": 409,
  "message": "El correo ya está registrado",
  "error": "Conflict"
}
```

En errores de validación, `message` puede ser un **array de strings**:

```json
{
  "statusCode": 400,
  "message": [
    "El correo no es válido",
    "La contraseña debe incluir al menos un número"
  ],
  "error": "Bad Request"
}
```

El frontend debe aceptar `message` como `string | string[]` y mostrar el primer mensaje
o una lista.

### 2.8 Códigos HTTP que debe manejar el frontend

| HTTP | Significado | Acción sugerida |
|---|---|---|
| `200` | Operación correcta | Mostrar datos o continuar el flujo |
| `201` | Recurso creado | Mostrar confirmación y siguiente paso |
| `400` | Validación o regla de negocio | Mostrar mensajes junto al formulario |
| `401` | Sin token, token inválido o expirado | Borrar sesión y redirigir a `/login` |
| `403` | Rol/perfil sin permiso o cuenta no activa | Mostrar mensaje y, si la cuenta no está activa, cerrar sesión |
| `404` | Recurso inexistente | Mostrar estado vacío o volver al listado |
| `409` | Duplicado, estado repetido o conflicto | Mostrar mensaje y refrescar datos |
| `423` | Cuenta bloqueada por intentos fallidos | Mostrar minutos restantes |
| `429` | Límite de peticiones por IP | Respetar `Retry-After` y deshabilitar el botón |
| `503` | Base de datos o correo no disponible | Mostrar aviso de reintento |

### 2.9 Rate limits actuales

| Endpoint | Límite |
|---|---|
| `POST /auth/login` | 10 peticiones por IP por minuto |
| `POST /auth/gestor/primer-acceso` | 10 peticiones por IP por minuto |
| `POST /auth/refresh` | 10 peticiones por IP por minuto |
| `POST /usuarios/comerciantes` | 10 peticiones por IP por minuto |
| `POST /usuarios/organizadores` | 10 peticiones por IP por minuto |
| `POST /usuarios/activacion` | 10 peticiones por IP por minuto |
| `POST /usuarios/activacion/reenviar` | 10 peticiones por IP por minuto |
| `POST /usuarios/password/recuperar` | 10 peticiones por IP por minuto |
| `POST /usuarios/password/restablecer` | 10 peticiones por IP por minuto |

El resto de endpoints no tiene rate limit explícito en el código actual.

---

## 3. Catálogo de endpoints existentes

**Total: 36 endpoints de negocio** (más Swagger y el endpoint raíz de salud).

| # | Método | Ruta | Acceso | Uso en el frontend |
|---|---|---|---|---|
| 1 | `GET` | `/` | Público | Verificar que la API responde |
| 2 | `POST` | `/auth/login` | Público | Inicio de sesión |
| 3 | `POST` | `/auth/gestor/primer-acceso` | Público | Cambio de contraseña temporal del gestor |
| 4 | `POST` | `/usuarios/comerciantes` | Público | Registro de comerciante |
| 5 | `POST` | `/usuarios/organizadores` | Público | Registro de la cuenta del organizador |
| 6 | `POST` | `/usuarios/activacion` | Público | Activación con código de 6 dígitos |
| 7 | `POST` | `/usuarios/activacion/reenviar` | Público | Reenviar código de activación |
| 8 | `POST` | `/usuarios/password/recuperar` | Público | Solicitar código de recuperación |
| 9 | `POST` | `/usuarios/password/restablecer` | Público | Definir nueva contraseña |
| 10 | `GET` | `/perfil` | Comerciante / Organizador | Ver perfil propio |
| 11 | `PATCH` | `/perfil` | Comerciante / Organizador | Editar datos personales |
| 12 | `PATCH` | `/perfil/password` | Comerciante / Organizador | Cambiar contraseña |
| 13 | `GET` | `/panel` | Gestor | Panel inicial del gestor |
| 14 | `POST` | `/gestor/gestores` | Gestor administrador | Crear otro gestor |
| 15 | `GET` | `/gestor/usuarios` | Gestor | Listado general de cuentas |
| 16 | `GET` | `/gestor/comerciantes` | Gestor | Listado específico de comerciantes |
| 17 | `GET` | `/gestor/usuarios/:id` | Gestor | Detalle de una cuenta |
| 18 | `PATCH` | `/gestor/usuarios/:id/estado` | Gestor administrador | Activar, suspender o inactivar; envía correo con motivo |
| 19 | `GET` | `/gestor/organizaciones` | Gestor | Listado de organizaciones |
| 20 | `GET` | `/gestor/organizaciones/:id` | Gestor | Detalle de una organización |
| 21 | `PATCH` | `/gestor/organizaciones/:id/estado` | Gestor administrador | Validar o suspender organización |
| 22 | `POST` | `/organizadores/mi-organizacion` | Organizador | Registrar la organización |
| 23 | `GET` | `/organizadores/mi-organizacion` | Organizador | Ver la organización propia |
| 24 | `PATCH` | `/organizadores/mi-organizacion` | Organizador | Actualizar la organización |
| 25 | `PATCH` | `/usuarios/:id/comerciante` | Gestor | Corregir datos sensibles del comerciante |
| 26 | `GET` | `/auth/me` | Autenticado | Recuperar la sesión actual |
| 27 | `POST` | `/auth/logout` | Autenticado | Cerrar sesión y revocar el token |
| 28 | `GET` | `/gestor/perfil` | Gestor | Ver el perfil del gestor autenticado |
| 29 | `PATCH` | `/gestor/perfil` | Gestor | Editar nombre, apellido y teléfono |
| 30 | `PATCH` | `/gestor/perfil/password` | Gestor | Cambiar la contraseña del gestor |
| 31 | `POST` | `/gestor/gestores/:id/reenviar-invitacion` | Gestor administrador | Reenviar credenciales temporales |
| 32 | `GET` | `/notificaciones` | Autenticado | Listar notificaciones propias |
| 33 | `PATCH` | `/notificaciones/:id/leida` | Autenticado | Marcar una notificación como leída |
| 34 | `PATCH` | `/notificaciones/leer-todas` | Autenticado | Marcar todas como leídas |
| 35 | `GET` | `/gestor/auditoria` | Gestor administrador | Consultar la auditoría sin datos sensibles |
| 36 | `POST` | `/auth/refresh` | Público | Renovar la sesión con refresh token |

---

## 4. Endpoints públicos

### 4.1 `GET /` — salud de la API

**Acceso:** público.

**Respuesta `200`:**

```text
Hello World!
```

Es texto plano, no JSON. Sirve para comprobar que el servidor está arriba.

---

### 4.2 `POST /auth/login` — iniciar sesión

**Acceso:** público.
**Rate limit:** 10 peticiones por IP por minuto.

**Cuerpo:**

```json
{
  "correo": "maria.gomez@gmail.com",
  "password": "Comerciante123"
}
```

| Campo | Obligatorio | Reglas |
|---|---|---|
| `correo` | Sí | Correo válido, máximo 150 caracteres; se normaliza a minúsculas |
| `password` | Sí | Texto no vacío |

**Respuesta `200` — login normal:**

```json
{
  "requiereCambioPassword": false,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "9f8c1b...",
  "tokenType": "Bearer",
  "expiresIn": 28800,
  "refreshExpiresIn": 604800,
  "usuario": {
    "id": "3",
    "nombre": "María",
    "apellido": "Gómez",
    "correo": "maria.gomez@gmail.com",
    "rol": "comerciante",
    "perfil": null,
    "estado": "activa"
  }
}
```

**Respuesta `200` — gestor pendiente de primer acceso:**

```json
{
  "requiereCambioPassword": true,
  "correo": "ana.lopez@tulua.gov.co",
  "nombre": "Ana",
  "perfil": "revisor",
  "mensaje": "Debes cambiar tu contraseña para activar la cuenta y acceder a la plataforma."
}
```

Esta respuesta **no incluye JWT**. El frontend debe redirigir a la vista de primer acceso
y conservar el correo para el siguiente paso.

**Errores:**

| HTTP | Causa | Mensaje típico |
|---|---|---|
| `400` | Cuerpo inválido | Errores del DTO |
| `401` | Correo o contraseña incorrectos | `Credenciales inválidas` |
| `403` | Cuenta pendiente no gestora, suspendida o inactiva | Mensaje según el estado |
| `423` | Cuenta bloqueada por intentos fallidos | Indica los minutos restantes |
| `429` | Límite por IP | Indica segundos de espera |

**Uso en el frontend:**

- Mapear `usuario.rol` y `usuario.perfil` para decidir la redirección.
- Si `requiereCambioPassword === true`, ir a `/primer-acceso`.
- Guardar `accessToken` y `usuario` en el almacén de sesión.
- Mostrar el mensaje de `403`/`423`/`429` tal como llega; son mensajes en español.
- No mostrar “correo no registrado” ni “contraseña incorrecta” por separado: el backend
  usa un único `401` para evitar enumeración de cuentas.

---

### 4.3 `POST /auth/gestor/primer-acceso` — contraseña definitiva del gestor

**Acceso:** público.
**Rate limit:** 10 peticiones por IP por minuto.

Se usa **solo** cuando el login devolvió `requiereCambioPassword: true`.

**Cuerpo:**

```json
{
  "correo": "ana.lopez@tulua.gov.co",
  "passwordActual": "Temporal123",
  "password": "NuevaClave456",
  "confirmarPassword": "NuevaClave456"
}
```

| Campo | Obligatorio | Reglas |
|---|---|---|
| `correo` | Sí | Correo válido |
| `passwordActual` | Sí | Contraseña temporal recibida por correo |
| `password` | Sí | 8–128 caracteres y al menos un número |
| `confirmarPassword` | Sí | Debe coincidir con `password` |

**Respuesta `200`:** la misma respuesta del login normal, con JWT:

```json
{
  "requiereCambioPassword": false,
  "accessToken": "...",
  "refreshToken": "9f8c1b...",
  "tokenType": "Bearer",
  "expiresIn": 1800,
  "refreshExpiresIn": 604800,
  "usuario": {
    "id": "9",
    "nombre": "Ana",
    "apellido": "López",
    "correo": "ana.lopez@tulua.gov.co",
    "rol": "gestor",
    "perfil": "revisor",
    "estado": "activa"
  }
}
```

**Errores:** `400`, `401`, `403`, `409` (cuenta ya activa), `423`, `429`.

**Uso en el frontend:**

- El campo “contraseña temporal” debe pedirse al usuario; no viene en la respuesta del login.
- Al completar, guardar el token y redirigir según `rol` y `perfil`.
- No confundir este flujo con la recuperación de contraseña.

---

### 4.4 `POST /usuarios/comerciantes` — registrar comerciante

**Acceso:** público.
**Respuesta:** `201`.

**Cuerpo:**

```json
{
  "nombre": "María",
  "apellido": "Gómez",
  "tipoDocumento": "CC",
  "documento": "1032456789",
  "telefono": "3214567890",
  "correo": "maria.gomez@gmail.com",
  "password": "Comerciante123",
  "confirmarPassword": "Comerciante123",
  "actividadComercial": "Venta de frutas y verduras",
  "categoria": "formal"
}
```

| Campo | Obligatorio | Reglas |
|---|---|---|
| `nombre` | Sí | 2–150 caracteres |
| `apellido` | No | 2–150 caracteres |
| `tipoDocumento` | Sí | `CC`, `CE`, `TI`, `PP` o `NIT` |
| `documento` | Sí | 5–30 caracteres: letras, números o guion; único |
| `telefono` | Sí | Formato `^[+0-9][0-9\s()-]{6,29}$` |
| `correo` | Sí | Correo válido, máximo 150; único sin distinguir mayúsculas |
| `password` | Sí | 8–128 caracteres y al menos un número |
| `confirmarPassword` | Sí | Debe coincidir |
| `actividadComercial` | Sí | 3–200 caracteres |
| `categoria` | Sí | `formal` o `informal` |

**Respuesta `201`:**

```json
{
  "id": "9",
  "nombre": "María",
  "apellido": "Gómez",
  "correo": "maria.gomez@gmail.com",
  "rol": "comerciante",
  "estado": "pendiente_activacion",
  "actividadComercial": "Venta de frutas y verduras",
  "categoria": "formal",
  "mensaje": "Cuenta creada en estado «Pendiente de activación». Revisa tu correo e ingresa el código de activación."
}
```

**Errores:**

| HTTP | Causa |
|---|---|
| `400` | Validaciones del DTO |
| `409` | Correo o documento ya registrados |
| `503` | La cuenta se creó, pero no se pudo enviar el código |

**Uso en el frontend:**

- Tras el `201`, **no hay sesión**: la cuenta está pendiente.
- Redirigir a la pantalla de activación con el correo precargado.
- Si llega `503`, la cuenta pudo haberse creado; ofrecer “reenviar código”.

---

### 4.5 `POST /usuarios/organizadores` — registrar cuenta de organizador

**Acceso:** público.
**Respuesta:** `201`.

**Cuerpo:**

```json
{
  "nombre": "Luis",
  "apellido": "Álvarez",
  "tipoDocumento": "CC",
  "documento": "801234567",
  "telefono": "3105551234",
  "correo": "luis.alvarez@agrovalle.org",
  "password": "Organizador123",
  "confirmarPassword": "Organizador123"
}
```

Tiene los mismos campos personales que el comerciante, **sin** `actividadComercial` ni
`categoria`.

**Respuesta `201`:**

```json
{
  "id": "7",
  "nombre": "Luis",
  "apellido": "Álvarez",
  "correo": "luis.alvarez@agrovalle.org",
  "rol": "organizador",
  "estado": "pendiente_activacion",
  "mensaje": "Cuenta de organizador creada en estado «Pendiente de activación». Revisa tu correo e ingresa el código de activación."
}
```

> **Importante:** este endpoint **no crea la organización**. Solo crea la cuenta personal.
> Después de activar la cuenta e iniciar sesión, el organizador debe registrar su
> organización con `POST /organizadores/mi-organizacion`.

**Errores:** `400`, `409` (correo o documento duplicado), `503` (correo no enviado).

---

### 4.6 `POST /usuarios/activacion` — activar cuenta

**Acceso:** público.
**Respuesta:** `200`.

**Cuerpo:**

```json
{
  "correo": "maria.gomez@gmail.com",
  "codigo": "123456"
}
```

| Campo | Obligatorio | Reglas |
|---|---|---|
| `correo` | Sí | Correo válido |
| `codigo` | Sí | Exactamente 6 dígitos |

**Respuesta `200`:**

```json
{
  "id": "9",
  "nombre": "María",
  "correo": "maria.gomez@gmail.com",
  "rol": "comerciante",
  "estado": "activa",
  "mensaje": "Cuenta activada correctamente. Ya puedes iniciar sesión."
}
```

**Errores:**

| HTTP | Causa |
|---|---|
| `400` | Código inválido, usado o expirado; cuenta inexistente o no pendiente |
| `409` | La cuenta ya está activa |

**Vigencia:** el código de activación dura **15 minutos** por defecto
(`ACTIVATION_CODE_TTL_MINUTES`).

**Uso en el frontend:**

- Formulario de 6 dígitos con un solo campo o seis casillas.
- Al activar, redirigir al login (no se emite token en este paso).
- Ofrecer “reenviar código” con temporizador.

---

### 4.7 `POST /usuarios/activacion/reenviar` — reenviar código

**Acceso:** público.
**Respuesta:** `200`.

**Cuerpo:**

```json
{ "correo": "maria.gomez@gmail.com" }
```

**Respuesta `200`:**

```json
{
  "mensaje": "Si el correo corresponde a una cuenta pendiente de activación, enviamos un nuevo código."
}
```

La respuesta es **genérica** exista o no la cuenta. No debe interpretarse como
confirmación de que el correo está registrado.

**Errores:** `400` (correo inválido), `503` (no se pudo enviar).

---

### 4.8 `POST /usuarios/password/recuperar` — solicitar recuperación

**Acceso:** público.
**Rate limit:** 10 peticiones por IP por minuto.

**Cuerpo:**

```json
{ "correo": "maria.gomez@gmail.com" }
```

**Respuesta `200`:**

```json
{
  "mensaje": "Si el correo corresponde a una cuenta activa, enviamos un código para restablecer la contraseña. Revisa tu correo: el código tiene vigencia corta."
}
```

**Notas:**

- Solo las cuentas **activas** reciben código.
- La respuesta es idéntica para correos inexistentes, pendientes, suspendidos o inactivos.
- El código de recuperación dura **2 minutos** por defecto
  (`PASSWORD_RECOVERY_CODE_TTL_MINUTES`).
- Cada solicitud invalida los códigos anteriores.

**Errores:** `400`, `429`, `503`.

---

### 4.9 `POST /usuarios/password/restablecer` — definir nueva contraseña

**Acceso:** público.
**Rate limit:** 10 peticiones por IP por minuto.

**Cuerpo:**

```json
{
  "correo": "maria.gomez@gmail.com",
  "codigo": "123456",
  "password": "NuevaClave456",
  "confirmarPassword": "NuevaClave456"
}
```

| Campo | Obligatorio | Reglas |
|---|---|---|
| `correo` | Sí | Correo válido |
| `codigo` | Sí | 6 dígitos |
| `password` | Sí | 8–128 caracteres y al menos un número |
| `confirmarPassword` | Sí | Debe coincidir |

**Respuesta `200`:**

```json
{
  "mensaje": "Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña."
}
```

**Errores:**

| HTTP | Causa |
|---|---|
| `400` | Código inválido, usado o expirado; contraseña fuera de política |
| `429` | Límite por IP |
| `503` | Error inesperado al actualizar |

El restablecimiento **desbloquea** la cuenta y limpia los intentos fallidos.

---

## 5. Endpoints autenticados

### 5.1 Perfil propio — `/perfil`

**Acceso:** roles `comerciante` y `organizador`.

#### `GET /perfil`

**Respuesta `200` para comerciante:**

```json
{
  "datosPersonales": {
    "id": "5",
    "nombre": "José",
    "apellido": "Pérez",
    "tipoDocumento": "CC",
    "documento": "1029384756",
    "telefono": "3001122334"
  },
  "actividadComercial": {
    "actividadComercial": "Venta de frutas y verduras",
    "categoria": "formal"
  },
  "seguridad": {
    "correo": "jose.perez@hotmail.com",
    "estado": "activa",
    "creadoEn": "2026-09-15T14:30:00.000Z"
  }
}
```

**Respuesta `200` para organizador:**

```json
{
  "datosPersonales": {
    "id": "7",
    "nombre": "Luis",
    "apellido": "Álvarez",
    "tipoDocumento": "CC",
    "documento": "801234567",
    "telefono": "3105551234"
  },
  "organizacion": {
    "nombreOrganizacion": "Fundación Agroecológica del Valle",
    "nit": "900123456-1",
    "representante": "Luis Álvarez",
    "tipoFeria": "Feria agroecológica",
    "contacto": "3105551234",
    "estado": "pendiente_validacion",
    "validadoEn": null
  },
  "seguridad": {
    "correo": "luis.alvarez@agrovalle.org",
    "estado": "activa",
    "creadoEn": "2026-09-15T14:30:00.000Z"
  }
}
```

`organizacion` puede ser `null` si el organizador aún no la ha registrado.

**Errores:** `401`, `403` (rol gestor o sin token activo), `404` (perfil inconsistente).

**Uso en el frontend:**

- Pantalla “Mi perfil” para comerciante y organizador.
- Tres secciones: **datos personales**, **actividad/organización** y **seguridad**.
- El gestor **no puede usar este endpoint**; para él existe `GET /panel`.

#### `PATCH /perfil`

**Cuerpo permitido:**

```json
{
  "nombre": "José Antonio",
  "apellido": "Pérez",
  "telefono": "3115550000"
}
```

| Campo | Obligatorio | Reglas |
|---|---|---|
| `nombre` | No | 2–150 caracteres |
| `apellido` | No | 2–150 caracteres o `null` para limpiarlo |
| `telefono` | No | Mismo formato del registro |

Debe enviarse **al menos uno**. Respuesta: el perfil completo actualizado.

**Campos bloqueados:** `documento`, `tipoDocumento`, `actividadComercial`, `categoria`,
`nombreOrganizacion`, `nit`, `correo` y `estado`. Si se envían, el `ValidationPipe`
responde `400` porque no forman parte del DTO.

**Errores:** `400`, `401`, `403`.

**Uso en el frontend:**

- Mostrar documento, tipo de documento, actividad y categoría como **solo lectura**.
- Ofrecer un aviso: “Para corregir documento o actividad comercial, contacta a la
  Secretaría de Gobierno”.
- Los datos de la organización se editan en `/organizadores/mi-organizacion`.

#### `PATCH /perfil/password`

**Cuerpo:**

```json
{
  "passwordActual": "Comerciante123",
  "passwordNueva": "NuevaClave456",
  "confirmarPassword": "NuevaClave456"
}
```

**Respuesta `200`:**

```json
{
  "mensaje": "Contraseña actualizada correctamente. Enviamos un aviso a tu correo."
}
```

**Errores:** `400` (actual incorrecta o nueva fuera de política), `401`, `403`.

**Uso en el frontend:**

- Formulario con tres campos y opción de mostrar/ocultar contraseña.
- Tras el éxito, mantener la sesión actual o pedir re-login según la política de UX.
- Se envía un aviso al correo; si el correo falla, el cambio igual se aplica.

---

### 5.2 Organización propia — `/organizadores/mi-organizacion`

**Acceso:** rol `organizador`.

#### `POST /organizadores/mi-organizacion`

**Cuerpo:**

```json
{
  "nombreOrganizacion": "Fundación Agroecológica del Valle",
  "nit": "900123456-1",
  "representante": "Luis Álvarez",
  "tipoFeria": "Feria agroecológica",
  "contacto": "3105551234"
}
```

| Campo | Obligatorio | Reglas |
|---|---|---|
| `nombreOrganizacion` | Sí | 3–200; único sin distinguir mayúsculas |
| `nit` | Sí | 8–10 dígitos y opcionalmente `-` + dígito; único |
| `representante` | Sí | 3–150 |
| `tipoFeria` | Sí | 3–100 |
| `contacto` | No | 3–150 |

**Respuesta `201`:**

```json
{
  "usuarioId": "7",
  "nombreOrganizacion": "Fundación Agroecológica del Valle",
  "nit": "900123456-1",
  "representante": "Luis Álvarez",
  "tipoFeria": "Feria agroecológica",
  "contacto": "3105551234",
  "estado": "pendiente_validacion",
  "validadoEn": null,
  "mensaje": "Organización registrada en estado «Pendiente de validación»."
}
```

**Errores:**

| HTTP | Causa |
|---|---|
| `400` | Validaciones |
| `403` | Rol distinto de organizador |
| `409` | Ya tiene organización, o NIT/nombre duplicado |
| `401` | Sin token o expirado |

Solo se permite **una organización por organizador**.

#### `GET /organizadores/mi-organizacion`

Devuelve la organización propia. Si no existe, `404`.

#### `PATCH /organizadores/mi-organizacion`

Actualización parcial de `nombreOrganizacion`, `nit`, `representante`, `tipoFeria` y
`contacto`; al menos uno. Revalida unicidad de nombre y NIT.

No acepta `estado`, `validadoPor` ni `validadoEn`: eso corresponde al gestor.

**Uso en el frontend:**

- Después de activar la cuenta y hacer login, si `GET /perfil` devuelve
  `organizacion: null`, mostrar un **onboarding obligatorio** para registrarla.
- Si `estado = pendiente_validacion`, mostrar una pantalla informativa de “en revisión”.
- Si `estado = suspendida`, mostrar el estado y un medio de contacto.
- El formulario de edición no debe incluir campos de validación.

---

### 5.3 Panel del gestor — `GET /panel`

**Acceso:** rol `gestor` (revisor y administrador).
**JWT:** vence a los 30 minutos.

**Respuesta `200`:**

```json
{
  "gestor": {
    "id": "1",
    "nombre": "Laura",
    "apellido": "Martínez",
    "correo": "admin@tulua.gov.co",
    "perfil": "administrador"
  },
  "indicadores": {
    "usuarios": {
      "estados": {
        "total": 8,
        "pendientesActivacion": 1,
        "activas": 6,
        "suspendidas": 1,
        "inactivas": 0
      },
      "roles": {
        "comerciante": 4,
        "organizador": 2,
        "gestor": 2
      }
    },
    "solicitudes": {
      "total": 4,
      "porEstado": {
        "borrador": 1,
        "radicada": 1,
        "en_revision": 0,
        "devuelta": 0,
        "aprobada": 1,
        "rechazada": 1,
        "cancelada": 0
      }
    },
    "permisos": {
      "total": 1,
      "porEstado": {
        "vigente": 1,
        "suspendido": 0,
        "revocado": 0,
        "vencido": 0
      }
    },
    "ferias": {
      "total": 2,
      "porEstado": {
        "radicada": 1,
        "aprobada": 1,
        "rechazada": 0,
        "cancelada": 0,
        "realizada": 0
      }
    }
  }
}
```

**Errores:** `401`, `403` (comerciante u organizador), `503`.

**Uso en el frontend:**

- Es la pantalla de inicio del gestor.
- Mostrar tarjetas con los conteos y accesos a “Usuarios” y “Organizaciones”.
- Diferenciar visualmente `perfil = revisor` (solo consulta) de
  `perfil = administrador` (acciones de escritura).
- Los mapas `porEstado` siempre incluyen todas las claves, incluso en `0`.

---

### 5.4 Crear gestor — `POST /gestor/gestores`

**Acceso:** gestor con perfil `administrador`.

**Cuerpo:**

```json
{
  "nombre": "Ana",
  "apellido": "López",
  "correo": "ana.lopez@tulua.gov.co",
  "perfil": "revisor"
}
```

| Campo | Obligatorio | Reglas |
|---|---|---|
| `nombre` | Sí | 2–150 |
| `apellido` | No | 2–150 |
| `correo` | Sí | Correo válido, único |
| `perfil` | Sí | `revisor` o `administrador` |

**Respuesta `201`:**

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

**Comportamiento:**

- Genera una contraseña temporal y la envía por correo.
- La cuenta nace en `pendiente_activacion`.
- La respuesta **no incluye la contraseña temporal**.
- Si el correo falla, responde `503`; la cuenta queda creada en pendiente.

**Errores:** `400`, `401`, `403`, `409`, `503`.

**Uso en el frontend:**

- Pantalla “Crear gestor” solo visible para administrador.
- Tras el `201`, mostrar confirmación y explicar que debe revisar el correo.
- Si `503`, advertir que la cuenta pudo crearse y usar
  `POST /gestor/gestores/:id/reenviar-invitacion` para generar una nueva contraseña
  temporal.

---

### 5.5 Listado general de cuentas — `GET /gestor/usuarios`

**Acceso:** gestor. El alcance depende del perfil.

**Query params:**

| Parámetro | Tipo | Descripción |
|---|---|---|
| `busqueda` | texto (máx. 150) | Nombre, apellido, correo, documento, actividad u organización |
| `rol` | `comerciante` \| `organizador` \| `gestor` | Filtro por rol |
| `estado` | `pendiente_activacion` \| `activa` \| `suspendida` \| `inactiva` | Filtro por estado |
| `perfil` | `revisor` \| `administrador` | Solo administrador |
| `pagina` | entero ≥ 1 | Por defecto `1` |
| `limite` | entero 1–100 | Por defecto `20` |

**Alcance:**

- **Administrador:** cualquier cuenta y cualquier filtro.
- **Revisor:** solo comerciantes y organizadores. Si intenta `rol=gestor` o `perfil`,
  recibe `403`.

**Respuesta `200`:**

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

`totalPaginas` es `0` cuando no hay resultados.

**Errores:** `400`, `401`, `403`.

**Uso en el frontend:**

- Es la pantalla principal de administración de cuentas.
- La tabla debe mostrar rol, estado, perfil (si aplica), organización y fecha de registro.
- Si el usuario es revisor, ocultar los filtros de rol gestor y perfil.
- El detalle se abre con `GET /gestor/usuarios/:id`.

---

### 5.6 Listado de comerciantes — `GET /gestor/comerciantes`

**Acceso:** gestor (revisor y administrador).

**Query params:**

| Parámetro | Tipo | Descripción |
|---|---|---|
| `busqueda` | texto (máx. 150) | Nombre, apellido, correo, documento o actividad |
| `estado` | enum de estado de usuario | Filtro por estado |
| `categoria` | `formal` \| `informal` | Filtro por categoría |
| `pagina` | entero ≥ 1 | Por defecto `1` |
| `limite` | entero 1–100 | Por defecto `20` |

**Respuesta `200`:** igual estructura que el listado general, con:

```json
{
  "datos": [
    {
      "id": "5",
      "nombre": "José",
      "apellido": "Pérez",
      "tipoDocumento": "CC",
      "documento": "1029384756",
      "correo": "jose.perez@hotmail.com",
      "telefono": "3001122334",
      "estado": "activa",
      "categoria": "formal",
      "actividadComercial": "Venta de frutas y verduras",
      "totalSolicitudes": 3,
      "totalPermisos": 1,
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

**Uso en el frontend:** vista especializada de comerciantes. Puede reutilizar la tabla
del listado general cambiando columnas y filtros.

---

### 5.7 Detalle de cuenta — `GET /gestor/usuarios/:id`

**Acceso:**

- Administrador: cualquier cuenta.
- Revisor: solo comerciantes y organizadores.

**Parámetro:** `id` numérico. Si no es numérico, `400`.

**Respuesta `200` (resumen):**

```json
{
  "usuario": {
    "id": "5",
    "nombre": "José",
    "apellido": "Pérez",
    "tipoDocumento": "CC",
    "documento": "1029384756",
    "telefono": "3001122334",
    "correo": "jose.perez@hotmail.com",
    "rol": "comerciante",
    "estado": "activa",
    "creadoEn": "2026-09-15T14:30:00.000Z",
    "actualizadoEn": "2026-09-20T10:00:00.000Z",
    "perfilComercial": {
      "actividadComercial": "Venta de frutas y verduras",
      "categoria": "formal",
      "actualizadoEn": "2026-09-15T14:30:00.000Z"
    },
    "perfilGestor": null,
    "organizacion": null
  },
  "solicitudes": [
    {
      "id": "12",
      "numeroRadicado": "SOL-2026-00012",
      "estado": "aprobada",
      "actividad": "Venta de frutas y verduras",
      "fechaInicio": "2026-10-01",
      "fechaFin": "2026-10-31",
      "horaInicio": "08:00",
      "horaFin": "18:00",
      "radicadaEn": "2026-09-20T15:00:00.000Z",
      "decididaEn": "2026-09-21T09:30:00.000Z",
      "motivoRechazo": null,
      "creadoEn": "2026-09-19T11:00:00.000Z",
      "espacio": "Espacio móvil Calle 30 - A",
      "permiso": {
        "numero": "PER-2026-00007",
        "estado": "vigente"
      }
    }
  ],
  "permisos": [
    {
      "id": "7",
      "numero": "PER-2026-00007",
      "categoriaAutorizada": "Venta de frutas y verduras",
      "fechaInicio": "2026-10-01",
      "fechaFin": "2026-10-31",
      "estado": "vigente",
      "emitidoEn": "2026-09-21T10:00:00.000Z",
      "espacio": "Espacio móvil Calle 30 - A",
      "solicitudNumero": "SOL-2026-00012",
      "cobro": {
        "valor": "50000.00",
        "estado": "pagado",
        "pagadoEn": "2026-09-22T10:00:00.000Z"
      }
    }
  ],
  "totales": {
    "solicitudes": 1,
    "permisos": 1
  }
}
```

**Notas:**

- Para organizadores, `organizacion` trae los datos y `solicitudes`/`permisos` quedan vacíos.
- Para gestores, `perfilGestor` trae `perfil` y `creadoPor`.
- No se expone `password_hash` ni `qr_token`.
- Los valores `NUMERIC` se devuelven como string.

**Errores:** `400`, `401`, `403` (revisor consultando un gestor), `404`.

**Uso en el frontend:**

- Pantalla de detalle con pestañas: “Datos”, “Solicitudes”, “Permisos”.
- Botones de cambio de estado solo para administrador.
- Mostrar un estado vacío cuando las listas no tengan elementos.

---

### 5.8 Cambiar estado de una cuenta — `PATCH /gestor/usuarios/:id/estado`

**Acceso:** solo gestor `administrador`.

**Cuerpo:**

```json
{ "estado": "suspendida" }
```

Estados permitidos: `activa`, `suspendida`, `inactiva`.

**Respuesta `200`:**

```json
{
  "id": "5",
  "nombre": "José",
  "correo": "jose.perez@hotmail.com",
  "estadoAnterior": "activa",
  "estado": "suspendida",
  "mensaje": "Cuenta suspendida. El cambio quedó registrado en la auditoría."
}
```

**Reglas de negocio:**

| Caso | Resultado |
|---|---|
| El administrador cambia su propia cuenta | `403` |
| La cuenta objetivo es un gestor en `pendiente_activacion` | `409` |
| La cuenta objetivo es otro administrador activo | Solo si hay al menos dos administradores activos |
| La cuenta ya está en ese estado | `409` |
| La cuenta no existe | `404` |
| Se activa una cuenta | Se limpian intentos fallidos y bloqueo |

**Motivo:** el cuerpo acepta `motivo` (3–300 caracteres). Es opcional, pero se
recomienda enviarlo al suspender o inactivar. El backend envía un correo al titular
con el motivo; no se agrega ninguna columna nueva a la base de datos. El motivo
también se devuelve en la respuesta del administrador.

```json
{
  "estado": "suspendida",
  "motivo": "Incumplimiento del horario autorizado"
}
```

Al intentar iniciar sesión con una cuenta suspendida o inactiva, el login responde
`403` con el mensaje genérico:

- Suspensión: «Su cuenta ha sido suspendida, comuníquese con soporte para activarla.»
- Inactivación: «Su cuenta ha sido desactivada, comuníquese con soporte para activarla.»

**Uso en el frontend:**

- Mostrar el estado actual y un menú de acciones.
- Confirmar la acción con un modal.
- Si `403` por ser la propia cuenta, deshabilitar el botón.
- Si `409`, refrescar el detalle y explicar el motivo.
- Tras el cambio, actualizar la fila y el detalle.

---

### 5.9 Organizaciones — `/gestor/organizaciones`

#### `GET /gestor/organizaciones`

**Acceso:** gestor (revisor y administrador).

**Query params:**

| Parámetro | Tipo | Descripción |
|---|---|---|
| `busqueda` | texto (máx. 150) | Organizador, correo, organización, NIT o representante |
| `estado` | `pendiente_validacion` \| `activa` \| `suspendida` | Filtro |
| `pagina` | entero ≥ 1 | Por defecto `1` |
| `limite` | entero 1–100 | Por defecto `20` |

**Respuesta `200`:**

```json
{
  "datos": [
    {
      "usuarioId": "7",
      "nombreOrganizacion": "Fundación Agroecológica del Valle",
      "nit": "900123456-1",
      "representante": "Luis Álvarez",
      "tipoFeria": "Feria agroecológica",
      "contacto": "3105551234",
      "estado": "pendiente_validacion",
      "validadoEn": null,
      "nombre": "Luis",
      "apellido": "Álvarez",
      "correo": "luis.alvarez@agrovalle.org",
      "telefono": "3105551234",
      "validadoPor": null,
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

Solo aparecen organizadores que ya registraron su organización.

#### `GET /gestor/organizaciones/:id`

`:id` es el `usuario_id` del organizador. Devuelve el mismo detalle de la organización
con los datos del organizador. `404` si no existe.

#### `PATCH /gestor/organizaciones/:id/estado`

**Acceso:** solo administrador.

**Cuerpo:**

```json
{
  "estado": "activa",
  "motivo": "Documentación verificada"
}
```

- `estado`: `activa` o `suspendida`.
- `motivo`: opcional, 3–300 caracteres.
- Actualiza `validado_por` y `validado_en`.
- Crea una notificación interna para el organizador.
- Si ya está en ese estado, `409`.
- No existe el estado `rechazada`; un rechazo se representa como `suspendida`.

**Uso en el frontend:**

- El revisor puede listar y ver, pero no validar.
- El administrador ve los botones “Activar” y “Suspender”.
- Pedir confirmación y, si se suspende, solicitar un motivo.

---

### 5.10 Corregir comerciante — `PATCH /usuarios/:id/comerciante`

**Acceso:** gestor (revisor y administrador).

**Cuerpo (al menos un campo):**

```json
{
  "documento": "1029384756",
  "tipoDocumento": "CC",
  "actividadComercial": "Venta de frutas, verduras y legumbres",
  "categoria": "formal"
}
```

| Campo | Reglas |
|---|---|
| `documento` | 5–30, letras/números/guion; único |
| `tipoDocumento` | `CC`, `CE`, `TI`, `PP`, `NIT` |
| `actividadComercial` | 3–200 |
| `categoria` | `formal` o `informal` |

**Respuesta `200`:**

```json
{
  "id": "5",
  "nombre": "José",
  "apellido": "Pérez",
  "tipoDocumento": "CC",
  "documento": "1029384756",
  "telefono": "3001122334",
  "correo": "jose.perez@hotmail.com",
  "estado": "activa",
  "actividadComercial": "Venta de frutas, verduras y legumbres",
  "categoria": "formal",
  "mensaje": "Datos del comerciante actualizados. El cambio quedó registrado en la auditoría."
}
```

**Errores:** `400` (id no numérico o sin campos), `401`, `403` (no gestor), `404`
(no existe o no es comerciante), `409` (documento duplicado).

**Uso en el frontend:**

- Formulario de corrección dentro del detalle del comerciante.
- Solo para gestores, no para el propio comerciante.
- El comerciante ve esos campos como solo lectura en `/perfil`.

### 5.11 Sesión, refresh y logout — `/auth/me`, `/auth/refresh`, `/auth/logout`

#### `GET /auth/me`

**Acceso:** autenticado (cualquier rol activo).

Devuelve el mismo objeto `usuario` que entrega el login:

```json
{
  "id": "3",
  "nombre": "María",
  "apellido": "Gómez",
  "correo": "maria.gomez@gmail.com",
  "rol": "comerciante",
  "perfil": null,
  "estado": "activa"
}
```

Sirve para validar la sesión al recargar la página y decidir la redirección por rol.
Responde `401` si el token falta, es inválido, expiró o su sesión fue revocada.

#### `POST /auth/refresh`

**Acceso:** público con rate limit de 10 peticiones por IP por minuto.

```json
{ "refreshToken": "9f8c1b..." }
```

**Respuesta `200`:**

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "tokenType": "Bearer",
  "expiresIn": 28800,
  "refreshExpiresIn": 604800,
  "usuario": {
    "id": "3",
    "nombre": "María",
    "apellido": "Gómez",
    "correo": "maria.gomez@gmail.com",
    "rol": "comerciante",
    "perfil": null,
    "estado": "activa"
  }
}
```

El refresh anterior queda invalidado por rotación. Si se reutiliza, la sesión se
revoca y responde `401`.

#### `POST /auth/logout`

**Acceso:** autenticado.
**Respuesta:** `204 No Content`.

Cuerpo opcional:

```json
{ "todas": false }
```

El backend marca `sesiones.revocada_en` para la sesión actual. El access token deja
de servir inmediatamente y el refresh token ya no puede rotarse. Con `todas: true`
se revocan todas las sesiones del usuario. El frontend debe eliminar ambos tokens
de su almacenamiento.

---

### 5.12 Perfil del gestor — `/gestor/perfil`

**Acceso:** rol `gestor` (revisor y administrador).

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/gestor/perfil` | Datos del gestor autenticado |
| `PATCH` | `/gestor/perfil` | Actualiza `nombre`, `apellido` y/o `telefono` |
| `PATCH` | `/gestor/perfil/password` | Cambia la contraseña del gestor |

**Respuesta de `GET /gestor/perfil`:**

```json
{
  "id": "1",
  "nombre": "Laura",
  "apellido": "Martínez",
  "correo": "admin@tulua.gov.co",
  "telefono": "3001122334",
  "perfil": "administrador",
  "estado": "activa",
  "creadoEn": "2026-09-15T14:30:00.000Z",
  "actualizadoEn": "2026-09-20T10:00:00.000Z"
}
```

**Cuerpo de `PATCH /gestor/perfil/password`:**

```json
{
  "passwordActual": "Admin1234",
  "passwordNueva": "NuevaClave456",
  "confirmarPassword": "NuevaClave456"
}
```

El cambio de contraseña exige la actual, aplica la política de 8–128 caracteres con
al menos un número y envía un aviso al correo institucional.

---

### 5.13 Reenviar invitación a un gestor

**Ruta:** `POST /gestor/gestores/:id/reenviar-invitacion`
**Acceso:** solo gestor administrador.
**Respuesta:** `200`.

```json
{
  "id": "9",
  "correo": "ana.lopez@tulua.gov.co",
  "perfil": "revisor",
  "mensaje": "Invitación reenviada. El gestor recibirá una nueva contraseña temporal por correo."
}
```

Reglas:

- Solo para cuentas con rol `gestor` y estado `pendiente_activacion`.
- Genera una nueva contraseña temporal, actualiza el hash y limpia bloqueos.
- Envía el correo con las credenciales.
- Si la cuenta ya está activa o no está pendiente, responde `409`.
- La contraseña temporal no se devuelve en la respuesta.

---

### 5.14 Notificaciones — `/notificaciones`

**Acceso:** cualquier usuario autenticado. Cada usuario solo ve sus propias
notificaciones.

#### `GET /notificaciones`

Query params: `leida` (`true`/`false`), `pagina` (desde 1), `limite` (1–100).

```json
{
  "datos": [
    {
      "id": "12",
      "tipo": "cambio_password",
      "asunto": "Contraseña actualizada",
      "cuerpo": "La contraseña de tu cuenta fue actualizada.",
      "canal": "app",
      "leida": false,
      "creadaEn": "2026-09-20T10:00:00.000Z"
    }
  ],
  "paginacion": {
    "pagina": 1,
    "limite": 20,
    "total": 1,
    "totalPaginas": 1
  },
  "noLeidas": 1
}
```

#### `PATCH /notificaciones/:id/leida`

Cuerpo opcional: `{ "leida": true }`. Por defecto marca como leída. Una notificación
de otro usuario responde `404`.

#### `PATCH /notificaciones/leer-todas`

Marca todas las no leídas del usuario y devuelve `{ "actualizadas": 2, "mensaje": "..." }`.

---

### 5.15 Auditoría — `GET /gestor/auditoria`

**Acceso:** solo gestor administrador.

Query params: `tabla`, `registroId`, `accion` (`insert`/`update`/`delete`), `pagina`,
`limite`.

Devuelve los registros de `auditoria` con el actor y los valores anterior/nuevo.
Los campos `password_hash`, `token_hash` y `qr_token` se eliminan recursivamente
antes de responder.

---

## 6. Flujos de frontend

### 6.1 Página de bienvenida

**Ruta sugerida:** `/`

**Contenido:**

- Encabezado con nombre de la Alcaldía y de la plataforma.
- Hero con el propósito: ordenar el espacio público, ferias agroecológicas y comercio
  formal/informal de Tuluá.
- Sección “¿Cómo funciona?” con tres pasos.
- Sección de eventos o ferias destacadas.
- Sección “Consulta el mapa” con un aviso de próxima disponibilidad.
- Llamados a la acción: **Iniciar sesión** y **Registrarse**.
- Pie de página con información de contacto y enlaces legales.

**Navbar:**

- Visitante: `Iniciar sesión` y `Registrarse`.
- Usuario autenticado: nombre, rol y `Cerrar sesión`.
- En móvil: menú hamburguesa con las mismas acciones.

**Datos:**

- En el Sprint 1 **no existe un endpoint público de eventos o ferias**. La sección de
  eventos debe alimentarse con contenido estático o un placeholder “Próximamente”.
- Tampoco existe endpoint público de mapa. El botón debe mostrarse deshabilitado o
  llevar a una vista informativa.
- No llamar endpoints protegidos desde la bienvenida.

### 6.2 Login

**Ruta sugerida:** `/login`

**Formulario:** correo y contraseña.

**Flujo:**

1. Enviar `POST /auth/login`.
2. Si `requiereCambioPassword === true`:
   - Guardar el correo.
   - Redirigir a `/primer-acceso`.
3. Si hay `accessToken`:
   - Guardar `accessToken`, `refreshToken` y `usuario`.
   - Redirigir según rol:

| `usuario.rol` | `usuario.perfil` | Destino sugerido |
|---|---|---|
| `comerciante` | — | `/comerciante/inicio` |
| `organizador` | — | `/organizador/inicio` |
| `gestor` | `revisor` | `/gestor/panel` |
| `gestor` | `administrador` | `/gestor/panel` |

4. Manejar errores:
   - `401`: “Correo o contraseña incorrectos”.
   - `403`: mostrar el mensaje del backend (pendiente, suspendida, inactiva).
   - `423`: mostrar minutos de bloqueo.
   - `429`: mostrar segundos de espera y deshabilitar el botón.

**Texto de ayuda:** enlace “¿Olvidaste tu contraseña?” a `/recuperar`.

### 6.3 Registro

**Ruta sugerida:** `/registro`

Primero se elige el tipo de cuenta:

- **Comerciante:** vende productos o servicios en el espacio público.
- **Organizador de feria:** representa una organización que realiza ferias.

#### Formulario de comerciante

**Ruta:** `/registro/comerciante`

| Campo | Tipo | Obligatorio |
|---|---|---|
| Nombres | texto | Sí |
| Apellidos | texto | No |
| Tipo de documento | select `CC/CE/TI/PP/NIT` | Sí |
| Documento | texto | Sí |
| Teléfono | tel | Sí |
| Correo | email | Sí |
| Contraseña | password | Sí |
| Confirmar contraseña | password | Sí |
| Actividad comercial | texto | Sí |
| Categoría | select `formal/informal` | Sí |

**Endpoint:** `POST /usuarios/comerciantes`.

#### Formulario de organizador

**Ruta:** `/registro/organizador`

| Campo | Tipo | Obligatorio |
|---|---|---|
| Nombres | texto | Sí |
| Apellidos | texto | No |
| Tipo de documento | select `CC/CE/TI/PP/NIT` | Sí |
| Documento | texto | Sí |
| Teléfono | tel | Sí |
| Correo | email | Sí |
| Contraseña | password | Sí |
| Confirmar contraseña | password | Sí |

**Endpoint:** `POST /usuarios/organizadores`.

**Importante:** no pedir en este formulario el nombre de la organización, NIT,
representante ni tipo de feria. Esos datos se registran después de activar la cuenta, en
`/organizador/mi-organizacion`.

**Después del registro:**

- Mostrar mensaje: “Cuenta creada. Revisa tu correo e ingresa el código de activación”.
- Redirigir a `/activar?correo=...`.
- Si llega `409`, indicar si el correo o el documento ya existen.
- Si llega `503`, avisar que la cuenta pudo crearse y ofrecer reenviar el código.

### 6.4 Activación de cuenta

**Ruta sugerida:** `/activar`

**Formulario:** correo (precargado) y código de 6 dígitos.

**Endpoint:** `POST /usuarios/activacion`.

**Flujo:**

1. Ingresar el código.
2. Si `200`, mostrar éxito y enlace a `/login`.
3. Si `400`, mostrar “El código es inválido o ha expirado”.
4. Si `409`, la cuenta ya está activa; enlazar a login.
5. Ofrecer “Reenviar código” con `POST /usuarios/activacion/reenviar`.
6. Mostrar temporizador de vigencia (15 minutos) y bloquear el reenvío unos segundos.

### 6.5 Recuperación de contraseña

**Ruta sugerida:** `/recuperar`

**Paso 1:** correo.
**Endpoint:** `POST /usuarios/password/recuperar`.
**Respuesta:** mensaje genérico. No afirmar que el correo existe.

**Paso 2:** código + nueva contraseña + confirmación.
**Ruta:** `/restablecer?correo=...`
**Endpoint:** `POST /usuarios/password/restablecer`.

**Reglas de UI:**

- El código vence en 2 minutos; mostrar aviso y permitir solicitar otro.
- La contraseña debe tener 8–128 caracteres y al menos un número.
- Al completar, redirigir a `/login`.
- No permitir recuperación para cuentas pendientes: esas deben usar activación.
- Si el usuario es un gestor pendiente que perdió su contraseña temporal, el
  administrador puede reenviar la invitación con
  `POST /gestor/gestores/:id/reenviar-invitacion`.

### 6.6 Primer acceso del gestor

**Ruta sugerida:** `/primer-acceso`

Se llega aquí solo desde el login con `requiereCambioPassword: true`.

**Formulario:**

- Correo (precargado, editable si se desea).
- Contraseña temporal.
- Nueva contraseña.
- Confirmar nueva contraseña.

**Endpoint:** `POST /auth/gestor/primer-acceso`.

Al completar, guardar el token y redirigir a `/gestor/panel`.

### 6.7 Onboarding de la organización

**Ruta sugerida:** `/organizador/mi-organizacion`

Después del login, consultar `GET /perfil`.

- Si `organizacion === null`: mostrar formulario de creación.
- Si `organizacion.estado === "pendiente_validacion"`: mostrar pantalla “Tu organización
  está en revisión”.
- Si `organizacion.estado === "activa"`: mostrar datos y permitir edición.
- Si `organizacion.estado === "suspendida"`: mostrar estado y canal de contacto.

**Endpoints:** `POST`, `GET` y `PATCH /organizadores/mi-organizacion`.

### 6.8 Perfil

**Rutas sugeridas:**

- `/comerciante/perfil`
- `/organizador/perfil`

**Secciones:**

1. **Datos personales:** nombre, apellido y teléfono editables.
2. **Actividad u organización:** solo lectura en `/perfil`.
3. **Seguridad:** correo y estado de la cuenta; cambio de contraseña.

**Endpoints:** `GET /perfil`, `PATCH /perfil`, `PATCH /perfil/password`.

### 6.9 Gestión de usuarios para el gestor

**Rutas sugeridas:**

- `/gestor/panel`
- `/gestor/usuarios`
- `/gestor/usuarios/[id]`
- `/gestor/comerciantes`
- `/gestor/organizaciones`
- `/gestor/organizaciones/[id]`
- `/gestor/gestores/nuevo`

**Revisor:**

- Puede ver panel, usuarios comerciantes/organizadores, detalle y organizaciones.
- No puede crear gestores, cambiar estados ni validar organizaciones.
- La interfaz debe ocultar esas acciones; el backend igual responde `403`.

**Administrador:**

- Puede ver todo.
- Puede crear gestores.
- Puede reenviar la invitación a un gestor pendiente.
- Puede activar, suspender e inactivar cuentas; al suspender o inactivar se envía
  un correo al titular con el motivo informado.
- Puede activar o suspender organizaciones.
- Puede corregir datos sensibles de comerciantes.
- Puede consultar la auditoría del sistema.

### 6.10 Sesión y expiración

- Guardar `accessToken`, `refreshToken` y `usuario` al iniciar sesión.
- Añadir el header `Authorization` en cada petición protegida.
- Al recargar, llamar a `GET /auth/me` para validar el token y recuperar el rol.
- Ante `401` por access token expirado, intentar `POST /auth/refresh` **una sola vez**.
  Si el refresh falla, borrar ambos tokens y redirigir a `/login`.
- No reintentar el refresh en bucle si el `401` viene de una sesión revocada.
- Ante `403` por cuenta suspendida o inactiva, mostrar el mensaje y cerrar sesión.
- El access token del gestor dura 30 minutos; el de comerciante/organizador, 8 horas.
  El refresh token dura 7 días por defecto.
- Para cerrar sesión, llamar a `POST /auth/logout` y eliminar ambos tokens del
  almacenamiento local. La revocación queda persistida en `sesiones.revocada_en`.

---

## 7. Mapa de rutas sugerido para Next.js

```text
app/
├─ (publico)/
│  ├─ page.tsx                    / (bienvenida)
│  ├─ login/page.tsx              /login
│  ├─ registro/page.tsx           /registro
│  ├─ registro/comerciante/page.tsx
│  ├─ registro/organizador/page.tsx
│  ├─ activar/page.tsx            /activar
│  ├─ recuperar/page.tsx          /recuperar
│  ├─ restablecer/page.tsx        /restablecer
│  └─ primer-acceso/page.tsx      /primer-acceso
├─ (comerciante)/
│  ├─ comerciante/inicio/page.tsx
│  └─ comerciante/perfil/page.tsx
├─ (organizador)/
│  ├─ organizador/inicio/page.tsx
│  ├─ organizador/perfil/page.tsx
│  └─ organizador/mi-organizacion/page.tsx
└─ (gestor)/
   ├─ gestor/panel/page.tsx
   ├─ gestor/usuarios/page.tsx
   ├─ gestor/usuarios/[id]/page.tsx
   ├─ gestor/comerciantes/page.tsx
   ├─ gestor/organizaciones/page.tsx
   ├─ gestor/organizaciones/[id]/page.tsx
   └─ gestor/gestores/nuevo/page.tsx
```

**Protección de rutas:**

- `middleware.ts` puede redirigir a `/login` si no hay token, pero **no es la barrera de
  seguridad**: el backend valida el JWT y el rol.
- La validación fina del rol debe hacerse en el servidor de Next.js o al cargar la
  pantalla, consultando `/perfil` o `/panel`.
- Un comerciante no debe poder abrir `/gestor/*` ni un gestor `/perfil`.

**Capa HTTP única:**

```text
src/lib/api-client.ts
```

Debe centralizar:

- URL base (`NEXT_PUBLIC_API_URL`).
- Header `Authorization`.
- Parseo de errores (`message` string o array).
- Redirección global ante `401`.
- Tipos derivados del contrato real.

---

## 8. Estado de los faltantes del Sprint 1

**Todos los endpoints funcionales y de soporte previstos para el Sprint 1 quedaron
implementados.**

### 8.1 Implementado en este sprint

| Elemento | Estado |
|---|---|
| CORS para `FRONTEND_URL` | **Implementado** en `src/main.ts` |
| Prefijo de API | **Se mantiene sin prefijo global**; documentación corregida |
| `GET /auth/me` | **Implementado** |
| `POST /auth/refresh` | **Implementado** con rotación y detección de reutilización |
| `POST /auth/logout` | **Implementado**; revoca la sesión en la tabla `sesiones` |
| Tabla `sesiones` | **Creada** en `sgp_tulua` para refresh tokens y logout persistente |
| `GET/PATCH /gestor/perfil` | **Implementado** |
| `PATCH /gestor/perfil/password` | **Implementado**; revoca las sesiones |
| `POST /gestor/gestores/:id/reenviar-invitacion` | **Implementado** |
| Motivo y correo al suspender/inactivar | **Implementado**; el motivo viaja en el correo, sin columna nueva |
| Módulo de notificaciones | **Implementado** (`GET`, marcar una, marcar todas) |
| Consulta de auditoría | **Implementado** solo para administrador y con datos sensibles filtrados |
| Rate limit en registro, activación y refresh | **Implementado** a 10 peticiones por minuto |

### 8.2 Decisiones posteriores (P2)

| Falta | Nota |
|---|---|
| Cambio de correo | Requiere verificación en el correo nuevo; hoy está fuera de alcance |
| Documentos de la organización | El modelo actual no tiene tabla para documentos de organizador |
| Listado/revocación de sesiones por dispositivo | La tabla lo permite; no se expone aún un endpoint de administración de sesiones |

---

## 9. Módulos de frontend que el Sprint 1 todavía no puede alimentar

Estos módulos **no deben conectarse a endpoints inexistentes**. Se deben mostrar como
“Próximamente” o dejarse fuera de la navegación principal.

| Módulo / pantalla | Estado backend | Qué hacer en el frontend |
|---|---|---|
| Eventos y ferias de la bienvenida | Sin endpoint público en Sprint 1 | Contenido estático o placeholder |
| Mapa interactivo ciudadano | Corresponde al Sprint 2 (GIS) | Vista “Próximamente”; no inventar endpoint |
| Solicitudes de espacio | Sprint 3 | No incluir en menú del Sprint 1 |
| Ferias y calendario | Sprint 3 | No incluir |
| Permisos y QR | Sprint 5 | No incluir |
| Cobros simulados | Sprint 5 | No incluir |
| Dashboard analítico | Sprint 6 | Solo usar los indicadores básicos de `GET /panel` |

**Sobre la página de bienvenida:** el requisito de “información sobre la alcaldía,
eventos, etc.” se cubre en el Sprint 1 con contenido institucional estático. Los eventos
reales llegarán cuando exista el módulo de ferias. El mapa ciudadano se mostrará como
una sección futura.

---

## 10. Requisitos de UI, responsive y accesibilidad

### 10.1 Enfoque mobile-first

- Diseñar primero a **360 px** y escalar a tablet y escritorio.
- Barra de navegación colapsable en móvil.
- Formularios de una sola columna en móvil y dos columnas en escritorio.
- Tablas del panel con scroll horizontal o tarjetas apiladas en móvil.
- Botones y enlaces táctiles de al menos **44 × 44 px**.

### 10.2 Estados obligatorios

Toda pantalla que consuma datos debe tener:

1. **Carga:** skeleton o spinner, botón deshabilitado mientras se envía.
2. **Vacío:** mensaje claro y acción sugerida.
3. **Error:** mensaje del backend, opción de reintentar.
4. **Éxito:** confirmación visible y siguiente paso.

### 10.3 Accesibilidad

- Etiquetas `<label>` asociadas a cada input.
- Foco visible.
- Contraste WCAG AA.
- Mensajes de error anunciados con `aria-live` o junto al campo.
- No usar solo color para indicar estados; añadir texto.
- Diálogos de confirmación con título, descripción y botones claros.

### 10.4 Mensajes informativos sugeridos

| Situación | Mensaje |
|---|---|
| Cuenta pendiente | “Tu cuenta está pendiente de activación. Revisa el código enviado a tu correo.” |
| Cuenta suspendida | “Su cuenta ha sido suspendida, comuníquese con soporte para activarla.” |
| Cuenta inactiva | “Su cuenta ha sido desactivada, comuníquese con soporte para activarla.” |
| Bloqueo por intentos | “La cuenta está bloqueada temporalmente. Inténtalo en X minutos.” |
| Organización en revisión | “Tu organización está pendiente de validación por la Alcaldía.” |
| Organización suspendida | “Tu organización está suspendida. Revisa el motivo o contacta a la Alcaldía.” |
| Correo enviado | “Si los datos son correctos, enviamos un código a tu correo.” |
| Error de red | “No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.” |

---

## 11. Datos de prueba y ejecución local

### 11.1 Credenciales del seed

| Correo | Contraseña | Rol / estado |
|---|---|---|
| `admin@tulua.gov.co` | `Admin1234` | Gestor administrador |
| `revisor@tulua.gov.co` | `Admin1234` | Gestor revisor |
| `maria.gomez@gmail.com` | `Comerciante123` | Comerciante activa |
| `jose.perez@hotmail.com` | `Comerciante123` | Comerciante activa |
| `ana.ruiz@gmail.com` | `Comerciante123` | Comerciante activa |
| `pedro.sanchez@gmail.com` | `Comerciante123` | Comerciante pendiente de activación |
| `luis.alvarez@agrovalle.org` | `Organizador123` | Organizador activo con organización activa |
| `marta.cifuentes@asocampesinos.org` | `Organizador123` | Organizador activo con organización pendiente |

### 11.2 Correos en desarrollo

Si `MAIL_HOST` está vacío, el backend **no envía correos**: escribe el código de
activación, el código de recuperación o la contraseña temporal en el log del servidor.
Para probar el frontend, revisar la consola donde corre `pnpm start:dev`.

### 11.3 Comandos

```powershell
pnpm install
pnpm start:dev
pnpm test -- --runInBand
pnpm test:e2e -- --runInBand
pnpm build
```

Swagger: `http://localhost:3000/api/docs`.

### 11.4 Flujos mínimos para validar el frontend

1. **Admin:** login → panel → listado de usuarios → detalle → crear gestor.
2. **Revisor:** login → panel → usuarios (solo comerciantes/organizadores) → intentar
   una acción de administrador y comprobar el `403`.
3. **Comerciante:** registro → activación con código del log → login → perfil → editar
   teléfono → cambiar contraseña.
4. **Organizador:** registro → activación → login → crear organización → ver estado
   pendiente → login como admin → validar organización.
5. **Recuperación:** solicitar código → restablecer contraseña → login.
6. **Gestor nuevo:** admin crea gestor → leer contraseña temporal del log → login →
   primer acceso → panel.

---

## 12. Checklist de integración del frontend

- [ ] Usar `NEXT_PUBLIC_API_URL=http://localhost:3000` (sin prefijo).
- [ ] Verificar que CORS responde con el origen de `FRONTEND_URL`.
- [ ] Crear `lib/api-client.ts` con manejo central de token y errores.
- [ ] Definir tipos TypeScript basados en este documento o en Swagger.
- [ ] Implementar layout público con navbar responsive.
- [ ] Implementar bienvenida con contenido estático y CTAs.
- [ ] Implementar login con redirección por rol/perfil.
- [ ] Implementar `GET /auth/me` para recuperar la sesión al recargar.
- [ ] Implementar `POST /auth/refresh` y la rotación de tokens.
- [ ] Implementar `POST /auth/logout` y borrar ambos tokens locales.
- [ ] Implementar el reto de primer acceso del gestor.
- [ ] Implementar registro de comerciante y organizador con validaciones espejo.
- [ ] Implementar activación y reenvío de código.
- [ ] Implementar recuperación y restablecimiento de contraseña.
- [ ] Implementar perfil de comerciante y organizador.
- [ ] Implementar perfil y cambio de contraseña del gestor.
- [ ] Implementar onboarding y edición de la organización.
- [ ] Implementar panel del gestor con indicadores.
- [ ] Implementar listados, filtros y paginación de usuarios.
- [ ] Implementar detalle de cuenta y cambio de estado según perfil, con motivo y aviso.
- [ ] Implementar listado, detalle y validación de organizaciones.
- [ ] Implementar creación y reenvío de invitación de gestores.
- [ ] Implementar la bandeja de notificaciones.
- [ ] Implementar la consulta de auditoría solo para administrador.
- [ ] Implementar corrección de datos de comerciante por gestor.
- [ ] Ocultar acciones no permitidas para el revisor.
- [ ] Añadir estados de carga, vacío, error y éxito.
- [ ] Verificar responsive a 360 px y accesibilidad básica.
- [ ] No enlazar módulos de Sprints 2–6 hasta que existan sus endpoints.

---

## 13. Riesgos y observaciones

1. **CORS restringido:** solo funciona el origen de `FRONTEND_URL`; en producción debe
   configurarse el dominio real.
2. **Prefijo:** la API se mantiene sin prefijo global; `NEXT_PUBLIC_API_URL` no debe
   incluir `/api/v1`.
3. **Rotación de refresh:** cada refresh invalida el anterior. El frontend debe guardar
   siempre el último refresh y no reintentar con uno viejo.
4. **Logout persistente:** la revocación se guarda en `sesiones.revocada_en`. Los
   access tokens de la sesión dejan de servir inmediatamente.
5. **Correo en desarrollo:** los códigos y las contraseñas temporales solo aparecen en el
   log si `MAIL_HOST` está vacío; el equipo de frontend debe saberlo para probar.
6. **Paginación:** se usa `pagina`/`limite`, no `page`/`limit`; el cliente debe respetar
   el contrato real.
7. **Datos sensibles:** el frontend nunca debe mostrar `password_hash`, `token_hash`,
   `refresh_token_hash` ni `qr_token`; el backend ya los excluye.
8. **Auditoría:** solo el administrador puede consultarla y el backend filtra los campos
   sensibles antes de responder.

---

## 14. Resumen para el equipo de frontend

- La API del Sprint 1 está **completa** para las siete historias.
- Ya se puede construir: bienvenida, login, sesión actual, logout, registro, activación,
  recuperación, perfiles, perfil del gestor, organizaciones, notificaciones, auditoría y
  panel de gestión de usuarios.
- CORS, prefijo de API, `GET /auth/me`, refresh token con rotación, logout persistente,
  perfil del gestor, reenvío de invitación, motivo de suspensión, notificaciones,
  auditoría y rate limits **ya están implementados**.
- Los módulos de eventos, mapa, solicitudes, ferias, permisos, cobros y dashboard
  analítico **no pertenecen al Sprint 1** y no tienen endpoints disponibles todavía.
- La bienvenida debe usar contenido estático y placeholders para eventos y mapa.
- El frontend debe tratar los IDs como string, manejar `message` como string o array y
  respetar los roles `comerciante`, `organizador`, `gestor/revisor` y
  `gestor/administrador`.
