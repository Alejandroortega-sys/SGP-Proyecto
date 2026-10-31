# Sprint 2: Funcionalidades de la plataforma al finalizar el sprint

Proyecto: Plataforma Web de Gestión del Espacio Público, Ferias Agroecológicas y Comercio Formal/Informal de Tuluá (Equipo 6).

## 1. Objetivo del sprint

Entregar el **Geo-Portal del espacio público**: un mapa interactivo de Tuluá donde cualquier persona puede ver qué zonas permiten, restringen o saturan la actividad comercial, donde los comerciantes pueden encontrar espacios disponibles, y donde los gestores municipales pueden definir las zonas, censar el comercio existente y administrar la oferta de espacios.

Al terminar el sprint, la plataforma debe permitir **ver y administrar el territorio**. Todavía no permite solicitar ni aprobar permisos, eso llega en el Sprint 3.

**Alcance:** 8 historias de usuario (HU-08 a HU-15) y 49 story points.

| Prioridad | Historias | Puntos |
|---|---|---|
| Must (imprescindibles) | HU-08, HU-09, HU-11, HU-13, HU-15 | 34 |
| Should (importantes) | HU-10, HU-12 | 10 |
| Could (deseables) | HU-14 | 5 |

---

## 2. Qué podrá hacer cada usuario al finalizar el sprint

### Ciudadano (sin necesidad de iniciar sesión)
- Abrir el mapa de Tuluá y ver las zonas permitidas, restringidas y de alta congestión peatonal, con su leyenda.
- Tocar una zona y conocer su nombre, tipo, horarios y productos permitidos.
- Activar o desactivar capas por tipo de zona.
- Ubicarse en el mapa desde su celular.

### Comerciante
- Todo lo anterior, con su cuenta.
- Ver los módulos, casetas y espacios temporales disponibles y abrir la ficha completa de cada uno.
- Buscar y filtrar espacios por sector, tipo de actividad y fecha.
- Buscar una calle o barrio y que el mapa se centre allí.

### Gestor municipal
- Dibujar zonas sobre el mapa, clasificarlas y definir sus restricciones.
- Editar la forma de una zona, desactivarla y consultar quién la cambió y cuándo.
- Censar módulos y puestos de comercio formal e informal, con su foto y su ubicación.
- Importar zonas y módulos desde archivos.
- Crear espacios temporales, bloquearlos por fechas y controlar su estado.

---

## 3. Funcionalidades por historia

### HU-08: Explorar el mapa interactivo de zonas (Must)

**Qué debe ofrecer**
- Mapa de Tuluá con las zonas coloreadas según su tipo (permitida, restringida o de alta congestión) y una leyenda clara.
- Acceso libre, sin registro.
- Detalle de cada zona al tocarla: nombre, tipo, restricciones de horario y de productos.
- Control para mostrar u ocultar zonas por tipo, con respuesta inmediata.
- Botón «mi ubicación» que centra el mapa en la posición del usuario, con aviso claro si no da el permiso o si está fuera de Tuluá.
- Uso fluido en celular (zoom y desplazamiento).

**Debe cumplir**
- Carga del mapa en menos de 2 segundos.
- Mensajes claros cuando no hay datos o hay un error, con opción de reintentar.
- Colores con buen contraste, sin depender solo del color para distinguir los tipos de zona.

### HU-09: Consultar espacios disponibles y su ficha (Must)

**Qué debe ofrecer**
- Capa de «Espacios» sobre el mapa, con marcadores solo de los espacios disponibles.
- Agrupación de marcadores cuando hay muchos cercanos.
- Ficha de cada espacio con tipo, sector, dimensiones, horario permitido, estado y restricciones de su zona.
- En celular la ficha aparece como hoja inferior y en escritorio como panel lateral.

**Debe cumplir**
- Un espacio ocupado o bloqueado **no aparece como disponible**, pero su estado es visible al consultar su ficha.
- Lo que se ve en el mapa coincide siempre con la información registrada.

### HU-10: Buscar y filtrar espacios (Should)

**Qué debe ofrecer**
- Filtros por sector, tipo de actividad y fecha, que se pueden combinar.
- Conteo de resultados que se actualiza al filtrar.
- Buscador de calles y barrios que centra el mapa en la zona elegida.
- Mensaje «No hay espacios disponibles con esos criterios», con una sugerencia para ampliar la búsqueda.

**Debe cumplir**
- Al combinar filtros se muestra solo lo que cumple **todos** los criterios.
- La disponibilidad por fecha tiene en cuenta los bloqueos y los espacios ya asignados.

### HU-11: Delimitar y clasificar zonas (Must)

**Qué debe ofrecer**
- Editor de zonas donde el gestor dibuja un polígono sobre el mapa.
- Clasificación de la zona como permitida, restringida o de alta congestión.
- Definición de restricciones por zona: horarios, productos permitidos y aforo.
- La zona guardada aparece de inmediato en el mapa y su ficha muestra las restricciones.

**Debe cumplir**
- El sistema **rechaza** zonas con líneas que se cruzan a sí mismas o que se solapan con otra zona, con un mensaje que explica el problema.
- Solo el gestor puede crear o modificar zonas.

### HU-12: Editar, desactivar y auditar zonas (Should)

**Qué debe ofrecer**
- Edición de la forma de una zona existente, con vista previa del cambio antes de guardar.
- Desactivación de una zona con confirmación.
- Historial de cambios por zona: qué se modificó, quién y cuándo.

**Debe cumplir**
- Cada cambio queda registrado como una versión, sin perder la anterior.
- Una zona desactivada deja de usarse para solicitudes nuevas, pero se conserva para las históricas.

### HU-13: Censar módulos y puestos (Must)

**Qué debe ofrecer**
- Registro de módulos y puestos con ubicación en el mapa, categoría (formal o informal), titular y actividad.
- Foto del puesto, visible en su ficha.
- Listado de módulos con filtros por sector y categoría.
- Baja de módulos.

**Debe cumplir**
- Si el punto cae en una zona restringida, el sistema **advierte antes de confirmar** y permite continuar de forma consciente.
- Una fotografía solo se acepta si es de un tipo y tamaño permitidos.
- Un módulo dado de baja deja de contar en la ocupación, pero se conserva en el historial.

### HU-14: Importar datos desde archivos (Could)

**Qué debe ofrecer**
- Carga de un archivo de zonas (GeoJSON) y de un archivo de módulos (CSV).
- Previsualización de lo que se va a importar, antes de confirmar.
- Resumen final con el total importado y el total rechazado.
- Reporte de errores por fila, descargable.

**Debe cumplir**
- Si el archivo trae filas o geometrías inválidas, solo se importan las válidas y se informa claramente qué falló.
- Funciona con archivos válidos, parcialmente válidos y con formato incorrecto.

### HU-15: Catálogo de espacios temporales y bloqueos (Must)

**Qué debe ofrecer**
- Creación y edición de espacios temporales con ubicación, dimensiones y horario.
- Bloqueo de un espacio por mantenimiento o evento en un rango de fechas, con calendario.
- Estados visibles del espacio: disponible, bloqueado y ocupado.

**Debe cumplir**
- Un espacio bloqueado no se puede solicitar en las fechas del bloqueo.
- Al aprobarse una solicitud (Sprint 3), el espacio pasa a «Ocupado» hasta que termina el permiso. En este sprint se deja lista esa lógica.
- No se puede bloquear un espacio en fechas donde ya tiene un permiso aprobado.

---

## 4. Reglas generales que aplican a todo el sprint

- **Roles:** las funciones del gestor solo son accesibles para gestores. El ciudadano ve el mapa sin iniciar sesión. El comerciante necesita su cuenta para consultar espacios.
- **Rendimiento:** el mapa y las consultas deben responder en menos de 2 segundos.
- **Uso en celular:** toda pantalla debe verse completa y usable desde 360 px de ancho, sin desplazamiento horizontal, con botones de tamaño táctil cómodo.
- **Estados de pantalla:** toda vista contempla carga, éxito, vacío y error, con mensajes comprensibles en español.
- **Trazabilidad:** los cambios hechos por gestores quedan registrados con autor y fecha.
- **Idioma:** todo el contenido en español y sin datos de prueba visibles.

---

## 5. Qué NO incluye este sprint

Estas funcionalidades pertenecen a sprints posteriores:

- Solicitar ubicación temporal, adjuntar documentos y hacer seguimiento (Sprint 3).
- Revisar, aprobar o rechazar solicitudes (Sprint 3).
- Calendario de ferias y registro de organizadores y sus vendedores (Sprint 3).
- Simulador de capacidad y densidad comercial.
- Permisos digitales con código QR y validación pública.
- Panel de indicadores y mapas de saturación.

---

## 6. Orden recomendado de entrega

1. **Zonas** (HU-11 y la base de HU-08), porque todo lo demás depende de ellas.
2. **Mapa público** (HU-08).
3. **Catálogo de espacios y bloqueos** (HU-15).
4. **Consulta de espacios** (HU-09) y luego **filtros y búsqueda** (HU-10).
5. **Censo de módulos** (HU-13).
6. **Historial y desactivación de zonas** (HU-12).
7. **Importación de archivos** (HU-14), solo si hay tiempo.

Si falta capacidad, se recorta en este orden: HU-14, luego HU-12 y HU-10. Las historias Must quedan intactas.

---

## 7. El sprint está «Done» cuando

- [ ] Cualquier persona puede explorar el mapa de zonas de Tuluá desde el celular, sin iniciar sesión, y ve el detalle de cada zona.
- [ ] El comerciante puede ver los espacios disponibles, abrir su ficha y filtrarlos por sector, actividad y fecha.
- [ ] El gestor puede dibujar, clasificar, editar y desactivar zonas, y ver su historial de cambios.
- [ ] El sistema impide guardar zonas inválidas o solapadas y explica el motivo.
- [ ] El gestor puede censar módulos con foto y recibe la advertencia al ubicar uno en zona restringida.
- [ ] El gestor puede crear espacios temporales y bloquearlos por fechas, y los bloqueos se respetan en la consulta.
- [ ] El mapa y las consultas responden en menos de 2 segundos.
- [ ] Todas las pantallas funcionan en celular y escritorio, con sus estados de carga, vacío y error.
- [ ] Los criterios de aceptación de cada historia fueron probados y el Product Owner aceptó las historias en la demo.
- [ ] No quedan defectos críticos ni altos abiertos.
