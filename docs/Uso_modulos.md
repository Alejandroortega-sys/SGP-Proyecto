# Módulo de censo de módulos y puestos — HU-13

**Módulo NestJS:** `src/modulos/` · **Ruta base:** `/modulos` · **Tabla:** `modulos`
**Frontend:** `/gestor/modulos` · **Componentes:** `frontend/src/features/modulos/`
**Migración:** `dataBase/07_modulos_hu13.sql`

---

## 1. Resumen

El gestor municipal puede censar módulos y puestos de comercio **formal e informal** con:

- Punto geográfico seleccionado sobre Leaflet.
- Categoría `formal` o `informal`.
- Titular con cuenta registrada o titular sin cuenta.
- Actividad económica.
- Foto opcional del puesto.
- Consulta de la zona contenedora y advertencia de zona restringida.
- Listado con filtros por sector derivado de la zona, categoría, estado y búsqueda.
- Ficha con foto, ubicación, restricciones e historial.
- Baja lógica y reactivación.

**No se agregó un campo `tipo`:** módulos y puestos comparten la tabla `modulos`.
**No se agregó una columna `sector`:** el sector es el nombre de la zona activa que
contiene el punto. Los puntos fuera de toda zona activa se agrupan como `sin_zona`.

---

## 2. Endpoints

Todos requieren `Authorization: Bearer <token>` y rol `gestor`. A diferencia de
zonas, **revisor y administrador pueden escribir**.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/modulos` | Listado con filtros y paginación. |
| `GET` | `/modulos/opciones` | Zonas activas como sectores y categorías. |
| `GET` | `/modulos/zona-contenedora?lat=&lng=` | Zona contenedora y advertencias del punto. |
| `GET` | `/modulos/:id` | Ficha completa. |
| `GET` | `/modulos/:id/historial` | Historial de auditoría. |
| `POST` | `/modulos` | Alta multipart con foto opcional. |
| `PATCH` | `/modulos/:id` | Edición multipart. |
| `PATCH` | `/modulos/:id/estado` | Baja lógica o reactivación. |

Las rutas `opciones` y `zona-contenedora` se declaran antes de `:id`.

---

## 3. Listado

### Query params

| Parámetro | Tipo | Descripción |
|---|---|---|
| `categoria` | `formal` \| `informal` | Categoría del comercio. |
| `sector` | texto | Nombre de una zona activa o `sin_zona`. |
| `estado` | `activo` \| `baja` \| `todos` | Por defecto se devuelven todos. |
| `busqueda` | texto | Código, actividad, titular o correo. |
| `pagina` | entero ≥ 1 | Default `1`. |
| `limite` | entero 1–100 | Default `20`. |

### Respuesta

```json
{
  "datos": [
    {
      "id": "7",
      "codigo": "MOD-0007",
      "categoria": "informal",
      "titular": null,
      "titularNombre": "Nelson Mina",
      "actividad": "Empanadas El Sabor",
      "fotoUrl": "/uploads/modulos/uuid.png",
      "estado": "activo",
      "sector": "Centro - Calle 30",
      "zonaContenedora": {
        "id": "1",
        "nombre": "Centro - Calle 30",
        "tipo": "permitida",
        "horarioInicio": "06:00",
        "horarioFin": "18:00",
        "aforoMaximo": 40,
        "productos": ["Frutas frescas", "Verduras"]
      },
      "ubicacion": {
        "type": "Point",
        "coordinates": [-76.1955, 4.0885]
      },
      "creadoEn": "2026-10-01T12:00:00.000Z"
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

---

## 4. Zona contenedora y advertencias

```http
GET /modulos/zona-contenedora?lat=4.0905&lng=-76.194
```

```json
{
  "zona": {
    "id": "3",
    "nombre": "Entorno Hospital",
    "tipo": "restringida",
    "horarioInicio": "06:00",
    "horarioFin": "18:00",
    "aforoMaximo": 5,
    "productos": ["Frutas frescas"]
  },
  "sector": "Entorno Hospital",
  "advertencias": [
    {
      "tipo": "zona_restringida",
      "mensaje": "El punto está en la zona restringida «Entorno Hospital». El censo se guardará solo si confirmas que conoces la restricción.",
      "requiereConfirmacion": true
    }
  ],
  "requiereConfirmacion": true
}
```

| Situación | Advertencia | Confirmación |
|---|---|---|
| Zona permitida | Ninguna | No |
| Zona restringida | `zona_restringida` | **Sí** |
| Alta congestión | `alta_congestion` | No |
| Fuera de zona activa | `fuera_de_zona` | No |

El alta o la edición con cambio de ubicación vuelven a calcular la zona. Si es
restringida y no llega `aceptaAdvertencia=true`, el backend responde `422` con
`advertencias`. No se puede omitir la confirmación llamando directamente a la API.

---

## 5. Alta y edición

`POST /modulos` y `PATCH /modulos/:id` usan `multipart/form-data`.

| Campo | Obligatorio | Regla |
|---|---|---|
| `categoria` | Sí | `formal` o `informal`. |
| `actividad` | Sí | 1–200 caracteres. |
| `ubicacion` | Sí | JSON `{"type":"Point","coordinates":[lng,lat]}`. |
| `titularId` | Uno de los dos | Comerciante registrado existente. |
| `titularNombre` | Uno de los dos | 1–150 caracteres. |
| `foto` | No | JPG/PNG/WebP, máximo 5 MB. |
| `aceptaAdvertencia` | Solo zona restringida | `true` para confirmar. |

- El `codigo` se genera automáticamente con la secuencia `modulos_codigo_seq`
  (`MOD-0007`, `MOD-0008`…).
- `registrado_por` se toma del gestor autenticado.
- La edición conserva la foto anterior si no se envía una nueva.
- El `codigo` no se modifica en la edición.

---

## 6. Foto

- Almacenamiento local en `UPLOAD_DIR` (default `uploads`).
- Límite configurable con `UPLOAD_MAX_BYTES` (default `5242880` = 5 MB).
- URL pública: `/uploads/modulos/<uuid>.<ext>`.
- Validación de MIME declarado **y** firma binaria real:
  - JPEG `FF D8 FF`
  - PNG `89 50 4E 47 0D 0A 1A 0A`
  - WebP `RIFF....WEBP`
- Errores: tipo/contenido inválido `400`, tamaño excedido `413`.
- El nombre original no se usa; se genera un UUID.

---

## 7. Baja lógica e historial

```http
PATCH /modulos/7/estado
Content-Type: application/json

{ "estado": "baja" }
```

- `baja` conserva la fila y deja de contar en la ocupación activa.
- `activo` reactiva el módulo.
- La operación es idempotente.
- El trigger `trg_modulos_auditoria` registra `INSERT`, `UPDATE` y `DELETE` en
  `auditoria` con `app.actor_id`.
- La migración registra una auditoría inicial para los módulos existentes.

```http
GET /modulos/7/historial?pagina=1&limite=20
```

Devuelve eventos con actor, fecha y cambios relevantes (categoría, titular,
actividad, foto, ubicación y estado).

---

## 8. Frontend

| Ruta | Contenido |
|---|---|
| `/gestor/modulos` | Listado, filtros, baja y reactivación. |
| `/gestor/modulos/nuevo` | Formulario de censo con mapa. |
| `/gestor/modulos/[id]` | Ficha del módulo con foto, zona e historial. |
| `/gestor/modulos/[id]/editar` | Edición del censo. |

El mapa usa Leaflet y OpenStreetMap, muestra las zonas activas y consulta la zona
contenedora al hacer clic o arrastrar el marcador. En zona restringida el botón de
guardar permanece deshabilitado hasta marcar la confirmación.

---

## 9. Pruebas

```powershell
# Backend
pnpm test -- --runInBand
pnpm test:e2e -- --runInBand
pnpm lint
pnpm build

# Frontend
cd frontend
pnpm test
pnpm test:e2e modulos.spec.ts
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

La suite Playwright crea módulos reales con prefijo `E2E Módulos` y los elimina
junto con su auditoría y sus fotos al terminar.

---

## 10. Migración

```powershell
psql -U postgres -d "sgp_tulua" -f dataBase/07_modulos_hu13.sql
```

El script es idempotente. Crea:

- `fn_auditoria_modulos` y `trg_modulos_auditoria`.
- `modulos_codigo_seq`, sembrada a partir del mayor código existente.
- `idx_modulos_categoria_estado`.
- Auditoría inicial de los módulos que aún no tenían historial.
