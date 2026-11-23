# Módulo de Solicitudes — HU-16 a HU-18

**Proyecto:** Plataforma Web de Gestión del Espacio Público, Ferias Agroecológicas y Comercio Formal/Informal de Tuluá (Equipo 6)
**Módulo NestJS:** `src/solicitudes/` · **Ruta base:** `/solicitudes`
**Frontend:** `/comerciante/solicitudes` · **Componentes:** `frontend/src/features/solicitudes/`
**Migración:** `dataBase/09_solicitudes_hu16.sql`

---

## 1. Resumen

Este módulo permite al **comerciante autenticado** radicar una solicitud de uso temporal de un espacio público. La solicitud se crea directamente en estado `radicada`; el borrador vive solo en el navegador y se elimina al cerrar sesión.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/solicitudes/mias` | Comerciante | Lista las solicitudes radicadas propias |
| `GET` | `/solicitudes/:id` | Comerciante | Detalle con productos, documentos e historial |
| `GET` | `/solicitudes/requisitos` | Comerciante | Requisitos documentales de la actividad |
| `GET` | `/solicitudes/disponibilidad` | Comerciante | Verifica fechas, horario, ocupación y duplicados |
| `POST` | `/solicitudes` | Comerciante | Radica la solicitud con sus documentos |
| `GET` | `/solicitudes/:id/requisitos` | Comerciante dueño | Requisitos, estado, versión vigente e historial de versiones |
| `POST` | `/solicitudes/:id/documentos` | Comerciante dueño | Carga o reemplaza un documento de un requisito |
| `GET` | `/solicitudes/:id/documentos/:documentoId/archivo` | Comerciante dueño / Gestor | Descarga autenticada de un documento |
| `PATCH` | `/gestor/solicitudes/:id/estado` | Gestor | Inicia revisión o devuelve para corrección |
| `PATCH` | `/gestor/solicitudes/:id/resolucion` | Gestor | Aprueba o rechaza y asigna el espacio (HU-20) |

---

## 2. Reglas de negocio

### 2.1 Radicación

- El espacio debe existir en `espacios_temporales` y estar en estado efectivo `disponible`.
- Se rechazan los estados almacenados `bloqueado`, `asignado` y `mantenimiento`, igual que en HU-09.
- La zona del espacio debe estar activa.
- La fecha de inicio no puede ser anterior a hoy en `America/Bogota`.
- La fecha de fin debe ser igual o posterior a la fecha de inicio.
- La hora de fin debe ser posterior a la hora de inicio.
- El rango horario debe caber en el horario propio del espacio o, si no tiene, en el de su zona.
- No puede cruzarse con un bloqueo, un permiso `vigente` o una solicitud `aprobada` en las mismas fechas y horas.
- No puede duplicar una solicitud activa del **mismo comerciante**, el **mismo espacio** y fechas solapadas en estado `radicada`, `en_revision` o `devuelta`. Responde `409` con el radicado existente.
- Al menos un producto debe estar activo. Si la zona tiene productos permitidos, todos los seleccionados deben pertenecer a esa lista.

### 2.2 Número de radicado

- Formato: `SOL-AAAA-#####`.
- Se genera al insertar la solicitud, es decir, al radicar.
- Usa `seq_radicado_solicitud` y la función `fn_numero_radicado_solicitud()`.
- La migración sincroniza la secuencia con el mayor consecutivo existente para evitar duplicados.

### 2.3 Estados

El enum de la base es:

```text
borrador | radicada | en_revision | devuelta | aprobada | rechazada | cancelada
```

La interfaz muestra `devuelta` como **“Requiere corrección”**. HU-16 solo crea `radicada`; las demás transiciones pertenecen a HU-17 a HU-20.

### 2.4 Historial

Cada radicación crea una fila en `solicitud_historial`:

```text
borrador → radicada
actor: comerciante
observación: Solicitud radicada por el comerciante.
```

El detalle devuelve la línea de tiempo con fecha, estados y actor.

### 2.5 Notificación y correo

Al radicar se crea una notificación en plataforma (`tipo = solicitud_radicada`) y se envía un correo al comerciante con el radicado, espacio, actividad, productos, fechas, horario y documentos.

Cada cambio de estado posterior usa el servicio de notificaciones de HU-18:

- Crea una fila en `notificaciones` con `solicitud_id`, `canal = app`, `leida = false` y el tipo `solicitud_<estado>`.
- Envía un correo al comerciante con el estado anterior, el nuevo, la observación del gestor o el motivo de rechazo y un enlace al detalle.
- Si el correo falla, el estado y la notificación interna permanecen; la respuesta incluye `correoEnviado: false` y un mensaje de advertencia.

---

## 3. Documentos

### 3.1 Catálogo

La tabla `requisitos_documentales` define los requisitos globales y por actividad. El tipo de actividad se toma de `espacios_temporales.actividad_permitida`.

Seed inicial:

| Requisito | Obligatorio | Actividad |
|---|---|---|
| Documento de identidad | Sí | Todas |
| RUT | Sí | Todas |
| Permiso de uso de suelo | No | Todas |
| Concepto sanitario | Sí | Venta de alimentos y frutas; Comidas rápidas |
| Cámara de comercio | No | Artesanías; Ferias y emprendimientos |

### 3.2 Formatos y almacenamiento

- PDF, JPG o PNG.
- Máximo 5 MB por archivo.
- Máximo 10 archivos por solicitud.
- Se valida la firma binaria real del archivo, no solo el `Content-Type`.
- Se guardan en un directorio privado (`UPLOAD_PRIVATE_DIR`, por defecto `uploads-privados/solicitudes/{id}/`).
- No se sirven como archivos estáticos públicos.
- La descarga pasa por un endpoint autenticado que verifica que el usuario sea el dueño o un gestor.

La tabla `solicitud_documentos` conserva `nombre_original`, `mime_type`, `tamano_bytes` y `requisito_id`.

### 3.3 Carga, reemplazo y versionado (HU-17)

- El comerciante dueño puede cargar o reemplazar documentos mientras la solicitud esté en `radicada` o `devuelta`.
- Cada reemplazo crea una fila nueva con `reemplaza_a` apuntando a la versión anterior. La fila anterior y su archivo se conservan.
- Solo puede existir una versión vigente por requisito. La versión vigente es la que no fue reemplazada por otra.
- El estado visible del requisito se calcula así:

| Situación | Estado |
|---|---|
| Sin documento vigente | `faltante` |
| Documento vigente `pendiente` | `cargado` |
| Documento vigente `validado` | `cumple` |
| Documento vigente `observado` | `no_cumple` |

- En estado `devuelta`, la solicitud vuelve a `en_revision` cuando **todos** los requisitos que tenían un documento `observado` ya tienen una versión nueva. La transición registra historial y notificación en la plataforma (`solicitud_en_revision`).
- Si la solicitud estaba en `devuelta` pero no había documentos observados, se mantiene en ese estado.
- Los documentos vigentes sin `requisito_id` o que no pertenecen al catálogo actual se devuelven en `otrosDocumentos` para no ocultar información existente.
- La transacción bloquea la fila de la solicitud (`FOR UPDATE`) para impedir dos reemplazos simultáneos.

---

## 4. Contratos

### 4.1 Radicación

`POST /solicitudes` usa `multipart/form-data`:

| Campo | Tipo | Descripción |
|---|---|---|
| `datos` | JSON string | `espacioId`, `actividad`, `productoIds`, `fechaInicio`, `fechaFin`, `horaInicio`, `horaFin` |
| `documentosMeta` | JSON string | Lista `{ requisitoId, nombreOriginal }` en el mismo orden de los archivos |
| `documentos` | archivos | Hasta 10 archivos PDF/JPG/PNG |

Ejemplo de `datos`:

```json
{
  "espacioId": "4",
  "actividad": "Venta de artesanías",
  "productoIds": ["3"],
  "fechaInicio": "2026-12-21",
  "fechaFin": "2026-12-23",
  "horaInicio": "09:00",
  "horaFin": "12:00"
}
```

Respuesta `201`:

```json
{
  "id": "12",
  "numeroRadicado": "SOL-2026-00012",
  "estado": "radicada",
  "mensaje": "Solicitud radicada correctamente.",
  "correoEnviado": true,
  "mensajeCorreo": null
}
```

Errores principales:

| HTTP | Causa |
|---|---|
| `400` | JSON inválido, campos incompletos, fechas pasadas, documentos faltantes o archivo inválido |
| `401` | Sin token o sesión revocada |
| `403` | Rol distinto de comerciante |
| `404` | Espacio inexistente |
| `409` | Espacio no disponible, bloqueado, ocupado o solicitud duplicada |
| `413` | Archivo que supera el límite de Multer |

### 4.2 Carga y reemplazo de documentos

**`GET /solicitudes/:id/requisitos`** devuelve:

```json
{
  "solicitudId": "12",
  "numeroRadicado": "SOL-2026-00012",
  "estado": "devuelta",
  "actividad": "Artesanías",
  "puedeCargar": true,
  "motivoBloqueo": null,
  "faltantes": ["RUT"],
  "requisitos": [
    {
      "id": "1",
      "nombre": "Documento de identidad",
      "descripcion": "Copia legible...",
      "obligatorio": true,
      "tipoActividad": null,
      "orden": 10,
      "estado": "cumple",
      "documentoActual": {
        "id": "8",
        "numeroVersion": 2,
        "esActual": true,
        "reemplazaA": "5",
        "estado": "validado",
        "url": "/solicitudes/12/documentos/8/archivo"
      },
      "versiones": []
    }
  ],
  "otrosDocumentos": []
}
```

**`POST /solicitudes/:id/documentos`** usa `multipart/form-data`:

| Campo | Tipo | Descripción |
|---|---|---|
| `requisitoId` | texto | Requisito del catálogo |
| `archivo` | archivo | Un PDF/JPG/PNG de máximo 5 MB |

Respuesta `201`:

```json
{
  "mensaje": "Documento reemplazado correctamente.",
  "estadoSolicitud": "en_revision",
  "volvioARevision": true,
  "requisito": { "...": "estado actualizado del requisito" },
  "faltantes": [],
  "correoEnviado": true,
  "mensajeCorreo": null
}
```

Errores principales:

| HTTP | Causa |
|---|---|
| `400` | Archivo vacío o inválido, requisito inexistente o de otra actividad |
| `401` | Sin token o sesión revocada |
| `403` | Rol distinto de comerciante |
| `404` | Solicitud ajena o inexistente |
| `409` | Estado que no admite cambios (`en_revision`, `aprobada`, etc.) |
| `413` | Archivo que supera el límite de Multer |

La descarga y la vista previa usan el endpoint autenticado existente. El archivo nunca se sirve como recurso estático público.

### 4.3 Cambio de estado del gestor

**`PATCH /gestor/solicitudes/:id/estado`**

Acceso: `gestor` (revisor o administrador). Aplica una transición no final de la máquina de estados.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `estado` | texto | Sí | `en_revision` o `devuelta` |
| `observacion` | texto | Si `estado = devuelta` | Observación visible en la línea de tiempo |

Transiciones permitidas por este endpoint:

```text
radicada → en_revision
en_revision → devuelta
devuelta → en_revision  (corrección documental del comerciante)
```

La aprobación y el rechazo **no** se hacen por este endpoint: tienen un contrato propio en `/resolucion` porque asignan el espacio en una transacción (HU-20).

Respuesta `200`:

```json
{
  "id": "12",
  "numeroRadicado": "SOL-2026-00012",
  "estadoAnterior": "radicada",
  "estado": "en_revision",
  "observacion": "El gestor inició la revisión de la solicitud.",
  "motivoRechazo": null,
  "decididaEn": null,
  "actualizadoEn": "2026-11-21T10:00:00.000Z",
  "correoEnviado": true,
  "mensajeCorreo": null,
  "mensaje": "Solicitud actualizada a «En revisión»."
}
```

Errores:

| HTTP | Causa |
|---|---|
| `400` | Estado inválido, falta observación de devolución o se intenta aprobar/rechazar por este endpoint |
| `401` | Sin token o sesión revocada |
| `403` | Rol distinto de gestor |
| `404` | La solicitud no existe |
| `409` | Transición no permitida, solicitud en estado final o bloqueo de otro gestor |

El cambio de estado, el historial y la notificación en plataforma se guardan en una sola transacción. El correo se envía después del commit y su fallo no revierte el trámite.

---

## 5. Interfaz del comerciante

### Rutas

| Ruta | Función |
|---|---|
| `/comerciante/solicitudes` | Mis solicitudes, filtro por estado y tarjeta de borrador local |
| `/comerciante/solicitudes/nueva` | Formulario de 5 pasos |
| `/comerciante/solicitudes/[id]` | Detalle con documentos e historial |
| `/comerciante/solicitudes/[id]/confirmacion` | Pantalla de confirmación posterior a la radicación |

### Pasos

1. **Ubicación:** mapa Leaflet con todos los espacios y lista accesible alternativa.
2. **Actividad:** texto libre y selección de productos permitidos por la zona.
3. **Documentos:** requisitos obligatorios y opcionales con validación de tipo y tamaño.
4. **Horario:** fechas y horas con verificación de disponibilidad en el servidor.
5. **Resumen:** revisión final y radicación.

### Detalle y corrección de documentos

- El detalle muestra cada requisito con su estado (`Faltante`, `Cargado`, `Cumple`, `No cumple`).
- El comerciante puede ver la vista previa y descargar la versión vigente.
- Las versiones anteriores quedan en un bloque desplegable con su número de versión y fecha.
- La carga usa un selector de archivo, validación en el cliente, vista previa local y una barra de progreso real por bytes.
- Si la operación falla, el archivo seleccionado se conserva para reintentar.
- En estados no editables se oculta la acción de carga y se muestra el motivo.
- Los documentos antiguos sin requisito asociado se muestran aparte para no ocultarlos.
- La línea de tiempo muestra el estado anterior y el nuevo, la fecha, el actor, la observación del gestor y usa etiquetas visuales por estado.
- El centro de notificaciones muestra las notificaciones propias, permite marcar una o todas y actualiza el indicador del menú sin esperar una navegación.
- Si la notificación tiene `solicitudId`, el comerciante puede abrir el detalle con el enlace **Ver solicitud**.

### Borrador local

- Los campos se guardan en `sessionStorage`.
- Los archivos se guardan en `IndexedDB`.
- Se recuperan al volver al formulario o desde la tarjeta **“Borrador sin radicar”** de Mis solicitudes.
- Se eliminan al radicar, al descartarlos o al cerrar sesión.
- No se envían al backend hasta la radicación.

### Accesibilidad y responsive

- Formulario y tarjetas probados a 360 px.
- Campos con etiqueta, errores asociados y áreas táctiles de al menos 44 px.
- Estados de carga, error, vacío y reintento.
- El mapa tiene una lista alternativa para seleccionar el espacio con teclado.

---

## 6. Pruebas

```powershell
# Backend
pnpm test -- --runInBand src/solicitudes src/notificaciones src/common/estados-solicitud.spec.ts
pnpm test:e2e -- --runInBand test/solicitudes.e2e-spec.ts test/notificaciones.e2e-spec.ts

# Frontend
cd frontend
pnpm test
pnpm test:e2e e2e/solicitudes.spec.ts e2e/solicitudes-documentos.spec.ts e2e/notificaciones.spec.ts e2e/seguimiento-solicitudes.spec.ts
```

Cubren:

- Reglas de fechas, horas, horario y documentos.
- Firma binaria, tamaño y rutas seguras de archivos.
- Radicación válida, faltantes de documentos, horario inválido, fechas pasadas y duplicados.
- Listado, detalle, requisitos y disponibilidad.
- Roles: comerciante permitido; gestor y anónimo rechazados en la radicación.
- Carga, reemplazo y versionado de documentos; transición `devuelta → en_revision`.
- Límites de tipo y tamaño, requisitos faltantes y acceso no autorizado a archivos.
- Transiciones del gestor: `radicada → en_revision → aprobada/rechazada`, transición inválida, estado final inmutable y motivo obligatorio.
- Notificación en plataforma y correo por cambio de estado, con `solicitud_id`.
- Aislamiento de solicitudes y notificaciones entre dos comerciantes.
- Centro de notificaciones: enlace al detalle y actualización del indicador de no leídas.
- Borrador local: guardar, recuperar y descartar.
- Flujo Playwright completo con documentos reales, progreso, vista previa y versiones.

---

## 7. Migración

```powershell
psql -U postgres -d "sgp_tulua" -f dataBase/09_solicitudes_hu16.sql
psql -U postgres -d "sgp_tulua" -f dataBase/10_solicitudes_hu17.sql
psql -U postgres -d "sgp_tulua" -f dataBase/11_notificaciones_hu18.sql
pnpm exec prisma generate
```

Las migraciones son idempotentes. La 11 agrega `notificaciones.solicitud_id`, su clave foránea a `solicitudes` y el índice `idx_notificaciones_solicitud` para enlazar cada aviso con su trámite.

La 09 agrega:

- `requisitos_documentales` y su seed.
- Metadatos de documentos en `solicitud_documentos`.
- `solicitud_historial` y su historial inicial.
- `fn_numero_radicado_solicitud()` y sincronización de la secuencia.
- Índices de duplicados, historial y documentos.

La 10 agrega el índice de versiones documentales. La columna `reemplaza_a` ya existe desde `01_creacion_bd.sql`.

---

## 8. Prueba manual rápida

1. Iniciar backend y frontend.
2. Entrar como `maria.gomez@gmail.com` / `Comerciante123`.
3. Abrir **Mis solicitudes → Nueva solicitud**.
4. Elegir un espacio disponible, por ejemplo **Kiosco Parque La Guadua**.
5. Completar actividad, productos, documentos y un horario dentro de `08:00–18:00`.
6. Verificar la disponibilidad y radicar.
7. Comprobar el número de radicado, el correo en el log (sin SMTP) y la notificación en la plataforma.
8. Abrir el detalle, comprobar el estado de cada requisito y usar **Vista previa**.
9. Reemplazar un documento con un PDF y comprobar la barra de progreso y el bloque **Versiones anteriores**.
10. Intentar subir un `.txt` o un archivo de más de 5 MB y comprobar el mensaje de rechazo.
11. Repetir la misma solicitud para comprobar el rechazo por duplicado.
12. Con el token de un gestor, cambiar el estado a `en_revision` y luego a `aprobada`:
    ```powershell
    Invoke-RestMethod -Method Patch -Uri 'http://localhost:3000/gestor/solicitudes/12/estado' `
      -Headers @{ Authorization = "Bearer $tokenGestor" } `
      -ContentType 'application/json' -Body '{"estado":"en_revision"}'
    ```
13. Volver a iniciar sesión como comerciante y abrir **Notificaciones**: debe aparecer el aviso con el radicado, la observación y el enlace **Ver solicitud**.
14. Abrir el detalle y comprobar la línea de tiempo con los estados, fechas y observaciones.
15. Marcar la notificación como leída y verificar que el indicador del menú disminuye sin cambiar de página.

---

## 9. Revisión documental del gestor (HU-19)

### 9.1 Rutas y permisos

| Ruta | Función |
|---|---|
| `/gestor/solicitudes` | Bandeja de revisión con filtros, orden y paginación |
| `/gestor/solicitudes/[id]` | Detalle, checklist, visor de documentos y devolución |

Disponible para gestores con perfil `revisor` y `administrador`. Un comerciante recibe `403`.

### 9.2 Bandeja

- Sin filtro de estado muestra `radicada` y `en_revision`.
- Filtros por estado, sector y `actividad_permitida` del espacio.
- Orden por antigüedad (más antiguas primero) o más recientes.
- Cada fila muestra comerciante, espacio, fechas, documentos, avance y bloqueo.
- Si otro gestor tiene el bloqueo, la acción cambia a **Ver en solo lectura**.

### 9.3 Verificación por requisito

- La lista se construye con los requisitos de la actividad del espacio.
- Solo se pueden verificar requisitos con documento vigente.
- El gestor elige **Cumple** o **No cumple** y pulsa **Guardar verificación**.
- `No cumple` exige una observación de 1–2000 caracteres.
- El estado se guarda en `solicitud_documentos.estado` (`validado`/`observado`) y la observación en `observacion`.
- Se registran `verificado_por` y `verificado_en`.
- El progreso (`X de Y requisitos verificados`) se actualiza sin recargar.

### 9.4 Bloqueo concurrente

- Abrir el detalle toma el bloqueo y, si la solicitud está radicada, la pasa a `En revisión`.
- Cada toma genera un `tokenBloqueo`; la liberación solo afecta al bloqueo de esa pantalla.
- El bloqueo se renueva cada 60 segundos y con cada verificación.
- Duración por defecto: 15 minutos (`REVISION_LOCK_MINUTES`).
- Si otro gestor intenta verificar o cambiar el estado, recibe `409`.
- Al salir de la pantalla se libera el bloqueo; si la pestaña se cierra sin liberar, expira por inactividad.
- El segundo gestor puede consultar en solo lectura y reintentar cuando el bloqueo se libere.

### 9.5 Devolución

- El botón **Devolver para corrección** exige una observación general.
- La solicitud pasa a `devuelta` (visible como **Requiere corrección**).
- Se registra historial, notificación en plataforma y correo.
- Los requisitos marcados `No cumple` conservan su observación para el comerciante.
- El bloqueo se libera al devolver.

### 9.6 Pruebas

```powershell
# Backend
pnpm test -- --runInBand src/solicitudes
pnpm test:e2e -- --runInBand test/revision-solicitudes.e2e-spec.ts

# Frontend
cd frontend
pnpm test
pnpm test:e2e e2e/revision-solicitudes.spec.ts
```

Las pruebas Playwright cubren bandeja y filtros, vista móvil, verificación con persistencia, devolución con notificación, concurrencia entre dos gestores y expiración del bloqueo.

### 9.7 Migración

```powershell
psql -U postgres -d "sgp_tulua" -f dataBase/12_revision_hu19.sql
pnpm exec prisma generate
```

La migración agrega `solicitud_revisiones`, el token de bloqueo y las columnas `verificado_por` y `verificado_en`.

---

## 10. Resolución y asignación del espacio (HU-20)

### 10.1 Endpoint

**`PATCH /gestor/solicitudes/:id/resolucion`**

Acceso: `gestor` (revisor y administrador). Exige que la solicitud esté en `en_revision` y que el gestor autenticado tenga el bloqueo de revisión vigente.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `decision` | texto | Sí | `aprobar` o `rechazar` |
| `dictamen` | texto | No | Dictamen de la aprobación, 1–2000 caracteres. Se guarda en el historial y es visible para el solicitante |
| `motivoRechazo` | texto | Si `decision = rechazar` | Motivo visible para el solicitante, 1–2000 caracteres |

Ejemplo de aprobación:

```json
{
  "decision": "aprobar",
  "dictamen": "Cumple con los requisitos documentales."
}
```

Ejemplo de rechazo:

```json
{
  "decision": "rechazar",
  "motivoRechazo": "La documentación no permite verificar la actividad solicitada."
}
```

Respuesta `200`:

```json
{
  "id": "12",
  "numeroRadicado": "SOL-2026-00012",
  "decision": "aprobar",
  "estadoAnterior": "en_revision",
  "estado": "aprobada",
  "dictamen": "Cumple con los requisitos documentales.",
  "motivoRechazo": null,
  "decididaEn": "2026-11-22T10:00:00.000Z",
  "actualizadoEn": "2026-11-22T10:00:00.000Z",
  "asignacion": {
    "espacioId": "2",
    "espacioNombre": "Espacio móvil Calle 30 - B",
    "fechaInicio": "2027-01-05",
    "fechaFin": "2027-01-07",
    "horaInicio": "09:00",
    "horaFin": "12:00"
  },
  "correoEnviado": true,
  "mensajeCorreo": null,
  "mensaje": "Solicitud aprobada y espacio asignado."
}
```

En un rechazo, `asignacion` es `null` y `motivoRechazo` contiene el texto enviado.

### 10.2 Reglas de aprobación

- La solicitud debe estar en `en_revision` y el bloqueo debe pertenecer al gestor.
- No se puede aprobar si existe un requisito vigente marcado como `No cumple`.
- El espacio debe existir y estar en estado `disponible`.
- No debe haber un bloqueo activo, un permiso `vigente` ni otra solicitud `aprobada` que se solape en fechas **y** horas.
- La aprobación cambia el estado a `aprobada`, asigna el espacio al rango solicitado, registra `decidida_en`, escribe el historial y crea la notificación.
- El espacio no cambia su estado global: la ocupación se calcula por rango de fechas, como ya hacían HU-09, HU-10 y HU-16.

### 10.3 Control de doble asignación

No se creó una tabla de asignaciones ni se modificó el esquema. La asignación es la propia solicitud `aprobada` con su espacio y rango.

La transacción:

1. Bloquea la fila de la solicitud con `FOR UPDATE`.
2. Exige el bloqueo de revisión propio.
3. Bloquea la fila del espacio con `FOR UPDATE`.
4. Con el lock del espacio en mano, consulta solapes contra bloqueos, permisos y solicitudes aprobadas.
5. Actualiza la solicitud, el historial y la notificación, y libera el bloqueo de revisión.

Dos aprobaciones concurrentes del mismo espacio se serializan en el lock del espacio: la segunda vuelve a consultar y recibe `409`. Dos resoluciones concurrentes de la misma solicitud se serializan en el lock de la solicitud: solo una cambia el estado.

Los permisos `vigente` conservan además su restricción `EXCLUDE` en la base de datos.

### 10.4 Interfaz

- La sección **Resolución** vive en `/gestor/solicitudes/[id]`.
- **Aprobar y asignar espacio** abre un diálogo con el resumen y un dictamen opcional.
- **Rechazar solicitud** abre un diálogo con motivo obligatorio.
- Si hay requisitos `No cumple`, Aprobar queda deshabilitado y se listan los requisitos.
- Si el bloqueo no es propio o la solicitud ya fue resuelta, las acciones se deshabilitan y se explica el motivo.
- El detalle del comerciante muestra el dictamen de aprobación o el motivo de rechazo, la fecha y el gestor.

### 10.5 Pruebas

```powershell
# Backend
pnpm test -- --runInBand src/solicitudes src/common/estados-solicitud.spec.ts
pnpm test:e2e -- --runInBand test/resolucion-solicitudes.e2e-spec.ts

# Frontend
cd frontend
pnpm test
pnpm test:e2e e2e/resolucion-solicitudes.spec.ts
```

Los e2e de Playwright cubren aprobación, rechazo, bloqueo por `No cumple`, doble asignación concurrente, resolución concurrente de la misma solicitud y vista móvil.

### 10.6 Migración

No requiere migración: usa las tablas y columnas existentes (`solicitudes`, `solicitud_historial`, `solicitud_revisiones`, `espacio_bloqueos`, `permisos`).
