# Módulo de Zonas — Uso y funcionamiento

**Proyecto:** Plataforma Web de Gestión del Espacio Público, Ferias Agroecológicas y Comercio Formal/Informal de Tuluá (Equipo 6)
**Módulo NestJS:** `src/zonas/` · **Ruta base:** `/zonas` · **Tablas:** `zonas`, `zona_productos`
**Frontend:** `/gestor/zonas` · **Componentes:** `frontend/src/features/zonas/`
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

### Query params

| Parámetro | Tipo    | Obligatorio | Descripción |
| --------- | ------- | ----------- | ----------- |
| `zoom`    | entero  | No          | Nivel de zoom del mapa (0–22). A menor zoom, mayor simplificación del polígono |

Si se omite `zoom`, se devuelve la geometría completa (comportamiento histórico).
Si se envía, el backend aplica `ST_SimplifyPreserveTopology` y reduce los
decimales de `ST_AsGeoJSON` según esta tabla:

| Zoom    | Tolerancia (grados) | Decimales |
| ------- | ------------------- | --------- |
| ≤ 11    | 0.0005              | 4         |
| 12–13   | 0.0002              | 4         |
| 14–15   | 0.00005             | 5         |
| 16–17   | sin simplificar     | 6         |
| 18–22   | sin simplificar     | 7         |

La simplificación nunca deja un polígono vacío: si `ST_SimplifyPreserveTopology`
produce una geometría vacía, se devuelve la original.

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
- **Simplificación:** se aplica `ST_SimplifyPreserveTopology` cuando se envía `?zoom=`. El frontend la usa al cambiar de nivel de zoom y cachea la respuesta por nivel para no agotar el límite de peticiones.

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
| `src/zonas/geometria-zoom.ts`                   | Tolerancia y decimales de simplificación por zoom     |
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

# 4b) GeoJSON simplificado para el nivel de zoom del mapa
Invoke-RestMethod -Uri 'http://localhost:3000/zonas/geojson?zoom=14'

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

---

## 14. Interfaz del gestor — Delimitar y clasificar (HU-11)

La interfaz reutiliza el módulo `/zonas` existente. **No se modificó el backend
ni el esquema de base de datos**: el navegador ayuda con validaciones inmediatas,
pero PostGIS sigue siendo la autoridad final de topología y solapes.

### Rutas

| Ruta | Acceso | Función |
| --- | --- | --- |
| `/gestor/zonas` | Gestor revisor y administrador | Listado, filtros, paginación y baja lógica |
| `/gestor/zonas/nueva` | Solo administrador | Editor para dibujar y clasificar una zona nueva |
| `/gestor/zonas/[id]/editar` | Administrador escribe; revisor consulta | Edición, vista previa y lectura del detalle |

### Listado

- Filtros por `tipo`, `activo` y búsqueda por nombre.
- Paginación de 20 registros.
- Tabla en escritorio y tarjetas en móvil.
- Columnas: zona, tipo, horario, aforo, espacios, módulos, estado y acciones.
- El administrador ve «Crear zona», «Editar», «Activar» y «Desactivar».
- El revisor ve el listado y el enlace «Ver» en modo lectura.
- La desactivación pide confirmación y usa `PATCH /zonas/:id/estado`; no borra
  la zona ni sus datos históricos.

### Editor de polígonos

- Mapa Leaflet cargado solo en el cliente con `next/dynamic` y `ssr: false`.
- Centro inicial en Tuluá, zoom 15.
- Las zonas activas se muestran como contexto, usando `GET /zonas/geojson`.
- Herramientas:
  - clic para agregar un vértice;
  - arrastrar un vértice para moverlo;
  - clic sobre un vértice para eliminarlo;
  - **Deshacer**, **Borrar**, **Cerrar polígono** y **Reabrir forma**.
- En edición se muestra la forma guardada con línea discontinua y la forma
  nueva encima, como vista previa del cambio.
- La zona en conflicto se resalta en rojo y se identifica por nombre.

### Validaciones del navegador

Antes de enviar se comprueba:

- mínimo tres vértices y área mayor que cero;
- autointersección: cruces entre aristas no adyacentes, vértices repetidos o
  un vértice que toca otra arista;
- solape con zonas activas: cruce de aristas, contención o solape parcial;
- los **bordes compartidos entre zonas adyacentes sí se permiten**, igual que
  `ST_Relate(..., '2********')` en PostGIS;
- la zona que se está editando se excluye de la comparación.

Mensajes principales:

- «Dibuja al menos tres vértices para formar un polígono.»
- «El polígono se cruza a sí mismo. Corrige los vértices marcados.»
- «El polígono no encierra un área válida.»
- «La zona se solapa con «Nombre». Las geometrías no pueden superponerse.»

Si PostGIS rechaza la operación, el editor muestra el mensaje `422` del backend
tal cual, sin ocultarlo.

### Formulario de clasificación y restricciones

- **Nombre:** 3 a 150 caracteres.
- **Tipo:** permitida, restringida o alta congestión, con descripción.
- **Horario:** hora de inicio y fin opcionales; deben enviarse juntas y el fin
  debe ser posterior al inicio.
- **Aforo:** entero mayor que cero o vacío.
- **Productos permitidos:** selección múltiple desde `GET /productos`.
  Solo se ofrecen productos activos.

En edición:

- Solo se envían los campos que cambiaron.
- Borrar el horario envía `null` en ambos campos.
- Borrar el aforo envía `null`.
- La lista de productos solo se reemplaza si el usuario la modifica.
- Si una zona ya tenía productos inactivos, se muestran con una advertencia:
  al modificar la lista esas asociaciones se eliminan, porque el backend solo
  acepta productos activos.

### Publicación inmediata

- Al crear una zona, el editor redirige a la edición con el mensaje de éxito.
- La zona nace activa por el valor por defecto de la base de datos.
- `GET /zonas/geojson` no almacena caché en el cliente, por lo que el mapa
  ciudadano y su ficha muestran la zona y sus restricciones en la siguiente
  consulta.
- La baja lógica excluye la zona del GeoJSON público.

### Archivos del frontend

| Archivo | Contenido |
| --- | --- |
| `frontend/src/features/zonas/lista-zonas.tsx` | Listado, filtros, paginación y baja lógica |
| `frontend/src/features/zonas/editor-zona.tsx` | Orquestación de creación/edición y permisos |
| `frontend/src/features/zonas/mapa-editor-zona.tsx` | Dibujo, vértices y vista previa en Leaflet |
| `frontend/src/features/zonas/mapa-editor-zona-carga.tsx` | Carga cliente con `next/dynamic` |
| `frontend/src/features/zonas/formulario-zona.tsx` | Clasificación, horario, aforo y productos |
| `frontend/src/features/zonas/geometria-zona.ts` | Conversión GeoJSON y validación topológica |
| `frontend/src/features/zonas/validaciones-zona.ts` | Reglas del formulario y cuerpos de la API |
| `frontend/src/features/zonas/*.test.ts` | Pruebas Vitest de geometría y validaciones |
| `frontend/src/app/(gestor)/gestor/zonas/**` | Rutas del listado y editor |
| `frontend/e2e/zonas.spec.ts` | Pruebas Playwright contra API y BD real |
| `frontend/e2e/limpieza-zonas.ts` | Limpieza SQL de las zonas de prueba |

### Pruebas de la interfaz

```powershell
cd frontend
pnpm test
pnpm lint
pnpm build
pnpm test:e2e e2e/zonas.spec.ts
```

Las pruebas Playwright cubren:

- creación de una zona válida dibujando sobre el mapa;
- clasificación, horario, aforo y productos;
- edición con vista previa;
- desactivación con confirmación y desaparición del GeoJSON público;
- rechazo de autointersecciones y solapes en el editor;
- rechazo `422` de la API real para geometrías autointersectadas y solapadas;
- acceso de solo lectura del revisor.

La prueba crea zonas cuyo nombre empieza por `E2E Zonas`; al final las elimina
por SQL junto con sus filas de auditoría, sin tocar las zonas del seed.

### Cómo probar manualmente

1. Iniciar backend y frontend:

   ```powershell
   pnpm start:dev
   cd frontend
   pnpm dev
   ```

2. Entrar como administrador (`admin@tulua.gov.co` / `Admin1234`).
3. Abrir `http://localhost:3001/gestor/zonas`.
4. Crear una zona en un área libre, completar el formulario y guardar.
5. Abrir `http://localhost:3001/mapa` y comprobar el polígono y su ficha.
6. Volver al listado, editar la zona y desactivarla.
7. Entrar como revisor (`revisor@tulua.gov.co` / `Admin1234`) y comprobar que
   solo puede consultar.
