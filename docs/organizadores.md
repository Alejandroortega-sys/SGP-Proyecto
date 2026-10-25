# Módulo de organizadores de feria

**Proyecto:** Plataforma Web de Gestión del Espacio Público de Tuluá (Equipo 6)
**Historia:** HU-07 (registro de la organización y validación por el gestor)
**Código:** `src/usuarios/` (registro de la cuenta) · `src/perfil/` (datos personales) · `src/organizadores/` (organización y validación)

---

## 1. Flujo general

```
POST /usuarios/organizadores          → cuenta personal en «pendiente_activacion»
POST /usuarios/activacion             → activa la cuenta con el código del correo
  │
  ├─ GET   /perfil                    → datos personales + organización + seguridad
  ├─ PATCH /perfil                    → nombre, apellido y teléfono
  ├─ PATCH /perfil/password           → cambio de contraseña
  │
  ├─ POST  /organizadores/mi-organizacion   → crea la organización (pendiente_validacion)
  ├─ GET   /organizadores/mi-organizacion   → consulta la organización
  └─ PATCH /organizadores/mi-organizacion   → actualiza la organización
  │
POST /auth/login (gestor)              → JWT de gestor
  ├─ GET   /gestor/organizaciones            → listado y filtros
  ├─ GET   /gestor/organizaciones/:id        → detalle
  └─ PATCH /gestor/organizaciones/:id/estado → activa o suspende (administrador)
```

El modelo relacional es **1:1**: `organizadores.usuario_id` es llave primaria y
foránea a `usuarios.id`. Por tanto, cada organizador registra **una sola
organización**. La creación de una segunda responde `409`.

### Sobre los documentos

El módulo **no incluye carga de documentos**. La tabla existente
`solicitud_documentos` está relacionada con `solicitudes` (trámites de uso
temporal del espacio de los comerciantes), no con `organizadores`; reutilizarla
exigiría crear solicitudes ficticias y rompería el significado del modelo. Por
esa razón, y según la indicación del proyecto, la organización solo valida que
el **NIT** y el **nombre** sean únicos.

Si más adelante se requieren documentos de la organización, se debe crear una
tabla nueva (por ejemplo `organizacion_documentos`) y endpoints de carga,
descarga y validación.

---

## 2. Registro de la cuenta — `POST /usuarios/organizadores`

Endpoint público. Crea únicamente la cuenta personal; la organización se
registra después de activar la cuenta.

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

Comportamiento:

- Crea `usuarios` con `rol = 'organizador'` y estado `pendiente_activacion`.
- Guarda la contraseña con argon2id y el hash del código de activación en
  `tokens_seguridad`.
- Envía el código de 6 dígitos al correo.
- No crea todavía la fila de `organizadores`: la organización se registra con
  la cuenta ya activa.

La activación y el reenvío usan los endpoints existentes:

```text
POST /usuarios/activacion
POST /usuarios/activacion/reenviar
```

---

## 3. Perfil personal — `GET/PATCH /perfil`

`/perfil` ahora acepta los roles `comerciante` y `organizador`.

Para un organizador, `GET /perfil` devuelve:

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

- `organizacion` es `null` mientras el organizador no la haya registrado.
- `PATCH /perfil` permite `nombre`, `apellido` y `telefono` (al menos uno).
- Los datos de la organización se actualizan en
  `PATCH /organizadores/mi-organizacion`.
- `PATCH /perfil/password` funciona igual que para comerciantes.
- Los cambios de `usuarios` quedan auditados por el trigger `fn_auditoria`.

---

## 4. Organización — `/organizadores/mi-organizacion`

### `POST /organizadores/mi-organizacion`

Solo rol `organizador`.

```json
{
  "nombreOrganizacion": "Fundación Agroecológica del Valle",
  "nit": "900123456-1",
  "representante": "Luis Álvarez",
  "tipoFeria": "Feria agroecológica",
  "contacto": "3105551234"
}
```

Reglas:

- `nombreOrganizacion` (3–200) y `nit` (8–10 dígitos, guion y dígito de
  verificación opcional) son únicos.
- La unicidad del nombre se comprueba **sin distinguir mayúsculas**. La BD solo
  tiene `UNIQUE` para el NIT; la comprobación del nombre es de aplicación.
- El estado no se envía: la BD aplica `pendiente_validacion` por defecto.
- Si el organizador ya tiene organización → `409`.
- Se crea una notificación interna y se registra la creación en `auditoria` con
  el organizador como actor.

### `GET /organizadores/mi-organizacion`

Devuelve la organización, su estado y `validadoEn`. Si aún no existe → `404`.

### `PATCH /organizadores/mi-organizacion`

Actualización parcial de `nombreOrganizacion`, `nit`, `representante`,
`tipoFeria` y `contacto` (al menos uno).

- No acepta `estado`, `validadoPor` ni `validadoEn`: la validación es
  competencia del gestor.
- Repite la validación de unicidad de nombre y NIT.
- Registra el valor anterior y el nuevo en `auditoria` con el organizador como
  actor.

---

## 5. Validación por el gestor — `/gestor/organizaciones`

### `GET /gestor/organizaciones`

Disponible para ambos perfiles de gestor (`revisor` y `administrador`).

| Parámetro | Tipo | Descripción |
|---|---|---|
| `estado` | enum | `pendiente_validacion`, `activa` o `suspendida`. |
| `busqueda` | texto (máx. 150) | Nombre del organizador, correo, nombre de la organización, NIT o representante. |
| `pagina` | entero ≥ 1 | Por defecto `1`. |
| `limite` | entero 1–100 | Por defecto `20`. |

Solo lista organizadores que ya registraron su organización.

### `GET /gestor/organizaciones/:id`

`:id` es el `usuario_id` del organizador. Devuelve los datos del organizador y
de la organización.

### `PATCH /gestor/organizaciones/:id/estado`

**Solo perfil `administrador`.** El revisor puede consultar, pero no cambiar el
estado, igual que ocurre con las cuentas.

```json
{
  "estado": "activa",
  "motivo": "Documentación verificada"
}
```

- Estados permitidos: `activa` y `suspendida`.
- Actualiza `estado`, `validado_por` y `validado_en`.
- Si la organización ya está en ese estado → `409`.
- Crea una notificación interna para el organizador. El `motivo` opcional se
  incluye en el cuerpo de la notificación.
- Registra el cambio en `auditoria` con el gestor como actor.

No existe un estado `rechazada` en `estado_organizacion`; un rechazo se
representa como `suspendida`.

---

## 6. Errores habituales

| HTTP | Causa |
|---|---|
| `400` | Cuerpo o identificador inválidos; organización sin campos para actualizar. |
| `401` | Falta el token o es inválido/expirado. |
| `403` | Rol incorrecto; revisor intentando cambiar el estado de una organización. |
| `404` | La organización no existe o el organizador aún no la registró. |
| `409` | NIT o nombre duplicado; segunda organización; estado repetido. |

---

## 7. Archivos del módulo

| Archivo | Contenido |
|---|---|
| `src/usuarios/dto/crear-organizador.dto.ts` | Registro de la cuenta del organizador. |
| `src/usuarios/dto/cuenta-response.dto.ts` | Respuesta común de registro/activación. |
| `src/usuarios/usuarios.service.ts` | `crearOrganizador` y flujo de activación. |
| `src/usuarios/usuarios.controller.ts` | `POST /usuarios/organizadores`. |
| `src/perfil/` | Perfil de comerciante y organizador; `/perfil` y `/perfil/password`. |
| `src/organizadores/organizadores.module.ts` | Módulo Nest. |
| `src/organizadores/organizadores.controller.ts` | Endpoints del organizador. |
| `src/organizadores/gestor-organizaciones.controller.ts` | Endpoints del gestor. |
| `src/organizadores/organizadores.service.ts` | Reglas de negocio y auditoría. |
| `src/organizadores/dto/` | DTOs de creación, actualización, listado y estado. |
| `src/organizadores/*.spec.ts` | Pruebas unitarias. |
| `test/organizadores.e2e-spec.ts` | Pruebas e2e. |

---

## 8. Probar el flujo

```powershell
# 1) Registrar la cuenta
Invoke-RestMethod -Method Post -Uri http://localhost:3000/usuarios/organizadores `
  -ContentType 'application/json' `
  -Body '{"nombre":"Luis","apellido":"Álvarez","tipoDocumento":"CC","documento":"801234567","telefono":"3105551234","correo":"luis@agrovalle.org","password":"Organizador123","confirmarPassword":"Organizador123"}'

# 2) Activar con el código recibido por correo
Invoke-RestMethod -Method Post -Uri http://localhost:3000/usuarios/activacion `
  -ContentType 'application/json' `
  -Body '{"correo":"luis@agrovalle.org","codigo":"123456"}'

# 3) Iniciar sesión y guardar el token
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth/login `
  -ContentType 'application/json' `
  -Body '{"correo":"luis@agrovalle.org","password":"Organizador123"}'
$auth = @{ Authorization = "Bearer $($login.accessToken)" }

# 4) Registrar la organización
Invoke-RestMethod -Method Post -Uri http://localhost:3000/organizadores/mi-organizacion `
  -Headers $auth -ContentType 'application/json' `
  -Body '{"nombreOrganizacion":"Fundación Agroecológica del Valle","nit":"900123456-1","representante":"Luis Álvarez","tipoFeria":"Feria agroecológica","contacto":"3105551234"}'

# 5) Consultar el perfil y la organización
Invoke-RestMethod -Uri http://localhost:3000/perfil -Headers $auth
Invoke-RestMethod -Uri http://localhost:3000/organizadores/mi-organizacion -Headers $auth

# 6) El administrador lista y activa la organización
$admin = Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth/login `
  -ContentType 'application/json' `
  -Body '{"correo":"admin@tulua.gov.co","password":"Admin1234"}'
$authAdmin = @{ Authorization = "Bearer $($admin.accessToken)" }
Invoke-RestMethod -Uri 'http://localhost:3000/gestor/organizaciones?estado=pendiente_validacion' -Headers $authAdmin
Invoke-RestMethod -Method Patch -Uri http://localhost:3000/gestor/organizaciones/7/estado `
  -Headers $authAdmin -ContentType 'application/json' `
  -Body '{"estado":"activa","motivo":"Documentación verificada"}'
```

---

## 9. Verificación

```powershell
pnpm lint
pnpm test -- --runInBand
pnpm test:e2e -- --runInBand
pnpm build
```
