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
| Base de datos | Esquema completo de los 6 sprints ya creado (30 tablas, enums, triggers, `EXCLUDE`, vistas) |
| **HU-08 — Mapa público de zonas** | **Implementada de extremo a extremo** |
| **HU-09 — Espacios disponibles y ficha** | **Implementada de extremo a extremo** |
| HU-11 — Delimitar y clasificar zonas | Backend completo; falta la interfaz de edición |
| HU-12 — Editar, desactivar y auditar zonas | Backend de edición/desactivación y auditoría; falta historial por zona y UI |
| HU-10, HU-13, HU-14, HU-15 | Pendientes |

**Estado actual del Sprint 2:** el Geo-Portal público funciona con Leaflet, zonas coloreadas, leyenda, capas, popup, geolocalización y API GeoJSON con simplificación por zoom. El comerciante ya puede consultar los espacios disponibles en tabla o mapa, ver su ficha y distinguir los estados bloqueado, ocupado y en mantenimiento.

---

## 2. Lo implementado en el Sprint 2: HU-08 y HU-09

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
| `frontend/src/features/espacios/*.test.ts` | Pruebas Vitest de agrupación y formatos |
| `frontend/e2e/espacios.spec.ts` | 7 pruebas Playwright de espacios |
| `frontend/package.json` y `frontend/pnpm-lock.yaml` | `leaflet` y `@types/leaflet` |

### Documentación

| Archivo | Cambio |
|---|---|
| `docs/Uso_zonas.md` | Parámetro `zoom`, tabla de simplificación y ejemplo |
| `README.md` | Estado del Sprint 2 y rutas del frontend |
| `docs/implementaciones_Sprint2.md` | Este documento |

---

## 4. Verificación ejecutada

| Suite | Resultado |
|---|---|
| Backend unitarias | **29 suites, 297 pruebas aprobadas** |
| Backend e2e | **9 suites, 84 pruebas aprobadas** |
| Frontend Vitest | **6 archivos, 33 pruebas aprobadas** |
| Frontend Playwright | **42 pruebas aprobadas**, incluidas 9 del mapa y 7 de espacios |
| Backend lint | Sin errores |
| Backend build | Correcto |
| Frontend `tsc --noEmit` | Sin errores |
| Frontend lint | Sin errores |
| Frontend build | Correcto (28 rutas) |

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
- Error de API y reintento.

---

## 5. Estado por historia del Sprint 2

| HU | Backend | Frontend | Estado |
|---|---|---|---|
| **HU-08** Mapa público de zonas | GeoJSON público con zoom | Mapa Leaflet completo | **Implementada** |
| **HU-09** Espacios disponibles y ficha | Listado y ficha con estado efectivo | Tabla, mapa, agrupación y ficha responsive | **Implementada** |
| **HU-10** Buscar y filtrar | Nada | Nada | Pendiente |
| **HU-11** Delimitar y clasificar zonas | Crear, clasificar, restricciones y validación | Nada | Backend completo; falta editor |
| **HU-12** Editar, desactivar y auditar | Editar, desactivar y auditoría por trigger | Nada | Parcial; falta historial por zona y UI |
| **HU-13** Censar módulos y puestos | Nada | Nada | Pendiente |
| **HU-14** Importar GeoJSON/CSV | Nada | Nada | Pendiente |
| **HU-15** Espacios temporales y bloqueos | Nada | Nada | Pendiente |

---

## 6. Qué falta implementar

> **HU-09 ya está implementada** (ver §2.9). Queda fuera de esta lista de pendientes.

### HU-10 — Buscar y filtrar

- Filtros combinables por sector, actividad y fecha.
- Conteo de resultados.
- Disponibilidad por fecha considerando bloqueos y permisos aprobados.
- Buscador de calles y barrios que centre el mapa.

**Decisión pendiente:** proveedor de geocodificación o capa propia de barrios.

### HU-11 — Interfaz de administración de zonas

- Editor de polígonos sobre el mapa.
- Formulario de tipo, horario, aforo y productos.
- Refresco inmediato del mapa y de la ficha.
- El backend ya rechaza geometrías inválidas y solapadas.

### HU-12 — Historial y desactivación

- Endpoint y UI de historial por zona.
- Vista previa del cambio de forma antes de guardar.
- Confirmación de desactivación.
- Auditoría de cambios en `zona_productos` (hoy solo se audita la fila de `zonas`).

### HU-13 — Censo de módulos

- CRUD de módulos y puestos.
- Foto con validación real de tipo y tamaño.
- Filtros por sector y categoría.
- Baja lógica.
- Advertencia al ubicar un módulo en zona restringida.

**Bloqueo:** no hay módulo de subida de archivos ni `UPLOAD_MAX_BYTES` configurado.

### HU-14 — Importación

- Carga de GeoJSON de zonas y CSV de módulos.
- Previsualización antes de confirmar.
- Resumen de importados y rechazados.
- Reporte de errores descargable.
- Importación parcial de filas válidas.

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
- Documentación de los módulos de espacios, censo, bloqueos e importación.
- Pruebas de aceptación con el Product Owner.

---

## 7. Decisiones pendientes

1. **Almacenamiento de fotos:** disco local vs S3. Falta definir `UPLOAD_MAX_BYTES`.
2. **Cambios de esquema:** evaluar `sector` en `zonas` y `modulos`; las columnas de la ficha de `espacios_temporales` ya se agregaron en HU-09.
3. **Historial de zonas:** endpoint dedicado `GET /zonas/:id/historial` vs reutilizar `GET /gestor/auditoria` con `tabla=zonas&registroId=...`.
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

---

## 9. Conclusión

La **HU-08** quedó implementada de extremo a extremo: mapa público, API GeoJSON con simplificación por zoom, polígonos por tipo, leyenda, capas, popup, geolocalización, estados de pantalla y pruebas automatizadas.

La **HU-09** quedó implementada de extremo a extremo: endpoints de espacios y ficha, estado efectivo con bloqueos/permisos/solicitudes, capa de marcadores con agrupación por zoom, vista de tabla, panel lateral en escritorio, hoja inferior en móvil y pruebas automatizadas.

El Sprint 2 sigue **incompleto**: faltan HU-10, HU-13, HU-14 y HU-15, además de la interfaz de administración de zonas (HU-11) y el historial por zona (HU-12). El checklist de «Sprint terminado» de `Sprint2_Funcinalidades.md` todavía no se cumple.
