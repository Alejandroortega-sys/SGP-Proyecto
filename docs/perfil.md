# Módulo de perfil y corrección de datos por el gestor

**Proyecto:** Plataforma Web de Gestión del Espacio Público de Tuluá (Equipo 6)
**Historia:** HU-04 (perfil en tres secciones; documento y actividad comercial solo vía gestor)
**Código:** `src/perfil/` (perfil de comerciantes y organizadores) · `src/usuarios/` (endpoint del gestor)

---

## 1. Flujo general

```
POST /auth/login (comerciante u organizador) ──► JWT + rol correspondiente
  │
  ├─ GET  /perfil               → datos personales + sección de negocio + seguridad
  │                                (comerciante: actividadComercial;
  │                                 organizador: organizacion)
  ├─ PATCH /perfil              → actualiza nombre / apellido / teléfono
  ├─ PATCH /perfil/password     → cambia contraseña (exige la actual + aviso por correo)
  │   └─ si envía documento, actividadComercial, categoria, nombreOrganizacion,
  │      nit, correo o estado → 400
  │
POST /auth/login (gestor) ────► JWT + rol 'gestor' (revisor o administrador)
  └─ PATCH /usuarios/:id/comerciante → corrige documento, tipoDocumento,
      actividadComercial y/o categoria (los campos sensibles, HU-04)
```

La decisión de qué campos puede tocar cada rol la hace el backend:

- El DTO de `PATCH /perfil` **no declara** los campos sensibles. Como el
  `ValidationPipe` global usa `whitelist + forbidNonWhitelisted`
  (ver `src/main.ts`), enviarlos devuelve **400** («la propiedad no debería
  existir»), sin llegar al servicio.
- `PATCH /usuarios/:id/comerciante` está protegido con `@Roles('gestor')`;
  cualquier otro rol recibe **403**.

## 2. Endpoints del perfil — `src/perfil/` (`@Roles('comerciante', 'organizador')`)

### `GET /perfil` — ver mis datos

Respuesta para un comerciante (nunca expone `password_hash`):

```json
{
  "datosPersonales": {
    "id": "5", "nombre": "José", "apellido": "Pérez",
    "tipoDocumento": "CC", "documento": "1029384756", "telefono": "3001122334"
  },
  "actividadComercial": { "actividadComercial": "Venta de frutas y verduras", "categoria": "formal" },
  "seguridad": { "correo": "jose.perez@hotmail.com", "estado": "activa", "creadoEn": "2026-09-15T14:30:00.000Z" }
}
```

Para un organizador, en lugar de `actividadComercial` se devuelve `organizacion`
(o `null` si aún no la ha registrado):

```json
{
  "datosPersonales": {
    "id": "7", "nombre": "Luis", "apellido": "Álvarez",
    "tipoDocumento": "CC", "documento": "801234567", "telefono": "3105551234"
  },
  "organizacion": {
    "nombreOrganizacion": "Fundación Agroecológica del Valle",
    "nit": "900123456-1", "representante": "Luis Álvarez",
    "tipoFeria": "Feria agroecológica", "contacto": "3105551234",
    "estado": "pendiente_validacion", "validadoEn": null
  },
  "seguridad": { "correo": "luis.alvarez@agrovalle.org", "estado": "activa", "creadoEn": "2026-09-15T14:30:00.000Z" }
}
```

La organización se crea y actualiza en
`POST/PATCH /organizadores/mi-organizacion` (ver `docs/organizadores.md`).

### `PATCH /perfil` — actualizar datos personales

- Editables para ambos roles: `nombre`, `apellido` (acepta `null` para
  limpiarlo) y `telefono` (misma validación del registro). **Al menos uno**;
  cuerpo vacío → 400.
- Respuesta: el perfil completo actualizado.
- Los datos de la organización **no** se cambian aquí: se usa
  `PATCH /organizadores/mi-organizacion`.
- El **correo queda fijo**: es la identidad de la cuenta y su cambio exigiría
  verificación (código al correo nuevo), todavía fuera de alcance.

### `PATCH /perfil/password` — cambiar contraseña (HU-04)

- Cuerpo: `passwordActual` + `passwordNueva` + `confirmarPassword`.
- La nueva sigue la política del registro: 8–128 caracteres y al menos un
  número; se guarda hasheada con argon2id.
- Si la actual no coincide → 400 «La contraseña actual es incorrecta».
- En una transacción: fija el actor de auditoría, guarda el hash y registra la
  notificación interna (`tipo: cambio_password`). Después envía el aviso por
  correo (`CorreoService.enviarAvisoCambioPassword`, sin datos sensibles); si
  el envío falla el cambio **no se revierte**, el fallo queda en el log.

## 3. Endpoint del gestor para corregir comerciantes — `PATCH /usuarios/:id/comerciante`

`@Roles('gestor')`, válido para **ambos perfiles** (revisor y administrador).

- Corrige: `documento` (regex del registro; UNIQUE → 409 si ya existe),
  `tipoDocumento` (CC/CE/TI/PP/NIT), `actividadComercial` (3–200) y `categoria`
  (formal/informal). Todos opcionales, **al menos uno**.
- El `:id` debe ser numérico (si no, 400); usuario inexistente o con rol ≠
  comerciante → 404; el resto de datos (nombre, teléfono…) los cambia el
  propio comerciante desde `PATCH /perfil`.
- Respuesta: los datos corregidos + mensaje.

## 4. Auditoría de los cambios (requisito del módulo)

**Todos los cambios de este módulo quedan registrados en la tabla `auditoria`.**
La BD tiene el trigger `fn_auditoria` en `usuarios` (HU-05), que guarda el
valor anterior y el nuevo en JSONB junto con el actor leído de la variable de
sesión `app.actor_id` (ver docs/baseDatos.md §2). El helper
`src/common/auditoria.ts` la fija **dentro de la transacción**:

```ts
await prisma.$transaction(async (tx) => {
  await fijarActorAuditoria(tx, idActor);   // set_config('app.actor_id', ..., true)
  await tx.usuarios.update(...);           // el trigger audita con el actor
});
```

Detalles importantes:

- El tercer argumento de `set_config` (`true`) hace la variable **local a la
  transacción**: el `UPDATE` de la misma conexión la ve, pero no queda en la
  conexión del pool para peticiones de otros usuarios.
- `PATCH /perfil` y `PATCH /perfil/password` → audita el trigger de `usuarios`
  con el propio comerciante como actor.
- `PATCH /usuarios/:id/comerciante`:
  - documento / tipoDocumento → trigger de `usuarios` con el **gestor** como
    actor.
  - actividadComercial / categoria → la tabla `comerciantes` **no tiene
    trigger**, así que la aplicación inserta el registro en `auditoria`
    (`tabla='comerciantes'`, valor anterior y nuevo, actor = gestor), imitando
    lo que haría `fn_auditoria`. La inserción usa SQL crudo a propósito para
    que `creado_en` lo genere `now()` de PostgreSQL: el `@default(now())` de
    Prisma se calcula en el cliente y con `@prisma/adapter-pg` aplica el
    desfase de la zona local (la fila quedaría con la hora corrida).
- El login (`POST /auth/login`) también limpia los contadores de intentos
  dentro de una transacción con el actor fijado: ese cambio queda auditado con
  el propio usuario. Los incrementos de intentos fallidos (peticiones no
  autenticadas) se registran con `actor_id` NULL, que es el valor honesto:
  no hay un usuario verificado detrás.
- Nota: el trigger de `usuarios` vuelca la fila completa en JSONB, incluido
  `password_hash`; es un hash argon2id (nunca texto plano) y es el
  comportamiento existente de la BD para cualquier cambio de contraseña.

Consulta de verificación:

```sql
SELECT tabla, registro_id, accion, actor_id, creado_en
  FROM auditoria ORDER BY creado_en DESC LIMIT 10;
```

## 5. Archivos del módulo

| Archivo | Contenido |
|---|---|
| `src/perfil/perfil.module.ts` | Módulo Nest (importa `CorreoModule`) |
| `src/perfil/perfil.controller.ts` | `GET /perfil`, `PATCH /perfil`, `PATCH /perfil/password` |
| `src/perfil/perfil.service.ts` | Consulta, actualización y cambio de contraseña con auditoría |
| `src/perfil/dto/ver-perfil.dto.ts` | Respuesta en 3 secciones (HU-04) |
| `src/perfil/dto/actualizar-perfil.dto.ts` | DTO sin campos sensibles (protección del pipe) |
| `src/perfil/dto/cambiar-password.dto.ts` | Actual + nueva + confirmación |
| `src/usuarios/dto/actualizar-comerciante-gestor.dto.ts` | DTO y respuesta del gestor |
| `src/common/auditoria.ts` | `fijarActorAuditoria` (`app.actor_id` transaccional) |
| `src/common/parse-id.ts` | `parseIdBigint` (params de URL → BigInt validado) |
| `src/common/opciones-argon2.ts` | Parámetros argon2id compartidos |
| `src/correo/correo.service.ts` | + `enviarAvisoCambioPassword()` |

## 6. Probar el flujo completo (datos del seed)

```powershell
# 1) Comerciante inicia sesión
$ login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth/login `
    -ContentType 'application/json' `
    -Body '{"correo":"jose.perez@hotmail.com","password":"Comerciante123"}'
$ auth = @{ Authorization = "Bearer $($login.accessToken)" }

# 2) Ve su perfil (200, tres secciones)
Invoke-RestMethod -Uri http://localhost:3000/perfil -Headers $auth

# 3) Actualiza su teléfono (200; queda auditado con él como actor)
Invoke-RestMethod -Method Patch -Uri http://localhost:3000/perfil -Headers $auth `
    -ContentType 'application/json' -Body '{"telefono":"3115550000"}'

# 4) Intenta cambiar su documento → 400 (campo no permitido)
#    (el cuerpo lleva una propiedad fuera del DTO)
Invoke-RestMethod -Method Patch -Uri http://localhost:3000/perfil -Headers $auth `
    -ContentType 'application/json' -Body '{"documento":"99999"}'   # 400

# 5) Cambia su contraseña (200 + aviso por correo/log)
Invoke-RestMethod -Method Patch -Uri http://localhost:3000/perfil/password -Headers $auth `
    -ContentType 'application/json' `
    -Body '{"passwordActual":"Comerciante123","passwordNueva":"NuevaClave456","confirmarPassword":"NuevaClave456"}'

# 6) Gestor corrige la actividad comercial (200; auditado con el gestor)
$ g = Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth/login `
    -ContentType 'application/json' `
    -Body '{"correo":"admin@tulua.gov.co","password":"Admin1234"}'
Invoke-RestMethod -Method Patch -Uri http://localhost:3000/usuarios/5/comerciante `
    -Headers @{ Authorization = "Bearer $($g.accessToken)" } `
    -ContentType 'application/json' `
    -Body '{"actividadComercial":"Venta de frutas, verduras y legumbres"}'
```

Errores esperados: 401 sin token o expirado · 403 rol sin permiso (comerciante
en el endpoint del gestor, o gestor en `/perfil`) · 400 campos inválidos o
bloqueados · 404 cuenta inexistente · 409 documento duplicado.

La documentación Swagger de los endpoints se genera desde el código en
<http://localhost:3000/api/docs> (ver docs/swagger.md).
