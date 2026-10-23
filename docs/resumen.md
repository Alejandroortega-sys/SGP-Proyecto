# Resumen del Proyecto
## Plataforma Web de Gestión del Espacio Público, Ferias Agroecológicas y Comercio Formal/Informal de Tuluá

**Equipo:** 6 | **Inicio:** Septiembre de 2026 | **Fuentes:** Documento de definición de alcance (`equipo_6_plataforma_web_gesti_n_espacio_publico.md`) + Backlog Jira (`Jira_Import_Backlog_v2_sin_puntos.csv`)

---

## 1. Contexto y objetivo

Desarrollar una **aplicación web responsive / PWA** (con panel administrativo web) para optimizar la ordenación socioeconómica y la gobernanza del espacio público en el centro y sectores clave de **Tuluá, Valle del Cauca**. La plataforma permite:

- **Censar y categorizar** módulos de comercio formal e informal (ventas ambulantes/casetas).
- **Gestionar la asignación temporal de espacios** para eventos, ferias campesinas/agroecológicas y emprendimientos locales.
- **Evaluar la factibilidad** de uso del espacio mediante un motor GIS que considera flujo peatonal y saturación comercial (sin sensores IoT).
- **Tramitar permisos digitales con código QR** verificables por cualquier ciudadano.
- Ofrecer a la Alcaldía un **panel analítico** para la toma de decisiones urbanas.

## 2. Alcance funcional (5 módulos principales)

| # | Módulo | Descripción |
|---|--------|-------------|
| 1 | **Autenticación y registro** | Registro/login con roles diferenciados: Comerciante/Solicitante y Gestor Municipal (el backlog agrega el rol Organizador de Feria). Validación de datos personales. |
| 2 | **Geo-Portal y delimitación** | Mapa interactivo con capas vectoriales (Leaflet/Mapbox): zonas permitidas, restringidas y de alta congestión peatonal. Catálogo georreferenciado de módulos, casetas y espacios temporales. |
| 3 | **Solicitud y asignación digital** | Formulario web para solicitar ubicación temporal, tipo de actividad y horario; carga de documentación digital; aprobación/rechazo con historial. |
| 4 | **Simulador de capacidad/densidad (motor backend, sin IoT)** | Calcula densidad de ocupación por sector y valida reglas urbanas: distancia mínima entre puestos, productos permitidos por zona, aforo límite por cuadrante. |
| 5 | **Permisos QR, transparencia y dashboard** | Carné digital con QR único por permiso aprobado; consulta pública sin login para validar legalidad/vigencia; indicadores de ocupación, recaudación, heatmaps de saturación. |

## 3. Exclusiones del alcance

- **Sin hardware/IoT:** sin sensores de conteo peatonal ni cámaras; la simulación se basa en lógica algorítmica e históricos de BD.
- **Sin pasarelas de pago reales** (PUE/PSE): el recaudo se **simula** con estados de pago.
- **Sin app móvil nativa** (no se compila para App Store/Play Store): solo Web Responsive/PWA.
- **Sin comparendos ni multas** (módulo policial fuera de alcance).
- **Solo español** (sin multilenguaje) y **sin modo offline** (se requiere conexión activa).

## 4. Requisitos no funcionales

| Requisito | Especificación |
|---|---|
| **Seguridad** | HTTPS, autenticación JWT con expiración, hash de contraseñas (mín. 8 caracteres con números), bloqueo tras 5 intentos fallidos, respuesta 403 ante accesos indebidos, no exponer datos sensibles en verificación QR pública. |
| **Rendimiento** | Respuestas < 2 segundos (renderizado de capas geográficas, generación/validación de QR, dashboard). |
| **Usabilidad** | Responsive móvil-primero (probado a 360 px), intuitiva para comerciantes; optimizada para escritorio en oficinas. Contraste WCAG AA, áreas táctiles ≥ 44 px. |

## 5. Especificación técnica (stack)

- **Backend:** Laravel (PHP) — *recomendado por el docente* — o Node.js / Python (FastAPI).
- **Base de datos:** PostgreSQL + **PostGIS** (o MySQL), con índices espaciales GIST, geometrías GeoJSON.
- **Frontend/mapas:** Leaflet.js (plugins de heatmaps) o Mapbox GL JS.
- **Herramientas:** VS Code, Git/GitHub, Postman, Figma, navegadores modernos.
- **Roles del equipo:** (1) Desarrollador Backend/GIS, (2) Desarrollador Frontend, (3) Diseñador UX/UI & Tester.

## 6. Usuarios del sistema y sus campos de datos

**Roles definidos:** Ciudadano (consulta sin registro) · Comerciante/Solicitante · Organizador de Feria · Gestor Municipal (perfiles **Revisor** y **Administrador**).

### Comerciante (HU-01, HU-04)

| Campo | Detalle |
|---|---|
| Nombre | Datos personales |
| **Documento de identidad** | Único en el sistema; **no modificable** por el comerciante (cambio solo vía gestor) |
| Teléfono | Contacto |
| Correo electrónico | Único; sirve para activación de cuenta, recuperación de contraseña y notificaciones |
| Actividad comercial | Datos comerciales |
| Contraseña | Mín. 8 caracteres con números; hash; el cambio requiere la contraseña actual y envía aviso por correo |
| Estado de cuenta | «Pendiente de activación» → «Activa» (→ «Suspendida» con motivo obligatorio) |

El perfil se organiza en tres secciones: **datos personales, actividad comercial y seguridad** (HU-04).

> **Nota sobre la dirección:** el backlog **no** define campo de dirección/domicilio para el usuario. Las direcciones aparecen solo como **búsqueda de calles/barrios para centrar el mapa** (HU-10); la ubicación de puestos y zonas se maneja con **puntos y polígonos geográficos**, no con direcciones postales.

### Organizador de feria (HU-07)

Nombre de la organización · **NIT** · Representante · Tipo de feria · Datos de contacto. Estado: «Pendiente de validación» → «Activa» (la valida el gestor).

### Gestor municipal (HU-03, HU-06)

Correo **institucional** · Perfil de permisos (Revisor/Administrador) · Invitación por correo para definir contraseña · Sesión expira a los **30 min** de inactividad.

### Entidades relacionadas (campos)

- **Zona (HU-11):** geometría polígono, tipo (permitida/restringida/alta congestión), horarios, productos permitidos, aforo.
- **Módulo/puesto censado (HU-13):** punto geográfico, categoría formal/informal, titular, actividad, foto.
- **Solicitud (HU-16):** espacio, actividad, productos, fechas, horario, documentación adjunta, número de radicado, borrador.
- **Feria/evento (HU-21):** nombre, tipo, fechas, zona, n.º de puestos, productos, documentación.
- **Permiso (HU-31):** número consecutivo, titular, espacio, vigencia, categoría, **QR único e impredecible**; verificable públicamente sin exponer documentos sensibles (HU-33); renovable, suspendible o revocable con motivo.
- **Cobro (HU-36):** tarifas por zona y tipo de actividad, recibo descargable, pago **simulado**.

## 7. Reglas de negocio del motor de factibilidad (Épica 4)

1. **Distancia mínima** entre puestos → si no se cumple: «No factible».
2. **Productos permitidos por zona** → producto no autorizado: «No factible».
3. **Aforo límite por cuadrante** → cuadrante lleno: «No factible».

- Parámetros **configurables sin código** y versionados con historial (valor anterior, nuevo, autor, fecha — HU-26).
- Aprobar una solicitud «No factible» exige **justificación escrita registrada como excepción** (HU-25).
- La simulación de escenarios **nunca modifica datos reales** (HU-28); hay alertas por umbrales de saturación (HU-29) y sugerencia de ubicaciones alternativas (HU-30).

## 8. Backlog ágil (archivo Jira CSV)

**Estructura:** 341 issues = 6 Épicas + 44 Historias de Usuario (HU-01 a HU-44) + **291 subtareas** (técnicas por especialidad: Backend/GIS, Frontend, UX/UI, QA). Cada historia trae criterios de aceptación en formato **Gherkin** (Dado/Cuando/Entonces), **Definition of Ready**, **INVEST**, prioridad **MoSCoW**, puntos **Fibonacci** y **Definition of Done** por subtarea.

| Épica | Historias | Puntos | Sprint | Prioridades |
|---|---|---|---|---|
| 1. Autenticación y gestión de usuarios | 7 | 31 | Sprint 1 | 3 Must, 4 Should |
| 2. Geo-Portal y delimitación del espacio público | 8 | 49 | Sprint 2 | 5 Must, 2 Should, 1 Could |
| 3. Solicitud y asignación digital de espacio | 8 | 52 | Sprint 3 | 5 Must, 2 Should, 1 Could |
| 4. Simulador de capacidad y densidad comercial | 7 | 44 | Sprint 4 | 3 Must, 3 Should, 1 Could |
| 5. Permisos digitales, QR y transparencia | 7 | 31 | Sprint 5 | 3 Must, 3 Should, 1 Could |
| 6. Dashboard administrativo e indicadores | 7 | 38 | Sprint 6 | 3 Must, 3 Should, 1 Could |
| **Total** | **44** | **245** | 6 sprints | **22 Must, 17 Should, 5 Could** |

**Dependencias entre épicas:** la 1 es la base → la 2 depende de la 1 → la 3 depende de 1 y 2 → la 4 depende de 2 y 3 → la 5 depende de la 3 → la 6 depende de 2, 3, 4 y 5.

**Riesgos identificados:** entrega de correos (SMTP de pruebas desde sprint 1), calidad de datos cartográficos (GeoJSON simplificado + índices GIST), concurrencia entre gestores (bloqueo de revisión y transacciones), complejidad de consultas espaciales (spike inicial), predictibilidad del QR (tokens aleatorios) y pocos datos reales para el dashboard (seeds representativos).

## 9. Entregables

1. **MVP:** geo-portal, módulo de solicitudes, motor de simulación de densidad, permisos QR y panel analítico.
2. **Documentación de usuario:** guía para comerciantes y manual para gestores.
3. **Código fuente:** repositorio Git con frontend, backend, esquemas de BD geográfica y scripts de prueba.
4. **Reporte final:** arquitectura, modelo de datos espacial (GeoJSON/PostGIS), casos de prueba y lecciones aprendidas.
