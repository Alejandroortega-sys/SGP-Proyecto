# Importación de zonas y módulos — HU-14

**Módulo NestJS:** `src/importaciones/` · **Ruta base:** `/importaciones`
**Frontend:** `/gestor/importaciones` · **Componentes:** `frontend/src/features/importaciones/`
**Dependencias nuevas:** ninguna · **Cambios de esquema:** ninguno

---

## 1. Resumen

El gestor municipal puede importar datos desde archivos:

- **Zonas:** un GeoJSON de polígonos con validación topológica, detección de
  solapes y reproyección a EPSG:4326.
- **Módulos:** un CSV con una fila por puesto, resolución del titular y de la
  zona contenedora, y reporte de errores por fila.

El flujo siempre es el mismo:

```
Cargar archivo → Previsualizar → Confirmar → Descargar reporte
```

La previsualización **no escribe datos definitivos**. La confirmación reutiliza
`ZonasService.crear` y `ModulosService.crear`, por lo que se conservan los
triggers, el versionado de zonas, el código automático de módulos, la auditoría
y la validación de zona restringida que ya existían.

---

## 2. Permisos

| Importación | Revisor | Administrador |
|---|---|---|
| Zonas (GeoJSON) | No | Sí |
| Módulos (CSV) | Sí | Sí |
| Reporte | Solo el gestor que creó la previsualización | Solo el gestor que la creó |

Todos los endpoints requieren `Authorization: Bearer <token>` y rol `gestor`.
El token de previsualización está ligado al usuario que lo creó.

---

## 3. Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/importaciones/srids` | SRID comunes disponibles en `spatial_ref_sys`. |
| `POST` | `/importaciones/zonas/previsualizar` | Multipart `archivo` + `sridOrigen` opcional. |
| `POST` | `/importaciones/zonas/confirmar` | JSON `{ "token": "..." }`. |
| `POST` | `/importaciones/modulos/previsualizar` | Multipart `archivo`. |
| `POST` | `/importaciones/modulos/confirmar` | JSON `{ "token": "...", "aceptaAdvertencia": false }`. |
| `GET` | `/importaciones/:token/reporte` | CSV de errores de una importación confirmada. |

### 3.1 Previsualización

```http
POST /importaciones/zonas/previsualizar
Content-Type: multipart/form-data

archivo=@zonas.geojson
sridOrigen=3857
```

Respuesta `200`:

```json
{
  "token": "3f1c2b9e-7a4d-4f0e-9b2a-1d2c3e4f5a6b",
  "tipo": "zonas",
  "expiraEn": "2026-11-09T15:30:00.000Z",
  "archivo": { "nombre": "zonas.geojson", "bytes": 12345 },
  "sridOrigen": 3857,
  "sridDetectado": true,
  "resumen": {
    "total": 10,
    "validas": 8,
    "rechazadas": 2,
    "advertencias": 1
  },
  "filas": [
    {
      "fila": 1,
      "estado": "valida",
      "datos": {
        "nombre": "Zona nueva",
        "tipo": "permitida",
        "horarioInicio": "06:00",
        "horarioFin": "18:00",
        "aforoMaximo": 20,
        "productosPermitidos": ["Frutas frescas"]
      },
      "geometria": { "type": "Polygon", "coordinates": [] },
      "zonaContenedora": null,
      "errores": [],
      "advertencias": [],
      "requiereConfirmacion": false
    }
  ]
}
```

- `estado` es `valida`, `advertencia` o `rechazada`.
- Una fila con advertencia **sí se importa**; una rechazada no.
- `geometria` ya está en EPSG:4326 y es la que se pinta en el mapa.
- `zonaContenedora` solo se usa en módulos.

### 3.2 Confirmación

```http
POST /importaciones/modulos/confirmar
Content-Type: application/json

{
  "token": "3f1c2b9e-7a4d-4f0e-9b2a-1d2c3e4f5a6b",
  "aceptaAdvertencia": true
}
```

Respuesta `200`:

```json
{
  "token": "...",
  "tipo": "modulos",
  "resumen": {
    "total": 10,
    "importados": 7,
    "rechazados": 3,
    "conAdvertencia": 1
  },
  "importados": [
    { "fila": 1, "id": "12", "codigo": "MOD-0012", "nombre": "Empanadas" }
  ],
  "rechazados": [
    { "fila": 3, "motivo": "La latitud debe ser un número entre -90 y 90." }
  ],
  "reporte": {
    "disponible": true,
    "nombreArchivo": "reporte-importacion-modulos-3f1c2b9e.csv",
    "url": "/importaciones/3f1c2b9e-7a4d-4f0e-9b2a-1d2c3e4f5a6b/reporte"
  }
}
```

La confirmación es **idempotente**: si se repite, no vuelve a insertar las filas
ya procesadas y devuelve el mismo resultado. Las filas que fallan se registran y
las demás continúan; no se revierte toda la importación. Si todas las filas son
inválidas, la confirmación no crea registros y genera un reporte con todos los
motivos.

### 3.3 Reporte

- `Content-Type: text/csv; charset=utf-8`.
- `Content-Disposition: attachment; filename="..."`.
- UTF-8 con BOM para que Excel respete las tildes.
- Incluye un resumen inicial y una fila por registro rechazado.
- Las celdas que empiezan por `=`, `+`, `@` o un `-` no numérico se sanean para
  evitar fórmulas en Excel.

---

## 4. Formato GeoJSON

### 4.1 Estructura

Se acepta un `FeatureCollection` o un único `Feature`.

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "nombre": "Zona nueva",
        "tipo": "permitida",
        "horarioInicio": "06:00",
        "horarioFin": "18:00",
        "aforoMaximo": 20,
        "productosPermitidos": "Frutas frescas; Verduras"
      },
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
      }
    }
  ]
}
```

### 4.2 Reglas

| Elemento | Regla |
|---|---|
| `geometry.type` | Solo `Polygon`. `MultiPolygon` y colecciones se rechazan. |
| Anillos | Mínimo 4 posiciones y cerrados. |
| Coordenadas | `[longitud, latitud]`; se admite altitud y se descarta. |
| `properties.nombre` | Obligatorio, 3–150 caracteres. |
| `properties.tipo` | `permitida`, `restringida` o `alta_congestion`. |
| `horarioInicio` / `horarioFin` | Opcionales, ambos juntos, `HH:MM`, fin posterior al inicio. |
| `aforoMaximo` | Opcional, entero mayor que cero. |
| `productosPermitidos` | Opcional, lista o texto separado por `;`. Los nombres deben existir y estar activos en `productos`. |
| `id` | Se ignora: la importación **solo crea** zonas nuevas. |
| Nombre repetido | Se muestra una advertencia, pero no se rechaza (la BD no exige unicidad de nombre). |
| Solapes | Se rechazan contra zonas activas y entre features del mismo archivo. La BD vuelve a validar al confirmar. |

### 4.3 Reproyección

El SRID de origen se resuelve así:

1. Si el archivo tiene el miembro antiguo `crs`, se lee de allí.
2. Si la interfaz envía `sridOrigen`, se usa ese valor.
3. Si existen ambos y no coinciden, el archivo se rechaza con `422`.
4. Si no hay ninguno, se asume EPSG:4326.

La transformación se hace en PostGIS:

```sql
ST_Transform(
  ST_SetSRID(ST_GeomFromGeoJSON($1), $sridOrigen),
  4326
)
```

El SRID debe existir en `spatial_ref_sys`. La interfaz ofrece WGS84, Web Mercator
y los sistemas MAGNA-SIRGAS comunes; también permite escribir cualquier EPSG.

---

## 5. Formato CSV de módulos

### 5.1 Columnas

| Columna | Obligatoria | Regla |
|---|---|---|
| `categoria` | Sí | `formal` o `informal`. |
| `actividad` | Sí | 1–200 caracteres. |
| `latitud` | Sí | Número entre -90 y 90. |
| `longitud` | Sí | Número entre -180 y 180. |
| `titular_documento` | Uno de los dos | Documento de un comerciante registrado. |
| `titular_nombre` | Uno de los dos | Nombre libre, 1–150 caracteres. |

Debe venir **exactamente uno** de `titular_documento` o `titular_nombre`. Las
columnas adicionales se ignoran.

### 5.2 Ejemplo

```csv
categoria,actividad,latitud,longitud,titular_documento,titular_nombre
informal,Venta de empanadas,4.0885,-76.1955,1032456789,
formal,Artesanías,4.0900,-76.1940,,Ana Ruiz
```

### 5.3 Codificación y delimitador

- UTF-8 obligatorio, con BOM opcional.
- Delimitador coma o punto y coma detectado desde el encabezado.
- Comillas dobles, comillas escapadas (`""`) y saltos de línea dentro de campos.
- En archivos con `;` se acepta coma decimal (`4,0885`) y separador de miles
  (`1.234,56`).
- Máximo 10 MB y 5.000 filas de datos.

### 5.4 Zonas restringidas

La previsualización marca las filas cuyo punto cae en una zona restringida con
`requiereConfirmacion: true`. En la pantalla aparece una casilla global:

- Marcada: las filas restringidas se importan.
- Sin marcar: esas filas se rechazan y quedan en el reporte.
- La confirmación vuelve a calcular la zona, de modo que un cambio posterior en
  las zonas no se puede omitir.

---

## 6. Flujo de la pantalla

Ruta: `/gestor/importaciones`.

1. **Cargar**
   - Pestañas «Zonas (GeoJSON)» y «Módulos (CSV)».
   - El revisor solo ve la pestaña de módulos.
   - Validación previa de extensión y tamaño.
   - Selector de SRID para zonas.
   - Plantilla descargable para cada formato.

2. **Previsualizar**
   - Tarjetas de total, válidas, advertencias y rechazadas.
   - Mapa Leaflet con zonas activas en gris y las filas candidatas con color
     según su estado.
   - Tabla en escritorio y tarjetas en móvil.
   - Motivos por fila.
   - Casilla de confirmación global si hay zonas restringidas.

3. **Confirmar**
   - Indicador de progreso y bloqueo del botón.
   - Resumen de importados y rechazados.

4. **Reporte**
   - Descarga del CSV de errores.
   - Enlaces a `/gestor/zonas` o `/gestor/modulos`.
   - Opción de importar otro archivo.

Estados contemplados: carga, éxito, vacío, error de archivo, error de red y token
expirado.

---

## 7. Códigos HTTP

| Código | Caso |
|---|---|
| `400` | Falta el archivo, DTO inválido o extensión incorrecta. |
| `401` | Sin token de acceso. |
| `403` | Rol/perfil sin permiso o token de otro gestor. |
| `409` | Reporte solicitado antes de confirmar. |
| `410` | Previsualización expirada o eliminada. |
| `413` | Archivo mayor a 10 MB. |
| `422` | JSON/CSV con formato incorrecto, encabezados faltantes, más de 5.000 filas, SRID desconocido o CRS contradictorio. |

Los errores de **una fila** no cambian el código HTTP: la previsualización
responde `200` y los devuelve en `errores`.

---

## 8. Implementación

| Archivo | Contenido |
|---|---|
| `src/importaciones/importaciones.module.ts` | Módulo; importa `ZonasModule` y `ModulosModule`. |
| `src/importaciones/importaciones.controller.ts` | Endpoints, multipart y Swagger. |
| `src/importaciones/importaciones.service.ts` | Previsualización, confirmación y reporte. |
| `src/importaciones/almacen-previsualizaciones.ts` | Tokens en memoria con TTL de 30 min y máximo 20 entradas. |
| `src/importaciones/csv.ts` | Parser RFC 4180, BOM, delimitador y encabezados. |
| `src/importaciones/geojson.ts` | Features, polígonos, propiedades y CRS. |
| `src/importaciones/reporte.ts` | CSV de errores con BOM y saneamiento. |
| `src/importaciones/errores.ts` | Errores de archivo/fila y traducción de errores de BD. |
| `src/importaciones/dto/importaciones.dto.ts` | DTOs de entrada y respuesta. |

Decisiones:

- **Sin tabla nueva:** el token vive en memoria. En una sola instancia de API es
  suficiente; con varias instancias habría que compartir el almacén.
- **Sin dependencias nuevas:** el CSV se parsea con un parser propio.
- **La BD sigue siendo la autoridad:** la confirmación llama a los servicios de
  dominio y deja que PostGIS valide topología, solapes y restricciones.
- **Revalidación:** aunque la previsualización cambie, la confirmación vuelve a
  validar cada fila.
- **No se modifica** `prisma/schema.prisma` ni los scripts SQL.

---

## 9. Pruebas

### Backend

```powershell
pnpm test -- --runInBand src/importaciones
pnpm test:e2e -- --runInBand importaciones
pnpm lint
pnpm build
```

Cobertura:

- Parser CSV: BOM, coma/punto y coma, comillas, saltos internos, encabezados
  faltantes/duplicados, límite de filas y UTF-8.
- Lector GeoJSON: FeatureCollection/Feature, Polygon, anillos, altitud, tipos,
  propiedades, `crs` y contradicciones.
- Servicio: previsualización válida, parcial y totalmente inválida, productos,
  titulares, zonas restringidas, idempotencia, tokens de otro gestor y expirados.
- Reporte: BOM, escape y saneamiento de fórmulas.
- E2E: autenticación, roles, formato incorrecto, confirmación parcial, reporte y
  error `410`.

### Frontend

```powershell
cd frontend
pnpm test
pnpm test:e2e importaciones.spec.ts
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

Cobertura Playwright:

- Administrador ve ambas pestañas; revisor solo módulos.
- GeoJSON parcial: previsualización con mapa, confirmación y reporte.
- CSV parcial: fila válida, fila inválida y zona restringida con confirmación
  global.
- CSV con formato incorrecto: mensaje claro y sin confirmación.
- Vista a 360 px sin desplazamiento horizontal.

Las pruebas Playwright crean datos reales con el prefijo `E2E Importación` y los
eliminan por SQL al terminar, junto con su auditoría.

---

## 10. Prueba manual

1. Backend: `pnpm start:dev`.
2. Frontend: `cd frontend && pnpm dev`.
3. Iniciar sesión como `admin@tulua.gov.co` / `Admin1234`.
4. Abrir `http://localhost:3001/gestor/importaciones`.
5. Probar:
   - Descargar la plantilla CSV y cargarla sin cambios.
   - Cargar un GeoJSON con un polígono libre.
   - Cargar un GeoJSON que se solape con una zona del seed: debe aparecer como
     rechazado.
   - Cargar un CSV con una fila válida, una con categoría incorrecta y una en
     «Entorno Hospital».
   - Confirmar sin marcar la casilla: la fila restringida debe quedar rechazada.
   - Repetir, marcar la casilla y confirmar: debe importarse.
   - Descargar el reporte y abrirlo en Excel.
6. Entrar como `revisor@tulua.gov.co` / `Admin1234`: no debe ver la pestaña de
   zonas.
