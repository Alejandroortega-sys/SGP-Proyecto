# Módulo de Ferias — HU-21

**Proyecto:** Plataforma Web de Gestión del Espacio Público, Ferias Agroecológicas y Comercio Formal/Informal de Tuluá (Equipo 6)
**Módulo NestJS:** `src/ferias/` · **Ruta base:** `/ferias`
**Frontend:** `/organizador/ferias` · **Componentes:** `frontend/src/features/ferias/`
**Migración:** `dataBase/13_ferias_hu21.sql`

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

La aprobación, el movimiento y la cancelación de ferias pertenecen a HU-22 y **no forman parte de esta entrega**.

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
| `revisor_id` | BIGINT | FK a `gestores` (HU-22) |
| `radicada_en` | TIMESTAMPTZ | `now()` |

### 2.2 Estados

| Estado | Significado |
|---|---|
| `radicada` | Solicitud enviada y pendiente de revisión |
| `aprobada` | Aprobada por el gestor |
| `rechazada` | Rechazada |
| `cancelada` | Cancelada |
| `realizada` | Ya se realizó |

Solo `radicada` y `aprobada` ocupan la agenda. La interfaz muestra las etiquetas en español.

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
pnpm test:e2e -- --runInBand test/ferias.e2e-spec.ts
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

> Para las pruebas Playwright debe estar aplicada la migración 13. El seed incluye una feria aprobada en Parque La Guadua (10–12 dic 2026) y una radicada en Centro - Calle 30 (15–17 ene 2027), útiles para probar cruces.

---

## 9. Archivos

### Backend

| Archivo | Contenido |
|---|---|
| `dataBase/13_ferias_hu21.sql` | `feria_documentos`, índice de agenda, sincronización del consecutivo y verificación de la restricción EXCLUDE |
| `dataBase/14_notificaciones_feria_hu21.sql` | `notificaciones.feria_id`, FK e índice |
| `prisma/schema.prisma` | Modelo `feria_documentos` y relación con `ferias` |
| `src/ferias/ferias.module.ts` | Módulo Nest |
| `src/ferias/ferias.controller.ts` | Endpoints, roles, Multer y Swagger |
| `src/ferias/ferias.service.ts` | Reglas, transacción, agenda, adjuntos y notificaciones |
| `src/ferias/agenda.ts` | Solapes, conflictos y sugerencias puras |
| `src/ferias/reglas.ts` | Fechas, aforo, estados y etiquetas |
| `src/ferias/dto/ferias.dto.ts` | DTOs de entrada y respuesta |
| `src/common/almacenamiento-archivos.ts` | Almacenamiento privado compartido |
| `src/correo/correo.service.ts` | `enviarConfirmacionFeria` |
| `src/notificaciones/notificaciones.service.ts` | `crearAvisoFeria` |
| `src/ferias/*.spec.ts` | Pruebas unitarias |
| `test/ferias.e2e-spec.ts` | Pruebas e2e del backend |

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
| `frontend/e2e/ferias.spec.ts` | Playwright |
| `frontend/e2e/limpieza-ferias.ts` | Limpieza de datos de prueba |
