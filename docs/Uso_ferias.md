# Módulo de Ferias — HU-21 y HU-22

**Proyecto:** Plataforma Web de Gestión del Espacio Público, Ferias Agroecológicas y Comercio Formal/Informal de Tuluá (Equipo 6)
**Módulo NestJS:** `src/ferias/` · **Rutas base:** `/ferias` y `/gestor/ferias`
**Frontend:** `/organizador/ferias` y `/gestor/ferias` · **Componentes:** `frontend/src/features/ferias/` y `frontend/src/features/ferias-gestor/`
**Migraciones:** `dataBase/13_ferias_hu21.sql`, `dataBase/14_notificaciones_feria_hu21.sql` y `dataBase/15_ferias_hu22.sql`

---

## 1. Resumen

Este módulo permite al **organizador de feria autenticado** solicitar el uso de una zona completa para una feria agroecológica o campesina. La solicitud se crea directamente en estado `radicada`, con número de radicado `FER-AAAA-#####`.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/ferias/zonas` | Organizador | Zonas activas con aforo definido y productos, más el catálogo |
| `GET` | `/ferias/agenda` | Organizador | Rangos ocupados por otras ferias activas |
| `GET` | `/ferias/disponibilidad` | Organizador | Disponibilidad, aforo, conflicto y sugerencias |
| `GET` | `/ferias/mias` | Organizador | Ferias propias con filtro y paginación |
| `GET` | `/ferias/:id` | Organizador dueño | Detalle con productos y adjuntos |
| `POST` | `/ferias` | Organizador | Radica la feria con adjuntos opcionales |
| `GET` | `/ferias/:id/documentos/:documentoId/archivo` | Organizador dueño / Gestor | Descarga autenticada |
| `GET` | `/gestor/ferias` | Gestor | Listado administrativo con filtros y paginación |
| `GET` | `/gestor/ferias/agenda` | Gestor | Agenda por rango de fechas, zona y estados |
| `GET` | `/gestor/ferias/:id` | Gestor | Detalle administrativo |
| `GET` | `/gestor/ferias/:id/cruces` | Gestor | Vista previa de cruces y sugerencias |
| `POST` | `/gestor/ferias/:id/aprobar` | Gestor | Aprueba y bloquea los espacios de la zona |
| `PATCH` | `/gestor/ferias/:id/agenda` | Gestor | Mueve la feria y reubica sus bloqueos |
| `POST` | `/gestor/ferias/:id/cancelar` | Gestor | Cancela con motivo y libera los espacios |

La administración del calendario, la aprobación, el movimiento y la cancelación pertenecen a HU-22 y se documentan en la sección 10.

---

## 2. Modelo de datos

### 2.1 `ferias`

Ya existía en `01_creacion_bd.sql`:

| Campo | Tipo | Regla |
|---|---|---|
| `id` | BIGINT | PK |
| `numero_radicado` | VARCHAR(30) | Único; `FER-AAAA-#####` |
| `organizador_id` | BIGINT | FK a `organizadores(usuario_id)` |
| `nombre` | VARCHAR(200) | Obligatorio |
| `tipo_feria` | VARCHAR(100) | Obligatorio |
| `zona_id` | BIGINT | FK a `zonas(id)` |
| `fecha_inicio` / `fecha_fin` | DATE | `fin >= inicio` |
| `numero_puestos` | INT | `> 0` y `<= aforo_maximo` |
| `estado` | `estado_feria` | `radicada` al crear |
| `revisor_id` | BIGINT | FK a `gestores`; gestor que aprobó (HU-22) |
| `radicada_en` | TIMESTAMPTZ | `now()` |
| `motivo_cancelacion` | TEXT | Motivo obligatorio al cancelar (HU-22) |
| `aprobada_en` / `cancelada_en` | TIMESTAMPTZ | Fechas de decisión (HU-22) |
| `cancelada_por` | BIGINT | FK a `gestores`; gestor que canceló (HU-22) |
| `actualizado_en` | TIMESTAMPTZ | Última modificación (HU-22) |

`espacio_bloqueos.feria_id` vincula cada bloqueo de espacio con la feria que lo originó. La migración 15 agrega la columna, su FK con borrado en cascada, el índice y los triggers de actualización y auditoría de `ferias`.

### 2.2 Estados

| Estado | Significado |
|---|---|
| `radicada` | Solicitud enviada y pendiente de aprobación |
| `aprobada` | Aprobada por el gestor; bloquea los espacios de la zona |
| `rechazada` | Estado histórico, sin acción en HU-22 |
| `cancelada` | Cancelada con motivo; libera los espacios |
| `realizada` | Estado histórico de una feria ya realizada |

Solo `radicada` y `aprobada` ocupan la agenda. Las acciones de HU-22 son:

| Desde | Acción | Hacia |
|---|---|---|
| `radicada` | Aprobar | `aprobada` |
| `radicada` | Mover | `radicada` con nuevas fechas/zona |
| `radicada` | Cancelar | `cancelada` |
| `aprobada` | Mover | `aprobada` con bloqueos reubicados |
| `aprobada` | Cancelar | `cancelada` |

No existe acción para `rechazada` ni `realizada`; se muestran en el calendario cuando se activa **Ver todos**.

### 2.3 `feria_documentos`

Creada por la migración 13:

| Campo | Tipo | Regla |
|---|---|---|
| `id` | BIGINT | PK |
| `feria_id` | BIGINT | FK `ON DELETE CASCADE` |
| `tipo_documento` | VARCHAR(100) | Etiqueta visible |
| `archivo_url` | TEXT | Ruta relativa privada |
| `nombre_original` | VARCHAR(255) | Nombre del archivo |
| `mime_type` | VARCHAR(100) | PDF/JPEG/PNG |
| `tamano_bytes` | INT | Tamaño validado |
| `cargado_en` | TIMESTAMPTZ | `now()` |

### 2.4 Consecutivo

`13_ferias_hu21.sql` sincroniza `seq_radicado_feria` con el mayor consecutivo existente. Esto es necesario porque el seed inserta `FER-2026-00001` y `FER-2026-00002` de forma explícita y, sin la sincronización, la primera feria nueva chocaría con el `UNIQUE`.

---

## 3. Reglas de negocio

### 3.1 Requisitos del organizador

- Rol `organizador`.
- Cuenta activa (lo exige el guard JWT).
- Organización registrada y en estado `activa`. Si no existe → `403`; si está `pendiente_validacion` o `suspendida` → `403` con mensaje explicativo.

### 3.2 Fechas y aforo

- Fecha de inicio no anterior a hoy en `America/Bogota`.
- Fecha de fin igual o posterior a la fecha de inicio.
- `numeroPuestos` entero mayor que cero.
- La zona debe existir, estar activa y tener `aforo_maximo > 0`.
- `numeroPuestos <= aforo_maximo`. Si la zona no tiene aforo, no admite ferias.

### 3.3 Cruces de agenda

- Se cruza contra ferias en estado `radicada` o `aprobada` de la **misma zona**.
- El rango de fechas es **inclusivo** en ambos extremos.
- La consulta se repite dentro de la transacción con la fila de la zona bloqueada (`FOR UPDATE`).
- La restricción `EXCLUDE USING gist` `ferias_zona_id_daterange_excl` es la última barrera ante peticiones concurrentes.
- Ante un cruce, `POST /ferias` responde `409` con `conflicto` y `sugerencias`.

### 3.4 Productos

- Al menos un producto.
- Todos deben existir y estar activos.
- Si la zona tiene productos configurados en `zona_productos`, todos los seleccionados deben pertenecer a esa lista.
- Si la zona no tiene catálogo, se acepta cualquier producto activo.

### 3.5 Adjuntos

- Opcionales.
- PDF, JPG o PNG.
- Máximo 5 MB por archivo y 10 archivos por feria.
- Se valida la firma binaria real del archivo, no solo el `Content-Type`.
- Se guardan en `UPLOAD_PRIVATE_DIR/ferias/{id}`.
- Solo el organizador dueño o un gestor pueden descargarlos.
- Si la radicación falla, los archivos ya escritos se eliminan.

### 3.6 Sugerencias de fechas

- Conservan la duración solicitada.
- Buscan hacia adelante en una ventana de 90 días.
- Devuelven hasta 3 rangos que no se cruzan con la agenda ni entre sí.
- Solo se exponen fechas, no datos de otros organizadores.

---

## 4. Contratos

### 4.1 `GET /ferias/zonas`

```json
{
  "zonas": [
    {
      "id": "4",
      "nombre": "Parque La Guadua",
      "tipo": "permitida",
      "activa": true,
      "aforoMaximo": 25,
      "horarioInicio": "06:00",
      "horarioFin": "20:00",
      "productosPermitidos": ["Frutas frescas", "Artesanías"],
      "admiteFerias": true
    }
  ],
  "productos": [{ "id": "1", "nombre": "Frutas frescas" }]
}
```

### 4.2 `GET /ferias/agenda`

Query: `zonaId`, `desde?`, `hasta?` (`YYYY-MM-DD`).

```json
{
  "zonaId": "4",
  "desde": "2026-12-01",
  "hasta": "2027-01-31",
  "ocupados": [{ "fechaInicio": "2026-12-10", "fechaFin": "2026-12-12" }]
}
```

### 4.3 `GET /ferias/disponibilidad`

Query: `zonaId`, `fechaInicio`, `fechaFin`, `numeroPuestos?`.

```json
{
  "disponible": false,
  "zona": { "...": "ZonaFeria" },
  "aforo": { "solicitado": 20, "maximo": 25, "suficiente": true },
  "conflicto": { "fechaInicio": "2026-12-10", "fechaFin": "2026-12-12" },
  "sugerencias": [
    { "fechaInicio": "2026-12-13", "fechaFin": "2026-12-15" }
  ],
  "motivo": "La zona ya está ocupada por otra feria entre el 2026-12-10 y el 2026-12-12. Elige otras fechas o usa una de las sugerencias."
}
```

### 4.4 `POST /ferias`

`multipart/form-data`:

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `datos` | JSON string | Sí | `nombre`, `tipoFeria`, `zonaId`, `fechaInicio`, `fechaFin`, `numeroPuestos`, `productoIds` |
| `adjuntos` | archivos | No | Hasta 10 PDF/JPG/PNG de 5 MB |

Ejemplo de `datos`:

```json
{
  "nombre": "Feria Agroecológica de Primavera",
  "tipoFeria": "Feria agroecológica",
  "zonaId": "4",
  "fechaInicio": "2027-02-10",
  "fechaFin": "2027-02-12",
  "numeroPuestos": 20,
  "productoIds": ["1", "2"]
}
```

Respuesta `201`:

```json
{
  "id": "12",
  "numeroRadicado": "FER-2026-00003",
  "estado": "radicada",
  "mensaje": "Feria radicada correctamente.",
  "correoEnviado": true,
  "mensajeCorreo": null
}
```

Errores principales:

| HTTP | Causa |
|---|---|
| `400` | JSON inválido, fechas inválidas, aforo insuficiente, productos inválidos o adjunto inválido |
| `401` | Sin token o sesión revocada |
| `403` | Rol distinto de organizador u organización no activa |
| `404` | Zona inexistente |
| `409` | Cruce de agenda con otra feria activa |
| `413` | Archivo que supera el límite de Multer |

### 4.5 `GET /ferias/mias`

Query: `estado?`, `pagina?`, `limite?`.

```json
{
  "datos": [
    {
      "id": "12",
      "numeroRadicado": "FER-2026-00003",
      "nombre": "Feria Agroecológica de Primavera",
      "tipoFeria": "Feria agroecológica",
      "estado": "radicada",
      "fechaInicio": "2027-02-10",
      "fechaFin": "2027-02-12",
      "numeroPuestos": 20,
      "radicadaEn": "2026-11-22T10:00:00.000Z",
      "zona": { "...": "ZonaFeria" }
    }
  ],
  "paginacion": { "pagina": 1, "limite": 20, "total": 1, "totalPaginas": 1 }
}
```

### 4.6 `GET /ferias/:id`

Incluye `productos` y `documentos` con su URL de descarga autenticada.

### 4.7 `GET /ferias/:id/documentos/:documentoId/archivo`

- Organizador dueño o gestor.
- Responde el binario con `Content-Disposition`.
- Un organizador ajeno recibe `404` (no se revela la existencia del documento).

---

## 5. Notificaciones y correo

Al radicar:

- Se crea una notificación interna con `tipo = 'feria_radicada'`, `feria_id`, `canal = 'app'` y `leida = false`.
- Se envía un correo al organizador con el radicado, zona, fechas, puestos, productos y adjuntos.
- Si el correo falla, la feria queda radicada y la respuesta incluye `correoEnviado: false`.

La bandeja de notificaciones expone `feriaId`. Cuando el usuario es el organizador dueño, muestra el enlace **Ver feria** hacia `/organizador/ferias/[id]`. La migración `14_notificaciones_feria_hu21.sql` agrega la columna y su índice.

Al aprobar, mover o cancelar (HU-22):

- Se crea una notificación interna con `feria_id` y tipo `feria_aprobada`, `feria_movida` o `feria_cancelada`.
- Se envía un correo al organizador con la acción, la zona, las fechas y el motivo cuando aplica.
- El detalle del organizador muestra `aprobadaEn`, `canceladaEn` y `motivoCancelacion`.
- Si el correo falla, la operación queda aplicada y la respuesta incluye `correoEnviado: false`.

---

## 6. Interfaz del organizador

### Rutas

| Ruta | Función |
|---|---|
| `/organizador/ferias` | Mis ferias, filtro por estado y paginación |
| `/organizador/ferias/nueva` | Formulario de una página por secciones |
| `/organizador/ferias/[id]` | Detalle y confirmación posterior a la radicación |

### Formulario

Secciones:

1. **Datos de la feria**: nombre y tipo (el tipo se prefija con el de la organización, pero es editable).
2. **Zona y fechas**: selector de zona con aforo, horario y productos; fechas; número de puestos; agenda ocupada; disponibilidad.
3. **Productos**: checkboxes; los no permitidos por la zona quedan deshabilitados.
4. **Adjuntos**: carga múltiple con barra de progreso real, validación local, vista previa y eliminación.
5. **Resumen**: revisión final y radicación.

Comportamientos:

- Si la organización no existe o no está activa, se muestra una advertencia y el botón de radicación queda deshabilitado.
- La disponibilidad se consulta con un pequeño retardo para no saturar la API.
- Ante un conflicto, se muestran las fechas alternativas con un botón que las aplica al formulario.
- Si el envío falla, se conservan los datos y los archivos seleccionados.
- Al radicar, se navega al detalle con el aviso **“Feria radicada correctamente”**.

### Accesibilidad y responsive

- Formulario probado a 360 px sin desplazamiento horizontal.
- Labels asociados, errores en texto y áreas táctiles de al menos 44 px.
- Estados de carga, error, vacío y reintento.
- Productos no permitidos deshabilitados con explicación textual.

---

## 7. Pruebas

### Backend

```powershell
pnpm test -- --runInBand src/ferias
pnpm test:e2e -- --runInBand test/ferias.e2e-spec.ts test/gestor-ferias.e2e-spec.ts
```

Cubren:

- Solapes inclusivos, conflictos y sugerencias de fechas.
- Ventana de 90 días y máximo de 3 alternativas.
- Validación de fechas, aforo y productos.
- Organización inexistente, pendiente o activa.
- Radicación con adjunto, número `FER` y notificación enlazada con `feria_id`.
- Cruce de agenda con `409` y sugerencias.
- Aforo insuficiente con `400`.
- Adjunto con formato inválido.
- Roles: organizador permitido; comerciante y gestor rechazados en la radicación; gestor puede descargar.

### Frontend

```powershell
cd frontend
pnpm test
pnpm test:e2e e2e/ferias.spec.ts
```

Cubren:

- Validaciones del formulario y aforo.
- Flujo completo de radicación con adjunto y descarga.
- Cruce con la feria aprobada del seed en Parque La Guadua (10–12 de diciembre de 2026) y uso de la sugerencia.
- Rechazo de 26 puestos en una zona de aforo 25.
- Vista a 360 px.

---

## 8. Migración y prueba manual

```powershell
psql -U postgres -d "sgp_tulua" -f dataBase/13_ferias_hu21.sql
psql -U postgres -d "sgp_tulua" -f dataBase/14_notificaciones_feria_hu21.sql
psql -U postgres -d "sgp_tulua" -f dataBase/15_ferias_hu22.sql
pnpm exec prisma generate
```

Prueba manual:

1. Inicia sesión como `luis.alvarez@agrovalle.org` / `Organizador123`.
2. Abre **Ferias → Nueva feria**.
3. Elige **Parque La Guadua** y las fechas **10–12 de diciembre de 2026**.
4. Comprueba el aviso de conflicto y las fechas alternativas.
5. Aplica una alternativa, selecciona productos y adjunta un PDF.
6. Radica y verifica el número `FER-...`, la notificación y el correo en el log.
7. Abre el detalle y descarga el adjunto.
8. Intenta 26 puestos en Parque La Guadua: el formulario debe impedirlo.

> Para las pruebas Playwright deben estar aplicadas las migraciones 13, 14 y 15. El seed incluye una feria aprobada en Parque La Guadua (10–12 dic 2026) y una radicada en Centro - Calle 30 (15–17 ene 2027), útiles para probar cruces y aprobación.

---

## 9. Archivos

### Backend

| Archivo | Contenido |
|---|---|
| `dataBase/13_ferias_hu21.sql` | `feria_documentos`, índice de agenda, sincronización del consecutivo y verificación de la restricción EXCLUDE |
| `dataBase/14_notificaciones_feria_hu21.sql` | `notificaciones.feria_id`, FK e índice |
| `dataBase/15_ferias_hu22.sql` | Campos de decisión, `espacio_bloqueos.feria_id`, triggers y bloqueos retroactivos |
| `dataBase/16_participantes_hu23.sql` | Baja lógica, productos por participante, envío del listado y trigger de cupo |
| `prisma/schema.prisma` | Modelos `feria_documentos`, `feria_vendedor_productos`, `espacio_bloqueos` y relación con `ferias` |
| `src/ferias/ferias.module.ts` | Módulo Nest con los controladores del organizador, los participantes y el gestor |
| `src/ferias/ferias.controller.ts` | Endpoints del organizador, roles, Multer y Swagger |
| `src/ferias/gestor-ferias.controller.ts` | Agenda, aprobación, movimiento y cancelación |
| `src/ferias/gestor-ferias.service.ts` | Transacciones, cruces, bloqueo y liberación de espacios |
| `src/ferias/ferias.service.ts` | Reglas, transacción, agenda, adjuntos y notificaciones |
| `src/ferias/participantes.controller.ts` | CRUD y envío del listado de participantes |
| `src/ferias/gestor-participantes.controller.ts` | Consulta del listado final por el gestor |
| `src/ferias/participantes.service.ts` | Cupo, productos, baja lógica y bloqueo tras el envío |
| `src/ferias/agenda.ts` | Solapes, conflictos, unión de rangos y sugerencias puras |
| `src/ferias/reglas.ts` | Fechas, aforo, estados, transiciones y motivo de cancelación |
| `src/ferias/dto/ferias.dto.ts` | DTOs del organizador |
| `src/ferias/dto/gestor-ferias.dto.ts` | DTOs del calendario y las acciones del gestor |
| `src/ferias/dto/participantes.dto.ts` | DTOs de participantes |
| `src/common/almacenamiento-archivos.ts` | Almacenamiento privado compartido |
| `src/correo/correo.service.ts` | `enviarConfirmacionFeria` y `enviarCambioEstadoFeria` |
| `src/notificaciones/notificaciones.service.ts` | `crearAvisoFeria` y `enviarCorreoFeria` |
| `src/ferias/*.spec.ts` | Pruebas unitarias |
| `test/ferias.e2e-spec.ts` · `test/gestor-ferias.e2e-spec.ts` · `test/participantes-ferias.e2e-spec.ts` | Pruebas e2e del backend |

### Frontend

| Archivo | Contenido |
|---|---|
| `frontend/src/app/(organizador)/organizador/ferias/page.tsx` | Listado |
| `frontend/src/app/(organizador)/organizador/ferias/nueva/page.tsx` | Formulario |
| `frontend/src/app/(organizador)/organizador/ferias/[id]/page.tsx` | Detalle |
| `frontend/src/features/ferias/formulario-feria.tsx` | Formulario y envío |
| `frontend/src/features/ferias/selector-zona-fechas.tsx` | Zona, fechas, agenda y sugerencias |
| `frontend/src/features/ferias/adjuntos-feria.tsx` | Adjuntos y vista previa |
| `frontend/src/features/ferias/lista-ferias.tsx` | Listado |
| `frontend/src/features/ferias/detalle-feria.tsx` | Detalle y descarga |
| `frontend/src/features/ferias/validaciones-feria.ts` | Validaciones y etiquetas |
| `frontend/src/app/(organizador)/organizador/ferias/[id]/participantes/page.tsx` | Gestión de participantes del organizador |
| `frontend/src/features/ferias/participantes/gestion-participantes.tsx` | Cupo, alta, edición, retiro y envío final |
| `frontend/src/features/ferias/participantes/formulario-participante.tsx` | Formulario de vendedor y productos |
| `frontend/src/features/ferias/participantes/lista-participantes.tsx` | Lista de vendedores activos |
| `frontend/src/features/ferias/participantes/validaciones-participantes.ts` | Validaciones y cálculo de cupo |
| `frontend/src/app/(gestor)/gestor/ferias/page.tsx` | Ruta del calendario del gestor |
| `frontend/src/app/(gestor)/gestor/ferias/[id]/participantes/page.tsx` | Listado final para el gestor |
| `frontend/src/features/ferias-gestor/listado-participantes.tsx` | Consulta del listado final |
| `frontend/src/features/ferias-gestor/calendario-ferias.tsx` | Contenedor, filtros, resumen y acciones |
| `frontend/src/features/ferias-gestor/calendario-mensual-ferias.tsx` | Vista mensual |
| `frontend/src/features/ferias-gestor/calendario-semanal-ferias.tsx` | Vista semanal por zona |
| `frontend/src/features/ferias-gestor/panel-feria.tsx` | Detalle y acciones del evento |
| `frontend/src/features/ferias-gestor/acciones-feria.tsx` | Modales de aprobar, mover y cancelar |
| `frontend/src/features/ferias-gestor/calendario-ferias-utilidades.ts` | Utilidades puras del calendario |
| `frontend/src/features/ferias-gestor/estilos-estado-feria.ts` | Colores, símbolos y etiquetas |
| `frontend/e2e/ferias.spec.ts` · `frontend/e2e/gestor-calendario-ferias.spec.ts` · `frontend/e2e/participantes-ferias.spec.ts` | Playwright |
| `frontend/e2e/limpieza-ferias.ts` | Limpieza de datos de prueba |

---

## 10. Calendario y administración de ferias (HU-22)

### 10.1 Acceso

Todos los endpoints de `/gestor/ferias` exigen `rol = gestor`. Los perfiles **revisor** y **administrador** pueden consultar, aprobar, mover y cancelar, siguiendo el criterio de HU-15, HU-19 y HU-20.

### 10.2 Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/gestor/ferias` | Listado con `estado`, `zonaId`, `desde`, `hasta`, `busqueda`, `pagina` y `limite` |
| `GET` | `/gestor/ferias/agenda` | Eventos del rango, zonas activas, resumen y cruces. Por defecto solo `radicada` y `aprobada`; `incluirTodos=true` agrega el resto |
| `GET` | `/gestor/ferias/:id` | Detalle con organizador, productos, documentos, espacios bloqueados y motivo de cancelación |
| `GET` | `/gestor/ferias/:id/cruces` | Vista previa. Recibe `zonaId`, `fechaInicio`, `fechaFin` y `paraAprobacion=true` para revisar espacios individuales |
| `POST` | `/gestor/ferias/:id/aprobar` | Cambia a `aprobada` y crea los bloqueos |
| `PATCH` | `/gestor/ferias/:id/agenda` | Recibe `zonaId`, `fechaInicio`, `fechaFin` y `motivo?` |
| `POST` | `/gestor/ferias/:id/cancelar` | Recibe `motivo` obligatorio (1–2000 caracteres) |

Ejemplo de agenda:

```http
GET /gestor/ferias/agenda?desde=2026-12-01&hasta=2026-12-31&zonaId=4
```

```json
{
  "desde": "2026-12-01",
  "hasta": "2026-12-31",
  "zonaId": "4",
  "zonas": [{ "id": "4", "nombre": "Parque La Guadua", "activa": true }],
  "eventos": [
    {
      "id": "1",
      "numeroRadicado": "FER-2026-00001",
      "nombre": "Feria Agroecológica de Diciembre",
      "estado": "aprobada",
      "fechaInicio": "2026-12-10",
      "fechaFin": "2026-12-12",
      "zona": { "id": "4", "nombre": "Parque La Guadua" },
      "tieneCruces": false
    }
  ],
  "cruces": [],
  "resumen": {
    "total": 1,
    "radicadas": 0,
    "aprobadas": 1,
    "canceladas": 0,
    "rechazadas": 0,
    "realizadas": 0
  }
}
```

### 10.3 Reglas de aprobación

1. La feria debe estar en `radicada`.
2. La zona debe estar activa y el número de puestos no puede superar el aforo.
3. La fecha de inicio no puede ser anterior a hoy.
4. No debe existir otra feria `radicada` o `aprobada` en la misma zona con fechas solapadas.
5. Todos los espacios de la zona deben estar libres: sin otro bloqueo, permiso `vigente`, solicitud `aprobada` ni asignación manual en el rango.
6. Si hay cualquier conflicto, responde `409` y **no** modifica la feria ni crea bloqueos.
7. Si todo está libre, en una sola transacción:
   - cambia a `aprobada`, guarda `revisor_id` y `aprobada_en`;
   - inserta un registro en `espacio_bloqueos` por cada espacio de la zona, con `feria_id` y el motivo «Feria FER-... — nombre»;
   - crea la notificación interna.
8. El correo se envía después del commit; su fallo no revierte la aprobación.

### 10.4 Reglas de cancelación y movimiento

- **Cancelar:** exige `radicada` o `aprobada`; el motivo es obligatorio; guarda `cancelada_en` y `cancelada_por`; elimina solo los bloqueos con `feria_id` de esa feria. Los triggers de HU-15 recalculan el estado de cada espacio.
- **Mover:** exige `radicada` o `aprobada`; valida la zona y el aforo; vuelve a consultar cruces excluyendo la propia feria; si estaba aprobada, elimina y recrea sus bloqueos en la misma transacción.
- **Concurrencia:** se bloquean la feria (`FOR UPDATE`), la zona y los espacios en orden de `id`. Las restricciones `EXCLUDE` de `ferias` y `espacio_bloqueos` siguen siendo la última barrera.
- **Estados terminales:** `cancelada`, `rechazada` y `realizada` no admiten aprobación, movimiento ni cancelación.

### 10.5 Interfaz del gestor

Ruta: **`/gestor/ferias`**.

- Vista **Mes** con una cuadrícula de 42 días y los eventos de cada día.
- Vista **Semana** con una fila por zona y siete columnas de días; en móvil se convierte en una lista vertical.
- Filtros por zona y por estados. Por defecto solo se muestran `radicada` y `aprobada`; **Ver también canceladas, rechazadas y realizadas** amplía la vista.
- Navegación anterior, siguiente y **Hoy**; resumen de eventos, pendientes y aprobadas.
- Leyenda con color, símbolo y texto, sin depender solo del color.
- Panel **Por aprobar** con las ferias `radicada`.
- Al abrir un evento se muestra su detalle y las acciones **Aprobar**, **Mover** y **Cancelar**, habilitadas según el estado.
- **Mover** consulta la vista previa de cruces, explica cada conflicto, permite aplicar una fecha sugerida y bloquea el guardado mientras haya conflicto.
- **Cancelar** exige un motivo y muestra los espacios que se liberarán.
- Responsive desde 360 px, sin desplazamiento horizontal, con áreas táctiles de al menos 44 px.

### 10.6 Bloqueos de espacios y administración de espacios

- `espacio_bloqueos.feria_id` identifica los bloqueos administrados por el calendario.
- Esos bloqueos no se editan ni se eliminan desde `/gestor/espacios`; se liberan al cancelar o mover la feria.
- El listado y la ficha del comerciante muestran el espacio como `bloqueado` con el motivo de la feria.

### 10.7 Pruebas

```powershell
# Backend
pnpm test -- --runInBand src/ferias
pnpm test:e2e -- --runInBand test/gestor-ferias.e2e-spec.ts

# Frontend
cd frontend
pnpm test
pnpm test:e2e e2e/gestor-calendario-ferias.spec.ts
```

Cubren:

- Agenda por rango, filtros y detección de cruces.
- Aprobación con bloqueo de todos los espacios.
- Rechazo de la aprobación si hay feria, permiso, solicitud, bloqueo o asignación manual en conflicto.
- Cancelación con motivo obligatorio y liberación exacta de los bloqueos.
- Movimiento con reubicación de bloqueos y `409` ante cruces.
- Notificación interna y correo para aprobación, movimiento y cancelación.
- Roles: revisor y administrador permitidos; comerciante y organizador rechazados.
- UI mensual, semanal por zona, acciones desde el calendario y vista a 360 px.

### 10.8 Migración y prueba manual

```powershell
psql -U postgres -d "sgp_tulua" -f dataBase/15_ferias_hu22.sql
pnpm exec prisma generate
```

La migración es idempotente. Agrega los campos de decisión, `espacio_bloqueos.feria_id`, los triggers de auditoría de `ferias` y crea bloqueos retroactivos para las ferias ya aprobadas cuando sus espacios están libres.

Prueba manual:

1. Inicia sesión como `revisor@tulua.gov.co` / `Admin1234`.
2. Abre **Ferias** en el menú del gestor.
3. En diciembre de 2026 verifica la feria aprobada de Parque La Guadua; en enero de 2027, la feria radicada de Centro - Calle 30.
4. Aprueba una feria radicada y comprueba que sus espacios aparecen bloqueados en la ficha del comerciante.
5. Intenta moverla a las fechas de otra feria activa: el sistema debe mostrar el cruce y no guardar.
6. Muévela a una fecha libre y comprueba las nuevas fechas.
7. Cancélala con un motivo y verifica que los espacios vuelven a estar disponibles.
8. Revisa la bandeja del organizador: debe tener los avisos de aprobación, movimiento y cancelación.

---

## 11. Participantes de la feria (HU-23)

### 11.1 Alcance

El organizador dueño registra los vendedores y productos de una **feria aprobada**. La lista respeta el cupo aprobado (`ferias.numero_puestos`) y el catálogo de productos permitidos por la zona (`zona_productos`).

Solo se puede gestionar mientras la feria está `aprobada` y el listado final no se ha enviado. Después del envío, la lista queda bloqueada y el gestor puede consultarla.

### 11.2 Modelo de datos

La migración `dataBase/16_participantes_hu23.sql` agrega:

| Elemento | Descripción |
|---|---|
| `ferias.participantes_enviados_en` | Fecha de envío del listado final. `NULL` = borrador. |
| `feria_vendedores.activo` | Baja lógica del participante. |
| `feria_vendedores.creado_en` / `actualizado_en` / `eliminado_en` | Marcas de tiempo. |
| `feria_vendedor_productos` | Relación N:M entre participante y productos. |

Los vendedores existentes se rellenan desde `producto_principal` cuando el nombre coincide con el catálogo. Si no coincide, quedan sin producto hasta que el organizador los edite.

### 11.3 Endpoints

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/ferias/:id/participantes` | Organizador dueño | Lista, cupo, catálogo y estado de envío |
| `POST` | `/ferias/:id/participantes` | Organizador dueño | Alta con nombre, documento opcional y productos |
| `PATCH` | `/ferias/:id/participantes/:participanteId` | Organizador dueño | Edición de datos y productos |
| `DELETE` | `/ferias/:id/participantes/:participanteId` | Organizador dueño | Baja lógica |
| `POST` | `/ferias/:id/participantes/enviar` | Organizador dueño | Envía y bloquea el listado final |
| `GET` | `/gestor/ferias/:id/participantes` | Gestor | Listado final; `409` si no se ha enviado |

Respuesta del listado:

```json
{
  "feria": {
    "id": "1",
    "numeroRadicado": "FER-2026-00001",
    "nombre": "Feria Agroecológica de Diciembre",
    "estado": "aprobada",
    "fechaInicio": "2026-12-10",
    "fechaFin": "2026-12-12",
    "numeroPuestos": 20,
    "zona": { "id": "4", "nombre": "Parque La Guadua" }
  },
  "cupo": {
    "aprobado": 20,
    "ocupados": 3,
    "disponibles": 17,
    "completo": false
  },
  "productosPermitidos": [{ "id": "1", "nombre": "Frutas frescas" }],
  "productosCatalogo": [
    { "id": "1", "nombre": "Frutas frescas" },
    { "id": "2", "nombre": "Verduras" }
  ],
  "participantes": [
    {
      "id": "1",
      "nombre": "Doralice Lozano",
      "documento": "CC 43789123",
      "productos": [{ "id": "1", "nombre": "Frutas frescas" }],
      "creadoEn": "2026-11-23T10:00:00.000Z",
      "actualizadoEn": "2026-11-23T10:00:00.000Z"
    }
  ],
  "listadoFinal": { "enviado": false, "enviadoEn": null }
}
```

### 11.4 Reglas

- Solo el organizador dueño de la feria puede consultar y modificar la lista.
- La feria debe estar `aprobada` para crear, editar, retirar o enviar.
- El cupo se calcula con participantes `activo = true` y no puede superar `numero_puestos`.
- El alta y la reactivación se serializan con `SELECT ... FOR UPDATE` sobre la feria; la BD tiene un trigger de cupo como última barrera.
- Productos: al menos uno, sin duplicados, existentes y activos. Si la zona tiene catálogo, todos deben pertenecer a `zona_productos`.
- Documento opcional, único por feria entre participantes activos. Si se vuelve a usar el documento de un participante retirado, se reactiva.
- Enviar exige al menos un participante activo.
- La baja es lógica: la fila se conserva y deja de ocupar cupo.
- El gestor solo ve el listado cuando `participantes_enviados_en` tiene valor.

### 11.5 Interfaz

| Ruta | Rol | Función |
|---|---|---|
| `/organizador/ferias/[id]/participantes` | Organizador | Alta, edición, retiro, cupo y envío final |
| `/gestor/ferias/[id]/participantes` | Gestor | Consulta del listado final y sus productos |

La interfaz muestra:

- cupo aprobado, ocupados y disponibles con barra de progreso;
- advertencia cuando el cupo está lleno;
- productos no permitidos deshabilitados con explicación;
- errores por campo y mensajes de la API;
- confirmación antes de retirar y antes de enviar;
- estado de solo lectura después del envío;
- responsive a 360 px y estados de carga, error y vacío.

### 11.6 Pruebas

```powershell
pnpm test -- --runInBand src/ferias/participantes.service.spec.ts
pnpm test:e2e -- --runInBand test/participantes-ferias.e2e-spec.ts

cd frontend
pnpm test
pnpm test:e2e e2e/participantes-ferias.spec.ts
```

Cubren alta, edición, baja lógica, reactivación por documento, cupo, productos no permitidos, bloqueo tras el envío, visibilidad del gestor, roles y vista a 360 px.

### 11.7 Migración

```powershell
psql -U postgres -d "sgp_tulua" -f dataBase/16_participantes_hu23.sql
pnpm exec prisma generate
```
