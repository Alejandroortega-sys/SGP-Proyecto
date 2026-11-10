# Implementaciones del Sprint 2 — Estado actual

**Proyecto:** Plataforma Web de Gestión del Espacio Público, Ferias Agroecológicas y Comercio Formal/Informal de Tuluá (Equipo 6)
**Fecha de actualización:** octubre de 2026
**Rama:** `Alejandro-Sprint2`
**Alcance del documento:** lo implementado para el Sprint 2 (HU-08 a HU-15) y lo que sigue pendiente.

---

## 1. Resumen ejecutivo

| Área | Estado |
|---|---|
| Sprint 1 (HU-01 a HU-07) | Backend completo (36 endpoints) y frontend implementado |
| Base de datos | Esquema completo de los 6 sprints ya creado (30 tablas base + `zona_versiones` de HU-12, enums, triggers, `EXCLUDE`, vistas) |
| **HU-08 — Mapa público de zonas** | **Implementada de extremo a extremo** |
| **HU-09 — Espacios disponibles y ficha** | **Implementada de extremo a extremo** |
| **HU-10 — Buscar y filtrar espacios** | **Implementada** (filtros, disponibilidad por fecha/hora, panel y sin resultados; búsqueda de calles/barrios fuera de alcance) |
| **HU-11 — Delimitar y clasificar zonas** | **Implementada de extremo a extremo** (editor, clasificación, restricciones y validaciones) |
| HU-12 — Editar, desactivar y auditar zonas | **Completa** (edición, desactivación, versionado, línea de tiempo y comparación) |
| **HU-13 — Censo de módulos y puestos** | **Implementada de extremo a extremo** (formulario, mapa, listado y ficha) |
| **HU-14 — Importar GeoJSON/CSV** | **Implementada de extremo a extremo** (lector, reproyección, CSV, reporte y pruebas) |
| HU-15 — Espacios temporales y bloqueos | Pendiente |

**Estado actual del Sprint 2:** el Geo-Portal público funciona con Leaflet, zonas coloreadas, leyenda, capas, popup, geolocalización y API GeoJSON con simplificación por zoom. El comerciante ya puede consultar los espacios disponibles en tabla o mapa, ver su ficha y distinguir los estados bloqueado, ocupado y en mantenimiento. El gestor administrador ya puede dibujar zonas, clasificarlas, definir sus restricciones, editarlas, desactivarlas e importar zonas desde GeoJSON; el revisor accede en modo lectura e importa módulos desde CSV. Ambos consultan y descargan el reporte de errores de cada importación.

---

## 2. Lo implementado en el Sprint 2: HU-08, HU-09, HU-10 y HU-11

### 2.1 Ruta pública y mapa

- Ruta pública **`/mapa`** dentro del layout público (navbar y footer existentes).
- Mapa con **Leaflet 1.9.4** y teselas de **OpenStreetMap**.
- Centro inicial en Tuluá (`4.0847, -76.1954`), zoom 16.
- Controles de zoom en español y atribución visible de OpenStreetMap.
- Carga del mapa solo en el cliente mediante `next/dynamic` con `ssr: false`.

### 2.2 Polígonos y capas

- Renderizado de las zonas activas del GeoJSON.
- Colores por tipo:
  - **Permitida:** verde, línea sólida.
  - **Restringida:** ámbar, línea discontinua.
  - **Alta congestión:** rojo, línea punteada.
- Diferenciación que no depende solo del color: patrón de línea y leyenda textual.
- Leyenda con conteos por tipo.
- Checkboxes para mostrar u ocultar cada tipo de zona en tiempo real.

### 2.3 Popup de detalle

Al tocar un polígono se muestra:

- Nombre de la zona.
- Tipo.
- Horario (`06:00 a 18:00`, «Desde…», «Hasta…» o «Sin horario definido»).
- Aforo (`40 personas` o «Sin aforo definido»).
- Productos permitidos.

El contenido se construye con nodos DOM y `textContent`, evitando interpretar datos de la base como HTML.

### 2.4 Botón «Mi ubicación»

- Usa `navigator.geolocation.getCurrentPosition`.
- Centra el mapa en la posición del usuario y agrega marcador y círculo de precisión.
- Mensajes claros si:
  - el navegador no soporta geolocalización;
  - el usuario niega el permiso;
  - la ubicación no está disponible o tarda demasiado;
  - la ubicación está fuera de Tuluá (radio de 15 km desde el centro).

### 2.5 Estados de pantalla

- **Carga:** indicador mientras se obtiene el GeoJSON.
- **Vacío:** «No hay zonas publicadas» con opción de reintentar.
- **Error:** mensaje del backend y botón «Reintentar».
- **Actualización:** aviso discreto al recargar zonas por cambio de zoom.
- **Éxito:** mapa y leyenda con los datos vigentes.

### 2.6 API GeoJSON con simplificación por zoom

Endpoint:

```http
GET /zonas/geojson?zoom=14
```

- `zoom` es opcional, entero y válido entre `0` y `22`.
- Sin `zoom` se conserva el comportamiento anterior: geometría completa y 9 decimales.
- Con `zoom` se aplica `ST_SimplifyPreserveTopology` y se reducen los decimales de `ST_AsGeoJSON`.
- Si la simplificación produce una geometría vacía, se devuelve la geometría original.

| Zoom | Tolerancia (grados) | Decimales |
|---|---|---|
| ≤ 11 | 0.0005 | 4 |
| 12–13 | 0.0002 | 4 |
| 14–15 | 0.00005 | 5 |
| 16–17 | sin simplificar | 6 |
| 18–22 | sin simplificar | 7 |

El frontend solicita el GeoJSON con el zoom actual y lo vuelve a pedir al cambiar de nivel, con debounce de 300 ms y caché por nivel para no agotar el rate limit de 60 peticiones por minuto.

### 2.7 Integración con la interfaz

- Enlace **«Mapa»** en el navbar público.
- CTA **«Abrir el mapa de zonas»** y bloque informativo en la portada.
- Estilos de Leaflet, popups y controles alineados con el design system existente.
- Diseño responsive probado a 360 px, sin desplazamiento horizontal.

### 2.8 Zonas de prueba y PostGIS

No se modificó el esquema de base de datos. Se reutilizaron las 4 zonas del seed:

- Centro - Calle 30 (permitida).
- Plaza Boyacá (alta congestión).
- Entorno Hospital (restringida).
- Parque La Guadua (permitida).

El modelo existente ya cubre la HU-08:

- `zonas.geometria` (`geometry(Polygon,4326)`).
- `zonas.tipo` (`tipo_zona`).
- `zonas.horario_inicio` y `horario_fin`.
- `zonas.aforo_maximo`.
- `zona_productos` para los productos permitidos.

### 2.9 HU-09 — Espacios disponibles y ficha

#### Esquema

La migración `dataBase/04_espacios_hu09.sql` agrega a `espacios_temporales`:

- `tipo` (`tipo_espacio`: `modulo`, `kiosco`, `puesto`, `espacio_movil`).
- `sector`, `dimensiones`, `horario_inicio` y `horario_fin`.
- Índices `idx_espacios_estado` y `idx_bloqueos_espacio_fechas`.

El seed ahora tiene 6 espacios: 3 disponibles, 1 bloqueado (25–31 oct 2026), 1 asignado y 1 en mantenimiento. Así se demuestran todos los estados.

#### API

- `GET /espacios` (comerciante): espacios disponibles con geometría y estado. Acepta `incluirNoDisponibles` y `fecha`.
- `GET /espacios/:id` (comerciante): ficha completa de cualquier espacio, con restricciones de su zona.
- El **estado efectivo** cruza `estado`, `espacio_bloqueos`, `permisos` vigentes y `solicitudes` aprobadas. Un espacio ocupado o bloqueado no se devuelve como disponible.
- La ficha incluye tipo, sector, dimensiones, actividad, horario, bloqueo, permiso y zona (tipo, horario, aforo y productos).

#### Frontend

- Ruta `/comerciante/espacios` con enlace en el menú del comerciante.
- Vista de mapa y vista de tabla sobre los mismos datos.
- Capa de marcadores con agrupación por zoom en celdas de 64 px.
- Marcadores por estado: disponible (verde, ✓), bloqueado (rojo, !), ocupado (azul, •) y mantenimiento (gris, ⚙).
- Checkbox «Mostrar no disponibles» para consultar los demás estados sin presentarlos como disponibles.
- Ficha como panel lateral en escritorio y hoja inferior en móvil, accesible con teclado y cierre con `Escape`.
- Estados de carga, vacío, error y reintento.

#### Pruebas

- Unitarias: cálculo de disponibilidad, servicio, controlador, agrupación y formatos.
- E2E backend: roles, listado, ficha, bloqueo, espacio asignado y errores.
- Playwright: tabla vs API/BD, ficha de escritorio y móvil, toggle de no disponibles, agrupación por zoom y reintento.

### 2.10 HU-10 — Buscar y filtrar espacios

#### Backend

- `GET /espacios` acepta `sector`, `actividad`, `fecha`, `horaInicio` y `horaFin`.
- `GET /espacios/opciones` devuelve las listas cerradas de sectores y actividades.
- La disponibilidad por fecha y horario cruza:
  - horario propio del espacio o de su zona;
  - `espacio_bloqueos`;
  - `permisos` vigentes;
  - `solicitudes` aprobadas, usando `solicitudes.hora_inicio/hora_fin`.
- Los conteos `total`, `disponibles` y `noDisponibles` corresponden a los filtros aplicados.
- Los estados registrados `bloqueado`, `asignado` y `mantenimiento` se respetan siempre.
- Se agregan índices de sector, actividad y disponibilidad (`05_filtros_hu10.sql`).

#### Frontend

- Panel de filtros con sector, actividad, fecha y rango horario.
- Conteo de resultados que se actualiza al aplicar filtros.
- En escritorio es una tarjeta visible; en móvil se abre como hoja inferior.
- Estado sin resultados: «No hay espacios disponibles con esos criterios», con sugerencia y botón para limpiar filtros.
- El mapa y la tabla consumen el mismo resultado filtrado.
- **La búsqueda de calles/barrios y el centrado del mapa por dirección quedan fuera de esta entrega por decisión del alcance.**

#### Pruebas

- Unitarias: filtros, validación horaria, cruces de horario y opciones.
- E2E backend: combinación de filtros, fecha/hora, validaciones y opciones.
- Playwright: filtros combinados, fecha/hora, sin resultados, limpieza y panel móvil.

### 2.11 HU-11 — Interfaz de administración de zonas

El backend `/zonas` ya existía; esta entrega completa la interfaz sin modificar
el esquema ni la API.

#### Rutas

- `/gestor/zonas`: listado, filtros, paginación y baja lógica.
- `/gestor/zonas/nueva`: editor de creación.
- `/gestor/zonas/[id]/editar`: edición y vista de solo lectura.

#### Listado

- Filtros por tipo, estado activo y búsqueda por nombre.
- Tabla en escritorio y tarjetas en móvil.
- Conteos de espacios y módulos por zona.
- El administrador puede crear, editar, activar y desactivar.
- El revisor solo consulta; la baja se confirma en un modal y es lógica.

#### Editor de polígonos

- Leaflet cargado solo en cliente con `next/dynamic` y `ssr: false`.
- Dibujo por clics, vértices arrastrables, eliminación de vértices, deshacer,
  borrar, cerrar y reabrir la forma.
- Las zonas activas se muestran como contexto y la zona en conflicto se
  resalta en rojo.
- En edición se muestra la forma guardada en línea discontinua y la nueva
  encima, como vista previa.

#### Validaciones

- El navegador detecta mínimo de vértices, área nula, autointersecciones y
  solapes con zonas activas.
- Los bordes compartidos entre zonas adyacentes se permiten.
- La zona editada se excluye de la comparación.
- PostGIS sigue siendo la autoridad final: un `422` del backend se muestra con
  el mensaje del trigger.
- Errores `400`, `403`, `404`, `422` y `503` se presentan en la interfaz.

#### Formulario

- Nombre, tipo, horario, aforo y productos permitidos.
- Los productos se cargan con `GET /productos` y solo se ofrecen activos.
- En edición se envían solo los campos modificados.
- Limpiar horario o aforo envía `null`; cambiar productos reemplaza la lista.
- Los productos inactivos ya asociados se muestran con advertencia.

#### Pruebas

- Vitest: geometría, solapes, bordes compartidos, validaciones y cuerpos de la API.
- Playwright: creación, edición, baja lógica, rechazo de autointersecciones y
  solapes, API real contra PostGIS y modo lectura del revisor.
- Las zonas de prueba se eliminan por SQL al terminar, junto con su auditoría.

### 2.12 HU-14 — Importación de zonas y módulos

#### Alcance

- Carga de un GeoJSON de zonas y un CSV de módulos.
- Previsualización con resumen, mapa Leaflet y tabla de filas.
- Confirmación parcial: se importan las filas válidas y se rechazan las demás.
- Reporte de errores descargable en CSV UTF-8 con BOM.
- Flujo completo: cargar, previsualizar, confirmar y reportar.

#### Backend

- Módulo `src/importaciones/` con endpoints bajo `/importaciones`.
- GeoJSON: `FeatureCollection` o `Feature`, solo `Polygon`, anillos cerrados,
  propiedades `nombre`, `tipo`, horarios, aforo y productos.
- Reproyección a EPSG:4326 con PostGIS `ST_Transform`; el SRID se lee del
  miembro `crs` o se selecciona en la interfaz. Si ambos existen deben coincidir.
- Validación topológica con `ST_IsValid` y detección de solapes contra zonas
  activas y entre candidatas del mismo archivo.
- CSV: parser RFC 4180 con BOM, coma o punto y coma, comillas y saltos internos;
  coma decimal en archivos con punto y coma.
- Columnas: `categoria`, `actividad`, `latitud`, `longitud` y exactamente uno de
  `titular_documento` o `titular_nombre`.
- Las filas en zona restringida exigen confirmación global; sin ella se rechazan.
- La confirmación reutiliza `ZonasService.crear` y `ModulosService.crear`, por lo
  que se mantienen triggers, versionado, código automático y auditoría.
- Previsualizaciones en memoria con TTL de 30 minutos y máximo 20 entradas.
  Confirmación idempotente y revalidación contra cambios de la BD.
- Reporte CSV con resumen, filas rechazadas, escape RFC 4180 y saneamiento de
  fórmulas de Excel.

#### Frontend

- Ruta `/gestor/importaciones` con enlace «Importar» en el menú del gestor y
  acceso rápido en el panel.
- Pestañas por tipo; el revisor solo ve módulos.
- Selector de SRID, plantillas descargables y validación previa del archivo.
- Mapa de previsualización con zonas activas en gris y filas coloreadas por
  estado.
- Tabla de escritorio y tarjetas móviles; casilla de confirmación para zonas
  restringidas.
- Descarga del reporte desde el navegador y enlaces al listado de zonas o
  módulos.
- Estados de carga, vacío, error y éxito; vista a 360 px.

#### Pruebas

- Unitarias: parser CSV, lector GeoJSON, reporte, almacén y servicio.
- E2E backend: roles, preview válido/parcial, formato incorrecto, confirmación,
  zona restringida, reporte, token de otro gestor y token expirado.
- Vitest: validaciones, formatos y plantillas.
- Playwright: pestañas por perfil, GeoJSON parcial, CSV parcial con zona
  restringida, formato incorrecto, descarga del reporte y vista móvil.

Detalle completo: [`docs/Uso_importaciones.md`](Uso_importaciones.md).

---

## 3. Archivos implementados o modificados

### Backend

| Archivo | Cambio |
|---|---|
| `src/zonas/geometria-zoom.ts` | Tolerancia y decimales de simplificación por zoom |
| `src/zonas/geometria-zoom.spec.ts` | Pruebas de la tabla de zoom |
| `src/common/geo.ts` | Helper `sqlGeoJsonSimplificado` |
| `src/common/geo.spec.ts` | Pruebas del helper GeoJSON |
| `src/zonas/dto/zonas.dto.ts` | `ListarZonasGeoJsonQueryDto` con `zoom` |
| `src/zonas/zonas.controller.ts` | `GET /zonas/geojson?zoom=` y Swagger |
| `src/zonas/zonas.service.ts` | Consulta con simplificación por zoom |
| `src/zonas/zonas.controller.spec.ts` | Delegación del zoom |
| `src/zonas/zonas.service.spec.ts` | Pruebas de simplificación y tipos GeoJSON |
| `test/zonas.e2e-spec.ts` | Pruebas de zoom válido e inválido |
| `dataBase/04_espacios_hu09.sql` | Migración de tipo, sector, dimensiones, horario e índices |
| `dataBase/05_filtros_hu10.sql` | Índices de filtros y disponibilidad |
| `src/espacios/espacios.module.ts` | Módulo de espacios |
| `src/espacios/espacios.controller.ts` | `GET /espacios` y `GET /espacios/:id` |
| `src/espacios/espacios.service.ts` | Consultas SQL y cruces de disponibilidad |
| `src/espacios/disponibilidad.ts` | Estado efectivo y motivos |
| `src/espacios/dto/espacios.dto.ts` | DTOs de espacios |
| `src/espacios/*.spec.ts` | Pruebas unitarias de disponibilidad, servicio y controlador |
| `test/espacios.e2e-spec.ts` | Pruebas e2e de espacios |

### Frontend

| Archivo | Cambio |
|---|---|
| `frontend/src/app/(publico)/mapa/page.tsx` | Ruta pública `/mapa` |
| `frontend/src/features/mapa/mapa-zonas.tsx` | Carga cliente de Leaflet |
| `frontend/src/features/mapa/mapa-leaflet.tsx` | Mapa, capas, popup, geolocalización y estados |
| `frontend/src/features/mapa/estilos-zona.ts` | Colores, etiquetas, formatos y geolocalización |
| `frontend/src/features/mapa/estilos-zona.test.ts` | Pruebas Vitest de funciones puras |
| `frontend/src/features/mapa/popup-zona.ts` | Construcción segura del popup |
| `frontend/src/types/api.ts` | Tipos GeoJSON de zonas |
| `frontend/src/lib/api-client.ts` | `obtenerZonasGeoJson(zoom)` |
| `frontend/src/features/publico/navbar-publica.tsx` | Enlace «Mapa» |
| `frontend/src/app/(publico)/page.tsx` | CTA y bloque del Geo-Portal |
| `frontend/src/components/ui/iconos.tsx` | `IconoUbicacion` |
| `frontend/src/app/globals.css` | Estilos de Leaflet, popup, leyenda, marcadores y clústeres |
| `frontend/e2e/mapa.spec.ts` | 9 pruebas Playwright del mapa |
| `frontend/src/app/(comerciante)/comerciante/espacios/page.tsx` | Ruta de espacios del comerciante |
| `frontend/src/features/espacios/espacios-comerciante.tsx` | Vista de espacios, tabla/mapa y ficha |
| `frontend/src/features/espacios/mapa-espacios.tsx` | Carga cliente de Leaflet |
| `frontend/src/features/espacios/mapa-espacios-leaflet.tsx` | Zonas, marcadores y agrupación |
| `frontend/src/features/espacios/agrupar-espacios.ts` | Agrupación pura por zoom |
| `frontend/src/features/espacios/ficha-espacio.tsx` | Panel lateral / hoja inferior |
| `frontend/src/features/espacios/tabla-espacios.tsx` | Tabla y tarjetas móviles |
| `frontend/src/features/espacios/estilos-espacio.ts` | Colores, símbolos y formatos |
| `frontend/src/features/espacios/etiqueta-espacio.tsx` | Etiqueta de estado |
| `frontend/src/features/espacios/panel-filtros.tsx` | Panel de filtros escritorio/móvil |
| `frontend/src/features/espacios/filtros-espacios.ts` | Validación y helpers de filtros |
| `frontend/src/features/espacios/*.test.ts` | Pruebas Vitest de agrupación, formatos y filtros |
| `frontend/e2e/espacios.spec.ts` | 11 pruebas Playwright de espacios |
| `frontend/src/app/(gestor)/gestor/zonas/page.tsx` | Listado de zonas |
| `frontend/src/app/(gestor)/gestor/zonas/nueva/page.tsx` | Ruta de creación |
| `frontend/src/app/(gestor)/gestor/zonas/[id]/editar/page.tsx` | Ruta de edición |
| `frontend/src/features/zonas/lista-zonas.tsx` | Listado, filtros, paginación y baja lógica |
| `frontend/src/features/zonas/editor-zona.tsx` | Creación/edición, permisos y mensajes |
| `frontend/src/features/zonas/mapa-editor-zona.tsx` | Dibujo y vista previa con Leaflet |
| `frontend/src/features/zonas/mapa-editor-zona-carga.tsx` | Carga cliente de Leaflet |
| `frontend/src/features/zonas/formulario-zona.tsx` | Clasificación y restricciones |
| `frontend/src/features/zonas/geometria-zona.ts` | Conversión GeoJSON y validación topológica |
| `frontend/src/features/zonas/validaciones-zona.ts` | Reglas del formulario y cuerpos de la API |
| `frontend/src/features/zonas/*.test.ts` | Pruebas Vitest de geometría y validaciones |
| `frontend/src/features/sesion/marco-sesion.tsx` | Enlace «Zonas» |
| `frontend/src/features/gestor/panel-gestor.tsx` | Acceso rápido «Gestionar zonas» |
| `frontend/src/types/api.ts` | Tipos de zonas, productos y respuestas |
| `frontend/src/lib/api-client.ts` | Cliente de zonas y productos |
| `frontend/src/app/globals.css` | Estilos de vértices y conflicto de zona |
| `frontend/e2e/zonas.spec.ts` | 4 pruebas Playwright de zonas |
| `frontend/e2e/limpieza-zonas.ts` | Limpieza SQL de zonas de prueba |
| `frontend/package.json` y `frontend/pnpm-lock.yaml` | `leaflet` y `@types/leaflet` |

### HU-13 — Censo de módulos y puestos

| Archivo | Cambio |
|---|---|
| `dataBase/07_modulos_hu13.sql` | Trigger de auditoría, secuencia de códigos, índice y auditoría inicial |
| `src/modulos/modulos.module.ts` | Módulo NestJS |
| `src/modulos/modulos.controller.ts` | Endpoints, Swagger y multipart |
| `src/modulos/modulos.service.ts` | Listado, ficha, zona, alta, edición, baja e historial |
| `src/modulos/dto/modulos.dto.ts` | DTOs y contratos de respuesta |
| `src/modulos/advertencias.ts` | Advertencias de zona restringida/alta congestión/fuera de zona |
| `src/modulos/foto.ts` | Validación por firma binaria, guardado y limpieza |
| `src/modulos/historial.ts` | Cambios legibles desde auditoría |
| `src/modulos/*.spec.ts` | Pruebas unitarias |
| `test/modulos.e2e-spec.ts` | Pruebas e2e de API |
| `frontend/src/app/(gestor)/gestor/modulos/**` | Rutas de listado, alta, ficha y edición |
| `frontend/src/features/modulos/**` | Listado, formulario, mapa, ficha, foto y validaciones |
| `frontend/src/types/api.ts` · `frontend/src/lib/api-client.ts` | Tipos y cliente con `FormData` |
| `frontend/e2e/modulos.spec.ts` · `frontend/e2e/limpieza-modulos.ts` | Playwright y limpieza de módulos/fotos |
| `docs/Uso_modulos.md` | Documentación funcional y de pruebas |

### HU-14 — Importación de zonas y módulos

| Archivo | Cambio |
|---|---|
| `src/importaciones/importaciones.module.ts` | Módulo de importación; importa zonas y módulos. |
| `src/importaciones/importaciones.controller.ts` | Endpoints, multipart, perfiles y Swagger. |
| `src/importaciones/importaciones.service.ts` | Preview, confirmación, revalidación y reporte. |
| `src/importaciones/almacen-previsualizaciones.ts` | Tokens en memoria con TTL y máximo de entradas. |
| `src/importaciones/csv.ts` | Parser CSV con BOM, delimitador y encabezados. |
| `src/importaciones/geojson.ts` | Features, polígonos, propiedades y CRS. |
| `src/importaciones/reporte.ts` | Reporte CSV con BOM y saneamiento. |
| `src/importaciones/errores.ts` | Errores de archivo/fila y traducción de BD. |
| `src/importaciones/dto/importaciones.dto.ts` | DTOs de entrada y respuesta. |
| `src/importaciones/*.spec.ts` | Pruebas unitarias de parser, GeoJSON, reporte, almacén, servicio y controlador. |
| `test/importaciones.e2e-spec.ts` | Pruebas e2e de los endpoints. |
| `src/zonas/zonas.module.ts` · `src/modulos/modulos.module.ts` | Exportan sus servicios para reutilizarlos. |
| `src/app.module.ts` | Registra `ImportacionesModule`. |
| `frontend/src/app/(gestor)/gestor/importaciones/page.tsx` | Ruta de importación. |
| `frontend/src/features/importaciones/**` | Flujo, selectores, mapa, tabla, reporte y validaciones. |
| `frontend/src/features/importaciones/validaciones-importacion.test.ts` | Pruebas Vitest. |
| `frontend/e2e/importaciones.spec.ts` · `frontend/e2e/limpieza-importaciones.ts` | Playwright y limpieza SQL. |
| `frontend/src/lib/api-client.ts` · `frontend/src/types/api.ts` | Cliente y tipos de importación. |
| `frontend/src/features/sesion/marco-sesion.tsx` · `frontend/src/features/gestor/panel-gestor.tsx` | Enlaces «Importar». |
| `docs/Uso_importaciones.md` | Documentación funcional, formatos y pruebas. |

### Documentación

| Archivo | Cambio |
|---|---|
| `docs/Uso_zonas.md` | Parámetro `zoom`, interfaz de HU-11, validaciones y pruebas |
| `frontend/README.md` | Rutas de zonas, módulos, importación y comandos |
| `docs/Uso_importaciones.md` | Formatos, endpoints, flujo y pruebas de HU-14 |
| `docs/implementaciones_Sprint2.md` | Este documento |

---

## 4. Verificación ejecutada

| Suite | Resultado |
|---|---|
| Backend unitarias | **41 suites, 391 pruebas aprobadas** |
| Backend e2e | **11 suites, 114 pruebas aprobadas** |
| Backend zonas (unitarias) | **3 suites, 39 pruebas aprobadas** |
| Frontend Vitest | **13 archivos, 81 pruebas aprobadas** |
| Frontend Playwright | **60 pruebas: 52 aprobadas y 8 fallos preexistentes en `espacios.spec.ts`**; las 5 pruebas de importación pasan |
| Backend lint | Sin errores |
| Backend build | Correcto |
| Frontend `tsc --noEmit` | Sin errores |
| Frontend lint | Sin errores |
| Frontend build | Correcto (38 rutas) |

> **Nota sobre los 8 fallos de `espacios.spec.ts`:** no están relacionados con HU-11 ni con HU-14.
> El seed tiene un permiso vigente del `2026-11-01` al `2026-11-30` para el
> espacio 1; al ejecutar la suite dentro de esa vigencia, el espacio aparece
> ocupado y quedan 2 disponibles, mientras las pruebas esperan 3. Es un supuesto
> de fecha preexistente en esas pruebas. Las pruebas de zonas contra la API y la
> BD real pasan completas.

Comandos usados:

```powershell
# Backend
pnpm test -- --runInBand
pnpm test:e2e -- --runInBand
pnpm lint
pnpm build

# Frontend
cd frontend
pnpm test
pnpm test:e2e
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

También se verificó contra la API real:

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/zonas/geojson?zoom=14'
```

Resultado: `FeatureCollection` con las 4 zonas activas del seed.

### Cobertura Playwright del mapa

- Carga pública sin sesión.
- Polígonos, leyenda y conteos.
- Petición con `zoom=16` y actualización a `zoom=15`.
- Popup con nombre, tipo, horario, aforo y productos.
- Mostrar y ocultar capas.
- Error de API y reintento.
- Ubicación dentro de Tuluá.
- Aviso de ubicación fuera de Tuluá.
- Permiso de ubicación denegado.
- Vista a 360 px sin desplazamiento horizontal.

### Cobertura Playwright de espacios

- Tabla con solo los espacios disponibles.
- Comparación de la tabla con la API real y la BD.
- Ficha en panel lateral en escritorio.
- Espacio bloqueado visible solo con «Mostrar no disponibles».
- Ficha con motivo de bloqueo y restricciones de la zona.
- Agrupación de marcadores al alejar y separación al acercar.
- Hoja inferior en móvil a 360 px sin desbordamiento.
- Filtros combinados por sector y actividad.
- Disponibilidad por fecha y horario.
- Estado sin resultados y limpieza de filtros.
- Panel de filtros móvil.
- Error de API y reintento.

---

## 5. Estado por historia del Sprint 2

| HU | Backend | Frontend | Estado |
|---|---|---|---|
| **HU-08** Mapa público de zonas | GeoJSON público con zoom | Mapa Leaflet completo | **Implementada** |
| **HU-09** Espacios disponibles y ficha | Listado y ficha con estado efectivo | Tabla, mapa, agrupación y ficha responsive | **Implementada** |
| **HU-10** Buscar y filtrar | Filtros y disponibilidad por fecha/hora | Panel de filtros, conteo y sin resultados | **Implementada** (sin buscador de calles/barrios) |
| **HU-11** Delimitar y clasificar zonas | Crear, clasificar, restricciones y validación | Editor de polígonos, formulario, listado y validaciones | **Implementada de extremo a extremo** |
| **HU-12** Editar, desactivar y auditar | Editar, desactivar, versionado e historial | Edición, vista previa, baja lógica, línea de tiempo y mapa comparativo | **Implementada** |
| **HU-13** Censar módulos y puestos | API, foto, auditoría e historial | Formulario, mapa, listado y ficha | **Implementada** |
| **HU-14** Importar GeoJSON/CSV | Lector, reproyección, CSV, reporte y pruebas | Carga, previsualización en mapa, tabla y reporte | **Implementada de extremo a extremo** |
| **HU-15** Espacios temporales y bloqueos | Nada | Nada | Pendiente |

---

## 6. Qué falta implementar

> **HU-09 ya está implementada** (ver §2.9). Queda fuera de esta lista de pendientes.

> **HU-10 ya está implementada** (ver §2.10), salvo el buscador de calles/barrios, que se excluyó por decisión del alcance.

> **HU-11 ya está implementada de extremo a extremo** (ver §2.11). Queda fuera de esta lista de pendientes.

> **HU-14 ya está implementada de extremo a extremo** (ver §2.12 y
> [`Uso_importaciones.md`](Uso_importaciones.md)). Queda fuera de esta lista de
> pendientes.

### HU-12 — Historial de cambios

**Implementada.** Se agregó `zona_versiones`, la función
`fn_registrar_version_zona`, el endpoint `GET /zonas/:id/historial`, la línea de
tiempo y el mapa comparativo de versiones. Los cambios de `zona_productos`
quedan cubiertos por el snapshot JSONB de cada versión. La edición con vista
previa y la confirmación de desactivación siguen disponibles en el editor.

### HU-13 — Censo de módulos

**Implementada.** El gestor revisor y el administrador pueden censar, editar,
dar de baja y reactivar módulos y puestos de comercio formal e informal.

- Punto geográfico seleccionado sobre Leaflet.
- Categoría formal/informal y titular registrado o nombre libre.
- Foto opcional con validación real por firma binaria y límite de 5 MB.
- Sector derivado de la zona contenedora, con opción «Sin zona».
- Consulta de la zona contenedora y confirmación explícita en zona restringida.
- Listado con filtros por sector, categoría, estado y búsqueda.
- Baja lógica con fila conservada, auditoría e historial en la ficha.
- Código automático `MOD-####` mediante secuencia.
- Migración `dataBase/07_modulos_hu13.sql`.

Detalle funcional y de pruebas: [`docs/Uso_modulos.md`](Uso_modulos.md).

### HU-14 — Importación

**Implementada.** El gestor administrador importa zonas desde GeoJSON y el
revisor o administrador importa módulos desde CSV.

- Lector GeoJSON con validación de polígonos, propiedades y reproyección a
  EPSG:4326 con PostGIS.
- Parser CSV con errores por fila, resolución de titular y zona contenedora.
- Previsualización con mapa, tabla, resumen y confirmación global de zonas
  restringidas.
- Confirmación parcial e idempotente; la BD vuelve a validar cada fila.
- Reporte CSV UTF-8 con BOM descargable.

Detalle funcional y de pruebas: [`docs/Uso_importaciones.md`](Uso_importaciones.md).

### HU-15 — Espacios temporales y bloqueos

- CRUD de espacios temporales.
- Bloqueos por rango de fechas con calendario.
- Estados visibles: disponible, bloqueado y ocupado.
- Validación para no bloquear fechas con permisos aprobados.
- Lógica preparada para pasar a «Ocupado» al aprobar una solicitud en el Sprint 3.

**Pendiente:** la auditoría no cubre `espacios_temporales` ni `espacio_bloqueos`. Las columnas de dimensiones y horario ya existen desde HU-09.

### Transversal

- Triggers de auditoría para `modulos`, `espacios_temporales` y `espacio_bloqueos`.
- Medición formal del rendimiento del mapa y las consultas (<2 s).
- Documentación de los módulos de espacios, censo y bloqueos (la importación ya
  está documentada en `Uso_importaciones.md`).
- Pruebas de aceptación con el Product Owner.

---

## 7. Decisiones pendientes

1. **Almacenamiento de fotos:** disco local vs S3. Falta definir `UPLOAD_MAX_BYTES`.
2. **Cambios de esquema:** evaluar `sector` en `zonas` y `modulos`; las columnas de la ficha de `espacios_temporales` ya se agregaron en HU-09.
3. **Historial de zonas:** resuelto con `GET /zonas/:id/historial` y la tabla `zona_versiones`; `auditoria` se conserva como registro genérico de bajo nivel.
4. **Buscador de calles y barrios:** Nominatim, capa propia de barrios o datos del municipio.
5. **Auditoría de espacios, módulos y bloqueos:** triggers nuevos en la base o registro manual desde el backend.

La librería de mapas ya está decidida: **Leaflet con OpenStreetMap**.

---

## 8. Cómo probar manualmente

1. Backend:

   ```powershell
   pnpm start:dev
   ```

2. Frontend:

   ```powershell
   cd frontend
   pnpm dev
   ```

3. Abrir `http://localhost:3001/mapa`.

4. Verificar:
   - Los 4 polígonos del seed.
   - La leyenda y los checkboxes de capas.
   - El popup al tocar cada zona.
   - El botón «Mi ubicación» con permiso concedido y denegado.
   - El cambio de zoom y la recarga del GeoJSON.
   - La vista a 360 px.

No se requiere iniciar sesión para consultar el mapa.

5. Iniciar sesión como comerciante (`maria.gomez@gmail.com` / `Comerciante123`) y abrir `http://localhost:3001/comerciante/espacios`.

6. Verificar:
   - La tabla muestra solo los 3 espacios disponibles.
   - El mapa agrupa los marcadores al alejar y los separa al acercar.
   - «Mostrar no disponibles» revela el bloqueado, el asignado y el de mantenimiento con su color y símbolo.
   - La ficha se abre como panel lateral en escritorio y hoja inferior a 360 px.
   - La ficha del espacio bloqueado muestra el motivo y las restricciones de Plaza Boyacá.

7. Probar los filtros:
   - Sector «Centro» y actividad «Venta de alimentos y frutas» → 2 resultados.
   - Fecha `2026-11-10` y horario `10:00`–`12:00` → 2 resultados (el espacio con permiso vigente queda ocupado).
   - Sector «Centro» y actividad «Artesanías» → estado sin resultados y botón para limpiar filtros.
   - En móvil, abrir «Filtros», aplicar un sector y comprobar el conteo.

8. Iniciar sesión como administrador (`admin@tulua.gov.co` / `Admin1234`) y abrir
   `http://localhost:3001/gestor/zonas`.

9. Verificar HU-11:
   - Crear una zona en un área libre: dibujar al menos tres vértices, cerrar el
     polígono y comprobar el mensaje de geometría válida.
   - Completar nombre, tipo, horario, aforo y productos; guardar.
   - Abrir `/mapa` y comprobar que la zona aparece con su ficha.
   - Intentar dibujar un polígono que se cruce a sí mismo: el editor lo rechaza.
   - Intentar dibujar sobre una zona activa: el editor nombra la zona en conflicto.
   - Editar la zona, guardar y desactivarla con confirmación.
   - Entrar como revisor (`revisor@tulua.gov.co` / `Admin1234`) y comprobar el
     modo lectura.

10. Abrir `http://localhost:3001/gestor/importaciones` y verificar HU-14:
    - Descargar la plantilla CSV y cargarla: debe previsualizarse y confirmarse.
    - Cargar un GeoJSON con un polígono libre y otro solapado: el solapado debe
      quedar rechazado.
    - Cargar un CSV con una fila válida, una con categoría incorrecta y una en
      «Entorno Hospital».
    - Confirmar sin marcar la casilla: la fila restringida debe rechazarse.
    - Repetir marcando la casilla: debe importarse.
    - Descargar el reporte CSV y comprobar el resumen y los motivos.
    - Entrar como revisor y comprobar que solo aparece la pestaña de módulos.

---

## 9. Conclusión

La **HU-08** quedó implementada de extremo a extremo: mapa público, API GeoJSON con simplificación por zoom, polígonos por tipo, leyenda, capas, popup, geolocalización, estados de pantalla y pruebas automatizadas.

La **HU-09** quedó implementada de extremo a extremo: endpoints de espacios y ficha, estado efectivo con bloqueos/permisos/solicitudes, capa de marcadores con agrupación por zoom, vista de tabla, panel lateral en escritorio, hoja inferior en móvil y pruebas automatizadas.

La **HU-10** quedó implementada: filtros combinables por sector y actividad, disponibilidad por fecha y horario, conteo de resultados, panel de filtros responsive y estado sin resultados. El buscador de calles/barrios se excluyó por decisión del alcance.

La **HU-11** quedó implementada de extremo a extremo: listado administrativo, editor de polígonos sobre Leaflet, clasificación, restricciones, validación inmediata de autointersecciones y solapes, rechazo `422` de PostGIS y modo lectura para el revisor.

La **HU-12** quedó implementada: edición de la geometría con vista previa, desactivación lógica, versionado inmutable de geometrías y restricciones, endpoint de historial, línea de tiempo con actor y fecha, y mapa de comparación entre versiones. Las solicitudes históricas no se eliminan ni se modifican al desactivar una zona.

La **HU-13** quedó implementada de extremo a extremo: censo de módulos y puestos, foto validada, sector derivado de la zona, advertencia de zona restringida, listado con filtros, baja lógica, reactivación e historial de auditoría.

La **HU-14** quedó implementada de extremo a extremo: importación de zonas desde GeoJSON con validación de geometrías y reproyección a EPSG:4326, importación de módulos desde CSV con reporte de errores por fila, previsualización sobre el mapa, confirmación parcial idempotente y reporte CSV descargable. La pantalla funciona en escritorio y a 360 px, y las pruebas cubren archivos válidos, parcialmente válidos y con formato incorrecto.

El Sprint 2 sigue **incompleto**: falta HU-15. El checklist de «Sprint terminado» de `Sprint2_Funcinalidades.md` todavía no se cumple por esa historia.
