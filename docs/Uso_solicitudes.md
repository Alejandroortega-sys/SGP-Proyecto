# Módulo de Solicitudes — HU-16

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
| `GET` | `/solicitudes/:id/documentos/:documentoId/archivo` | Comerciante dueño / Gestor | Descarga autenticada de un documento |

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

Si el correo falla, la solicitud **permanece radicada** y la respuesta incluye `correoEnviado: false` con un mensaje de advertencia.

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

---

## 4. Contrato de radicación

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
pnpm test -- --runInBand src/solicitudes
pnpm test:e2e -- --runInBand test/solicitudes.e2e-spec.ts

# Frontend
cd frontend
pnpm test
pnpm test:e2e e2e/solicitudes.spec.ts
```

Cubren:

- Reglas de fechas, horas, horario y documentos.
- Firma binaria, tamaño y rutas seguras de archivos.
- Radicación válida, faltantes de documentos, horario inválido, fechas pasadas y duplicados.
- Listado, detalle, requisitos y disponibilidad.
- Roles: comerciante permitido; gestor y anónimo rechazados en la radicación.
- Borrador local: guardar, recuperar y descartar.
- Flujo Playwright completo con documentos reales y confirmación.

---

## 7. Migración

```powershell
psql -U postgres -d "sgp_tulua" -f dataBase/09_solicitudes_hu16.sql
pnpm exec prisma generate
```

La migración es idempotente y agrega:

- `requisitos_documentales` y su seed.
- Metadatos de documentos en `solicitud_documentos`.
- `solicitud_historial` y su historial inicial.
- `fn_numero_radicado_solicitud()` y sincronización de la secuencia.
- Índices de duplicados, historial y documentos.

---

## 8. Prueba manual rápida

1. Iniciar backend y frontend.
2. Entrar como `maria.gomez@gmail.com` / `Comerciante123`.
3. Abrir **Mis solicitudes → Nueva solicitud**.
4. Elegir un espacio disponible, por ejemplo **Kiosco Parque La Guadua**.
5. Completar actividad, productos, documentos y un horario dentro de `08:00–18:00`.
6. Verificar la disponibilidad y radicar.
7. Comprobar el número de radicado, el correo en el log (sin SMTP) y la notificación en la plataforma.
8. Repetir la misma solicitud para comprobar el rechazo por duplicado.
