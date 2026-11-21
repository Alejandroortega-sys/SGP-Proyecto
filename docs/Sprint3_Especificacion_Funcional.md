# Sprint 3 - Especificación funcional para agentes de codificación

**Proyecto:** Plataforma Web de Gestión del Espacio Público - Tuluá (SGP-Tulua)
**Épica:** 3 - Solicitud y asignación digital de espacio
**Sprint:** 21 nov - 10 dic 2026
**Alcance:** 8 historias de usuario (HU-16 a HU-23), 52 puntos

---

## 0. Cómo usar este documento

Este documento describe **qué** debe hacer el sistema, no **cómo** construirlo. No asume lenguaje, framework, base de datos ni arquitectura. Si el repositorio ya tiene un stack, el agente debe:

1. Leer el código existente y **seguir sus convenciones** (estructura, nombres, estilo, manejo de errores, pruebas).
2. Reutilizar lo que ya exista (autenticación, roles, mapa, catálogo de espacios) en lugar de recrearlo.
3. Implementar cada historia como un cambio pequeño y verificable, en el orden de la sección 8.
4. Tratar cada criterio de aceptación como una prueba: si no se puede comprobar, la historia no está terminada.

**Notación de criterios:** *Dado* (contexto), *cuando* (acción), *entonces* (resultado esperado).

**Marcas de confianza:**
- Sin marca: viene literalmente del backlog.
- **[Supuesto]**: dato no definido en el backlog; el agente debe confirmarlo con el equipo o con el código existente antes de fijarlo.

---

## 1. Contexto de negocio

El municipio de Tuluá gestiona el uso temporal de espacios públicos (zonas, módulos y espacios de venta o de eventos). Hoy el trámite exige ir a una oficina. Este sprint digitaliza el trámite completo:

- Un **comerciante** pide el uso temporal de un espacio, adjunta documentos y sigue el estado de su solicitud.
- Un **gestor municipal** revisa los documentos, devuelve o resuelve la solicitud y asigna el espacio sin conflictos.
- Un **organizador de feria** pide espacios para ferias agroecológicas y registra a sus vendedores; el gestor aprueba y programa en un calendario.

## 2. Roles

| Rol | Qué hace en este sprint |
|---|---|
| Comerciante | Radica solicitudes, adjunta y corrige documentos, consulta estados y notificaciones |
| Gestor municipal | Revisa documentos, devuelve, aprueba o rechaza, asigna espacio, administra el calendario de ferias |
| Organizador de feria | Solicita espacios para ferias, registra vendedores participantes |

Regla transversal: cada rol solo ve y modifica lo que le corresponde. Un comerciante **nunca** ve solicitudes de otros usuarios. Los accesos indebidos se rechazan como "no autenticado" o "no autorizado".

## 3. Prerrequisitos (ya construidos en sprints 1 y 2)

El agente debe **integrarse** con estos componentes, no reimplementarlos. Si alguno no existe en el código, debe avisarlo antes de continuar.

| Componente | Historia origen | Lo que este sprint necesita de él |
|---|---|---|
| Inicio de sesión y recuperación de contraseña | HU-02 | Identificar al usuario autenticado y su rol |
| Panel administrativo del gestor | HU-03 | Punto de entrada donde se montan las vistas del gestor |
| Registro de organizador de feria | HU-07 | Existencia de organizadores activos |
| Consulta de espacios y ficha detallada | HU-09 | Elegir un espacio disponible para solicitar |
| Catálogo de espacios temporales y disponibilidad | HU-15 | Saber qué espacios existen y en qué fechas están libres |
| Zonas y reglas por zona (horarios permitidos, aforo, productos permitidos) | Épica 2 | Validar horarios, aforo y productos **[Supuesto: estos datos viven en la definición de zonas]** |

## 4. Modelo de dominio compartido

### 4.1 Solicitud de ubicación temporal

Campos mínimos: identificador, **número de radicado** (único, legible, generado al radicar), comerciante, espacio solicitado, actividad, productos, rango de fechas, horario, estado, historial de estados, observaciones del gestor, documentos asociados, fechas de creación y actualización.

### 4.2 Estados y transiciones de la solicitud

Estados: **Borrador, Radicada, En revisión, Requiere corrección, Aprobada, Rechazada**.

| Desde | Hacia | Quién / qué lo dispara |
|---|---|---|
| (nuevo) | Borrador | Comerciante guarda sin terminar (HU-16) |
| Borrador | Radicada | Comerciante envía formulario válido (HU-16) |
| Radicada | En revisión | El gestor empieza la revisión **[Supuesto: el backlog no define el disparador]** |
| En revisión | Requiere corrección | Gestor devuelve con observaciones (HU-19) |
| Requiere corrección | En revisión | Comerciante reemplaza el documento pedido (HU-17) |
| En revisión | Aprobada | Gestor aprueba y asigna espacio (HU-20) |
| En revisión | Rechazada | Gestor rechaza con motivo obligatorio (HU-20) |

Reglas: toda transición queda en el **historial de estados** (fecha, estado anterior y nuevo, quién, observación). Una solicitud Aprobada o Rechazada **no vuelve a cambiar de estado**. Cada cambio de estado dispara una notificación al comerciante (HU-18).

### 4.3 Documento de solicitud

Archivo asociado a una solicitud y a un requisito documental. Tiene versiones: al reemplazarlo se conserva la anterior. Estado por requisito: pendiente, cargado, Cumple, No cumple (con observación).

### 4.4 Requisito documental

Catálogo de documentos exigidos, **según el tipo de actividad**. Define cuáles son obligatorios.

### 4.5 Notificación

Mensaje al usuario por cambio de estado. Dos canales: **en la plataforma** (con indicador de no leídas) y **correo electrónico**.

### 4.6 Evento o feria

Solicitud de un organizador para usar una zona en un rango de fechas con un número de puestos. Estados **[Supuesto]**: Radicado, Aprobado, Cancelado. Tiene adjuntos, motivo de cancelación y número de radicado.

### 4.7 Participante de feria

Vendedor asociado a un evento aprobado, con sus datos y la lista de productos que venderá.

## 5. Componentes compartidos (construir una vez, reutilizar)

Estos puntos conectan varias historias. Construirlos una sola vez evita duplicar lógica:

| Componente | Lo usan | Descripción |
|---|---|---|
| **Máquina de estados de la solicitud** | HU-16, HU-17, HU-19, HU-20 | Única fuente de verdad de transiciones permitidas y su historial |
| **Almacenamiento seguro de archivos** | HU-17, HU-21 | Valida tipo y tamaño, restringe el acceso al dueño y al gestor, y soporta versiones |
| **Servicio de notificaciones** | HU-16, HU-18, HU-19, HU-20, HU-22 | Recibe un evento de dominio y entrega notificación en plataforma y por correo |
| **Servicio de correo** | HU-16, HU-18, HU-22 | Plantillas en español; usar un servidor de pruebas en desarrollo |
| **Control de concurrencia** | HU-19, HU-20 | Impide ediciones simultáneas y asignaciones duplicadas |
| **Detección de cruces de agenda** | HU-21, HU-22 | Detecta solapamiento de zona y fechas entre eventos |
| **Verificación de disponibilidad de espacios** | HU-16, HU-20, HU-21, HU-22 | Consulta y bloquea espacios por rango de fechas |
| **Generador de número de radicado** | HU-16, HU-21 | Número único y legible para solicitudes y eventos |

## 6. Requisitos transversales

**Todas las operaciones del servidor**
- Con datos válidos: responder correctamente y guardar o devolver lo esperado.
- Con datos inválidos o incompletos: rechazar con mensaje descriptivo y **no modificar datos**.
- Sin sesión o sin el rol requerido: rechazar el acceso.
- Respuesta en menos de 2 s en uso normal.
- Las operaciones nuevas tienen pruebas automáticas y su contrato (entradas, salidas, errores) queda documentado para quien construye la interfaz.

**Toda pantalla**
- Se ve completa y sin desplazamiento horizontal en celular (360 px) y en escritorio.
- Maneja los estados de carga, éxito, vacío y error, con mensajes claros en español.
- No pierde lo escrito si la operación falla.
- Valida los datos en el cliente antes de enviarlos.
- Accesible: contraste WCAG AA y áreas táctiles de al menos 44 px.
- No genera errores en la consola del navegador.

**Diseño (UX):** cada historia tiene una tarea de diseño (prototipo navegable) que el Product Owner aprueba **antes** de construir la interfaz.

**Pruebas (QA):** al menos un caso por criterio de aceptación, con casos positivos, negativos y de valores límite; regresión sobre las historias de las que depende; sin defectos críticos ni altos abiertos.

---

## 7. Historias de usuario

### HU-16 - Radicar como comerciante una solicitud de ubicación temporal
**Prioridad:** Must · **Puntos:** 8 · **Rol:** Comerciante
**Historia:** Como comerciante quiero diligenciar y radicar una solicitud indicando el espacio, la actividad, los productos y el horario para obtener formalmente el uso temporal de un espacio público.

**Funcionalidades**
1. Crear la solicitud con sus estados y generar el número de radicado al radicar.
2. Validar fechas, horarios permitidos por zona y solicitudes duplicadas.
3. Guardar borradores y recuperarlos después desde «Mis solicitudes».
4. Enviar un correo de confirmación al radicar.
5. Formulario por pasos: ubicación, actividad, horario y resumen.
6. Seleccionar el espacio desde el mapa dentro del formulario.
7. Pantalla de confirmación tras radicar.

**Criterios de aceptación**
- Dado que elegí un espacio disponible, cuando completo actividad, productos, fechas y horario y envío, entonces se crea la solicitud en estado «Radicada» con un número de radicado y recibo un correo de confirmación.
- Dado que dejo campos obligatorios vacíos o un horario fuera de lo permitido en la zona, cuando envío, entonces se resaltan los errores y la solicitud no se radica.
- Dado que ya tengo una solicitud activa para ese espacio y esas fechas, cuando envío una nueva, entonces el sistema me informa y no la duplica.
- Dado que no termino el formulario, cuando guardo un borrador, entonces puedo retomarlo después desde «Mis solicitudes».

**Integración con la aplicación**
- **Consume:** sesión y rol del comerciante (HU-02); espacios y disponibilidad (HU-09, HU-15); reglas de horario por zona.
- **Produce:** solicitud en estado Radicada (entrada de HU-17, HU-18, HU-19); evento de notificación "solicitud radicada".
- **Punto de montaje:** nueva sección «Mis solicitudes» en el área del comerciante, que HU-18 amplía con la lista y el detalle.
- **Cuidado:** definir qué cuenta como "solicitud activa" para el chequeo de duplicados (misma persona, mismo espacio, fechas que se solapan, estado no final) **[Supuesto]**.

---

### HU-17 - Adjuntar y corregir como comerciante la documentación de su solicitud
**Prioridad:** Must · **Puntos:** 5 · **Rol:** Comerciante · **Depende de:** HU-16
**Historia:** Como comerciante quiero adjuntar los documentos exigidos y reemplazar los que el gestor me pida corregir para completar mi trámite sin ir a una oficina.

**Funcionalidades**
1. Almacenar archivos de forma segura validando tipo (PDF o imagen) y tamaño.
2. Catálogo de requisitos documentales según el tipo de actividad.
3. Reemplazar documentos conservando versiones anteriores.
4. Componente de carga con vista previa y barra de progreso.
5. Lista de requisitos con el estado de cada documento.
6. Al radicar, indicar exactamente qué documentos obligatorios faltan.

**Criterios de aceptación**
- Dado que estoy en mi solicitud, cuando adjunto un PDF o imagen dentro del tamaño permitido, entonces el archivo queda asociado y puedo verlo en una vista previa.
- Dado que adjunto un formato no permitido o un archivo muy pesado, cuando intento subirlo, entonces se rechaza con un mensaje que indica el motivo.
- Dado que faltan documentos obligatorios, cuando intento radicar, entonces el sistema indica exactamente cuáles faltan.
- Dado que el gestor me pidió corregir un documento, cuando lo reemplazo, entonces la solicitud vuelve a «En revisión» y se conserva la versión anterior.

**Integración con la aplicación**
- **Consume:** la solicitud de HU-16; el tipo de actividad para elegir el catálogo de requisitos.
- **Produce:** documentos y su estado por requisito (los lee HU-19); transición Requiere corrección → En revisión.
- **Componente compartido:** el almacenamiento de archivos lo reutiliza HU-21 para los adjuntos de la feria.
- **Seguridad:** solo el dueño de la solicitud y los gestores acceden al archivo. Un acceso no autorizado debe ser rechazado, incluso conociendo la dirección del archivo.
- **Límites de tamaño y formatos permitidos:** valores a definir **[Supuesto]**; dejarlos en configuración, no fijos en el código.
- **Relación con HU-16:** la validación de documentos faltantes se ejecuta en el momento de radicar.

---

### HU-18 - Seguir como comerciante sus solicitudes y recibir notificaciones
**Prioridad:** Must · **Puntos:** 5 · **Rol:** Comerciante · **Depende de:** HU-16
**Historia:** Como comerciante quiero ver el estado y el historial de mis solicitudes y recibir avisos cuando cambien para saber en qué etapa está mi trámite sin tener que consultar al gestor.

**Funcionalidades**
1. Consultar las solicitudes del usuario con su historial de estados.
2. Servicio de notificaciones (plataforma y correo) por cada cambio de estado.
3. Lista de solicitudes con filtro por estado.
4. Detalle con línea de tiempo (fechas y observaciones del gestor).
5. Centro de notificaciones con indicador de no leídas.

**Criterios de aceptación**
- Dado que tengo solicitudes, cuando abro «Mis solicitudes», entonces veo la lista con su estado: Borrador, Radicada, En revisión, Requiere corrección, Aprobada o Rechazada.
- Dado que abro el detalle de una solicitud, cuando carga, entonces veo una línea de tiempo con fechas y observaciones del gestor.
- Dado que cambia el estado de mi solicitud, cuando el gestor lo actualiza, entonces recibo una notificación en la plataforma y un correo.
- Dado que soy comerciante, cuando consulto solicitudes, entonces nunca veo las de otros usuarios.

**Integración con la aplicación**
- **Consume:** el historial de estados que escribe la máquina de estados (HU-16, HU-17, HU-19, HU-20).
- **Produce:** el **servicio de notificaciones**, que luego reutiliza HU-22 para avisar al organizador.
- **Patrón recomendado:** que los módulos de solicitud emitan un evento de dominio ("estado cambiado") y el servicio de notificaciones lo escuche, en lugar de que cada módulo envíe correos por su cuenta.
- **Seguridad:** el filtro por usuario debe aplicarse en el servidor, nunca solo en la interfaz.
- **Extiende** la sección «Mis solicitudes» creada en HU-16.

---

### HU-19 - Revisar y verificar como gestor municipal la documentación de las solicitudes
**Prioridad:** Must · **Puntos:** 8 · **Rol:** Gestor municipal · **Depende de:** HU-17
**Historia:** Como gestor municipal quiero revisar cada solicitud y sus documentos y marcar qué requisitos cumple para decidir con criterios claros y devolver las solicitudes incompletas.

**Funcionalidades**
1. Bandeja de solicitudes con filtros (estado, sector, tipo de actividad) y ordenamiento por antigüedad.
2. Verificación por requisito: marcar «Cumple» o «No cumple» con observación; el avance se guarda.
3. Bloqueo de revisión concurrente entre gestores.
4. Visor de documentos con lista de verificación de requisitos.
5. Devolver la solicitud para corrección, con observaciones.

**Criterios de aceptación**
- Dado que hay solicitudes radicadas, cuando abro la bandeja, entonces las veo ordenadas por antigüedad con filtros por estado, sector y tipo de actividad.
- Dado que reviso los documentos en el visor, cuando marco cada requisito como «Cumple» o «No cumple» con una observación, entonces el avance queda guardado.
- Dado que algún requisito no cumple, cuando devuelvo la solicitud, entonces pasa a «Requiere corrección» y el comerciante es notificado con mis observaciones.
- Dado que otro gestor está revisando la misma solicitud, cuando intento abrirla, entonces el sistema me avisa y evita ediciones simultáneas.

**Integración con la aplicación**
- **Consume:** solicitudes y documentos (HU-16, HU-17); sesión con rol de gestor (HU-03).
- **Produce:** verificación por requisito (la lee HU-20 para decidir); transición En revisión → Requiere corrección y su notificación (HU-18).
- **Punto de montaje:** panel administrativo del gestor (HU-03).
- **Concurrencia:** el bloqueo debe liberarse si el gestor cierra la pantalla o pasa un tiempo sin actividad, para no dejar solicitudes bloqueadas para siempre **[Supuesto: definir tiempo de expiración]**.
- **Sector:** el filtro por sector depende de que la solicitud conozca el sector de su espacio (dato de la Épica 2).

---

### HU-20 - Aprobar o rechazar como gestor municipal las solicitudes y asignar el espacio
**Prioridad:** Must · **Puntos:** 8 · **Rol:** Gestor municipal · **Depende de:** HU-19
**Historia:** Como gestor municipal quiero aprobar o rechazar una solicitud revisada y asignar el espacio solicitado para entregar los espacios de forma transparente y sin conflictos.

**Funcionalidades**
1. Flujo de estados de la solicitud y su resolución (aprobar o rechazar).
2. Asignación del espacio a la solicitud con **control de doble asignación** en una operación atómica (todo o nada).
3. Pantalla de resolución con acciones de aprobar y rechazar.
4. Diálogo de motivo de rechazo y confirmación de aprobación.
5. Dictamen visible para el solicitante.

**Criterios de aceptación**
- Dado que reviso una solicitud que cumple, cuando la apruebo, entonces el estado cambia a «Aprobada», el espacio queda asignado en el rango de fechas y el comerciante es notificado.
- Dado que rechazo una solicitud, cuando guardo, entonces debo escribir un motivo obligatorio que será visible para el solicitante.
- Dado que otro gestor ya resolvió la solicitud o el espacio ya fue asignado en esas fechas, cuando intento resolverla, entonces el sistema lo impide.

**Integración con la aplicación**
- **Consume:** verificación por requisito (HU-19); disponibilidad del espacio (Épica 2).
- **Produce:** asignación del espacio en un rango de fechas; esa asignación **cambia la disponibilidad** que ven HU-09, HU-10 y HU-15, y que valida HU-16 para evitar solicitudes sobre espacios ya asignados; notificación al comerciante (HU-18).
- **Atomicidad:** cambiar el estado y asignar el espacio deben ocurrir juntos. Si falla uno, ninguno se aplica.
- **Concurrencia:** dos gestores resolviendo a la vez, o dos solicitudes sobre el mismo espacio y fechas, nunca deben producir dos asignaciones. Probarlo con peticiones simultáneas.
- **Regla:** una solicitud con requisitos «No cumple» no debería poder aprobarse **[Supuesto: confirmar con el Product Owner]**.

---

### HU-21 - Solicitar como organizador de feria un espacio para una feria agroecológica
**Prioridad:** Should · **Puntos:** 8 · **Rol:** Organizador de feria · **Depende de:** HU-07, HU-15
**Historia:** Como organizador de feria quiero solicitar un espacio para una feria indicando fechas, zona, número de puestos y productos para realizar ferias campesinas y agroecológicas con autorización.

**Funcionalidades**
1. Modelo de evento o feria con sus estados.
2. Validar cruces de agenda y aforo por zona.
3. Sugerir fechas libres para la zona elegida cuando hay conflicto.
4. Adjuntar documentación del evento reutilizando el almacenamiento de documentos.
5. Formulario de solicitud de feria.
6. Selector de zona y fechas que muestra la disponibilidad.

**Criterios de aceptación**
- Dado que soy organizador activo, cuando diligencio nombre, tipo de feria, fechas, zona, número de puestos y productos, entonces se radica una solicitud de evento con su número de radicado.
- Dado que la fecha y zona se cruzan con otro evento aprobado, cuando envío, entonces el sistema informa el conflicto y sugiere fechas libres.
- Dado que el número de puestos supera el aforo de la zona, cuando envío, entonces el sistema me advierte y no radica la solicitud.
- Dado que adjunto la documentación del evento, cuando radico, entonces queda asociada a la solicitud.

**Integración con la aplicación**
- **Consume:** organizador activo (HU-07); catálogo de zonas con aforo y disponibilidad (HU-15, Épica 2); almacenamiento de archivos (HU-17); generador de número de radicado.
- **Produce:** evento en estado Radicado (lo gestiona HU-22).
- **Comparte con HU-22** la detección de cruces: implementarla una sola vez.
- **Seguridad:** solo organizadores activos pueden radicar.

---

### HU-22 - Programar y administrar como gestor municipal el calendario de ferias y eventos
**Prioridad:** Should · **Puntos:** 5 · **Rol:** Gestor municipal · **Depende de:** HU-21
**Historia:** Como gestor municipal quiero ver, aprobar, mover y cancelar las ferias en un calendario por zona para evitar cruces de fechas y espacios.

**Funcionalidades**
1. Consultar la agenda por rango de fechas y detectar cruces.
2. Aprobar y cancelar eventos con **bloqueo y liberación de espacios**.
3. Notificar al organizador por aprobación o cancelación.
4. Calendario mensual y semanal por zona.
5. Acciones de aprobar, mover y cancelar eventos desde el calendario.

**Criterios de aceptación**
- Dado que hay eventos aprobados, cuando abro el calendario mensual o semanal, entonces veo cada uno en su fecha y zona.
- Dado que muevo un evento a una fecha con cruce, cuando guardo, entonces el sistema me advierte el conflicto y no aplica el cambio.
- Dado que apruebo un evento, cuando confirmo, entonces se bloquean la zona y los espacios en esas fechas y el organizador es notificado.
- Dado que cancelo un evento con un motivo, cuando confirmo, entonces se liberan los espacios y el organizador es notificado.

**Integración con la aplicación**
- **Consume:** eventos de HU-21; servicio de notificaciones (HU-18); disponibilidad de espacios.
- **Produce:** bloqueo y liberación de espacios por fechas, que **afecta la disponibilidad** que ven los comerciantes (HU-09, HU-10, HU-16) y que respeta HU-20 al asignar.
- **Atomicidad:** aprobar un evento y bloquear sus espacios ocurre en una sola operación; cancelar y liberar, igual.
- **Punto de montaje:** panel administrativo del gestor (HU-03).
- **Cancelar exige motivo**, que se envía al organizador.

---

### HU-23 - Registrar y gestionar como organizador de feria los vendedores participantes de su feria
**Prioridad:** Could · **Puntos:** 5 · **Rol:** Organizador de feria · **Depende de:** HU-21
**Historia:** Como organizador de feria quiero registrar los vendedores y productos que participarán en mi feria aprobada para cumplir los cupos y las reglas de productos de la zona.

**Funcionalidades**
1. Modelo de participantes de la feria con alta, consulta, edición y baja.
2. Validar que los productos estén permitidos en la zona y que no se supere el cupo aprobado.
3. Formulario y lista de participantes.
4. Enviar el listado final y mostrarlo al gestor.
5. Advertencias claras de cupo y de productos no permitidos.

**Criterios de aceptación**
- Dado que mi feria está aprobada, cuando agrego un vendedor con sus datos y productos, entonces queda en la lista de participantes.
- Dado que un producto no está permitido en la zona, cuando lo agrego, entonces el sistema me advierte y no lo acepta.
- Dado que el número de participantes alcanza el cupo aprobado, cuando intento agregar otro, entonces el sistema lo impide.
- Dado que envío el listado final, cuando el gestor lo consulta, entonces ve los participantes y sus productos.

**Integración con la aplicación**
- **Consume:** evento aprobado (HU-21, HU-22); reglas de productos permitidos por zona (Épica 2); cupo aprobado del evento.
- **Produce:** listado final consultable por el gestor desde su panel.
- **Condición:** solo se pueden agregar participantes a eventos en estado Aprobado.
- **Seguridad:** el organizador solo gestiona los participantes de **sus** ferias.

---

## 8. Orden de implementación sugerido

Respeta las dependencias del backlog. Las tareas de diseño (UX) de cada historia van **antes** de su interfaz.

| Orden | Historia | Motivo |
|---|---|---|
| 1 | Componentes compartidos (sección 5): máquina de estados, generador de radicado, servicio de correo | Los usan varias historias |
| 2 | HU-16 | Origen del flujo; todo lo demás depende de la solicitud |
| 3 | HU-17 | Adjuntos; también habilita HU-21 |
| 4 | HU-18 | Notificaciones, que luego reutilizan HU-19, HU-20 y HU-22 |
| 5 | HU-19 | Revisión del gestor |
| 6 | HU-20 | Resolución y asignación |
| 7 | HU-21 | Ferias (lógica de cruces compartida con HU-22) |
| 8 | HU-22 | Calendario |
| 9 | HU-23 | Participantes (opcional si el tiempo no alcanza) |

Las historias Must (HU-16 a HU-20) forman el flujo principal. Si el tiempo se acaba, recortar primero HU-23 y luego HU-22.

## 9. Definition of Done de cada historia

- Todos los criterios de aceptación de la historia se cumplen y están cubiertos por pruebas.
- Las operaciones del servidor tienen pruebas automáticas y su contrato está documentado.
- La interfaz coincide con el prototipo aprobado y cumple la sección 6.
- El código fue revisado por otra persona e integrado en la rama del equipo.
- No quedan defectos críticos ni altos abiertos.
- Probado en escritorio y celular, con textos en español y sin datos de prueba visibles.
- La funcionalidad está desplegada en el ambiente de pruebas y lista para la revisión del sprint.

## 10. Fuera de alcance de este sprint

- Pagos o cobros por el uso del espacio.
- Firma electrónica o documentos oficiales de resolución.
- Aplicación móvil nativa (solo web responsive).
- Seguimiento en tiempo real con sensores y uso del mapa sin conexión (excluidos de la Épica 2).
- Cualquier historia de las Épicas 4 en adelante.

## 11. Preguntas abiertas para el equipo

Confirmar antes de implementar, porque el backlog no las define:

1. ¿Qué dispara Radicada → En revisión? (¿el gestor abre la solicitud, o es automático?)
2. ¿Qué formatos y tamaño máximo de archivo se permiten?
3. ¿Se puede aprobar una solicitud con requisitos «No cumple»?
4. ¿Cuánto tiempo dura el bloqueo de revisión concurrente sin actividad?
5. ¿Cuáles son los estados exactos de un evento o feria?
6. ¿Qué cuenta como "solicitud activa" para el chequeo de duplicados?
