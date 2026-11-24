---
name: frontend
description: Úsala al crear o refactorizar cualquier UI de la plataforma (componentes, layouts, páginas, estilos). Aplica el sistema de diseño del proyecto.
---

# Restricciones absolutas
- Solo puedes leer y modificar archivos dentro de /frontend. Nada fuera de esa carpeta
  (ni raíz, ni backend, ni configs externas, ni .opencode).
- NO hagas commits, ni git add, ni push, ni cambies de rama. El usuario gestiona git.
- NO instales dependencias. Usa solo lo que ya está en package.json y next/font.
- NO toques lógica: hooks, fetch, rutas, tipos ni props públicas. Solo JSX, clases y CSS.
- Si algo requiere salir de estas reglas, detente y pregúntalo.

# Dirección de diseño
Plataforma profesional para desarrolladores: sobria, densa, rápida y consistente.
Referencias SOLO de criterio (no copiar layouts, textos ni logos, y no extraer su paleta):
- Vercel docs: minimalismo, sidebar limpio, código protagonista.
- Revolut: jerarquía tipográfica clara, espacio en blanco, micro-interacciones.
- UEFA Champions League: contraste y presencia de los titulares.

# Paleta
No hay paleta definida. Propón una neutra y profesional:
- Grises neutros para bg, surface, border y texto.
- UN solo color de acento, definido en una única variable (--accent) para cambiarlo luego sin tocar componentes.
- Colores semánticos sobrios: success, warning, danger.
- Modo claro y oscuro con contraste AA.
- Todo el color vive en tokens (CSS variables). Prohibido hardcodear colores en componentes.

# Sistema
- Tokens en globals.css: colores, radios (6/8/12), sombras suaves, espaciado en múltiplos de 4px.
- Tipografía con next/font: una sans moderna + una mono para código.
  Escala 12/13/14/16/20/24/32/48, pesos 400/500/600.
- Componentes en components/ui/: Button (primary/secondary/ghost/danger), Input, Card, Badge,
  Tabs, Modal, Tooltip, Skeleton, EmptyState, CodeBlock.
  Si ya existe un equivalente, refactorízalo en vez de duplicarlo.
- Todo elemento interactivo: hover, focus-visible, disabled y loading.
- Transiciones CSS de 150–200 ms, respetando prefers-reduced-motion.
- Iconos como SVG inline.

# Específico de agente de código
- Chat/stream con buen ritmo y estado del agente visible (pensando / ejecutando / error / listo).
- CodeBlock: mono, botón copiar, nombre de archivo.
- Diffs y terminal con colores semánticos sobrios.
- Siempre diseñar estados de carga (skeleton), vacío (con acción) y error (con reintento).

# Al terminar cada tarea
Correr build y lint desde /frontend, listar archivos modificados y pendientes.
No commitear: el usuario lo hará.