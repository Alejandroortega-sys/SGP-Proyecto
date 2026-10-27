# Módulo de Zonas — Uso y funcionamiento

**Proyecto:** Plataforma Web de Gestión del Espacio Público, Ferias Agroecológicas y Comercio Formal/Informal de Tuluá (Equipo 6)
**Módulo NestJS:** `src/zonas/` · **Ruta base:** `/zonas` · **Tablas:** `zonas`, `zona_productos`
**Dependencias de BD:** PostGIS 3.6, `fn_validar_zona`, `fn_auditoria`, `trg_zonas_marca`

---

## 1. Resumen

Este módulo administra las **zonas normativas** del espacio público y expone su geometría al mapa público.

| Método  | Ruta                | Acceso                         | Descripción                                       |
| ------- | ------------------- | ------------------------------ | ------------------------------------------------- |
| `POST`  | `/zonas`            | Gestor **administrador**       | Crea una zona y sus productos permitidos          |
| `PATCH` | `/zonas/:id`        | Gestor **administrador**       | Edita atributos, geometría y productos permitidos |
| `PATCH` | `/zonas/:id/estado` | Gestor **administrador**       | Activa o desactiva la zona                        |
| `GET`   | `/zonas`            | Gestor revisor y administrador | Lista zonas con filtros y conteos, sin geometría  |
| `GET`   | `/zonas/:id`        | Gestor revisor y administrador | Detalle con geometría GeoJSON y productos         |
| `GET`   | `/zonas/geojson`    | **Público**                    | `FeatureCollection` de zonas activas para el mapa |

> **Orden de rutas:** `GET /zonas/geojson` está declarado antes de `GET /zonas/:id`. Si se invierte el orden, Nest interpreta `geojson` como un `id` y responde `400`.

---

## 2. Modelo de datos

### `zonas`

| Campo                            | Tipo real                | Reglas                                                     |
| -------------------------------- | ------------------------ | ---------------------------------------------------------- |
| `id`                             | `BIGINT IDENTITY`        | PK                                                         |
| `nombre`                         | `VARCHAR(150)`           | Obligatorio; **no es único** en la BD                      |
| `tipo`                           | `tipo_zona`              | `permitida`, `restringida`, `alta_congestion`              |
| `geometria`                      | `geometry(Polygon,4326)` | Obligatoria, SRID 4326, `CHECK ST_IsValid`                 |
| `horario_inicio` / `horario_fin` | `TIME`                   | Opcionales; formato `HH:MM`                                |
| `aforo_maximo`                   | `INT`                    | Opcional; debe ser `> 0`                                   |
| `activa`                         | `BOOLEAN`                | Default `TRUE`; baja lógica                                |
| `creado_por`                     | `BIGINT` FK `usuarios`   | Lo fija el backend con el gestor autenticado               |
| `creado_en` / `actualizado_en`   | `TIMESTAMPTZ`            | `actualizado_en` lo actualiza el trigger `trg_zonas_marca` |

### `zona_productos`

| Campo         | Tipo                    | Regla                             |
| ------------- | ----------------------- | --------------------------------- |
| `zona_id`     | `BIGINT` FK `zonas`     | PK compuesta, `ON DELETE CASCADE` |
| `producto_id` | `BIGINT` FK `productos` | PK compuesta                      |

### Reglas que aplica la base de datos

- `trg_zonas_validar` → `fn_validar_zona`:
  - rechaza polígonos topológicamente inválidos (`ST_IsValid`);
  - rechaza solapes con otras zonas **activas** (`ST_Relate`).
  - Ambos casos lanzan `RAISE EXCEPTION` (`P0001`), que el filtro global traduce a **422**.
- `trg_zonas_auditoria` → `fn_auditoria`: registra `INSERT`, `UPDATE` y `DELETE` en `auditoria`, usando `app.actor_id`.
- `trg_zonas_marca`: actualiza `actualizado_en` en cada `UPDATE`.

El backend **no reimplementa** la validación topológica ni los solapes: solo valida la estructura GeoJSON antes de enviarla a PostGIS.

---

## 3. Autenticación y autorización

La API usa JWT global (`JwtAuthGuard`) y roles (`RolesGuard`):

```http
Authorization: Bearer <accessToken>
```

| Endpoint                  | `@Roles` | `@PerfilGestor` | `@Public` |
| ------------------------- | -------- | --------------- | --------- |
| `GET /zonas`              | `gestor` | —               | No        |
| `GET /zonas/:id`          | `gestor` | —               | No        |
| `POST /zonas`             | `gestor` | `administrador` | No        |
| `PATCH /zonas/:id`        | `gestor` | `administrador` | No        |
| `PATCH /zonas/:id/estado` | `gestor` | `administrador` | No        |
| `GET /zonas/geojson`      | —        | —               | **Sí**    |

El rol y el perfil se recargan de la BD en cada petición, por lo que una suspensión o un cambio de perfil surte efecto inmediato.

---

## 4. Crear zona — `POST /zonas`

**Acceso:** gestor con perfil `administrador`.

### Cuerpo

```json
{
  "nombre": "Centro - Calle 30",
  "tipo": "permitida",
  "geometria": {
    "type": "Polygon",
    "coordinates": [
      [
        [-76.196, 4.088],
        [-76.192, 4.088],
        [-76.192, 4.09],
        [-76.196, 4.09],
        [-76.196, 4.088]
      ]
    ]
  },
  "horarioInicio": "06:00",
  "horarioFin": "18:00",
  "aforoMaximo": 40,
  "productosPermitidos": ["1", "2", "5"]
}
```

### Campos

| Campo                 | Obligatorio | Validación                                                    |
| --------------------- | ----------- | ------------------------------------------------------------- |
| `nombre`              | Sí          | Texto, 3–150 caracteres; se recorta                           |
| `tipo`                | Sí          | `permitida`, `restringida` o `alta_congestion`                |
| `geometria`           | Sí          | `Polygon` GeoJSON 2D, `[longitud, latitud]`, anillos cerrados |
| `horarioInicio`       | No          | `HH:MM` 24 h                                                  |
| `horarioFin`          | No          | `HH:MM` 24 h                                                  |
| `aforoMaximo`         | No          | Entero `>= 1`                                                 |
| `productosPermitidos` | No          | Lista de IDs string, sin duplicados, máximo 100               |

Reglas adicionales:

- `horarioInicio` y `horarioFin` deben enviarse **juntos**; si ambos vienen, `fin > inicio`.
- Los productos deben existir y estar **activos**.
- `activa`, `creado_por`, `creado_en` y `actualizado_en` **no se reciben** en el cuerpo:
  - la zona nace activa por el default de la BD;
  - `creado_por` se toma del JWT.
- El nombre no es único en la BD; se permite repetirlo.

### Respuesta `201`

Devuelve el detalle completo (atributos, geometría y productos permitidos):

```json
{
  "id": "5",
  "nombre": "Centro - Calle 30",
  "tipo": "permitida",
  "horarioInicio": "06:00",
  "horarioFin": "18:00",
  "aforoMaximo": 40,
  "activa": true,
  "creadoPor": "1",
  "creadoEn": "2026-09-15T14:30:00.000Z",
  "actualizadoEn": "2026-09-15T14:30:00.000Z",
  "geometria": {
    "type": "Polygon",
    "coordinates": [[[-76.196, 4.088], "…"]]
  },
  "productosPermitidos": [
    { "id": "1", "nombre": "Frutas frescas", "activo": true },
    { "id": "2", "nombre": "Verduras", "activo": true }
  ]
}
```

### Errores

| HTTP  | Causa                                                                                                       |
| ----- | ----------------------------------------------------------------------------------------------------------- |
| `400` | Campo inválido, geometría mal formada, horarios incompletos/fuera de orden, producto inexistente o inactivo |
| `401` | Sin token o token inválido/expirado                                                                         |
| `403` | Rol distinto de gestor o perfil distinto de administrador                                                   |
| `422` | La BD rechazó el polígono por topología inválida o solape                                                   |
| `503` | Base de datos no disponible                                                                                 |

---

## 5. Editar zona — `PATCH /zonas/:id`

**Acceso:** gestor `administrador`.

Todos los campos son opcionales, pero debe enviarse **al menos uno**:

```json
{
  "nombre": "Centro renovado",
  "tipo": "restringida",
  "geometria": { "type": "Polygon", "coordinates": [[["…"]]] },
  "horarioInicio": "07:00",
  "horarioFin": "17:00",
  "aforoMaximo": 30,
  "productosPermitidos": ["1", "2"]
}
```

Reglas:

- Mismas validaciones de campos que en `POST`.
- `productosPermitidos` **reemplaza la lista completa**. Enviar `[]` elimina todas las asociaciones.
- Para borrar el horario se envían `horarioInicio: null` y `horarioFin: null` juntos.
- `aforoMaximo: null` elimina el límite propio de la zona.
- `activa` **no** se cambia aquí; existe `PATCH /zonas/:id/estado`.
- La operación se ejecuta en una transacción con `app.actor_id` fijado.
- Si la zona no existe → `404`.

Respuesta `200`: igual al detalle de `GET /zonas/:id`.

---

## 6. Activar o desactivar — `PATCH /zonas/:id/estado`

**Acceso:** gestor `administrador`.

```json
{ "activa": false }
```

- `activa` es obligatorio y booleano.
- La operación es **idempotente**: si la zona ya está en ese estado, responde `200`.
- La desactivación es lógica: no se elimina la zona ni sus espacios.
- Queda auditada por `fn_auditoria`.

Respuesta `200`:

```json
{
  "id": "1",
  "nombre": "Centro - Calle 30",
  "activa": false,
  "actualizadoEn": "2026-09-20T10:00:00.000Z",
  "mensaje": "Zona desactivada."
}
```

---

## 7. Listar zonas — `GET /zonas`

**Acceso:** gestor revisor y administrador.

### Query params

| Parámetro  | Tipo    | Descripción                                              |
| ---------- | ------- | -------------------------------------------------------- |
| `tipo`     | enum    | `permitida`, `restringida`, `alta_congestion`            |
| `activo`   | boolean | `true` o `false`                                         |
| `busqueda` | texto   | Búsqueda por nombre, sin distinguir mayúsculas (`ILIKE`) |
| `pagina`   | entero  | Desde `1`; default `1`                                   |
| `limite`   | entero  | `1–100`; default `20`                                    |

Ejemplo:

```http
GET /zonas?tipo=permitida&activo=true&busqueda=Centro&pagina=1&limite=20
```

### Respuesta `200`

```json
{
  "datos": [
    {
      "id": "1",
      "nombre": "Centro - Calle 30",
      "tipo": "permitida",
      "horarioInicio": "06:00",
      "horarioFin": "18:00",
      "aforoMaximo": 40,
      "activa": true,
      "totalEspacios": 2,
      "totalModulos": 3,
      "creadoEn": "2026-09-15T14:30:00.000Z",
      "actualizadoEn": "2026-09-20T10:00:00.000Z"
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

Características:

- **No devuelve la geometría** para mantener el listado liviano.
- `totalEspacios`: cantidad de filas de `espacios_temporales` con `zona_id = zona.id` (cualquier estado).
- `totalModulos`: cantidad de módulos del censo cuyo punto cae dentro del polígono (`ST_Contains`), ya que `modulos` no tiene `zona_id`.
- Los conteos se calculan en la misma consulta SQL, sin N+1.

---

## 8. Detalle de zona — `GET /zonas/:id`

**Acceso:** gestor revisor y administrador.

```http
GET /zonas/1
```

Respuesta `200`:

```json
{
  "id": "1",
  "nombre": "Centro - Calle 30",
  "tipo": "permitida",
  "horarioInicio": "06:00",
  "horarioFin": "18:00",
  "aforoMaximo": 40,
  "activa": true,
  "creadoPor": "1",
  "creadoEn": "2026-09-15T14:30:00.000Z",
  "actualizadoEn": "2026-09-20T10:00:00.000Z",
  "geometria": {
    "type": "Polygon",
    "coordinates": [
      [
        [-76.196, 4.088],
        [-76.192, 4.088],
        [-76.192, 4.09],
        [-76.196, 4.09],
        [-76.196, 4.088]
      ]
    ]
  },
  "productosPermitidos": [
    { "id": "1", "nombre": "Frutas frescas", "activo": true },
    { "id": "2", "nombre": "Verduras", "activo": true }
  ]
}
```

- La geometría se obtiene con `ST_AsGeoJSON(geometria)::jsonb` y se normaliza con `leerGeoJson(..., 'Polygon')`.
- Los productos se devuelven con su estado `activo`; si un producto fue desactivado, sigue apareciendo aquí para que el gestor lo vea.
- `id` no numérico → `400`; zona inexistente → `404`.

---

## 9. GeoJSON público — `GET /zonas/geojson`

**Acceso:** público, sin `Authorization`.

Devuelve un `FeatureCollection` con **solo las zonas activas**:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [-76.196, 4.088],
            [-76.192, 4.088],
            [-76.192, 4.09],
            [-76.196, 4.09],
            [-76.196, 4.088]
          ]
        ]
      },
      "properties": {
        "id": "1",
        "nombre": "Centro - Calle 30",
        "tipo": "permitida",
        "horarios": { "inicio": "06:00", "fin": "18:00" },
        "aforo": 40,
        "productos": ["Frutas frescas", "Verduras"]
      }
    }
  ]
}
```

Detalles:

- La geometría se genera en la consulta con `ST_AsGeoJSON(geometria)::jsonb`.
- Los productos se agregan con `jsonb_agg` y se ordenan por nombre.
- Solo se incluyen productos **activos** en `properties.productos`.
- El frontend puede pasar el objeto directamente a Leaflet/Mapbox.
- **Rate limit:** 60 peticiones por minuto por IP (`ThrottlerGuard` + `@Throttle`). Al superarlo responde `429` con `Retry-After`.
- No se aplica `ST_SimplifyPreserveTopology` todavía. La meta es responder en menos de 2 s; se medirá con datos reales y solo se simplificará si es necesario.

---

## 10. Flujo transaccional y auditoría

`POST`, `PATCH` y `PATCH /estado` ejecutan:

```ts
await prisma.$transaction(async (tx) => {
  await fijarActorAuditoria(tx, usuario.id); // set_config('app.actor_id', ..., true)
  // INSERT / UPDATE de zonas
  // reemplazo de zona_productos
});
```

- El tercer argumento `true` de `set_config` hace la variable local a la transacción.
- `fn_auditoria` registra en `auditoria` el valor anterior y el nuevo de la zona.
- La geometría se escribe con fragmentos parametrizados:
  - `poligonoASql(...)` → `ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)`.
  - Nunca se concatena GeoJSON en el texto SQL.

---

## 11. Archivos del módulo

| Archivo                                         | Contenido                                             |
| ----------------------------------------------- | ----------------------------------------------------- |
| `src/zonas/zonas.module.ts`                     | Módulo Nest; registra `ThrottlerGuard`                |
| `src/zonas/zonas.controller.ts`                 | Endpoints, roles, Swagger y rate limit                |
| `src/zonas/zonas.service.ts`                    | Consultas SQL, transacciones, auditoría y mapeo       |
| `src/zonas/dto/zonas.dto.ts`                    | DTOs de entrada, listado, detalle y GeoJSON           |
| `src/zonas/zonas.controller.spec.ts`            | Pruebas de roles, metadatos y delegación              |
| `src/zonas/zonas.service.spec.ts`               | Pruebas de creación, edición, filtros y GeoJSON       |
| `test/zonas.e2e-spec.ts`                        | Pruebas e2e de acceso, validación, rutas y rate limit |
| `src/common/geo.ts`                             | `poligonoASql`, `sqlGeoJson`, `leerGeoJson`           |
| `src/common/filters/prisma-exception.filter.ts` | Traduce `P0001` a `422`                               |

---

## 12. Probar el flujo con los datos del seed

```powershell
# 1) Login como administrador
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth/login `
    -ContentType 'application/json' `
    -Body '{"correo":"admin@tulua.gov.co","password":"Admin1234"}'
$auth = @{ Authorization = "Bearer $($login.accessToken)" }

# 2) Listar zonas
Invoke-RestMethod -Uri 'http://localhost:3000/zonas?activo=true&pagina=1&limite=20' -Headers $auth

# 3) Detalle de una zona
Invoke-RestMethod -Uri 'http://localhost:3000/zonas/1' -Headers $auth

# 4) GeoJSON público (sin token)
Invoke-RestMethod -Uri 'http://localhost:3000/zonas/geojson'

# 5) Crear una zona
Invoke-RestMethod -Method Post -Uri http://localhost:3000/zonas `
    -Headers $auth -ContentType 'application/json' `
    -Body '{"nombre":"Parque La Guadua","tipo":"permitida","geometria":{"type":"Polygon","coordinates":[[[-76.198,4.088],[-76.194,4.088],[-76.194,4.092],[-76.198,4.092],[-76.198,4.088]]]},"horarioInicio":"08:00","horarioFin":"17:00","aforoMaximo":25,"productosPermitidos":["1","2"]}'

# 6) Desactivar la zona
Invoke-RestMethod -Method Patch -Uri http://localhost:3000/zonas/4/estado `
    -Headers $auth -ContentType 'application/json' `
    -Body '{"activa":false}'

# 7) Revisor: puede consultar, pero no escribir
#    (revisor@tulua.gov.co / Admin1234)
$revisor = Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth/login `
    -ContentType 'application/json' `
    -Body '{"correo":"revisor@tulua.gov.co","password":"Admin1234"}'
Invoke-RestMethod -Uri 'http://localhost:3000/zonas' `
    -Headers @{ Authorization = "Bearer $($revisor.accessToken)" }
```

---

## 13. Verificación

```powershell
pnpm test -- --runInBand
pnpm test:e2e -- --runInBand
pnpm lint
pnpm build
```

Resultado esperado:

- Pruebas unitarias y e2e en verde.
- Lint sin errores.
- Build de NestJS correcto.
- `GET /zonas/geojson` público y por debajo de 2 s con los datos del seed.
