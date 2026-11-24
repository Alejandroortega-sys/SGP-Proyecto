# Sistema de Diseño — **Terraza**

> Sistema de diseño para la rediseño de la interfaz gráfica de **SGP Tuluá** — Plataforma de Gestión del Espacio Público, Ferias Agroecológicas y Comercio Formal/Informal de Tuluá, Valle del Cauca.

**Versión:** 1.0.0  
**Estado:** Propuesta de rediseño (no implementada)  
**Fecha:** Noviembre 2026

---

## 1. Identidad de la Plataforma

### Concepto: **Terraza**

El nombre del sistema de diseño es **Terraza**, en referencia a los espacios públicos, plazuelas, mercados al aire libre y terrazas urbanas que la plataforma gestiona. La identidad evoca:

- **Naturaleza y agroecología:** El Valle del Cauca, el río, los cultivos, las ferias campesinas.
- **Gobernanza urbana moderna:** Precisión, transparencia, ordenamiento territorial.
- **Calidez institucional:** No fría ni burocrática; cercana al comerciante y al ciudadano.

### Principios de Diseño

| # | Principio | Descripción |
|---|-----------|-------------|
| 1 | **Claridad ante todo** | Cada pantalla debe responder a una pregunta en menos de 3 segundos: "¿Qué pasa aquí y qué puedo hacer?" |
| 2 | **Jerarquía espacial** | La información importante siempre tiene más peso visual (color, tamaño, posición). El ruido visual se elimina agresivamente. |
| 3 | **Consistencia con identidad** | Ningún componente debe parecer genérico de un framework. Cada detalle refuerza la marca **Terraza**. |
| 4 | **Accesibilidad sin compromisos** | WCAG AA como mínimo. Contraste, foco visible, tamaños táctiles ≥ 44 px y navegación por teclado siempre. |
| 5 | **Responsive desde la estructura** | El layout de 3 columnas se adapta naturalmente: en móvil se convierte en navegación inferior + contenido full-width. |

---

## 2. Paleta de Colores

### Filosofía cromática

Se abandona el azul genérico (`#2563eb`). El acento principal se mueve a un **verde profundo** que evoca la ecología, la agroecología y la institucionalidad colombiana, con un **dorado cálido** como acento secundario para acciones de alto impacto. El fondo no es gris frío: es un **blanco cálido** que transmite cercanía.

### 2.1 Color Primario — **Cañaduzo** 🌿

Inspirado en el verde profundo de la caña de azúcar del Valle del Cauca.

| Token | Nombre | Hex | Uso |
|-------|--------|-----|-----|
| `--primary` | Cañaduzo | `#0D7C4F` | Botón primario, enlaces activos, acento principal |
| `--primary-hover` | Cañaduzo Oscuro | `#096B43` | Hover de botones y enlaces primarios |
| `--primary-active` | Cañaduzo Profundo | `#075A38` | Estado activo/click |
| `--primary-text` | Cañaduzo Texto | `#0B6B45` | Texto de enlaces e iconos sobre fondo claro |
| `--primary-soft` | Cañaduzo Suave | `#E8F5EE` | Fondos de elementos destacados, badge activo |
| `--primary-border` | Cañaduzo Borde | `#B2DFCB` | Bordes de elementos con foco primario |
| `--primary-contrast` | Cañaduzo Contraste | `#FFFFFF` | Texto sobre fondo primario |
| `--primary-glow` | Cañaduzo Resplandor | `rgba(13, 124, 79, 0.15)` | Sombras y halos sutiles |

### 2.2 Acento Secundario — **Maíz** 🌽

Un dorado cálido inspirado en los cultivos andinos y el maíz. Se usa con moderación para llamar la atención sobre acciones críticas.

| Token | Nombre | Hex | Uso |
|-------|--------|-----|-----|
| `--accent-gold` | Maíz | `#D4930D` | Acento secundario, badges premium, indicadores |
| `--accent-gold-hover` | Maíz Oscuro | `#B57D0A` | Hover de elementos dorados |
| `--accent-gold-soft` | Maíz Suave | `#FEF7E0` | Fondos de badges e indicadores dorados |
| `--accent-gold-border` | Maíz Borde | `#F0D68A` | Bordes dorados |

### 2.3 Neutros — **Piedra de Río**

Una escala de neutros cálidos (no fríos), con un matiz casi imperceptible de verde-gris que los conecta con la paleta principal.

#### Modo Claro

| Token | Nombre | Hex | Uso |
|-------|--------|-----|-----|
| `--bg-base` | Base | `#FAFAF7` | Fondo de la aplicación (no blanco puro) |
| `--bg-surface` | Superficie | `#FFFFFF` | Tarjetas, paneles, modales |
| `--bg-elevated` | Elevada | `#FFFFFF` | Elementos flotantes (dropdowns, tooltips) |
| `--bg-subtle` | Sutil | `#F3F3EE` | Filas alternas, hover suave, fondos de sección |
| `--bg-hover` | Hover | `#EBEBE5` | Hover de elementos interactivos neutros |
| `--bg-active` | Activo | `#DFDFD8` | Estado presionado/activo |
| `--border-subtle` | Borde Sutil | `#E8E8E0` | Separadores sutiles, bordes de tarjetas |
| `--border-default` | Borde | `#D4D4CC` | Bordes de inputs, contenedores |
| `--border-strong` | Borde Fuerte | `#A8A8A0` | Bordes enfocados, divisores importantes |
| `--text-heading` | Título | `#1A1A18` | Titulares, texto principal de alto contraste |
| `--text-body` | Cuerpo | `#40403C` | Texto de cuerpo, párrafos |
| `--text-muted` | Tenue | `#71716C` | Metadatos, labels secundarias, placeholders |
| `--text-faint` | Fantasma | `#A0A09A` | Texto muy secundario, hints |
| `--overlay` | Velo | `rgba(26, 26, 24, 0.55)` | Fondos de modal, backdrop |

#### Modo Oscuro

| Token | Nombre | Hex | Uso |
|-------|--------|-----|-----|
| `--bg-base` | Base | `#0F0F0E` | Fondo de la aplicación |
| `--bg-surface` | Superficie | `#1A1A18` | Tarjetas, paneles |
| `--bg-elevated` | Elevada | `#252523` | Elementos flotantes |
| `--bg-subtle` | Sutil | `#20201E` | Hover suave en oscuro |
| `--bg-hover` | Hover | `#2C2C2A` | Hover en modo oscuro |
| `--bg-active` | Activo | `#383835` | Presionado en oscuro |
| `--border-subtle` | Borde Sutil | `#2A2A28` | Separadores en oscuro |
| `--border-default` | Borde | `#3C3C38` | Bordes de inputs en oscuro |
| `--border-strong` | Borde Fuerte | `#52524E` | Bordes enfocados en oscuro |
| `--text-heading` | Título | `#F0F0EC` | Titulares en oscuro |
| `--text-body` | Cuerpo | `#C0C0B8` | Texto de cuerpo en oscuro |
| `--text-muted` | Tenue | `#787872` | Texto secundario en oscuro |
| `--text-faint` | Fantasma | `#50504C` | Texto muy secundario en oscuro |
| `--overlay` | Velo | `rgba(0, 0, 0, 0.70)` | Backdrop en oscuro |

**Adaptaciones en oscuro:**
- `--primary-soft` → `rgba(13, 124, 79, 0.18)`
- `--primary-border` → `rgba(13, 124, 79, 0.40)`
- `--primary-text` → `#5EC496`
- `--accent-gold-soft` → `rgba(212, 147, 13, 0.15)`
- `--accent-gold-border` → `rgba(212, 147, 13, 0.35)`

### 2.4 Semánticos

| Estado | Color | Hex | Fondo Suave | Hex Fondo | Borde | Hex Borde |
|--------|-------|-----|-------------|-----------|-------|-----------|
| **Éxito** | `--success` | `#16A34A` | `--success-soft` | `#ECFDF2` | `--success-border` | `#BBF7D0` |
| **Advertencia** | `--warning` | `#D97706` | `--warning-soft` | `#FFFBEB` | `--warning-border` | `#FDE68A` |
| **Peligro** | `--danger` | `#DC2626` | `--danger-soft` | `#FEF2F2` | `--danger-border` | `#FECACA` |
| **Peligro-hover** | `--danger-hover` | `#B91C1C` | — | — | — | — |
| **Información** | `--info` | `#0284C7` | `--info-soft` | `#F0F9FF` | `--info-border` | `#BAE6FD` |
| **Realizado** | `--completed` | `#7C3AED` | `--completed-soft` | `#F5F3FF` | `--completed-border` | `#DDD6FE` |

#### Variantes oscuras de semánticos

| Estado | Texto | Hex | Fondo | Hex | Borde | Hex |
|--------|-------|-----|-------|-----|-------|-----|
| Éxito | `--success-text-dark` | `#4ADE80` | `--success-soft-dark` | `rgba(22,163,74,0.14)` | `--success-border-dark` | `rgba(22,163,74,0.35)` |
| Advertencia | `--warning-text-dark` | `#FBBF24` | `--warning-soft-dark` | `rgba(217,119,6,0.14)` | `--warning-border-dark` | `rgba(217,119,6,0.35)` |
| Peligro | `--danger-text-dark` | `#F87171` | `--danger-soft-dark` | `rgba(220,38,38,0.14)` | `--danger-border-dark` | `rgba(220,38,38,0.40)` |
| Info | `--info-text-dark` | `#38BDF8` | `--info-soft-dark` | `rgba(2,132,199,0.14)` | `--info-border-dark` | `rgba(2,132,199,0.35)` |
| Realizado | `--completed-text-dark` | `#A78BFA` | `--completed-soft-dark` | `rgba(124,58,237,0.14)` | `--completed-border-dark` | `rgba(124,58,237,0.35)` |

---

## 3. Tipografía

### 3.1 Familias Tipográficas

| Uso | Familia | Fuente | Alternativa del sistema |
|-----|---------|--------|------------------------|
| **Principal** | `--font-display` | **Sora** (Google Fonts) | `ui-sans-serif, system-ui, sans-serif` |
| **Cuerpo / UI** | `--font-body` | **Inter** (Google Fonts) | `ui-sans-serif, system-ui, sans-serif` |
| **Mono / Código** | `--font-mono` | **JetBrains Mono** (Google Fonts) | `ui-monospace, SF Mono, Cascadia Mono, monospace` |

**¿Por qué Sora para display?** Sora es una tipografía geométrica con personalidad propia, de origen latinoamericano (diseñada en Brasil). Su calidez y carácter la distinguen de las opciones genéricas como Roboto o Open Sans, y refuerza la identidad de la plataforma.

### 3.2 Escala Tipográfica

La escala sigue un ratio de **1.2** (Minor Third) para crear una jerarquía clara sin saltos exagerados.

| Token | Tamaño | Line-height | Peso | Uso |
|-------|--------|-------------|------|-----|
| `--text-xs` | `12px` | `1.4` | 500 | Metadatos, badges, timestamps, etiquetas |
| `--text-sm` | `13px` | `1.45` | 400 | Texto de UI densa, tablas, formularios |
| `--text-base` | `14px` | `1.55` | 400 | Cuerpo principal, párrafos, labels |
| `--text-lg` | `16px` | `1.5` | 400 | Énfasis, subtítulos, cards destacadas |
| `--text-xl` | `19.2px` | `1.35` | 600 | Subsecciones (h3) |
| `--text-2xl` | `23px` | `1.3` | 600 | Títulos de sección (h2) |
| `--text-3xl` | `27.6px` | `1.25` | 700 | Título de página (h1) |
| `--text-4xl` | `33px` | `1.15` | 700 | Titulares de portada/hero |
| `--text-5xl` | `40px` | `1.1` | 700 | Hero principal, landing |

### 3.3 Pesos

| Nombre | Valor | Uso |
|--------|-------|-----|
| Regular | `400` | Cuerpo, texto base |
| Medium | `500` | Labels de formulario, badges, metadatos |
| Semibold | `600` | Subtítulos, botones, navegación activa |
| Bold | `700` | Titulares, números destacados |

### 3.4 Letter Spacing

| Contexto | Valor |
|----------|-------|
| Cuerpo normal | `0` (0em) |
| Títulos grandes (≥ 27px) | `-0.02em` |
| Etiquetas uppercase (badges) | `0.05em` |
| Números grandes (KPIs) | `-0.03em` |

---

## 4. Espaciado

### 4.1 Escala de Espaciado

Base: **4px**. Múltiplos para consistencia absoluta.

| Token | Valor | Nombre | Uso típico |
|-------|-------|--------|------------|
| `--space-1` | `4px` | Nano | Gap entre icono y texto |
| `--space-2` | `8px` | Micro | Padding interno de badges, gap pequeño |
| `--space-3` | `12px` | Pequeño | Padding de inputs, gap de labels |
| `--space-4` | `16px` | Base | Padding de tarjetas, gap de filas |
| `--space-5` | `20px` | Medio | Espaciado entre secciones internas |
| `--space-6` | `24px` | Grande | Padding de tarjetas amplias, gap de columnas |
| `--space-8` | `32px` | XL | Separación entre bloques principales |
| `--space-10` | `40px` | XXL | Separación de secciones de página |
| `--space-12` | `48px` | Hero | Padding de hero, secciones de landing |
| `--space-16` | `64px` | Layout | Padding lateral de layout en desktop |

### 4.2 Espaciado de Layout (3 Columnas)

| Zona | Ancho | Comportamiento |
|------|-------|----------------|
| **Sidebar izquierda** (navegación) | `264px` fijo | `position: sticky; top: 0; height: 100dvh` |
| **Columna central** (contenido) | `minmax(0, 1fr)` fluido | Se expande, con `max-width: 720px` centrado |
| **Panel derecho** (contexto/acciones) | `320px` fijo | `position: sticky; top: 0; height: 100dvh`, oculto en tablets |
| **Gap entre columnas** | `0` (bordes como separadores) | Los divisores verticales reemplazan el gap |
| **Header superior** | `100%` | `height: 56px`, `position: sticky; top: 0; z-index: 50` |

#### Breakpoints

| Nombre | Valor | Comportamiento |
|--------|-------|----------------|
| `sm` | `640px` | Móvil: 1 columna, navegación inferior |
| `md` | `768px` | Tablet: 2 columnas (sidebar + contenido), panel derecho oculto |
| `lg` | `1024px` | Desktop: 3 columnas completas |
| `xl` | `1280px` | Desktop grande: contenido central se expande hasta 720px |
| `2xl` | `1536px` | Extra grande: layout centrado con márgenes laterales |

---

## 5. Bordes y Radios

### 5.1 Radios de Borde

| Token | Valor | Uso |
|-------|-------|-----|
| `--radius-none` | `0px` | Sin radio |
| `--radius-sm` | `6px` | Badges, tags pequeños |
| `--radius-md` | `8px` | Botones, inputs, campos de formulario |
| `--radius-lg` | `12px` | Tarjetas, paneles, modales |
| `--radius-xl` | `16px` | Contenedores grandes, cards destacadas |
| `--radius-2xl` | `20px` | Modales grandes, paneles de contexto |
| `--radius-full` | `9999px` | Avatares, indicadores circulares, badges de notificación |

### 5.2 Grosores de Borde

| Token | Valor | Uso |
|-------|-------|-----|
| `--border-hairline` | `1px` | Bordes estándar (inputs, tarjetas, divisores) |
| `--border-medium` | `1.5px` | Bordes de elementos interactivos en hover |
| `--border-thick` | `2px` | Foco visible, estados activos |

### 5.3 Estilo de Bordes

| Elemento | Color | Grosor |
|----------|-------|--------|
| Tarjeta | `--border-subtle` | 1px |
| Input (normal) | `--border-default` | 1px |
| Input (hover) | `--border-strong` | 1.5px |
| Input (focus) | `--primary` | 2px |
| Input (error) | `--danger` | 2px |
| Divisor de sección | `--border-subtle` | 1px |
| Divisor de columna (layout) | `--border-subtle` | 1px |

---

## 6. Sombras

### 6.1 Escala de Elevación

Cada nivel corresponde a un estado de elevación en la interfaz.

| Token | Sombra | Uso |
|-------|--------|-----|
| `--shadow-xs` | `0 1px 2px rgba(26,26,24,0.04)` | Tarjetas planas, elementos en reposo |
| `--shadow-sm` | `0 1px 3px rgba(26,26,24,0.06), 0 1px 2px rgba(26,26,24,0.04)` | Tarjetas con elevación sutil |
| `--shadow-md` | `0 4px 8px rgba(26,26,24,0.06), 0 2px 4px rgba(26,26,24,0.04)` | Dropdowns, popovers, tarjetas destacadas |
| `--shadow-lg` | `0 8px 24px rgba(26,26,24,0.08), 0 4px 8px rgba(26,26,24,0.04)` | Modales, paneles flotantes |
| `--shadow-xl` | `0 16px 48px rgba(26,26,24,0.12), 0 4px 12px rgba(26,26,24,0.06)` | Modales grandes, sheets |
| `--shadow-glow` | `0 0 0 4px rgba(13,124,79,0.12)` | Foco primario, elementos activos |

### 6.2 Sombras Adaptadas al Modo Oscuro

| Token | Sombra en oscuro |
|-------|-----------------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.20)` |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.30), 0 1px 2px rgba(0,0,0,0.20)` |
| `--shadow-md` | `0 4px 8px rgba(0,0,0,0.30), 0 2px 4px rgba(0,0,0,0.20)` |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.40), 0 4px 8px rgba(0,0,0,0.20)` |

---

## 7. Estados de Interacción

### 7.1 Hover

| Elemento | Cambio en Hover |
|----------|----------------|
| **Botón sólido** | `background: --primary-hover`, `transform: translateY(-1px)`, `shadow: --shadow-sm` |
| **Botón contorno** | `background: --primary-soft`, `border-color: --primary-border`, `color: --primary-text` |
| **Botón fantasma** | `background: --bg-hover`, `color: --text-heading` |
| **Botón peligro** | `background: --danger-hover` |
| **Enlace de navegación** | `background: --bg-hover`, transición de 150ms |
| **Tarjeta** | `shadow: --shadow-sm`, `border-color: --border-default` |
| **Fila de tabla** | `background: --bg-subtle` |
| **Icono de acción** | `background: --bg-hover`, `color: --text-heading` |
| **Elemento de menú lateral** | `background: --bg-subtle`, texto cambia a `--text-heading` |

### 7.2 Active / Pressed

| Elemento | Cambio en Active |
|----------|-----------------|
| **Botón sólido** | `background: --primary-active`, `transform: translateY(0)`, `shadow: none` |
| **Botón contorno** | `background: --primary-soft`, `transform: scale(0.98)` |
| **Tarjeta clicable** | `transform: scale(0.99)`, `shadow: --shadow-xs` |
| **Fila de tabla** | `background: --bg-active` |

### 7.3 Focus Visible

| Token | Valor |
|-------|-------|
| `--focus-ring` | `outline: 2px solid --primary; outline-offset: 2px` |
| `--focus-ring-inset` | `outline: 2px solid --primary; outline-offset: -2px` (para inputs) |
| `--focus-ring-gold` | `outline: 2px solid --accent-gold; outline-offset: 2px` (para elementos dorados) |

### 7.4 Disabled

| Propiedad | Valor |
|-----------|-------|
| `opacity` | `0.5` |
| `cursor` | `not-allowed` |
| `color` | `--text-faint` |
| `background` | `--bg-subtle` |
| **Sin hover effects** | Todos los efectos de hover se desactivan |

### 7.5 Transiciones

| Propiedad | Duración | Easing |
|-----------|----------|--------|
| `background-color` | `150ms` | `ease-out` |
| `border-color` | `150ms` | `ease-out` |
| `color` | `150ms` | `ease-out` |
| `box-shadow` | `200ms` | `ease-out` |
| `transform` | `150ms` | `ease-out` |
| `opacity` | `200ms` | `ease-out` |
| `width/height` | `250ms` | `ease-in-out` (sidebar, paneles) |

### 7.6 Loading / Skeleton

| Propiedad | Valor |
|-----------|-------|
| **Skeleton base** | `background: --bg-subtle` |
| **Skeleton shimmer** | Gradiente animado: `linear-gradient(90deg, --bg-subtle 25%, --bg-hover 50%, --bg-subtle 75%)`, animación de 1.5s |
| **Spinner** | `border: 2.5px solid --border-subtle; border-top-color: --primary`, animación de rotación 800ms linear |
| **Respetar reduced-motion** | Todas las animaciones se reducen a `0.01ms` |

---

## 8. Layout — Arquitectura de 3 Columnas

### 8.1 Estructura General

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HEADER STICKY (56px) — Logo · Búsqueda · Notificaciones · Avatar      │
├──────────┬────────────────────────────────────┬───────────────────────┤
│          │                                    │                       │
│ SIDEBAR  │         CONTENIDO CENTRAL          │    PANEL DERECHO      │
│ IZQUIERDO│                                    │   (Contexto/Acciones) │
│ 264px    │         minmax(0, 1fr)             │     320px             │
│ sticky   │         max-width: 720px           │     sticky            │
│          │                                    │                       │
│          │                                    │                       │
│          │                                    │                       │
├──────────┴────────────────────────────────────┴───────────────────────┤
│  FOOTER (40px) — Información institucional · Versión                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Sidebar Izquierdo — Navegación Principal

| Propiedad | Valor |
|-----------|-------|
| `width` | `264px` (fijo) |
| `position` | `sticky` |
| `top` | `0` |
| `height` | `100dvh` |
| `background` | `--bg-surface` |
| `border-right` | `1px solid --border-subtle` |
| `z-index` | `40` |
| `overflow-y` | `auto` |

**Secciones internas del sidebar:**

1. **Cabecera del sidebar** (alto: 56px)
   - Logo SGP Tuluá + nombre de la plataforma
   - Borde inferior: `1px solid --border-subtle`
   - Padding: `16px`

2. **Navegación principal** (flex-grow)
   - Items de navegación con altura mínima: `40px`
   - Padding horizontal: `12px 16px`
   - Gap entre items: `2px`
   - Estado activo: `background: --primary-soft; color: --primary-text; font-weight: 600; border-radius: 8px`
   - Hover inactivo: `background: --bg-hover; border-radius: 8px`
   - Badge de notificaciones: `background: --danger; color: white; font-size: 10px; padding: 2px 6px; border-radius: 9999px`

3. **Perfil de usuario** (sticky al fondo)
   - Borde superior: `1px solid --border-subtle`
   - Avatar circular: `36px × 36px`
   - Nombre del usuario + rol
   - Botón de cerrar sesión (fantasma, ancho completo)

### 8.3 Columna Central — Contenido Principal

| Propiedad | Valor |
|-----------|-------|
| `flex` | `1 1 0%` (fluid) |
| `max-width` | `720px` |
| `margin` | `0 auto` (centrado cuando hay espacio) |
| `padding` | `24px 16px` (móvil) → `32px 24px` (desktop) |
| `min-width` | `0` (permite truncar contenido overflow) |

**Estructura interna de páginas:**

```
┌─────────────────────────────────────┐
│  ENCABEZADO DE PÁGINA               │
│  Título (h1) + Descripción + CTA    │
├─────────────────────────────────────┤
│  BARRA DE ACCIONES / FILTROS        │
│  (sticky al hacer scroll)           │
├─────────────────────────────────────┤
│  CONTENIDO PRINCIPAL                │
│  (tarjetas, tablas, formularios)    │
├─────────────────────────────────────┤
│  PAGINACIÓN                         │
└─────────────────────────────────────┘
```

### 8.4 Panel Derecho — Contexto y Acciones Rápidas

| Propiedad | Valor |
|-----------|-------|
| `width` | `320px` (fijo) |
| `position` | `sticky` |
| `top` | `0` |
| `height` | `100dvh` |
| `background` | `--bg-surface` |
| `border-left` | `1px solid --border-subtle` |
| `overflow-y` | `auto` |
| `padding` | `20px 16px` |
| `gap interno` | `20px` entre widgets |

**Contenido típico del panel derecho (varía por rol):**

- **Gestor:** Resumen de indicadores, solicitudes pendientes, actividad reciente
- **Comerciante:** Estado de permisos, próximos vencimientos, accesos rápidos
- **Organizador:** Estado de ferias, documentos pendientes, próximos eventos

**Widgets del panel derecho:**
- Cada widget: `background: --bg-subtle; border-radius: 12px; padding: 16px; margin-bottom: 16px`
- Título de widget: `font-size: 13px; font-weight: 600; color: --text-muted; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px`

### 8.5 Header Superior

| Propiedad | Valor |
|-----------|-------|
| `height` | `56px` |
| `position` | `sticky` |
| `top` | `0` |
| `z-index` | `50` |
| `background` | `--bg-surface/95` (con `backdrop-filter: blur(8px)`) |
| `border-bottom` | `1px solid --border-subtle` |
| `display` | `flex; align-items: center; padding: 0 16px` |
| `gap` | `16px` |

**Elementos del header (de izquierda a derecha):**

1. **Logo compacto** (visible solo en móvil/tablet cuando el sidebar está oculto)
   - Icono: `32px × 32px`
2. **Barra de búsqueda** (expandida en desktop, colapsada en móvil)
   - `height: 36px; border-radius: 8px; background: --bg-subtle; padding: 0 12px`
   - Placeholder: `Buscar módulos, zonas, solicitudes…`
3. **Spacer** (`flex: 1`)
4. **Botón de notificaciones**
   - Icono con badge de no leídas
   - `position: relative; width: 36px; height: 36px; border-radius: 8px`
   - Badge: `position: absolute; top: -2px; right: -2px`
5. **Avatar de usuario**
   - `32px × 32px; border-radius: 9999px; background: --primary-soft; color: --primary-text`
   - Click abre dropdown de perfil

### 8.6 Responsive — Adaptación del Layout

| Breakpoint | Sidebar | Contenido | Panel derecho | Navegación |
|------------|---------|-----------|---------------|------------|
| `≥ 1024px` (lg) | Visible, 264px, sticky | Fluido, max 720px | Visible, 320px, sticky | Sidebar izquierdo |
| `768px – 1023px` (md) | Visible, 264px, sticky | Fluido | **Oculto** (accesible via botón) | Sidebar izquierdo |
| `< 768px` (sm) | **Oculto** | Full-width | **Oculto** | Bottom nav bar (56px, fixed) |

**Bottom Navigation Bar (móvil):**

| Propiedad | Valor |
|-----------|-------|
| `position` | `fixed; bottom: 0; left: 0; right: 0` |
| `height` | `56px` |
| `background` | `--bg-surface` |
| `border-top` | `1px solid --border-subtle` |
| `z-index` | `50` |
| `display` | `flex; justify-content: space-around` |
| `padding` | `0 8px` |
| **Items** | 4–5 items: Inicio, Mapa, Solicitudes, Notificaciones, Perfil |
| **Item activo** | `color: --primary-text; font-weight: 600` |
| **Item inactivo** | `color: --text-muted` |
| **Icono** | `24px × 24px`, encima del label |
| **Label** | `font-size: 10px; font-weight: 500` |

---

## 9. Componentes — Especificaciones de Diseño

### 9.1 Botones

| Variante | Fondo | Borde | Texto | Hover | Active |
|----------|-------|-------|-------|-------|--------|
| **Primario (sólido)** | `--primary` | `none` | `--primary-contrast` (blanco) | `--primary-hover` + `translateY(-1px)` + `--shadow-sm` | `--primary-active` + `translateY(0)` |
| **Secundario (contorno)** | `--bg-surface` | `1px solid --border-default` | `--text-heading` | `--primary-soft` + borde `--primary-border` + texto `--primary-text` | `--bg-active` + `scale(0.98)` |
| **Fantasma** | `transparent` | `none` | `--text-body` | `--bg-hover` + texto `--text-heading` | `--bg-active` |
| **Peligro** | `--danger` | `none` | `#FFFFFF` | `--danger-hover` | `#991b1b` |
| **Dorado (CTA especial)** | `--accent-gold` | `none` | `#FFFFFF` | `--accent-gold-hover` | `#9A6B08` |

**Tamaños:**

| Tamaño | Alto mínimo | Padding X | Padding Y | Font size | Gap icono-texto |
|--------|-------------|-----------|-----------|-----------|-----------------|
| **sm** | `34px` | `12px` | `6px` | `13px` | `6px` |
| **md** | `40px` | `16px` | `8px` | `14px` | `8px` |
| **lg** | `44px` | `20px` | `10px` | `16px` | `8px` |

**Propiedades comunes:**
- `border-radius: --radius-md (8px)`
- `font-weight: 600 (semibold)`
- `transition: all 150ms ease-out`
- `focus-visible: --focus-ring`
- `disabled: opacity 0.5, cursor not-allowed`
- **Loading state:** spinner a la izquierda del texto, texto no se oculta

### 9.2 Campos de Formulario (Inputs)

| Estado | Borde | Fondo |
|--------|-------|-------|
| **Normal** | `1px solid --border-default` | `--bg-surface` |
| **Hover** | `1.5px solid --border-strong` | `--bg-surface` |
| **Focus** | `2px solid --primary` (sin offset) | `--bg-surface` |
| **Error** | `2px solid --danger` | `--bg-surface` |
| **Disabled** | `1px solid --border-subtle` | `--bg-subtle` |

**Dimensiones:**
- `height: 40px` (md)
- `padding: 0 12px`
- `border-radius: --radius-md (8px)`
- `font-size: 14px`
- `font-family: --font-body (Inter)`

**Label:**
- `font-size: 13px; font-weight: 500; color: --text-heading; margin-bottom: 6px`
- Campo requerido: asterisco en `--danger`, `font-weight: 700`

**Texto de ayuda:**
- `font-size: 12px; color: --text-muted; margin-top: 4px`

**Texto de error:**
- `font-size: 12px; color: --danger; font-weight: 500; margin-top: 4px`

### 9.3 Tarjetas (Cards)

| Propiedad | Valor |
|-----------|-------|
| `background` | `--bg-surface` |
| `border` | `1px solid --border-subtle` |
| `border-radius` | `--radius-lg (12px)` |
| `shadow` | `--shadow-xs` |
| `padding` | `20px` (cuerpo), `16px 20px` (encabezado/pie) |

**Hover de tarjeta clicable:**
- `border-color: --border-default`
- `shadow: --shadow-sm`
- `transition: all 200ms ease-out`

**Variante destacada (highlighted):**
- `border-color: --primary-border`
- `shadow: --shadow-sm`
- Borde izquierdo: `3px solid --primary`

### 9.4 Tablas

| Elemento | Estilo |
|----------|--------|
| **Encabezado** | `background: --bg-subtle; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: --text-muted; padding: 10px 16px; border-bottom: 1px solid --border-subtle` |
| **Fila normal** | `padding: 12px 16px; border-bottom: 1px solid --border-subtle; transition: background 150ms` |
| **Fila hover** | `background: --bg-subtle` |
| **Fila seleccionada** | `background: --primary-soft` |
| **Fila par (zebra)** | `background: --bg-subtle/50` (opcional) |
| **Celda** | `font-size: 14px; color: --text-body` |
| **Celda numérica** | `font-variant-numeric: tabular-nums; text-align: right` |

**Paginación:**
- Botones: `36px × 36px; border-radius: 8px; font-size: 13px; font-weight: 500`
- Página activa: `background: --primary; color: white; font-weight: 600`
- Hover inactivo: `background: --bg-hover`

### 9.5 Badges / Etiquetas

| Tipo | Fondo | Texto | Borde |
|------|-------|-------|-------|
| **Éxito** | `--success-soft` | `--success` | `--success-border` |
| **Advertencia** | `--warning-soft` | `--warning` | `--warning-border` |
| **Peligro** | `--danger-soft` | `--danger` | `--danger-border` |
| **Info** | `--info-soft` | `--info` | `--info-border` |
| **Neutro** | `--bg-subtle` | `--text-muted` | `--border-subtle` |
| **Primario** | `--primary-soft` | `--primary-text` | `--primary-border` |
| **Dorado** | `--accent-gold-soft` | `--accent-gold` | `--accent-gold-border` |

**Dimensiones:**
- `padding: 2px 8px`
- `font-size: 11px; font-weight: 600`
- `border-radius: --radius-sm (6px)` (no full — se diferencian de los avatares)
- `text-transform: none` (se usa uppercase solo en badges de categoría)
- `line-height: 1.6`

### 9.6 Modales / Diálogos

| Propiedad | Valor |
|-----------|-------|
| **Overlay** | `background: --overlay; backdrop-filter: blur(4px)` |
| **Contenedor** | `background: --bg-surface; border-radius: --radius-2xl (20px); box-shadow: --shadow-xl; max-width: 520px; width: calc(100% - 32px)` |
| **Header** | `padding: 20px 24px; border-bottom: 1px solid --border-subtle; display: flex; justify-content: space-between; align-items: center` |
| **Body** | `padding: 24px` |
| **Footer** | `padding: 16px 24px; border-top: 1px solid --border-subtle; display: flex; justify-content: flex-end; gap: 8px` |
| **Título** | `font-size: 16px; font-weight: 700; color: --text-heading; font-family: --font-display (Sora)` |
| **Botón cerrar** | `width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; hover: --bg-hover` |
| **Animación de entrada** | `opacity: 0 → 1 (200ms), transform: scale(0.95) → 1 (200ms), easing: ease-out` |

**Variantes de tamaño:**

| Variante | Max-width | Uso |
|----------|-----------|-----|
| **sm** | `400px` | Confirmaciones, alertas |
| **md** | `520px` | Formularios, detalles |
| **lg** | `680px` | Formularios complejos, visores |
| **xl** | `860px` | Mapas, tablas expansivas |
| **full** | `calc(100% - 32px)` | Pantalla completa en móvil |

### 9.7 Alertas / Notificaciones Inline

| Propiedad | Valor |
|-----------|-------|
| `padding` | `12px 16px` |
| `border-radius` | `--radius-md (8px)` |
| `border` | `1px solid` (color semántico) |
| `font-size` | `13px; line-height: 1.5` |
| `gap icono-texto` | `10px` |
| `icono` | `20px × 20px` |

| Tono | Fondo | Borde | Texto | Icono |
|------|-------|-------|-------|-------|
| Éxito | `--success-soft` | `--success-border` | `--success` | ✓ Check |
| Error | `--danger-soft` | `--danger-border` | `--danger` | ⚠ Alerta |
| Advertencia | `--warning-soft` | `--warning-border` | `--warning` | ⚠ Alerta |
| Info | `--info-soft` | `--info-border` | `--info` | ℹ Info |

### 9.8 Tooltips

| Propiedad | Valor |
|-----------|-------|
| `background` | `--bg-elevated` |
| `color` | `--text-heading` |
| `padding` | `6px 10px` |
| `border-radius` | `--radius-sm (6px)` |
| `font-size` | `12px; font-weight: 500` |
| `shadow` | `--shadow-md` |
| `border` | `1px solid --border-subtle` |
| `max-width` | `240px` |
| `z-index` | `100` |
| **Flecha** | `6px × 6px, same background y borde` |

### 9.9 Tabs / Pestañas

| Propiedad | Valor |
|-----------|-------|
| **Contenedor** | `border-bottom: 1px solid --border-subtle; display: flex; gap: 0` |
| **Tab inactivo** | `padding: 10px 16px; font-size: 13px; font-weight: 500; color: --text-muted; border-bottom: 2px solid transparent; transition: all 150ms` |
| **Tab hover** | `color: --text-heading; background: --bg-hover/50` |
| **Tab activo** | `color: --primary-text; border-bottom-color: --primary; font-weight: 600` |
| **Tab panel** | `padding-top: 20px` |

---

## 10. Layout de Páginas Específicas

### 10.1 Panel del Gestor (Dashboard)

```
┌──────────────────────────────────────────────────────────────────────┐
│ HEADER                                                               │
├──────────┬─────────────────────────────────────┬────────────────────┤
│ NAV      │  DASHBOARD                          │  RESUMEN           │
│          │                                     │                    │
│  Panel   │  ┌─ KPIs ─────────────────────┐    │  • Indicadores     │
│  ↓       │  │ [4] Solicitudes            │    │    rápidos         │
│  Solic.  │  │ [12] Permisos              │    │                    │
│  Permisos│  │ [8] Módulos                │    │  ┌─ Actividad ───┐ │
│  Zonas   │  │ [3] Ferias                 │    │  │ Últimas       │ │
│  Ferias  │  └────────────────────────────┘    │  │ acciones      │ │
│  Módulos │                                     │  └──────────────┘ │
│  Espacios│  ┌─ Gráfico de ocupación ─────┐    │                    │
│  Usuarios│  │                             │    │  ┌─ Accesos ─────┐ │
│  Org.    │  │  [Chart area]               │    │  │ Rápidos       │ │
│  Auditoría│ │                             │    │  └──────────────┘ │
│          │  └─────────────────────────────┘    │                    │
│          │                                     │                    │
│ [Perfil] │  ┌─ Tabla: Últimas solicitudes ─┐  │                    │
│ [Salir]  │  │                              │  │                    │
│          │  │  S-2026-0142 · María G.      │  │                    │
│          │  │  S-2026-0141 · Juan P.       │  │                    │
│          │  └──────────────────────────────┘  │                    │
├──────────┴─────────────────────────────────────┴────────────────────┤
│ FOOTER                                                               │
└──────────────────────────────────────────────────────────────────────┘
```

### 10.2 Vista de Detalle (Módulo/Espacio/Solicitud)

```
┌──────────────────────────────────────────────────────────────────────┐
│ HEADER                                                               │
├──────────┬─────────────────────────────────────┬────────────────────┤
│ NAV      │  DETALLE DE MÓDULO M-104            │  ACCIONES RÁPIDAS  │
│          │                                     │                    │
│          │  ┌─ Breadcrumbs ──────────────┐    │  [Editar]          │
│          │  │ Módulos / M-104            │    │  [Ver historial]   │
│          │  └────────────────────────────┘    │  [Cambiar estado]  │
│          │                                     │                    │
│          │  ┌─ Mapa (Leaflet) ───────────┐    │  ┌─ Info ─────────┐│
│          │  │                            │    │  │ Zona: Centro   ││
│          │  │  [Mapa con marcador]       │    │  │ Categoría: ... ││
│          │  │                            │    │  │ Estado: Activo ││
│          │  └────────────────────────────┘    │  │ Titular: ...   ││
│          │                                     │  └───────────────┘│
│          │  ┌─ Tabs ───────────────────────┐    │                    │
│          │  │ [Datos] [Historial] [Docs]   │    │  ┌─ Documentos ───┐│
│          │  ├──────────────────────────────┤    │  │ • Foto         ││
│          │  │  Formulario de datos         │    │  │ • Cédula       ││
│          │  │                              │    │  │ • Permiso QR   ││
│          │  │  Actividad: Frutas           │    │  └────────────────┘│
│          │  │  Titular: María Fernández    │    │                    │
│          │  │  Categoría: Formal           │    │                    │
│          │  └──────────────────────────────┘    │                    │
├──────────┴─────────────────────────────────────┴────────────────────┤
└──────────────────────────────────────────────────────────────────────┘
```

### 10.3 Formulario Multi-paso (Nueva Solicitud)

```
┌──────────────────────────────────────────────────────────────────────┐
│ HEADER                                                               │
├──────────┬─────────────────────────────────────┬────────────────────┤
│ NAV      │  NUEVA SOLICITUD                    │  RESUMEN           │
│          │                                     │                    │
│          │  ●────●────○────○────○             │  ┌─ Paso actual ──┐│
│          │  Ubicación Activ. Docs  Hor. Resumen│  │ • Espacio      ││
│          │                                     │  │ • Actividad    ││
│          │  ┌─ Contenido del paso ─────────┐  │  │ • Documentos   ││
│          │  │                              │  │  │ • Horario      ││
│          │  │  Formulario del paso actual   │  │  └────────────────┘│
│          │  │                              │  │                    │
│          │  │  [Mapa o campos]             │  │                    │
│          │  │                              │  │                    │
│          │  └──────────────────────────────┘  │                    │
│          │                                     │                    │
│          │  [← Anterior]           [Siguiente →] │                    │
│          │                                     │                    │
├──────────┴─────────────────────────────────────┴────────────────────┤
└──────────────────────────────────────────────────────────────────────┘
```

---

## 11. Microinteracciones y Detalles

### 11.1 Animaciones Clave

| Interacción | Duración | Easing | Detalle |
|-------------|----------|--------|---------|
| Hover de botón | `150ms` | `ease-out` | `translateY(-1px)` + sombra sutil |
| Click de botón | `100ms` | `ease-in` | `translateY(0)` + sombra se reduce |
| Aparecer modal | `200ms` | `ease-out` | `opacity: 0→1`, `scale: 0.95→1` |
| Cerrar modal | `150ms` | `ease-in` | `opacity: 1→0`, `scale: 1→0.97` |
| Sidebar toggle (móvil) | `250ms` | `ease-in-out` | `translateX(-100%) → 0` |
| Badge de notificación | `200ms` | `ease-out` | `scale: 0→1` con `spring` |
| Skeleton shimmer | `1.5s` | `linear` | Gradiente se mueve de izquierda a derecha |
| Spinner | `800ms` | `linear` | Rotación continua 360° |
| Toast/alerta aparece | `250ms` | `ease-out` | `translateY(8px) → 0` + `opacity: 0→1` |
| Fila de tabla seleccionada | `150ms` | `ease-out` | `background` cambia suavemente |

### 11.2 Iconografía

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Line icons, stroke-based, `stroke-width: 1.5px` |
| **Tamaño base** | `20px × 20px` |
| **Tamaño pequeño** | `16px × 16px` (tabs, badges) |
| **Tamaño grande** | `24px × 24px` (sidebar, header) |
| **Color normal** | `--text-muted` |
| **Color hover** | `--text-heading` |
| **Color activo** | `--primary-text` |
| **Color peligro** | `--danger` |
| **Library recomendada** | **Lucide Icons** (consistente con el estilo line, open-source, tree-shakeable) |

### 11.3 Logo / Marca

| Elemento | Especificación |
|----------|---------------|
| **Isotipo** | Escudo simplificado con forma de hoja dentro, en `--primary` |
| **Tamaño header** | `32px × 32px` |
| **Tamaño sidebar** | `36px × 36px` |
| **Variante monocromática** | Blanco sobre `--primary`, para fondos oscuros |
| **Espaciado logo-texto** | `10px` de gap |

---

## 12. Patrones de Diseño por Rol

### 12.1 Gestor Municipal

- **Sidebar:** Navegación completa con todos los módulos (Panel, Solicitudes, Permisos, Zonas, Ferias, Módulos, Espacios, Importar, Usuarios, Comerciantes, Organizaciones, Auditoría)
- **Panel derecho:** Indicadores rápidos del panel, solicitudes pendientes de revisión, accesos rápidos
- **Énfasis visual:** Tablas densas, badges de estado con colores semánticos, acciones de aprobación/rechazo prominentes
- **Sidebar para revisor:** Se ocultan las acciones de escritura (Crear gestor, cambiar estado, auditoría)

### 12.2 Comerciante

- **Sidebar:** Simplificado (Inicio, Espacios, Mis solicitudes, Mis permisos, Pagos, Mi perfil)
- **Panel derecho:** Estado de permisos vigentes, próximos vencimientos, accesos rápidos
- **Énfasis visual:** Tarjetas grandes con información clara, formularios guiados paso a paso, badges de estado de solicitud muy visibles
- **CTA principal:** "Nueva solicitud" siempre accesible

### 12.3 Organizador

- **Sidebar:** (Inicio, Ferias, Mi organización, Mi perfil)
- **Panel derecho:** Estado de ferias, documentos pendientes, próximos eventos
- **Énfasis visual:** Calendario de ferias prominente, tarjetas de eventos con información de puestos y zona
- **CTA principal:** "Nueva feria" destacado

### 12.4 Ciudadano (sin sesión)

- **Layout:** Sin sidebar, header completo con navegación simple
- **Contenido:** Mapa público de zonas, verificación de permisos por QR/código
- **Énfasis visual:** Mapa grande y prominente, buscador de permisos

---

## 13. Guía de Implementación

### 13.1 Variables CSS (Custom Properties)

```css
:root {
  /* Primario — Cañaduzo */
  --primary: #0D7C4F;
  --primary-hover: #096B43;
  --primary-active: #075A38;
  --primary-text: #0B6B45;
  --primary-soft: #E8F5EE;
  --primary-border: #B2DFCB;
  --primary-contrast: #FFFFFF;
  --primary-glow: rgba(13, 124, 79, 0.15);

  /* Acento — Maíz */
  --accent-gold: #D4930D;
  --accent-gold-hover: #B57D0A;
  --accent-gold-soft: #FEF7E0;
  --accent-gold-border: #F0D68A;

  /* Neutros — Piedra de Río (claro) */
  --bg-base: #FAFAF7;
  --bg-surface: #FFFFFF;
  --bg-elevated: #FFFFFF;
  --bg-subtle: #F3F3EE;
  --bg-hover: #EBEBE5;
  --bg-active: #DFDFD8;
  --border-subtle: #E8E8E0;
  --border-default: #D4D4CC;
  --border-strong: #A8A8A0;
  --text-heading: #1A1A18;
  --text-body: #40403C;
  --text-muted: #71716C;
  --text-faint: #A0A09A;
  --overlay: rgba(26, 26, 24, 0.55);

  /* Semánticos */
  --success: #16A34A;
  --success-soft: #ECFDF2;
  --success-border: #BBF7D0;
  --warning: #D97706;
  --warning-soft: #FFFBEB;
  --warning-border: #FDE68A;
  --danger: #DC2626;
  --danger-hover: #B91C1C;
  --danger-soft: #FEF2F2;
  --danger-border: #FECACA;
  --info: #0284C7;
  --info-soft: #F0F9FF;
  --info-border: #BAE6FD;
  --completed: #7C3AED;
  --completed-soft: #F5F3FF;
  --completed-border: #DDD6FE;

  /* Tipografía */
  --font-display: 'Sora', ui-sans-serif, system-ui, sans-serif;
  --font-body: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* Radios */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --radius-full: 9999px;

  /* Sombras */
  --shadow-xs: 0 1px 2px rgba(26,26,24,0.04);
  --shadow-sm: 0 1px 3px rgba(26,26,24,0.06), 0 1px 2px rgba(26,26,24,0.04);
  --shadow-md: 0 4px 8px rgba(26,26,24,0.06), 0 2px 4px rgba(26,26,24,0.04);
  --shadow-lg: 0 8px 24px rgba(26,26,24,0.08), 0 4px 8px rgba(26,26,24,0.04);
  --shadow-xl: 0 16px 48px rgba(26,26,24,0.12), 0 4px 12px rgba(26,26,24,0.06);
}
```

### 13.2 Mapa de Migración de Tokens Existentes

| Token actual | Token nuevo Terraza |
|--------------|---------------------|
| `--accent` (#2563eb) | `--primary` (#0D7C4F) |
| `--accent-fuerte` (#1d4ed8) | `--primary-hover` (#096B43) |
| `--accent-activo` (#1e40af) | `--primary-active` (#075A38) |
| `--accent-texto` (#1d4ed8) | `--primary-text` (#0B6B45) |
| `--accent-suave` (#eff6ff) | `--primary-soft` (#E8F5EE) |
| `--accent-borde` (#bfdbfe) | `--primary-border` (#B2DFCB) |
| `--fondo` (#f6f7f8) | `--bg-base` (#FAFAF7) |
| `--superficie` (#ffffff) | `--bg-surface` (#FFFFFF) |
| `--borde` (#e4e4e7) | `--border-subtle` (#E8E8E0) |
| `--borde-fuerte` (#d4d4d8) | `--border-default` (#D4D4CC) |
| `--titulo` (#18181b) | `--text-heading` (#1A1A18) |
| `--texto` (#3f3f46) | `--text-body` (#40403C) |
| `--tenue` (#71717a) | `--text-muted` (#71716C) |
| `--interaccion` (#f4f4f5) | `--bg-hover` (#EBEBE5) |
| `--exito` (#059669) | `--success` (#16A34A) |
| `--advertencia` (#d97706) | `--warning` (#D97706) |
| `--peligro` (#dc2626) | `--danger` (#DC2626) |
| `--info` (#0284c4) | `--info` (#0284C7) |
| `--realizada` (#7c3aed) | `--completed` (#7C3AED) |

---

## 14. Reglas y Restricciones

### 14.1 Reglas Obligatorias

1. **Ningún componente puede hardcodear colores.** Solo se usan variables CSS (`--token`).
2. **El acento dorado se usa con moderación.** Máximo 1 elemento dorado por vista (CTA principal o badge especial).
3. **El sidebar es siempre sticky.** Nunca se desplaza con el contenido.
4. **El panel derecho es contextual.** Su contenido cambia según la página activa.
5. **Todas las transiciones tienen duración definida.** No hay animaciones sin timing.
6. **Los formularios siempre muestran estado de error en el campo.** No solo en un mensaje general.
7. **Los estados vacíos siempre tienen una acción.** "Sin datos" + botón de crear/agregar.

### 14.2 Anti-patrones (Qué NO hacer)

- ❌ No usar el azul `#2563eb` ni ningún azul genérico como acento principal.
- ❌ No usar `border-radius: 0.375rem` (el old `--radius-md` de 6px). Ahora el md es `8px`.
- ❌ No poner más de 5 items en el bottom nav de móvil.
- ❌ No usar sombras en tarjetas que no son elevadas (las del flujo normal usan solo borde).
- ❌ No hacer el sidebar scrolleable con el contenido. Es independiente.
- ❌ No usar texto menor a 12px en ninguna parte de la interfaz.
- ❌ No usar más de 2 variantes de botones en una misma fila de acciones.

---

## 15. Checklist de Rediseño

Para cada página/componente, verificar:

- [ ] Usa variables CSS del sistema Terraza (no colores hardcodeados)
- [ ] Tipografía sigue la escala definida (Sora para display, Inter para UI)
- [ ] Layout respeta la estructura de 3 columnas en desktop
- [ ] Sidebar es sticky y tiene 264px de ancho
- [ ] Panel derecho es sticky y tiene 320px de ancho (en desktop)
- [ ] Header superior es sticky con 56px de altura
- [ ] Hover states definidos en todos los elementos interactivos
- [ ] Focus visible con `--focus-ring` en todos los elementos interactivos
- [ ] Estados de loading, vacío y error implementados
- [ ] Responsive: 3 col → 2 col (md) → 1 col + bottom nav (sm)
- [ ] Contraste cumple WCAG AA (4.5:1 para texto normal, 3:1 para texto grande)
- [ ] Áreas táctiles ≥ 44px en móvil
- [ ] Transiciones de 150ms en hover, 200ms en apariciones
- [ ] Badges y etiquetas usan la paleta semántica definida

---

*Documento creado como propuesta de rediseño. No modifica código existente.*  
*Sistema de diseño **Terraza** v1.0.0 — SGP Tuluá*
