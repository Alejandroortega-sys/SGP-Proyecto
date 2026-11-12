# Módulo de Espacios — HU-09

**Proyecto:** Plataforma Web de Gestión del Espacio Público, Ferias Agroecológicas y Comercio Formal/Informal de Tuluá (Equipo 6)
**Módulo NestJS:** `src/espacios/` · **Ruta base:** `/espacios` · **Tablas:** `espacios_temporales`, `espacio_bloqueos`, `zonas`, `zona_productos`, `permisos`, `solicitudes`
**Frontend:** `/comerciante/espacios` · **Componentes:** `frontend/src/features/espacios/`

---

## 1. Resumen

Este módulo permite al **comerciante autenticado** consultar los espacios disponibles del espacio público, verlos en una tabla o en el mapa y abrir su ficha completa con las restricciones de su zona.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/espacios` | Comerciante | Lista espacios con filtros, geometría y estado |
| `GET` | `/espacios/opciones` | Comerciante | Sectores y actividades para el panel de filtros |
| `GET` | `/espacios/:id` | Comerciante | Ficha completa, incluso de espacios no disponibles |

La ficha incluye **tipo, sector, dimensiones, actividad, horario, estado registrado, estado efectivo, bloqueo u ocupación vigente y restricciones de la zona**.

> El ciudadano sigue usando el mapa público de zonas (`/mapa`). Los espacios requieren una cuenta de comerciante activa, como pide HU-09.

---

## 2. Modelo de datos

La migración `dataBase/04_espacios_hu09.sql` agrega a `espacios_temporales`:

| Campo | Tipo | Regla |
|---|---|---|
| `tipo` | `tipo_espacio` | `modulo`, `kiosco`, `puesto` o `espacio_movil` |
| `sector` | `VARCHAR(100)` | Sector o barrio del espacio |
| `dimensiones` | `VARCHAR(60)` | Medidas legibles, por ejemplo `3 × 2 m` |
| `horario_inicio` / `horario_fin` | `TIME` | Opcionales; si existen, `horario_fin > horario_inicio` |

También crea los índices `idx_espacios_estado` y `idx_bloqueos_espacio_fechas`.

### Estados

El enum `estado_espacio` conserva cuatro valores:

- `disponible`
- `bloqueado`
- `asignado`
- `mantenimiento`

El estado **registrado** es el de la columna `estado`. El estado **efectivo** se calcula con la fecha consultada:

1. `mantenimiento` siempre prevalece.
2. Un bloqueo activo en `espacio_bloqueos` convierte el espacio en `bloqueado`.
3. Un permiso `vigente` o una solicitud `aprobada` que cubra la fecha lo convierten en `asignado`.
4. Si la BD lo registra como `bloqueado` o `asignado`, se respeta aunque no exista un registro auxiliar activo.
5. Solo es `disponible` si el estado efectivo es `disponible`.

Así se cumple la regla de aceptación: **un espacio ocupado o bloqueado no aparece como disponible**. Además, desde HU-15 el estado almacenado se sincroniza automáticamente con bloqueos, permisos, solicitudes y asignaciones manuales mediante `fn_recalcular_estado_espacio`.

---

## 3. Autenticación

```http
Authorization: Bearer <accessToken>
```

Los dos endpoints usan `@Roles('comerciante')`. Un gestor, organizador o usuario sin sesión recibe `403` o `401`.

---

## 4. Listar espacios — `GET /espacios`

### Query params

| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `incluirNoDisponibles` | boolean | `false` | Incluye bloqueados, asignados y en mantenimiento para consultar su ficha |
| `fecha` | `YYYY-MM-DD` | fecha actual de la BD | Fecha con la que se evalúan bloqueos y ocupaciones |
| `sector` | texto | — | Coincidencia exacta con `espacios_temporales.sector` |
| `actividad` | texto | — | Coincidencia exacta con `actividad_permitida` |
| `horaInicio` | `HH:MM` | — | Inicio del rango horario solicitado; requiere `horaFin` y `fecha` |
| `horaFin` | `HH:MM` | — | Fin del rango horario solicitado; debe ser posterior a `horaInicio` |

Ejemplos:

```http
GET /espacios
GET /espacios?incluirNoDisponibles=true
GET /espacios?fecha=2026-11-10
GET /espacios?sector=Centro&actividad=Venta%20de%20alimentos%20y%20frutas
GET /espacios?fecha=2026-11-10&horaInicio=10:00&horaFin=12:00
```

Reglas del filtro horario:

- `horaInicio` y `horaFin` se envían juntos.
- El rango debe caber dentro del horario efectivo del espacio: horario propio o, si no tiene, horario de la zona.
- Se cruza con `solicitudes.hora_inicio/hora_fin` de permisos vigentes y solicitudes aprobadas.
- Un bloqueo de fechas bloquea el día completo.
- Si el espacio y la zona no tienen horario, no se aplica restricción horaria.
- Los estados registrados `bloqueado`, `asignado` y `mantenimiento` siempre se respetan.

### Respuesta `200`

```json
{
  "datos": [
    {
      "id": "1",
      "nombre": "Espacio móvil Calle 30 - A",
      "tipo": "espacio_movil",
      "sector": "Centro",
      "dimensiones": "3 × 2 m",
      "actividadPermitida": "Venta de alimentos y frutas",
      "estado": "disponible",
      "estadoEfectivo": "disponible",
      "disponible": true,
      "motivoEstado": null,
      "ubicacion": {
        "type": "Point",
        "coordinates": [-76.195, 4.089]
      },
      "horario": { "inicio": "06:00", "fin": "14:00" },
      "zona": {
        "id": "1",
        "nombre": "Centro - Calle 30",
        "tipo": "permitida"
      }
    }
  ],
  "total": 3,
  "disponibles": 3,
  "noDisponibles": 3
}
```

- `total` es la cantidad devuelta por el filtro actual.
- `disponibles` y `noDisponibles` cuentan los espacios que cumplen **todos** los filtros aplicados.
- Si el espacio no tiene horario propio, `horario` hereda el de su zona.
- La geometría se lee con `ST_AsGeoJSON(ubicacion)::jsonb` y se normaliza como `Point`.

### Opciones de filtros — `GET /espacios/opciones`

```http
GET /espacios/opciones
```

```json
{
  "sectores": ["Centro", "Parque La Guadua", "Plaza Boyacá"],
  "actividades": ["Artesanías", "Comidas rápidas", "Ferias y emprendimientos", "Venta de alimentos y frutas"]
}
```

Las opciones se calculan sobre todos los espacios registrados, no solo sobre los disponibles, para que no desaparezcan al aplicar filtros.

### Errores

| HTTP | Causa |
|---|---|
| `400` | `fecha` o `incluirNoDisponibles` inválidos |
| `401` | Sin token o token inválido/expirado |
| `403` | El rol no es comerciante |
| `503` | Base de datos no disponible |

---

## 5. Ficha del espacio — `GET /espacios/:id`

### Query params

| Parámetro | Tipo | Descripción |
|---|---|---|
| `fecha` | `YYYY-MM-DD` | Fecha con la que se evalúa el estado efectivo |

```http
GET /espacios/3
```

### Respuesta `200`

```json
{
  "id": "3",
  "nombre": "Espacio Plaza Boyacá - Norte",
  "tipo": "puesto",
  "sector": "Plaza Boyacá",
  "dimensiones": "4 × 3 m",
  "actividadPermitida": "Artesanías",
  "estado": "bloqueado",
  "estadoEfectivo": "bloqueado",
  "disponible": false,
  "motivoEstado": "Bloqueado por «Mantenimiento del andén» del 25/10/2026 al 31/10/2026.",
  "ubicacion": {
    "type": "Point",
    "coordinates": [-76.1905, 4.0888]
  },
  "horario": { "inicio": "07:00", "fin": "17:00" },
  "zona": {
    "id": "2",
    "nombre": "Plaza Boyacá",
    "tipo": "alta_congestion",
    "activa": true,
    "horarioInicio": "07:00",
    "horarioFin": "17:00",
    "aforoMaximo": 15,
    "productos": ["Artesanías", "Comidas rápidas"]
  },
  "bloqueo": {
    "fechaInicio": "2026-10-25",
    "fechaFin": "2026-10-31",
    "motivo": "Mantenimiento del andén",
    "activo": true
  },
  "permiso": null,
  "creadoEn": "2026-10-23T09:58:50.261Z"
}
```

- `bloqueo` devuelve el bloqueo más relevante (el activo primero).
- `permiso` devuelve el permiso vigente que cubre la fecha.
- `zona` devuelve las restricciones completas de la zona; si el espacio no tiene zona, es `null`.
- `id` no numérico → `400`; espacio inexistente → `404`.

---

## 6. Interfaz del comerciante

Ruta: **`/comerciante/espacios`**.

### Vista de mapa

- Capa de zonas activas como contexto, reutilizando `GET /zonas/geojson`.
- Marcadores solo de los espacios disponibles por defecto.
- Checkbox **«Mostrar no disponibles»** para consultar bloqueados, asignados y en mantenimiento sin confundirlos con disponibles.
- Agrupación de marcadores en celdas de 64 px según el zoom (`agrupar-espacios.ts`).
- Al hacer clic en un grupo, el mapa se acerca; al hacer clic en un marcador, se abre la ficha.
- Colores y símbolos por estado:
  - Disponible: verde, ✓.
  - Bloqueado: rojo, !.
  - Ocupado: azul, •.
  - Mantenimiento: gris, ⚙.

### Vista de tabla

- Columnas: Espacio, Tipo, Sector, Dimensiones, Horario, Zona, Estado y «Ver ficha».
- En móvil se muestran tarjetas equivalentes para evitar desplazamiento horizontal.
- La tabla y el mapa consumen la misma respuesta y abren la misma ficha.

### Panel de filtros

- Selectores de **sector** y **actividad** con las opciones del catálogo.
- Fecha y rango horario opcionales.
- Conteo de resultados que se actualiza al aplicar los filtros.
- Botones **Aplicar filtros** y **Limpiar filtros**.
- En escritorio es una tarjeta visible sobre los resultados.
- En móvil se abre como hoja inferior desde el botón «Filtros».
- Si no hay coincidencias, muestra «No hay espacios disponibles con esos criterios» y permite limpiar los filtros.

> El buscador de calles y barrios no forma parte de esta entrega por decisión del alcance.

### Ficha

- **Escritorio:** panel lateral derecho.
- **Móvil:** hoja inferior con fondo oscuro, tirador y cierre.
- Accesible con `role="dialog"`, foco al abrir, cierre con `Escape` y retorno del foco.
- Muestra una alerta con `motivoEstado` cuando el espacio no está disponible.
- Estados de carga, error, vacío y reintento.

---

## 7. Pruebas

### Backend

```powershell
pnpm test -- --runInBand src/espacios
pnpm test:e2e -- --runInBand test/espacios.e2e-spec.ts
```

Cubren:

- Cálculo de disponibilidad con bloqueos, permisos y solicitudes.
- Listado solo de disponibles y listado completo con `incluirNoDisponibles`.
- Ficha de un espacio bloqueado con restricciones de zona.
- Filtros combinados por sector y actividad.
- Disponibilidad por fecha y rango horario.
- Validación de horas incompletas, fuera de orden y sin fecha.
- `GET /espacios/opciones`.
- Roles: comerciante permitido; gestor, organizador y anónimo rechazados.
- `400`/`404` y validación de fecha.

### Frontend

```powershell
cd frontend
pnpm test
pnpm test:e2e e2e/espacios.spec.ts
```

Cubren:

- Agrupación por zoom y conteos por estado.
- Tabla solo con disponibles.
- Comparación de la tabla con la API real (mapa/BD).
- Ficha en panel lateral y hoja inferior.
- Espacio bloqueado visible solo al activar «Mostrar no disponibles».
- Agrupación al alejar y separación al acercar.
- Filtros combinados por sector y actividad.
- Consulta por fecha y horario.
- Caso sin resultados y limpieza de filtros.
- Panel de filtros móvil a 360 px.
- Error de API y reintento.

---

## 8. Archivos

### Backend

| Archivo | Contenido |
|---|---|
| `dataBase/04_espacios_hu09.sql` | Migración de columnas, enum, índices y datos |
| `dataBase/05_filtros_hu10.sql` | Índices de filtros y disponibilidad |
| `src/espacios/espacios.module.ts` | Módulo Nest |
| `src/espacios/espacios.controller.ts` | Endpoints, roles y Swagger |
| `src/espacios/espacios.service.ts` | Consultas SQL, cruces de disponibilidad y DTOs |
| `src/espacios/disponibilidad.ts` | Cálculo puro del estado efectivo |
| `src/espacios/dto/espacios.dto.ts` | DTOs de entrada y respuesta |
| `src/espacios/*.spec.ts` | Pruebas unitarias |
| `test/espacios.e2e-spec.ts` | Pruebas e2e |

### Frontend

| Archivo | Contenido |
|---|---|
| `frontend/src/app/(comerciante)/comerciante/espacios/page.tsx` | Ruta del comerciante |
| `frontend/src/features/espacios/espacios-comerciante.tsx` | Vista, datos, tabla/mapa y ficha |
| `frontend/src/features/espacios/mapa-espacios.tsx` | Carga cliente de Leaflet |
| `frontend/src/features/espacios/mapa-espacios-leaflet.tsx` | Zonas, marcadores y agrupación |
| `frontend/src/features/espacios/agrupar-espacios.ts` | Agrupación pura por zoom |
| `frontend/src/features/espacios/ficha-espacio.tsx` | Panel lateral / hoja inferior |
| `frontend/src/features/espacios/tabla-espacios.tsx` | Tabla y tarjetas |
| `frontend/src/features/espacios/panel-filtros.tsx` | Panel de filtros escritorio/móvil |
| `frontend/src/features/espacios/filtros-espacios.ts` | Validación y helpers de filtros |
| `frontend/src/features/espacios/estilos-espacio.ts` | Colores, símbolos y formatos |
| `frontend/src/features/espacios/etiqueta-espacio.tsx` | Etiqueta de estado |
| `frontend/e2e/espacios.spec.ts` | Pruebas Playwright |

---

## 9. Cómo probar con el seed

```powershell
# 1) Aplicar las migraciones
psql -U postgres -d "sgp_tulua" -f dataBase/04_espacios_hu09.sql
psql -U postgres -d "sgp_tulua" -f dataBase/05_filtros_hu10.sql

# 2) Login como comerciante
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth/login `
    -ContentType 'application/json' `
    -Body '{"correo":"maria.gomez@gmail.com","password":"Comerciante123"}'
$auth = @{ Authorization = "Bearer $($login.accessToken)" }

# 3) Disponibles (3 con el seed)
Invoke-RestMethod -Uri 'http://localhost:3000/espacios' -Headers $auth

# 4) Todos los estados (6 con el seed)
Invoke-RestMethod -Uri 'http://localhost:3000/espacios?incluirNoDisponibles=true' -Headers $auth

# 5) Opciones de filtros
Invoke-RestMethod -Uri 'http://localhost:3000/espacios/opciones' -Headers $auth

# 6) Filtros combinados
Invoke-RestMethod -Uri 'http://localhost:3000/espacios?sector=Centro&actividad=Venta%20de%20alimentos%20y%20frutas' -Headers $auth

# 7) Disponibilidad por fecha y horario
Invoke-RestMethod -Uri 'http://localhost:3000/espacios?fecha=2026-11-10&horaInicio=10:00&horaFin=12:00' -Headers $auth

# 8) Ficha de un espacio bloqueado
Invoke-RestMethod -Uri 'http://localhost:3000/espacios/3' -Headers $auth
```

El seed incluye:

- 3 espacios disponibles.
- 1 bloqueado con mantenimiento del 25 al 31 de octubre de 2026.
- 1 asignado.
- 1 en mantenimiento.

---

## 10. Administración municipal — HU-15

**Ruta base:** `/gestor/espacios` · **Frontend:** `/gestor/espacios`, `/gestor/espacios/nuevo`, `/gestor/espacios/[id]`, `/gestor/espacios/[id]/editar`.

La administración está disponible para gestores con perfil **revisor** y **administrador**. La consulta del comerciante sigue en `/espacios` y no cambia.

### 10.1 Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/gestor/espacios` | Listado con filtros, paginación y estado efectivo |
| `GET` | `/gestor/espacios/opciones` | Tipos, estados, zonas activas y sectores |
| `GET` | `/gestor/espacios/zona-contenedora` | Zona activa que contiene un punto |
| `GET` | `/gestor/espacios/:id` | Ficha con zona, bloqueos y estado efectivo |
| `POST` | `/gestor/espacios` | Crear espacio |
| `PATCH` | `/gestor/espacios/:id` | Editar espacio |
| `DELETE` | `/gestor/espacios/:id` | Eliminar si no tiene permisos ni solicitudes |
| `PATCH` | `/gestor/espacios/:id/estado` | Fijar `disponible` o `mantenimiento` |
| `POST` | `/gestor/espacios/:id/asignar` | Asignación manual |
| `POST` | `/gestor/espacios/:id/liberar` | Liberar asignación manual |
| `GET` | `/gestor/espacios/:id/bloqueos` | Listar bloqueos |
| `POST` | `/gestor/espacios/:id/bloqueos` | Crear bloqueo |
| `PATCH` | `/gestor/espacios/:id/bloqueos/:bloqueoId` | Editar bloqueo |
| `DELETE` | `/gestor/espacios/:id/bloqueos/:bloqueoId` | Eliminar bloqueo |
| `GET` | `/gestor/espacios/:id/historial` | Auditoría del espacio y sus bloqueos |

### 10.2 Reglas de estado

- La zona se detecta automáticamente con `ST_Contains` al crear o mover el punto.
- El formulario solo permite fijar manualmente `disponible` o `mantenimiento`.
- `mantenimiento` prevalece sobre cualquier bloqueo u ocupación.
- La asignación manual se conserva en `asignacion_manual` hasta que el gestor pulsa **Liberar**.
- El estado se recalcula con la fecha actual:
  1. permiso `vigente` que cubre hoy → `asignado`;
  2. solicitud `aprobada` que cubre hoy → `asignado`;
  3. bloqueo que cubre hoy → `bloqueado`;
  4. en otro caso → `disponible`.
- Al liberar, el estado se recalcula; si hay un bloqueo vigente queda `bloqueado`.
- No se puede asignar un espacio en mantenimiento, bloqueado hoy o ya ocupado por un permiso/solicitud.

### 10.3 Bloqueos

- `fechaFin >= fechaInicio`.
- No se permite cruzar con otro bloqueo, un permiso `vigente`, una solicitud `aprobada` o una asignación manual activa.
- La restricción `EXCLUDE` de `espacio_bloqueos` sigue siendo la última barrera de la BD.
- Crear, editar o eliminar un bloqueo dispara el recálculo del estado.
- El calendario es propio, sin librerías adicionales; en móvil se muestra además la lista de bloqueos.

### 10.4 Borrado

- Solo se elimina un espacio sin filas asociadas en `permisos` o `solicitudes`.
- Los bloqueos se eliminan en cascada.
- Si hay relaciones, responde `409` y conserva el registro.

### 10.5 Migración y auditoría

`dataBase/08_espacios_hu15.sql` agrega:

- `espacios_temporales.asignacion_manual`.
- `fn_recalcular_estado_espacio` y triggers sobre `espacio_bloqueos`, `permisos` y `solicitudes`.
- Triggers de auditoría para `espacios_temporales` y `espacio_bloqueos`.
- Historial inicial de los espacios existentes.

### 10.6 Pruebas

```powershell
pnpm test -- --runInBand src/espacios
pnpm test:e2e -- --runInBand test/gestor-espacios.e2e-spec.ts
cd frontend
pnpm test
pnpm test:e2e e2e/gestor-espacios.spec.ts
```

Cubren roles, CRUD, validaciones, bloqueos solapados, conflictos con permisos/solicitudes, asignación/liberación, mantenimiento, borrado condicionado, historial, calendario y vista a 360 px.

> Para las pruebas Playwright debe aplicarse antes la migración:
>
> ```powershell
> psql -U postgres -d "sgp_tulua" -f dataBase/08_espacios_hu15.sql
> ```
