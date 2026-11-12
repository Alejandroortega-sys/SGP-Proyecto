# Manual de usuario — SGP Tuluá

**Plataforma Web de Gestión del Espacio Público, Ferias Agroecológicas y Comercio Formal/Informal de Tuluá**

**Equipo 6 · Alcaldía Municipal de Tuluá, Valle del Cauca**
**Versión del manual:** noviembre de 2026
**Público:** ciudadanía, comerciantes, organizadores de ferias y gestores municipales que nunca han usado la plataforma.

---

## Índice

1. [Qué es SGP Tuluá](#1-qué-es-sgp-tuluá)
2. [Qué puedes hacer hoy y qué vendrá después](#2-qué-puedes-hacer-hoy-y-qué-vendrá-después)
3. [Cómo entrar a la plataforma](#3-cómo-entrar-a-la-plataforma)
4. [Roles y permisos](#4-roles-y-permisos)
5. [Conceptos clave: zonas, módulos y espacios](#5-conceptos-clave-zonas-módulos-y-espacios)
6. [Las zonas en detalle](#6-las-zonas-en-detalle)
7. [Los módulos del censo en detalle](#7-los-módulos-del-censo-en-detalle)
8. [Los espacios temporales en detalle](#8-los-espacios-temporales-en-detalle)
9. [Diferencias entre zona, módulo y espacio](#9-diferencias-entre-zona-módulo-y-espacio)
10. [El mapa público para ciudadanos](#10-el-mapa-público-para-ciudadanos)
11. [Guía del comerciante](#11-guía-del-comerciante)
12. [Guía del organizador de ferias](#12-guía-del-organizador-de-ferias)
13. [Guía del gestor municipal](#13-guía-del-gestor-municipal)
14. [Flujo completo de la plataforma](#14-flujo-completo-de-la-plataforma)
15. [Restricciones, aforos y limitaciones de comercio](#15-restricciones-aforos-y-limitaciones-de-comercio)
16. [Cómo solicitar el uso de un espacio](#16-cómo-solicitar-el-uso-de-un-espacio)
17. [Estados de la plataforma](#17-estados-de-la-plataforma)
18. [Mensajes de error y qué hacer](#18-mensajes-de-error-y-qué-hacer)
19. [Seguridad y privacidad](#19-seguridad-y-privacidad)
20. [Limitaciones actuales y próximos pasos](#20-limitaciones-actuales-y-próximos-pasos)
21. [Preguntas frecuentes](#21-preguntas-frecuentes)
22. [Anexos: datos de demostración y glosario](#22-anexos-datos-de-demostración-y-glosario)

---

## 1. Qué es SGP Tuluá

SGP Tuluá es una **aplicación web** creada para que la Alcaldía de Tuluá pueda ordenar, de forma clara y digital, el uso del **espacio público** del municipio. La plataforma reúne en un solo lugar:

- un **mapa de zonas** con las reglas de uso del espacio público;
- un **censo** de los módulos, puestos y casetas que ya existen;
- un **catálogo de espacios temporales** que se pueden asignar a comerciantes;
- la **consulta de espacios disponibles** para comerciantes;
- herramientas de **administración municipal**: cuentas, organizaciones, zonas, censo, espacios, bloqueos, importaciones y auditoría.

La idea central es sencilla: **antes de ocupar un lugar, una persona debe saber si puede hacerlo, en qué horario, con qué productos y bajo qué condiciones**. La plataforma organiza esa información y la pone a disposición de la ciudadanía, los comerciantes y los funcionarios.

### 1.1 ¿Qué problema resuelve?

En el espacio público conviven vendedores formales e informales, ferias, eventos y ciudadanos que transitan. Sin información centralizada es difícil saber:

- qué zonas permiten actividad comercial;
- qué zonas están restringidas o saturadas;
- qué puestos ya existen y quién los ocupa;
- qué espacios están libres y en qué fechas;
- qué funcionario tomó cada decisión.

SGP Tuluá responde esas preguntas con datos geográficos (puntos y polígonos), reglas de negocio y un historial de cambios.

### 1.2 ¿Qué significa “espacio público” aquí?

Es el área de la ciudad que pertenece a todos: calles, andenes, plazas, parques, entornos de equipamientos y zonas de uso colectivo. La plataforma no reemplaza las normas municipales ni los trámites presenciales: **las organiza y las hace visibles**.

---

## 2. Qué puedes hacer hoy y qué vendrá después

Es importante entender el estado real de la plataforma para no buscar funciones que todavía no existen.

### 2.1 Funciones disponibles hoy

| Función | Ciudadano | Comerciante | Organizador | Gestor |
|---|---:|---:|---:|---:|
| Consultar el mapa público de zonas | ✅ | ✅ | ✅ | ✅ |
| Ver el detalle de una zona: tipo, horario, aforo y productos | ✅ | ✅ | ✅ | ✅ |
| Registrarse, activar la cuenta e iniciar sesión | — | ✅ | ✅ | Por invitación |
| Editar perfil y cambiar contraseña | — | ✅ | ✅ | ✅ |
| Consultar espacios disponibles en tabla y mapa | — | ✅ | — | ✅ |
| Filtrar espacios por sector, actividad, fecha y horario | — | ✅ | — | ✅ |
| Gestionar zonas, clasificarlas y versionarlas | — | — | — | ✅ |
| Censar módulos y puestos con foto | — | — | — | ✅ |
| Administrar espacios, bloqueos y estados | — | — | — | ✅ |
| Importar zonas (GeoJSON) y módulos (CSV) | — | — | — | ✅ |
| Gestionar organizaciones y cuentas | — | — | — | ✅ |
| Consultar la auditoría | — | — | — | ✅ (solo administrador) |
| Recibir notificaciones internas | — | ✅ | ✅ | ✅ |

### 2.2 Funciones que todavía no están disponibles

Estas funciones están **diseñadas en la base de datos** y aparecen en el plan del proyecto, pero **no tienen pantallas ni endpoints en esta versión**:

- crear y radicar una **solicitud de uso de espacio**;
- revisar, devolver, aprobar o rechazar solicitudes;
- calcular la **factibilidad** desde la interfaz;
- emitir **permisos digitales con QR**;
- registrar **cobros simulados**;
- gestionar **ferias** y vendedores;
- ver el **dashboard analítico** completo.

Por eso, cuando en este manual se explica el flujo de “solicitud → permiso”, se indica claramente qué parte ya existe y qué parte es el flujo previsto para los siguientes sprints.

---

## 3. Cómo entrar a la plataforma

### 3.1 Direcciones de acceso

En un entorno local de desarrollo:

| Servicio | Dirección |
|---|---|
| Aplicación web | `http://localhost:3001` |
| Documentación interactiva de la API | `http://localhost:3000/api/docs` |
| API | `http://localhost:3000` |

En producción, la Alcaldía debe publicar la aplicación en su dominio institucional con HTTPS.

### 3.2 Tipos de cuenta

- **Ciudadano:** no necesita cuenta. Solo abre el mapa público.
- **Comerciante:** se registra, activa su cuenta e inicia sesión.
- **Organizador de feria:** se registra, activa su cuenta y luego registra su organización.
- **Gestor municipal:** no se registra solo; un administrador le crea la cuenta y le envía una contraseña temporal.

### 3.3 Recomendaciones de uso

- Usa un navegador actualizado (Chrome, Edge, Firefox o Safari).
- La plataforma funciona en celular desde **360 px** de ancho y en escritorio.
- Mantén tu correo electrónico actualizado: allí llegan los códigos de activación y los avisos.
- No compartas tu contraseña ni el enlace de invitación de un gestor.

---

## 4. Roles y permisos

### 4.1 Ciudadano o visitante

Puede consultar sin registrarse:

- el mapa de zonas activas;
- la clasificación de cada zona;
- horarios, aforo y productos permitidos;
- la leyenda y las capas del mapa.

No puede ver datos personales de comerciantes, módulos ni espacios.

### 4.2 Comerciante

Es la persona que vende productos o servicios en el espacio público. Puede:

- registrarse y activar su cuenta;
- consultar y editar sus datos personales;
- cambiar su contraseña;
- consultar los espacios temporales disponibles y su ficha;
- recibir notificaciones internas.

En el flujo previsto también podrá radicar solicitudes y recibir permisos con QR.

### 4.3 Organizador de feria

Representa una organización, asociación o fundación que realiza ferias agroecológicas o eventos. Puede:

- registrarse y activar su cuenta;
- registrar **una** organización;
- consultar y editar los datos de su organización;
- ver el estado de validación;
- recibir notificaciones.

En el flujo previsto también podrá solicitar ferias e inscribir vendedores.

### 4.4 Gestor municipal

Es el funcionario de la Alcaldía que administra la plataforma. Existen dos perfiles:

| Perfil | Puede hacer |
|---|---|
| **Revisor** | Consultar cuentas de comerciantes y organizadores, organizaciones, zonas, módulos, espacios e importaciones de módulos. No crea gestores, no cambia estados de cuentas, no valida organizaciones, no crea ni edita zonas y no consulta la auditoría. |
| **Administrador** | Todo lo del revisor y, además, crear gestores, reenviar invitaciones, activar/suspender/inactivar cuentas, validar organizaciones, crear/editar/desactivar zonas y consultar la auditoría. |

> **Regla de oro:** el **revisor consulta**; el **administrador decide y escribe** en los módulos sensibles. En módulos, espacios e importación de módulos, el revisor también puede escribir.

### 4.5 Matriz rápida de permisos

| Acción | Ciudadano | Comerciante | Organizador | Revisor | Administrador |
|---|---:|---:|---:|---:|---:|
| Ver mapa público | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver espacios disponibles | — | ✅ | — | — | — |
| Crear/editar zonas | — | — | — | — | ✅ |
| Consultar zonas e historial | — | — | — | ✅ | ✅ |
| Censar/editar módulos | — | — | — | ✅ | ✅ |
| Administrar espacios | — | — | — | ✅ | ✅ |
| Importar zonas | — | — | — | — | ✅ |
| Importar módulos | — | — | — | ✅ | ✅ |
| Crear gestores | — | — | — | — | ✅ |
| Cambiar estado de cuentas | — | — | — | — | ✅ |
| Validar organizaciones | — | — | — | — | ✅ |
| Ver auditoría | — | — | — | — | ✅ |

---

## 5. Conceptos clave: zonas, módulos y espacios

La plataforma usa tres conceptos que suelen confundirse. Antes de usarla, conviene tenerlos claros.

### 5.1 Zona

Una **zona** es un **polígono** dibujado sobre el mapa que representa un área del espacio público con reglas comunes. Ejemplos: “Centro - Calle 30”, “Plaza Boyacá”, “Entorno Hospital”, “Parque La Guadua”.

Una zona responde preguntas como:

- ¿Se permite actividad comercial aquí?
- ¿En qué horario?
- ¿Cuántas personas o puestos caben?
- ¿Qué productos se permiten?

La zona **no es un puesto físico**: es el “reglamento del área”.

### 5.2 Módulo del censo

Un **módulo** (o puesto censado) es un **punto** que representa un puesto, caseta o módulo que **ya existe** en el espacio público. El municipio lo registra para saber qué hay allí, quién es el titular y en qué condiciones opera.

Un módulo del censo responde:

- ¿Qué puesto existe en este punto?
- ¿Es formal o informal?
- ¿Quién es su titular?
- ¿Qué actividad realiza?
- ¿Tiene foto?
- ¿Está activo o dado de baja?

> **No confundir:** “módulo” también se usa para hablar de los módulos del software (zonas, espacios, importaciones). En este manual, cuando decimos “módulo” sin más, hablamos del **puesto censado**. El contexto técnico se aclara cuando corresponde.

### 5.3 Espacio temporal

Un **espacio temporal** es un **punto asignable** del catálogo municipal: un lugar que puede solicitarse para una actividad temporal. Puede ser un módulo físico, un kiosco, un puesto o un espacio móvil.

Un espacio temporal responde:

- ¿Qué lugar está disponible?
- ¿Qué dimensiones tiene?
- ¿Qué actividad permite?
- ¿En qué horario?
- ¿Está libre, bloqueado, asignado o en mantenimiento?
- ¿A qué zona pertenece y qué restricciones hereda?

### 5.4 La diferencia en una frase

> La **zona** dice **dónde y bajo qué reglas** se puede comerciar; el **módulo** registra **qué puesto ya existe**; el **espacio temporal** es **qué lugar se puede asignar** para una actividad temporal.

---

## 6. Las zonas en detalle

### 6.1 ¿Para qué sirven?

Las zonas son la base de todo el ordenamiento. Sin una zona, la plataforma no sabe si un punto está permitido, restringido o saturado. Las zonas alimentan:

- el mapa público;
- la ficha de los espacios;
- las advertencias del censo de módulos;
- el futuro motor de factibilidad;
- los indicadores de ocupación.

### 6.2 Tipos de zona

| Tipo | Significado para el usuario | Cómo se muestra en el mapa |
|---|---|---|
| **Permitida** | El municipio permite la actividad comercial dentro de las condiciones de la zona (horario, aforo y productos). | Verde, línea sólida. |
| **Restringida** | La actividad está limitada. El censo exige una confirmación explícita y el uso puede requerir autorización especial. | Ámbar, línea discontinua. |
| **Alta congestión** | Es una zona con alta presión comercial o peatonal. Se advierte para evitar saturarla. | Rojo, línea punteada. |

La diferenciación **no depende solo del color**: también cambia el patrón de la línea y la leyenda textual, para que sea accesible.

### 6.3 Datos que guarda una zona

| Dato | Qué significa |
|---|---|
| **Nombre** | Identificación legible. No es único: pueden existir nombres repetidos. |
| **Tipo** | Permitida, restringida o alta congestión. |
| **Geometría** | Polígono cerrado en el mapa. Debe ser válido y no puede superponerse con otra zona activa. |
| **Horario de inicio y fin** | Ventana en la que se permite la actividad. Es opcional. |
| **Aforo máximo** | Número máximo de referencia para la zona. Es opcional. |
| **Productos permitidos** | Lista de productos del catálogo que pueden venderse en la zona. Es opcional. |
| **Activa** | Si está activa aparece en el mapa público; si se desactiva, deja de publicarse, pero se conserva su historia. |

### 6.4 Reglas de las zonas

- El polígono debe tener al menos tres vértices y un área válida.
- No puede cruzarse a sí mismo.
- **No puede superponerse con otra zona activa.**
- Los **bordes compartidos** entre zonas vecinas sí se permiten.
- La validación final la hace la base de datos con PostGIS; el navegador también avisa antes de guardar.
- Cada creación, edición, activación o desactivación genera una **versión** en el historial.
- Desactivar una zona **no borra** sus espacios, módulos, solicitudes, permisos ni ferias históricas.

### 6.5 Ejemplo con los datos de demostración

| Zona | Tipo | Horario | Aforo | Productos permitidos |
|---|---|---|---|---|
| Centro - Calle 30 | Permitida | 06:00–18:00 | 40 | Frutas frescas, Verduras, Ropa y calzado |
| Plaza Boyacá | Alta congestión | 07:00–17:00 | 15 | Artesanías, Comidas rápidas |
| Entorno Hospital | Restringida | Sin horario | 5 | Sin productos configurados |
| Parque La Guadua | Permitida | 06:00–20:00 | 25 | Frutas frescas, Plantas ornamentales, Artesanías |

### 6.6 Cómo se crea una zona (gestor administrador)

1. Entra con una cuenta de gestor **administrador**.
2. Abre **Zonas** en el menú.
3. Pulsa **Crear zona**.
4. Dibuja el polígono sobre el mapa:
   - clic para agregar un vértice;
   - arrastra un vértice para moverlo;
   - clic sobre un vértice para eliminarlo;
   - usa **Deshacer**, **Borrar**, **Cerrar polígono** o **Reabrir forma**.
5. Completa:
   - nombre;
   - tipo;
   - horario (inicio y fin juntos, con el fin posterior al inicio);
   - aforo (entero mayor que cero);
   - productos permitidos (solo productos activos).
6. Guarda. La zona nace activa y aparece de inmediato en el mapa público y en la ficha de los espacios.

### 6.7 Cómo se edita, desactiva y consulta el historial

- **Editar:** cambia atributos, geometría o productos. Se muestra la forma guardada y la nueva como vista previa. Los productos se reemplazan completos si modificas la lista.
- **Desactivar:** pide confirmación. La zona deja de aparecer en el mapa público y no se usará para nuevas solicitudes, pero se conserva para el historial.
- **Historial:** muestra una línea de tiempo con versiones (`v1`, `v2`…), acción, fecha, actor y cambios. Permite comparar geometrías en el mapa.

### 6.8 Catálogo de productos

Los productos son la lista maestra que se usa para configurar las zonas. En la interfaz de zonas se seleccionan solo los productos **activos**.

- El **administrador** y el **revisor** pueden consultar el catálogo.
- Solo un **gestor** puede crear productos o activarlos/desactivarlos mediante la API (`POST /productos`, `PATCH /productos/:id`).
- En la interfaz actual **no hay una pantalla dedicada** para administrar productos: se usan los datos del seed y, para cambios, la documentación interactiva de la API con un token de gestor.
- Un producto inactivo no se ofrece en el formulario de zonas, pero las zonas que ya lo tenían asociado conservan la relación histórica.

---

## 7. Los módulos del censo en detalle

### 7.1 ¿Qué es censar?

Censar es **registrar lo que ya existe**. El municipio recorre el espacio público y documenta cada puesto, caseta o módulo. El censo no autoriza a nadie a vender: es un inventario para la toma de decisiones.

### 7.2 Datos de un módulo

| Dato | Descripción |
|---|---|
| **Código** | Se genera automáticamente (`MOD-0001`, `MOD-0002`…). No se edita. |
| **Ubicación** | Punto exacto sobre el mapa. |
| **Categoría** | `formal` o `informal`. |
| **Titular** | Un comerciante registrado en la plataforma **o** un nombre libre (titular sin cuenta). |
| **Actividad** | Qué vende o qué servicio presta. |
| **Foto** | Imagen opcional del puesto. |
| **Estado** | `activo` o `baja`. La baja es lógica: no borra la fila. |
| **Sector** | Se deriva de la zona activa que contiene el punto. Si está fuera de toda zona, se agrupa como “Sin zona”. |

### 7.3 Reglas del censo

- El punto debe estar dentro de las coordenadas de Tuluá.
- Si el punto cae en una **zona restringida**, la plataforma muestra una advertencia y exige una confirmación explícita antes de guardar.
- Si cae en una **zona de alta congestión**, muestra una advertencia, pero no exige confirmación.
- Si cae **fuera de toda zona activa**, muestra una advertencia de “fuera de zona”.
- La foto es opcional; si se envía, debe ser JPG, PNG o WebP, con un máximo de 5 MB y contenido real validado (no solo la extensión).
- Un módulo dado de baja deja de contar en la ocupación, pero se conserva en el historial.

### 7.4 Diferencia con un espacio temporal

Un módulo del censo **describe un puesto que ya está allí**. Un espacio temporal **describe un lugar que puede asignarse**. Por eso:

- El módulo tiene titular actual.
- El espacio temporal normalmente no tiene titular hasta que se apruebe una solicitud.
- El módulo se usa para ocupación y diagnóstico.
- El espacio se usa para disponibilidad y futuras solicitudes.

> Un espacio temporal puede ser de tipo físico `modulo`, `kiosco`, `puesto` o `espacio_movil`. Ese “tipo” describe el objeto físico, no lo convierte en un registro del censo.

### 7.5 Cómo se censa un módulo (gestor revisor o administrador)

1. Abre **Módulos** en el menú del gestor.
2. Pulsa **Censar módulo**.
3. Haz clic en el mapa para ubicar el punto.
4. La plataforma consulta la zona contenedora y muestra advertencias.
5. Completa categoría, titular (registrado o nombre libre) y actividad.
6. Adjunta una foto si la tienes.
7. Si la zona es restringida, marca la confirmación.
8. Guarda.

### 7.6 Consulta, baja y reactivación

- Listado con filtros por **sector** (derivado de la zona), **categoría**, **estado** y **búsqueda** por código, actividad, titular o correo.
- Ficha con foto, ubicación, restricciones de la zona e historial.
- **Baja lógica:** conserva la fila, deja de contar en la ocupación y queda auditada.
- **Reactivación:** vuelve a estado activo.
- **Historial:** muestra quién cambió qué y cuándo.

---

## 8. Los espacios temporales en detalle

### 8.1 ¿Qué es un espacio temporal?

Es un lugar del catálogo municipal que puede ser solicitado para una actividad temporal. No es una zona (no es un polígono) y no es un módulo del censo (no describe un puesto existente): es un **punto asignable**.

### 8.2 Tipos de espacio

| Tipo | Descripción |
|---|---|
| `modulo` | Módulo físico. |
| `kiosco` | Kiosco. |
| `puesto` | Puesto. |
| `espacio_movil` | Espacio móvil, carrito o estructura desmontable. |

### 8.3 Datos de un espacio

| Dato | Descripción |
|---|---|
| **Nombre** | Identificación legible. |
| **Tipo** | Módulo, kiosco, puesto o espacio móvil. |
| **Sector** | Sector o barrio. Si se deja vacío al crear, se usa el nombre de la zona contenedora. |
| **Dimensiones** | Texto legible, por ejemplo `3 × 2 m`. |
| **Ubicación** | Punto exacto en el mapa. |
| **Zona** | Se detecta automáticamente con la zona activa que contiene el punto. Puede quedar fuera de zona. |
| **Actividad permitida** | Actividad prevista para ese espacio. |
| **Horario** | Horario propio. Si no tiene, hereda el de la zona. |
| **Estado** | Disponible, bloqueado, asignado o mantenimiento. |
| **Asignación manual** | Marca que un gestor lo asignó a mano hasta liberarlo. |

### 8.4 Estados de un espacio

La plataforma distingue dos conceptos:

- **Estado registrado:** lo que dice la fila del espacio (`disponible`, `bloqueado`, `asignado`, `mantenimiento`).
- **Estado efectivo:** lo que resulta de cruzar el estado registrado con la **fecha consultada**, los bloqueos, los permisos vigentes y las solicitudes aprobadas.

| Estado efectivo | Qué significa | Color y símbolo en el mapa |
|---|---|---|
| **Disponible** | Se podrá solicitar cuando el flujo de solicitudes esté habilitado, siempre que la fecha y el horario lo permitan. | Verde, ✓ |
| **Bloqueado** | Tiene un bloqueo por fechas o un motivo administrativo. | Rojo, ! |
| **Asignado** | Está ocupado por un permiso vigente, una solicitud aprobada o una asignación manual. | Azul, • |
| **Mantenimiento** | El gestor lo retiró temporalmente. Prevalece sobre todo lo demás. | Gris, ⚙ |

> Un espacio **asignado** o **bloqueado** nunca aparece como disponible. Si activas “Mostrar no disponibles”, puedes consultarlo con su estado real y su motivo.

### 8.5 Reglas de disponibilidad

1. **Mantenimiento** siempre prevalece.
2. Un **bloqueo activo** en la fecha consultada convierte el espacio en bloqueado.
3. Un **permiso vigente** que cubre la fecha lo convierte en asignado.
4. Una **solicitud aprobada** que cubre la fecha lo convierte en asignado.
5. Si el estado registrado es `bloqueado` o `asignado`, se respeta aunque no haya un registro auxiliar activo.
6. Solo es **disponible** si el estado efectivo es disponible.
7. Si se consulta un rango horario, el espacio debe cubrir ese rango con su horario propio o, si no tiene, con el de su zona.

### 8.6 Bloqueos

Un bloqueo es un rango de fechas en el que un espacio no puede usarse. Ejemplos: mantenimiento de un andén, un evento, una feria, una revisión.

- `fechaFin` debe ser igual o posterior a `fechaInicio`.
- No se puede cruzar con otro bloqueo del mismo espacio.
- No se puede cruzar con un permiso vigente, una solicitud aprobada o una asignación manual activa.
- La base de datos tiene una restricción de exclusión como última barrera.
- Crear, editar o eliminar un bloqueo recalcula el estado del espacio.

### 8.7 Asignación manual y liberación

- El gestor puede **asignar manualmente** un espacio para reservarlo.
- No se puede asignar si está en mantenimiento, bloqueado hoy o ya ocupado por un permiso o solicitud.
- Mientras exista la asignación manual, el estado se conserva.
- **Liberar** quita la asignación y recalcula el estado: si hay un bloqueo vigente, queda bloqueado; si no, disponible.
- No se puede cambiar el estado manual ni crear/editar bloqueos mientras haya una asignación manual; primero hay que liberarla.

### 8.8 Administración de espacios

El gestor puede:

- crear un espacio con nombre, tipo, ubicación, sector, dimensiones, actividad, horario y estado inicial (`disponible` o `mantenimiento`);
- editar sus datos y mover el punto (la zona se recalcula);
- ponerlo en mantenimiento o devolverlo a disponible;
- asignarlo o liberarlo;
- crear, editar y eliminar bloqueos;
- eliminarlo **solo si no tiene permisos ni solicitudes asociadas** (si los tiene, responde `409` y se conserva);
- consultar su historial de auditoría.

### 8.9 Consulta del comerciante

El comerciante entra a **Espacios disponibles** y puede:

- ver la lista en **mapa** o **tabla**;
- activar **“Mostrar no disponibles”**;
- filtrar por sector, actividad, fecha y rango horario;
- abrir la ficha de cada espacio;
- leer dimensiones, horario, zona, restricciones, estado y motivo.

La ficha muestra las restricciones de la zona: tipo, horario, aforo y productos permitidos. Es la información que debe revisar antes de solicitar un espacio.

---

## 9. Diferencias entre zona, módulo y espacio

| Pregunta | Zona | Módulo del censo | Espacio temporal |
|---|---|---|---|
| ¿Qué representa? | Un área con reglas | Un puesto que ya existe | Un lugar asignable |
| ¿Qué forma tiene en el mapa? | Polígono | Punto | Punto |
| ¿Quién lo crea? | Gestor administrador | Gestor revisor o administrador | Gestor revisor o administrador |
| ¿Tiene titular? | No | Sí (registrado o nombre libre) | No hasta que se asigne |
| ¿Tiene horario? | Sí, opcional | No | Sí, opcional (hereda el de la zona) |
| ¿Tiene aforo? | Sí, opcional | No | No propio; la zona puede tenerlo |
| ¿Tiene productos permitidos? | Sí, opcional | No (tiene actividad) | No (tiene actividad permitida) |
| ¿Se puede desactivar? | Sí, baja lógica | Sí, baja lógica | Sí, mantenimiento/bloqueo |
| ¿Sirve para solicitar? | No directamente | No | Sí, en el flujo previsto |
| ¿Aparece en el mapa público? | Sí, si está activa | No | No; solo en la vista del comerciante |

### 9.1 Ejemplo práctico

- **Zona “Centro - Calle 30”**: polígono permitido, horario 06:00–18:00, aforo 40, productos frutas, verduras y ropa.
- **Módulo “MOD-0001”**: puesto de “Frutería La 30” que ya existe en un punto de esa zona, con titular María Gómez.
- **Espacio “Espacio móvil Calle 30 - A”**: punto de 3 × 2 m dentro de la zona, con actividad “Venta de alimentos y frutas”, que puede solicitarse en el flujo previsto.

---

## 10. El mapa público para ciudadanos

### 10.1 Cómo abrirlo

- Desde la página de inicio, pulsa **Mapa** o **Abrir el mapa de zonas**.
- También puedes entrar directamente a `/mapa`.
- **No necesitas cuenta.**

### 10.2 Qué muestra

- Polígonos de las zonas **activas**.
- Colores y patrones por tipo.
- Leyenda con conteos por tipo.
- Checkboxes para mostrar u ocultar cada tipo de zona.
- Al tocar un polígono, una ficha con:
  - nombre;
  - tipo;
  - horario (“06:00 a 18:00”, “Desde…”, “Hasta…”, “Sin horario definido”);
  - aforo (“40 personas” o “Sin aforo definido”);
  - productos permitidos.

### 10.3 Botón “Mi ubicación”

Centra el mapa en tu posición y muestra un marcador con un círculo de precisión. Si el navegador no lo permite, si tardas demasiado o si estás fuera de Tuluá (radio aproximado de 15 km desde el centro), aparece un mensaje claro.

### 10.4 Qué no muestra el mapa público

- No muestra los módulos del censo.
- No muestra los espacios temporales.
- No muestra datos personales.
- No permite solicitar espacios.

Para ver espacios, el comerciante debe iniciar sesión.

### 10.5 Consejos de lectura

- **Verde sólido:** zona permitida; revisa igualmente horario, aforo y productos.
- **Ámbar discontinuo:** zona restringida; puede requerir autorización o justificación.
- **Rojo punteado:** alta congestión; evita saturarla y revisa las condiciones.
- La ausencia de polígono no significa automáticamente que el lugar sea libre: puede estar fuera de zona o pendiente de reglamentación.

---

## 11. Guía del comerciante

### 11.1 Crear la cuenta

1. Abre `/registro` y elige **Comerciante**.
2. Completa:
   - nombres y apellidos;
   - tipo de documento (CC, CE, TI, PP o NIT);
   - número de documento;
   - teléfono;
   - correo electrónico;
   - contraseña y confirmación (mínimo 8 caracteres, al menos un número);
   - actividad comercial;
   - categoría (formal o informal).
3. Acepta y envía. La cuenta queda en **“Pendiente de activación”**.
4. Recibirás un **código de 6 dígitos** en el correo. En desarrollo, si no hay servidor de correo configurado, el código aparece en la consola del backend.

### 11.2 Activar la cuenta

1. Abre `/activar`.
2. Ingresa el correo y el código de 6 dígitos.
3. El código dura **15 minutos**. Si expiró, usa **Reenviar código**.
4. Al activar, la cuenta pasa a **Activa** y ya puedes iniciar sesión.

### 11.3 Iniciar sesión

1. Abre `/login`.
2. Ingresa correo y contraseña.
3. Si la cuenta está pendiente, suspendida o inactiva, verás un mensaje explicativo.
4. Si fallas 5 veces, la cuenta se bloquea temporalmente y verás los minutos restantes.
5. Al entrar, el sistema te lleva a `/comerciante/inicio`.

### 11.4 Tu página de inicio

Muestra:

- estado de la cuenta;
- correo y fecha de registro;
- tu actividad comercial y categoría;
- accesos rápidos para consultar espacios, editar datos, cambiar contraseña y revisar notificaciones;
- un aviso de “Próximamente” con las solicitudes, ferias, permisos QR y cobros.

### 11.5 Tu perfil

En `/comerciante/perfil` puedes:

- editar **nombre**, **apellido** y **teléfono**;
- cambiar tu contraseña (se envía un aviso al correo);
- consultar tu documento, tipo de documento, actividad y categoría.

**No puedes cambiar** el documento, el tipo de documento, la actividad comercial, la categoría, el correo ni el estado. Si necesitas corregirlos, contacta a la Secretaría de Gobierno; un gestor puede hacerlo.

### 11.6 Consultar espacios disponibles

Ruta: `/comerciante/espacios`.

1. Inicia sesión como comerciante.
2. En el menú, pulsa **Espacios**.
3. Elige la vista **Mapa** o **Tabla**.
4. Usa los filtros:
   - **Sector**;
   - **Actividad**;
   - **Fecha**;
   - **Hora de inicio** y **hora de fin** (deben ir juntas y con fecha).
5. Pulsa **Aplicar filtros**.
6. Si no hay resultados, pulsa **Limpiar filtros** o amplía la búsqueda.
7. Activa **“Mostrar no disponibles”** si quieres ver bloqueados, asignados o en mantenimiento.
8. Haz clic en un marcador o en “Ver ficha” para abrir el detalle.

### 11.7 Cómo leer la ficha del espacio

La ficha muestra:

- nombre, tipo y sector;
- dimensiones;
- actividad permitida;
- horario;
- zona contenedora y su tipo;
- horario, aforo y productos permitidos de la zona;
- estado registrado y estado efectivo;
- motivo si no está disponible;
- bloqueo o permiso vigente, si existe;
- fecha de creación.

En escritorio se abre como panel lateral; en celular, como hoja inferior. Puedes cerrarla con `Escape` o con el botón de cierre.

### 11.8 Qué significa cada estado en la consulta

| Estado | Qué debes hacer |
|---|---|
| **Disponible** | Puedes revisar la ficha y, cuando el flujo de solicitudes esté habilitado, iniciar el trámite. |
| **Bloqueado** | No está disponible en esas fechas. Lee el motivo y prueba otra fecha o espacio. |
| **Asignado** | Ya está ocupado por un permiso, una solicitud aprobada o una asignación manual. |
| **Mantenimiento** | El municipio lo retiró temporalmente. No se puede usar hasta que vuelva a disponible. |

### 11.9 Lo que todavía no puedes hacer

En esta versión **no existe el botón “Solicitar”** ni el formulario de solicitud. La plataforma solo permite **consultar** espacios. La solicitud formal, la carga de documentos, la revisión, la aprobación y el permiso con QR llegarán en los siguientes sprints.

Si necesitas pedir un espacio hoy, debes hacerlo por el canal presencial o el correo que indique la Alcaldía. La plataforma te sirve para **llegar informado**: saber qué espacio existe, en qué zona está y qué restricciones tiene.

### 11.10 Recuperar la contraseña

1. En `/login`, pulsa **¿Olvidaste tu contraseña?**.
2. Ingresa tu correo.
3. Recibirás un código de recuperación (vigencia corta, 2 minutos por defecto).
4. Abre `/restablecer`, ingresa el código y define la nueva contraseña.
5. Inicia sesión con la nueva contraseña.

---

## 12. Guía del organizador de ferias

### 12.1 Crear la cuenta

1. Abre `/registro` y elige **Organizador de feria**.
2. Completa los datos personales (los mismos del comerciante, **sin** actividad comercial ni categoría).
3. Activa la cuenta con el código de 6 dígitos.

### 12.2 Registrar la organización

Después de activar la cuenta e iniciar sesión:

1. Abre `/organizador/mi-organizacion`.
2. Completa:
   - nombre de la organización;
   - NIT;
   - representante;
   - tipo de feria;
   - contacto.
3. Guarda. La organización queda en **“Pendiente de validación”**.

Cada organizador puede registrar **una sola organización**.

### 12.3 Estados de la organización

| Estado | Significado |
|---|---|
| **Pendiente de validación** | La Alcaldía aún no la ha revisado. |
| **Activa** | La organización fue validada y puede operar en la plataforma. |
| **Suspendida** | La organización fue suspendida o rechazada; revisa el motivo o contacta a la Alcaldía. |

### 12.4 Editar la organización

Puedes actualizar nombre, NIT, representante, tipo de feria y contacto. No puedes cambiar el estado ni los campos de validación: eso corresponde al gestor.

### 12.5 Ferias

El módulo de ferias, el calendario y la inscripción de vendedores **todavía no están implementados**. Cuando estén disponibles, el organizador con organización activa podrá radicar una feria con zona, fechas, número de puestos y productos, y el sistema evitará cruces de fecha y zona.

---

## 13. Guía del gestor municipal

### 13.1 Acceso y primer inicio de sesión

Un gestor no se registra solo. Un administrador lo crea y le envía una contraseña temporal.

1. Recibe el correo con la contraseña temporal.
2. Entra a `/login` con tu correo institucional y esa contraseña.
3. El sistema te pedirá cambiarla. Abre `/primer-acceso`.
4. Ingresa la contraseña temporal, la nueva y su confirmación.
5. Al guardar, la cuenta pasa a **Activa** y entras al panel.

La contraseña debe tener entre 8 y 128 caracteres y al menos un número.

### 13.2 Panel

En `/gestor/panel` verás:

- tus datos y perfil (revisor o administrador);
- totales de usuarios por estado y por rol;
- totales de solicitudes por estado;
- totales de permisos por estado;
- totales de ferias por estado.

> Los indicadores de solicitudes, permisos y ferias se alimentan de la base de datos. En la demostración verás cifras del seed aunque esas pantallas todavía no existan. No interpretes esos números como trámites que puedas gestionar en esta versión.

### 13.3 Mi perfil

En `/gestor/perfil` puedes:

- ver tus datos, correo, perfil y estado;
- editar nombre, apellido y teléfono;
- cambiar tu contraseña.

El correo, el perfil y el estado no se cambian desde ahí.

### 13.4 Gestión de cuentas

En `/gestor/usuarios`:

- busca por nombre, apellido, correo, documento, actividad u organización;
- filtra por rol, estado y, si eres administrador, por perfil de gestor;
- abre el detalle de una cuenta.

El detalle muestra:

- datos personales;
- perfil comercial, organización o perfil de gestor según el rol;
- solicitudes y permisos asociados (datos del seed mientras el flujo no esté activo);
- totales.

**Administrador:**

- puede crear gestores;
- puede reenviar la invitación a un gestor pendiente;
- puede activar, suspender o inactivar cuentas;
- puede corregir documento, tipo de documento, actividad y categoría de un comerciante.

Reglas importantes:

- No puedes cambiar el estado de tu propia cuenta.
- No puedes dejar el sistema sin administradores activos.
- Un gestor en “pendiente de activación” debe completar el primer acceso antes de que se le cambie el estado.
- Al activar una cuenta se limpian los intentos fallidos y el bloqueo.
- Al suspender o inactivar puedes escribir un motivo; se envía al titular.

### 13.5 Crear un gestor

1. Abre `/gestor/gestores/nuevo` (solo administrador).
2. Completa nombre, apellido, correo institucional y perfil (revisor o administrador).
3. Guarda. La cuenta nace pendiente y recibe una contraseña temporal.
4. Si el correo falla, la cuenta queda creada; usa **Reenviar invitación** desde el detalle.

### 13.6 Organizaciones

En `/gestor/organizaciones`:

- lista y busca organizaciones;
- filtra por estado;
- abre el detalle;
- el administrador puede activar o suspender.

Solo aparecen organizadores que ya registraron su organización. No existe el estado “rechazada”: un rechazo se representa como **suspendida**.

### 13.7 Zonas

Ruta: `/gestor/zonas`.

- **Listado:** filtros por tipo, estado y nombre; paginación; columnas de zona, tipo, horario, aforo, espacios, módulos, estado y acciones.
- **Crear:** solo administrador.
- **Editar:** administrador escribe; revisor consulta.
- **Historial:** ambos perfiles.
- **Desactivar:** baja lógica con confirmación.

Para el paso a paso de dibujo, clasificación y restricciones, revisa la sección 6.

### 13.8 Censo de módulos

Ruta: `/gestor/modulos`.

- Listado con filtros por sector derivado de la zona (incluye “Sin zona”), categoría, estado y búsqueda.
- Formulario con punto en Leaflet, categoría, titular, actividad y foto.
- Advertencia y confirmación en zona restringida.
- Ficha con foto, zona, restricciones, baja/reactivación e historial.

Revisor y administrador pueden censar, editar y dar de baja.

### 13.9 Espacios temporales

Ruta: `/gestor/espacios`.

- **Listado:** búsqueda, tipo, estado, sector, zona, asignación manual y paginación.
- **Crear:** punto en el mapa, detección automática de zona, tipo, sector, dimensiones, actividad, horario y estado inicial.
- **Ficha:** estado registrado y efectivo, asignación manual, liberación, mantenimiento, borrado condicionado, bloqueos e historial.
- **Editar:** datos, ubicación, horario y estado manual.
- **Bloqueos:** calendario mensual para crear, editar y eliminar rangos de fechas.
- **Eliminar:** solo si no hay permisos ni solicitudes.

Para el detalle de estados, bloqueos y asignación manual, revisa la sección 8.

### 13.10 Importaciones

Ruta: `/gestor/importaciones`.

**Zonas (GeoJSON)** — solo administrador:

1. Selecciona el archivo `.geojson` o `.json`.
2. Indica el SRID de origen si hace falta (WGS84, Web Mercator, MAGNA-SIRGAS u otro EPSG).
3. Previsualiza: resumen, mapa y filas válidas/rechazadas.
4. Confirma.
5. Descarga el reporte de errores si hubo filas rechazadas.

**Módulos (CSV)** — revisor y administrador:

1. Descarga la plantilla.
2. Completa una fila por módulo: `categoria`, `actividad`, `latitud`, `longitud` y exactamente uno de `titular_documento` o `titular_nombre`.
3. Carga el archivo `.csv`.
4. Previsualiza y revisa errores por fila.
5. Si hay filas en zona restringida, marca la casilla global para aceptarlas.
6. Confirma. Las filas válidas se importan y las demás quedan en el reporte.

La confirmación es idempotente: repetirla no duplica lo ya importado. La base de datos vuelve a validar cada fila.

### 13.11 Productos

El catálogo de productos se consulta en la interfaz al configurar zonas. La creación y el cambio de estado están disponibles por API para gestores; no hay una pantalla dedicada en esta versión. Si necesitas administrar productos, usa Swagger (`/api/docs`) con un token de gestor.

### 13.12 Auditoría

Ruta: `/gestor/auditoria` (solo administrador).

- Filtra por tabla, registro, acción, página y límite.
- Muestra actor, fecha y valores anterior/nuevo.
- Los campos sensibles (`password_hash`, `token_hash`, `qr_token`) se eliminan antes de responder.

### 13.13 Notificaciones

Ruta: `/notificaciones`.

- Bandeja compartida por todos los roles.
- Cada usuario ve solo sus notificaciones.
- Puedes marcar una como leída o marcar todas.
- El contador del menú se actualiza al navegar.

---

## 14. Flujo completo de la plataforma

### 14.1 Flujo operativo actual

Este es el flujo que **hoy funciona**:

```text
1. El administrador crea una zona
   └─ Define polígono, tipo, horario, aforo y productos permitidos.

2. La zona se publica en el mapa
   └─ GET /zonas/geojson → /mapa (ciudadano) y ficha de espacios (comerciante).

3. El gestor crea espacios dentro de la zona
   └─ El sistema detecta la zona contenedora y guarda el punto.

4. El gestor puede bloquear, asignar o poner en mantenimiento un espacio.

5. El comerciante se registra y activa su cuenta.

6. El comerciante consulta espacios
   └─ Filtra por sector, actividad, fecha y horario.
   └─ Abre la ficha y revisa restricciones.

7. El comerciante NO puede solicitar todavía
   └─ El botón y el formulario llegan en el Sprint 3.

8. En paralelo, el gestor censa módulos
   └─ Registra los puestos que ya existen, con foto y advertencias.
```

### 14.2 Flujo previsto de solicitud y permiso

Este es el flujo **diseñado** para los siguientes sprints. La base de datos y los datos de prueba ya lo contemplan, pero la API y la interfaz todavía no lo exponen.

```text
Comerciante
   │
   ├─ 1. Elige un espacio disponible y una fecha/horario
   │
   ├─ 2. Completa actividad, productos y datos del trámite
   │
   ├─ 3. Adjunta documentos (RUT, cámara de comercio, etc.)
   │
   ├─ 4. Guarda borrador o radica la solicitud
   │       └─ Número automático: SOL-2026-#####
   │
   ▼
Gestor revisor
   │
   ├─ 5. Revisa documentos
   │       ├─ Puede devolver con observaciones (documento corregido)
   │       └─ Puede continuar la revisión
   │
   ├─ 6. Evalúa factibilidad
   │       ├─ Distancia mínima entre puestos
   │       ├─ Producto permitido en la zona
   │       └─ Aforo del cuadrante/zona
   │
   ├─ 7. Decide
   │       ├─ Rechaza con motivo
   │       ├─ Aprueba
   │       └─ Aprueba con excepción justificada si era no factible
   │
   ▼
Sistema / Gestor
   │
   ├─ 8. Emite el permiso PER-2026-#####
   │       └─ Carné digital con QR único
   │
   ├─ 9. Genera el cobro simulado
   │       └─ Estado pendiente → pagado + recibo
   │
   ▼
Comerciante
   │
   ├─ 10. Consulta y descarga su permiso
   │
   └─ 11. Usa el espacio en la vigencia autorizada
           ├─ Renovación
           ├─ Suspensión con motivo
           └─ Revocación con motivo

Ciudadano
   │
   └─ 12. Escanea el QR y verifica validez y vigencia
           (sin ver documentos ni datos sensibles)
```

### 14.3 Qué significa “se solicita y se crea el permiso”

En el flujo previsto:

1. La **solicitud** es la petición del comerciante. Tiene un número de radicado y un estado.
2. La **evaluación de factibilidad** es el análisis técnico de las reglas urbanas.
3. La **aprobación** es la decisión del gestor.
4. El **permiso** es el documento digital que autoriza el uso. Se crea **solo después** de una solicitud aprobada.
5. El **QR** permite que cualquier ciudadano verifique que el permiso es válido, sin exponer datos personales.
6. El **cobro** es simulado: no hay pasarela de pago real.

En la versión actual, los pasos 1 a 12 del flujo previsto **no están disponibles en la interfaz**. Solo existen las tablas, los estados y algunos datos de ejemplo.

### 14.4 Ejemplo de ciclo completo (cuando esté habilitado)

María Gómez quiere vender frutas en el Centro:

1. Consulta el espacio “Espacio móvil Calle 30 - A”.
2. Revisa que la zona “Centro - Calle 30” permite frutas y verduras, y que el horario es 06:00–18:00.
3. Solicita el espacio del 1 al 30 de noviembre, de 06:00 a 14:00.
4. Adjunta su RUT.
5. La solicitud queda radicada como `SOL-2026-00001`.
6. El revisor revisa los documentos y el motor confirma que hay distancia suficiente, producto permitido y aforo disponible.
7. El gestor aprueba.
8. Se emite el permiso `PER-2026-00001` con QR.
9. Se genera un cobro simulado de $50.000 y se marca como pagado.
10. María descarga su carné.
11. Un ciudadano escanea el QR y ve que el permiso está vigente.
12. Si María incumple el horario, el gestor puede suspender el permiso con un motivo; luego puede reactivarlo o revocarlo.

---

## 15. Restricciones, aforos y limitaciones de comercio

### 15.1 Las restricciones viven en la zona

La zona es el “reglamento” del área. Allí se configuran:

- **Tipo de zona:** permitida, restringida o alta congestión.
- **Horario:** desde y hasta qué hora se permite la actividad.
- **Aforo máximo:** cuántos puestos o personas se consideran el límite de referencia.
- **Productos permitidos:** qué productos pueden venderse.

### 15.2 Cómo se interpreta cada restricción

| Restricción | Dónde se configura | Dónde se ve | Qué efecto tiene hoy |
|---|---|---|---|
| Tipo de zona | Editor de zonas | Mapa público y ficha de espacio | Cambia el color/patrón y genera advertencias en el censo. |
| Horario de zona | Editor de zonas | Mapa y ficha | Se muestra; el espacio puede heredarlo. |
| Aforo de zona | Editor de zonas | Ficha de zona/espacio | Se muestra y alimenta el motor de factibilidad de la BD. |
| Productos permitidos | Editor de zonas + catálogo | Ficha de zona/espacio | Se muestran; el motor de factibilidad los usa. |
| Actividad permitida del espacio | Formulario de espacio | Ficha del espacio | Orienta al comerciante; no bloquea por sí sola. |
| Bloqueo del espacio | Gestión de bloqueos | Ficha y consulta | Impide el uso en esas fechas. |
| Mantenimiento | Ficha del espacio | Consulta | Impide el uso hasta retirarlo. |
| Asignación manual | Ficha del espacio | Consulta | Reserva el espacio hasta liberarlo. |

### 15.3 Qué se valida automáticamente hoy

| Regla | ¿Se valida? | Dónde |
|---|---|---|
| Polígono de zona válido y sin solapes | Sí | Base de datos (PostGIS) + navegador |
| Horario de zona coherente | Sí | Backend |
| Productos existentes y activos al asociarlos a una zona | Sí | Backend |
| Zona restringida en el censo | Sí, con confirmación | Backend |
| Foto válida (tipo, firma y tamaño) | Sí | Backend |
| Bloqueos sin solapes | Sí | Backend + restricción de BD |
| Bloqueo contra permiso/solicitud/asignación | Sí | Backend |
| Asignación manual contra mantenimiento/bloqueo/ocupación | Sí | Backend |
| Disponibilidad efectiva por fecha/horario | Sí | Backend |
| Aforo máximo al crear módulos/espacios | No | Solo se registra y se usa en el motor previsto |
| Producto permitido al crear módulos/espacios | No | Solo se muestra y se usa en el motor previsto |
| Zona permitida como requisito para censar | No | Solo se advierte; en restringida se pide confirmación |
| Solicitud de espacio | No implementada | Sprint 3 |

> Es importante no confundir “registrado” con “autorizado”. Que un módulo o un espacio exista en la plataforma no significa que una persona tenga permiso para vender. El permiso formal llega con el flujo de solicitudes.

### 15.4 El motor de factibilidad (diseñado)

La base de datos ya contiene una función que evalúa tres reglas:

1. **Distancia mínima entre puestos:** compara el punto con los módulos activos del censo. El parámetro por defecto es **5 metros**.
2. **Producto permitido en la zona:** verifica que el producto esté asociado a la zona que contiene el punto.
3. **Aforo del cuadrante/zona:** cuenta los módulos activos dentro de la zona y los compara con el aforo máximo de la zona o, si no tiene, con el parámetro global de **40 puestos**.

Si el punto no está en ninguna zona activa, el motor marca el producto y el aforo como no factibles.

Parámetros del motor:

| Parámetro | Valor por defecto | Significado |
|---|---:|---|
| `distancia_minima` | 5 m | Distancia mínima entre puestos activos. |
| `aforo_cuadrante_defecto` | 40 | Aforo cuando la zona no define uno propio. |
| `umbral_alerta` | 80 % | Porcentaje de ocupación que genera una alerta de saturación. |

También existe una función de **alternativas** que busca espacios disponibles en un radio de 500 m que cumplan todas las reglas.

> **Estado actual:** el motor existe en PostgreSQL y se usa en los datos de prueba y en las vistas del dashboard, pero **no está expuesto en la API ni en la interfaz**. No verás un botón “Simular factibilidad” en esta versión.

### 15.5 Aforos: cómo leerlos

- El aforo de la zona es un **límite de referencia**, no un contador en tiempo real.
- La plataforma no tiene sensores ni IoT: no mide personas.
- La ocupación se calcula con los módulos activos censados dentro de la zona.
- El aforo se usa en el motor de factibilidad y en los indicadores de ocupación.
- Un aforo de 15 en Plaza Boyacá no impide crear un módulo desde la interfaz actual, pero el motor lo marcará como no factible si se supera.

### 15.6 Limitaciones por tipo de comercio

- La **categoría** del módulo (formal/informal) describe su situación, no autoriza la venta.
- Los **productos permitidos** son una lista positiva: lo que no está en la lista no debería venderse en esa zona.
- La **actividad permitida** del espacio es una orientación; el detalle definitivo se valida en la solicitud.
- Las zonas **restringidas** requieren atención especial: pueden tener condiciones adicionales que la Alcaldía evalúa caso a caso.
- Las zonas de **alta congestión** buscan evitar la saturación; el motor puede rechazar nuevas ubicaciones.

### 15.7 Consejos prácticos para el comerciante

1. Revisa la zona del espacio antes de ilusionarte con él.
2. Verifica que tu producto esté en la lista de productos permitidos.
3. Verifica que tu horario quepa dentro del horario de la zona.
4. Revisa el aforo: si la zona está cerca del límite, puede que no sea factible.
5. Consulta la fecha: un espacio puede estar disponible hoy y bloqueado en la fecha que necesitas.
6. Si el espacio está en una zona restringida, prepara la justificación o autorización que corresponda.

---

## 16. Cómo solicitar el uso de un espacio

Esta sección responde a dos preguntas distintas:

- **¿Qué puedo hacer hoy?**
- **¿Cómo será el flujo completo cuando esté habilitado?**

### 16.1 Lo que puedes hacer hoy (versión actual)

1. **Crea tu cuenta de comerciante** en `/registro/comerciante`.
2. **Activa** la cuenta con el código de 6 dígitos.
3. **Inicia sesión** en `/login`.
4. **Completa tu perfil** y verifica que tus datos sean correctos.
5. Abre **Espacios** en el menú del comerciante.
6. Filtra por sector, actividad, fecha y horario.
7. Abre la ficha del espacio que te interese.
8. Revisa:
   - dimensiones;
   - actividad permitida;
   - horario;
   - zona;
   - restricciones (tipo, aforo, productos);
   - estado y motivo.
9. Si el espacio está disponible, **anota su nombre y ubicación**.
10. **No existe todavía un botón para solicitar**. Debes usar el canal presencial o el correo que indique la Alcaldía.

> La plataforma ya te permite llegar al trámite con la información correcta, pero el trámite digital como tal pertenece al Sprint 3.

### 16.2 El flujo completo previsto (Sprints 3 a 5)

Cuando el módulo de solicitudes esté implementado, el flujo será:

#### Paso 1. Elegir el espacio y la fecha

- Desde la tabla o la ficha, pulsa **Solicitar**.
- Selecciona la fecha de inicio y fin.
- Selecciona la hora de inicio y fin.
- El sistema valida que el espacio esté disponible y que el rango quepa en su horario.

#### Paso 2. Completar la actividad y los productos

- Describe la actividad.
- Selecciona los productos que vas a vender.
- El sistema compara con los productos permitidos por la zona.

#### Paso 3. Adjuntar documentos

- Documentos típicos: RUT, cámara de comercio, identificación, autorizaciones.
- Cada documento queda en estado **pendiente**. El revisor puede validarlo u observarlo.
- Si un documento se observa, puedes cargar una versión corregida (queda enlazada a la anterior).

#### Paso 4. Guardar borrador o radicar

- Puedes guardar un **borrador** y continuar después.
- Al radicar, la solicitud recibe un número `SOL-2026-#####` y pasa a **radicada**.

#### Paso 5. Revisión

El gestor revisor puede:

- pasar a **en revisión**;
- **devolver** con observaciones para que corrijas;
- **rechazar** con un motivo obligatorio;
- **aprobar**.

#### Paso 6. Factibilidad

Antes de aprobar, el sistema evalúa:

- distancia mínima entre puestos;
- producto permitido en la zona;
- aforo disponible.

Si el resultado es **no factible**, el gestor solo puede aprobar con una **excepción justificada** por escrito. Esa excepción queda registrada.

#### Paso 7. Permiso

Con la solicitud aprobada, se crea el permiso:

- número `PER-2026-#####`;
- titular;
- espacio;
- vigencia;
- categoría autorizada;
- **QR único e impredecible**;
- estado **vigente**.

#### Paso 8. Cobro simulado

- Se calcula una tarifa según la zona y el tipo de actividad.
- El cobro queda **pendiente**.
- Se registra un pago **simulado** y el cobro pasa a **pagado**.
- Se genera un recibo descargable.
- **No se piden datos de tarjeta ni se usa una pasarela real.**

#### Paso 9. Uso y seguimiento

- El comerciante descarga su carné digital.
- El permiso puede renovarse, suspenderse o revocarse.
- Suspender o revocar exige un motivo y queda en el historial.
- El permiso vence al terminar la vigencia.

#### Paso 10. Verificación ciudadana

- Cualquier ciudadano escanea el QR.
- La plataforma responde si el permiso es válido, está vencido o no existe.
- No muestra documentos, teléfono, correo ni datos sensibles.

### 16.3 Diagrama de estados de la solicitud

```text
borrador
   │ radicar
   ▼
radicada ──► en_revision ──► devuelta ──► en_revision
   │              │
   │              ├──► aprobada ──► permiso
   │              └──► rechazada
   └──► cancelada
```

### 16.4 Diagrama de estados del permiso

```text
vigente ──► suspendido ──► vigente
   │
   ├──► revocado
   └──► vencido (por fecha)
```

### 16.5 Qué necesitas tener listo

- Cuenta de comerciante activa.
- Datos personales y comerciales correctos.
- Documentos digitales vigentes.
- Claridad sobre la actividad y los productos.
- Fecha y horario deseados.
- Conocimiento de la zona y sus restricciones.

---

## 17. Estados de la plataforma

### 17.1 Cuenta de usuario

| Estado | Significado |
|---|---|
| `pendiente_activacion` | La cuenta se creó, pero falta el código de activación. |
| `activa` | Puede iniciar sesión y usar la plataforma. |
| `suspendida` | La Alcaldía la suspendió; no puede iniciar sesión. |
| `inactiva` | La Alcaldía la desactivó; no puede iniciar sesión. |

### 17.2 Organización

| Estado | Significado |
|---|---|
| `pendiente_validacion` | Esperando revisión del gestor. |
| `activa` | Validada. |
| `suspendida` | Suspendida o rechazada. |

### 17.3 Zona

| Estado | Significado |
|---|---|
| `activa` | Se publica en el mapa y se usa para nuevas solicitudes. |
| `inactiva` | No se publica; se conserva para el historial. |

### 17.4 Módulo del censo

| Estado | Significado |
|---|---|
| `activo` | Cuenta en la ocupación y aparece en el listado. |
| `baja` | Se conserva, pero no cuenta en la ocupación. |

### 17.5 Espacio temporal

| Estado | Significado |
|---|---|
| `disponible` | Libre para el flujo de solicitudes. |
| `bloqueado` | No disponible por fechas o decisión administrativa. |
| `asignado` | Ocupado por permiso, solicitud aprobada o asignación manual. |
| `mantenimiento` | Retirado temporalmente; prevalece sobre todo. |

### 17.6 Solicitud (flujo previsto)

| Estado | Significado |
|---|---|
| `borrador` | Guardada sin radicar. |
| `radicada` | Enviada con número de radicado. |
| `en_revision` | El gestor la está revisando. |
| `devuelta` | Requiere correcciones del comerciante. |
| `aprobada` | Aprobada; puede generar permiso. |
| `rechazada` | Rechazada con motivo. |
| `cancelada` | Cancelada por el comerciante o la administración. |

### 17.7 Documento (flujo previsto)

| Estado | Significado |
|---|---|
| `pendiente` | Cargado, sin revisar. |
| `validado` | Revisado y aceptado. |
| `observado` | Requiere corrección. |

### 17.8 Permiso (flujo previsto)

| Estado | Significado |
|---|---|
| `vigente` | Autorización activa dentro de las fechas. |
| `suspendido` | Temporalmente sin efecto, con motivo. |
| `revocado` | Sin efecto de forma definitiva, con motivo. |
| `vencido` | Pasó la fecha de vigencia. |

### 17.9 Feria (flujo previsto)

| Estado | Significado |
|---|---|
| `radicada` | Solicitud de feria enviada. |
| `aprobada` | Aprobada. |
| `rechazada` | Rechazada. |
| `cancelada` | Cancelada. |
| `realizada` | Ya se realizó. |

### 17.10 Cobro (flujo previsto)

| Estado | Significado |
|---|---|
| `pendiente` | Generado, sin pago. |
| `pagado` | Pago simulado registrado. |
| `anulado` | Cobro anulado. |

---

## 18. Mensajes de error y qué hacer

| Código | Qué significa | Qué hacer |
|---|---|---|
| `400` | Datos inválidos o regla de negocio incumplida. | Revisa los campos marcados y corrige. |
| `401` | No hay sesión o el token expiró. | Inicia sesión de nuevo. |
| `403` | Tu rol no tiene permiso o la cuenta no está activa. | Verifica tu rol; si la cuenta está suspendida, contacta a la Alcaldía. |
| `404` | El recurso no existe. | Vuelve al listado o actualiza la página. |
| `409` | Duplicado, estado repetido, solape o conflicto. | Revisa el mensaje y corrige; puede que el registro ya exista. |
| `413` | El archivo es demasiado grande. | Reduce el tamaño (foto máximo 5 MB; importación máximo 10 MB). |
| `422` | La base de datos rechazó una regla: geometría inválida, solape, zona restringida sin confirmación, etc. | Lee el mensaje y corrige la geometría o confirma la advertencia. |
| `423` | Cuenta bloqueada por intentos fallidos. | Espera los minutos indicados o recupera la contraseña. |
| `429` | Demasiadas peticiones por minuto. | Espera el tiempo indicado (`Retry-After`). |
| `503` | Base de datos o correo no disponible. | Reintenta más tarde; si persiste, contacta a soporte. |

### 18.1 Problemas frecuentes

**No me llega el código de activación.**
- Revisa la carpeta de spam.
- En desarrollo, el código aparece en la consola del backend.
- Usa **Reenviar código**.
- Verifica que el correo esté bien escrito.

**Mi cuenta está bloqueada.**
- Espera los minutos indicados (el bloqueo se produce tras 5 intentos fallidos y dura 15 minutos por defecto).
- Usa la recuperación de contraseña si no recuerdas la clave.

**No veo el espacio que quiero.**
- Puede estar bloqueado, asignado o en mantenimiento. Activa **“Mostrar no disponibles”**.
- Puede no cumplir el filtro de fecha, horario, sector o actividad.
- Puede estar fuera de la zona que estás consultando.

**El mapa no muestra una zona.**
- La zona puede estar inactiva.
- Puede haber un error de red; pulsa **Reintentar**.
- Puede que el polígono no se haya guardado por un solape.

**No puedo guardar una zona.**
- Revisa que el polígono tenga al menos tres vértices y no se cruce.
- Revisa que no se superponga con otra zona activa.
- Revisa que el horario tenga inicio y fin, con el fin posterior.
- Revisa que el aforo sea mayor que cero.

**No puedo eliminar un espacio.**
- Tiene permisos o solicitudes asociadas. La plataforma lo conserva para no romper el historial. Usa mantenimiento o bloqueo.

**El sistema dice que no soy gestor administrador.**
- Tu perfil es revisor. Puedes consultar, pero no crear zonas, cambiar cuentas ni validar organizaciones.

---

## 19. Seguridad y privacidad

### 19.1 Contraseñas y sesiones

- Las contraseñas se guardan con **argon2id**, nunca en texto plano.
- El acceso usa un **token de acceso** de corta duración y un **refresh token** de 7 días.
- Los gestores tienen tokens de 30 minutos; comerciantes y organizadores, de 8 horas.
- Al cerrar sesión, el token se revoca en la base de datos.
- Si el token expira, la aplicación intenta renovarlo una vez; si falla, te envía al login.

### 19.2 Bloqueo por intentos fallidos

- Después de **5 intentos fallidos**, la cuenta se bloquea temporalmente.
- El mensaje indica cuántos minutos faltan.
- Al activar la cuenta o restablecer la contraseña, se limpian los intentos y el bloqueo.

### 19.3 Qué datos se muestran

- El ciudadano solo ve información de zonas: no ve datos personales.
- El comerciante ve su propio perfil y los espacios.
- El organizador ve su organización.
- El gestor ve cuentas y organizaciones según su perfil.
- La auditoría oculta `password_hash`, `token_hash` y `qr_token`.
- La verificación pública de QR (cuando exista) solo mostrará validez, vigencia, categoría y nombre comercial, nunca documentos ni contactos.

### 19.4 Recomendaciones

- Usa una contraseña distinta a la de otros servicios.
- No compartas tu sesión.
- Cierra sesión en equipos compartidos.
- No envíes documentos por canales no oficiales.
- Reporta cualquier comportamiento extraño a la Alcaldía.

---

## 20. Limitaciones actuales y próximos pasos

### 20.1 Limitaciones de esta versión

| Limitación | Detalle |
|---|---|
| Sin solicitudes | No hay botón ni formulario para pedir un espacio. |
| Sin permisos QR | No se emiten carnés ni se verifica QR desde la interfaz. |
| Sin cobros | No hay pagos ni recibos en la interfaz. |
| Sin ferias | No hay calendario ni inscripción de vendedores. |
| Sin dashboard analítico | Solo el panel básico de indicadores. |
| Sin factibilidad visible | El motor existe en la base, pero no se puede ejecutar desde la interfaz. |
| Sin buscador de calles/barrios | Se excluyó del alcance; el mapa se centra manualmente. |
| Sin administración visual de productos | Los productos se gestionan por API/Swagger. |
| Sin modo offline | La aplicación requiere conexión. |
| Solo español | No hay multilenguaje. |
| Sin app nativa | Es una aplicación web responsive, no una app de tiendas. |

### 20.2 Próximos pasos del proyecto

1. **Sprint 3:** solicitudes, documentos, revisión y ferias.
2. **Sprint 4:** simulador de factibilidad y densidad visible.
3. **Sprint 5:** permisos con QR, verificación pública y cobros simulados.
4. **Sprint 6:** dashboard analítico con las vistas materializadas.

### 20.3 Qué puede hacer la Alcaldía mientras tanto

- Mantener actualizadas las zonas, los horarios, los aforos y los productos.
- Censar los módulos existentes.
- Crear y bloquear espacios según la operación real.
- Usar las importaciones para cargar datos masivos.
- Revisar la auditoría para control interno.
- Usar los espacios y el mapa como fuente oficial de consulta.

---

## 21. Preguntas frecuentes

**¿Necesito cuenta para ver el mapa?**
No. El mapa público de zonas es abierto.

**¿Necesito cuenta para ver espacios?**
Sí. La consulta de espacios es para comerciantes autenticados.

**¿Puedo solicitar un espacio desde la plataforma?**
Todavía no. La consulta está disponible; la solicitud llega en el Sprint 3.

**¿Un módulo del censo me da permiso para vender?**
No. El censo es un inventario. El permiso es un trámite aparte.

**¿Un espacio disponible está reservado para mí?**
No. Estar disponible significa que no tiene bloqueo ni ocupación en la fecha consultada. La reserva se formaliza con una solicitud aprobada.

**¿Por qué un espacio aparece asignado si la tabla dice disponible?**
Porque el estado efectivo cruza la fecha con permisos, solicitudes y bloqueos. Un permiso vigente puede ocuparlo aunque la fila base diga “disponible”.

**¿Por qué no aparece mi zona en el mapa?**
Puede estar inactiva, tener un error de geometría o no haberse guardado. Revisa el listado de zonas como gestor.

**¿Puedo cambiar mi documento o mi actividad comercial?**
No desde tu perfil. Un gestor debe corregirlos. El correo también es fijo.

**¿Qué pasa si no activo mi cuenta?**
Queda en “pendiente de activación” y no puedes iniciar sesión. Usa el código o pide reenvío.

**¿Qué pasa si olvido mi contraseña?**
Usa “¿Olvidaste tu contraseña?”. Recibirás un código de recuperación de vigencia corta.

**¿Los pagos son reales?**
No. En el alcance del proyecto el pago es **simulado**; no se integran pasarelas ni se piden datos de tarjeta.

**¿Puedo usar la plataforma en el celular?**
Sí. Está diseñada mobile-first y se prueba desde 360 px.

**¿Puedo usar la plataforma sin internet?**
No. Requiere conexión activa.

**¿Quién puede ver mis datos?**
Tu perfil lo ves tú; los gestores según su rol. La ciudadanía no ve datos personales. La auditoría oculta campos sensibles.

**¿Qué es el QR del permiso?**
Un código único que permitirá verificar públicamente que un permiso es válido y está vigente, sin exponer documentos. Aún no está implementado en la interfaz.

**¿Puedo tener dos organizaciones?**
No. Cada organizador tiene una sola organización.

**¿Puedo tener dos cuentas con el mismo correo o documento?**
No. Correo y documento son únicos.

**¿Qué pasa si dos gestores editan la misma zona?**
Cada cambio genera una versión y queda auditado con el actor y la fecha. La base de datos valida topología y solapes.

**¿Puedo recuperar una zona desactivada?**
Sí. El administrador puede activarla de nuevo; se conserva todo su historial.

**¿Puedo eliminar un módulo?**
Se da de baja lógica. No se borra la fila; se conserva para el historial.

**¿Puedo eliminar un espacio?**
Solo si no tiene permisos ni solicitudes asociadas. Si los tiene, se conserva y puedes bloquearlo o ponerlo en mantenimiento.

---

## 22. Anexos: datos de demostración y glosario

### 22.1 Credenciales del seed

Estas credenciales son solo para demostración y pruebas locales. **No deben usarse en producción.**

| Correo | Contraseña | Rol / estado |
|---|---|---|
| `admin@tulua.gov.co` | `Admin1234` | Gestor administrador |
| `revisor@tulua.gov.co` | `Admin1234` | Gestor revisor |
| `maria.gomez@gmail.com` | `Comerciante123` | Comerciante activa |
| `jose.perez@hotmail.com` | `Comerciante123` | Comerciante activa |
| `ana.ruiz@gmail.com` | `Comerciante123` | Comerciante activa |
| `pedro.sanchez@gmail.com` | `Comerciante123` | Comerciante pendiente de activación |
| `luis.alvarez@agrovalle.org` | `Organizador123` | Organizador activo con organización activa |
| `marta.cifuentes@asocampesinos.org` | `Organizador123` | Organizador con organización pendiente |

### 22.2 Zonas del seed

| Zona | Tipo | Horario | Aforo | Productos |
|---|---|---|---|---|
| Centro - Calle 30 | Permitida | 06:00–18:00 | 40 | Frutas frescas, Verduras, Ropa y calzado |
| Plaza Boyacá | Alta congestión | 07:00–17:00 | 15 | Artesanías, Comidas rápidas |
| Entorno Hospital | Restringida | Sin horario | 5 | Sin productos configurados |
| Parque La Guadua | Permitida | 06:00–20:00 | 25 | Frutas frescas, Plantas ornamentales, Artesanías |

### 22.3 Espacios del seed

| Espacio | Tipo | Sector | Estado registrado | Nota |
|---|---|---|---|---|
| Espacio móvil Calle 30 - A | Espacio móvil | Centro | Disponible | Puede aparecer asignado dentro de la vigencia del permiso del seed (1–30 nov 2026). |
| Espacio móvil Calle 30 - B | Espacio móvil | Centro | Disponible | — |
| Espacio Plaza Boyacá - Norte | Puesto | Plaza Boyacá | Bloqueado | Bloqueo del 25 al 31 de octubre de 2026. |
| Kiosco Parque La Guadua | Kiosco | Parque La Guadua | Disponible | — |
| Espacio Plaza Boyacá - Sur | Puesto | Plaza Boyacá | Asignado | — |
| Módulo Parque La Guadua - Este | Módulo | Parque La Guadua | Mantenimiento | — |

### 22.4 Módulos del seed

| Código | Categoría | Actividad | Titular |
|---|---|---|---|
| MOD-0001 | Formal | Frutería La 30 | María Gómez |
| MOD-0002 | Informal | Empanadas El Sabor | José Pérez |
| MOD-0003 | Informal | Artesanías Mina | Nelson Mina |
| MOD-0004 | Formal | Artesanías Ana | Ana Ruiz |
| MOD-0005 | Formal | Vivero Andrade | Carlos Andrade |
| MOD-0006 | Informal | Frutas Rosa | Rosa Betancur |

### 22.5 Glosario

| Término | Definición |
|---|---|
| **Aforo** | Límite de referencia de puestos o personas en una zona. |
| **Asignación manual** | Reserva de un espacio hecha por un gestor hasta que la libere. |
| **Bloqueo** | Rango de fechas en el que un espacio no puede usarse. |
| **Censo** | Registro de los puestos que ya existen. |
| **Coordenadas** | Par ordenado longitud/latitud que ubica un punto. |
| **Estado efectivo** | Estado real de un espacio al cruzar la fecha con bloqueos y ocupaciones. |
| **Factibilidad** | Resultado de evaluar si un uso cumple las reglas urbanas. |
| **GeoJSON** | Formato de datos geográficos usado para zonas. |
| **Módulo** | Puesto censado; también puede referirse a un componente del software. |
| **Permiso** | Documento digital que autoriza el uso de un espacio. |
| **Polígono** | Figura cerrada que representa una zona. |
| **PostGIS** | Extensión de PostgreSQL para datos geográficos. |
| **QR** | Código único para verificar un permiso. |
| **Radicado** | Número que identifica una solicitud. |
| **Restricción** | Condición de uso de una zona o espacio. |
| **Seed** | Datos de demostración cargados en la base. |
| **Solicitud** | Petición formal de uso de un espacio. |
| **SRID 4326** | Sistema de coordenadas WGS84, usado por el mapa. |
| **Zona** | Polígono con reglas de uso del espacio público. |

### 22.6 Documentos técnicos relacionados

- `docs/Uso_zonas.md`: zonas, productos, GeoJSON e historial.
- `docs/Uso_modulos.md`: censo de módulos y puestos.
- `docs/Uso_espacios.md`: consulta y administración de espacios.
- `docs/Uso_importaciones.md`: importación de GeoJSON y CSV.
- `docs/baseDatos.md`: modelo de datos completo.
- `docs/Uso_endpoints.md`: contrato de la API del Sprint 1.
- `docs/gestor.md`, `docs/perfil.md`, `docs/organizadores.md`, `docs/panel.md`: módulos de cuentas.
- `docs/avance_frontend.md` e `docs/implementaciones_Sprint2.md`: estado del desarrollo.
- `README.md`: instalación, comandos y credenciales de prueba.

---

## Cierre

SGP Tuluá busca que el espacio público de Tuluá sea más ordenado, transparente y fácil de entender. En esta versión, la plataforma ya permite **ver el territorio**, **consultar espacios** y **administrar la información municipal**. El siguiente paso es convertir esa información en trámites digitales completos: solicitudes, permisos con QR y cobros simulados.

Si tienes dudas sobre una zona, un espacio o un trámite, consulta primero la ficha de la plataforma y, si no encuentras la respuesta, contacta a la Secretaría de Gobierno de la Alcaldía de Tuluá.
