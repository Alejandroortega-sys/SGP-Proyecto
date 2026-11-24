/**
 * Clases compartidas entre <Boton> y <EnlaceBoton> para que un botón y un
 * enlace estilizado como botón nunca diverjan visualmente.
 *
 * Estados según docs/DESIGN.md §7.1–§7.5:
 * - solido/dorado: hover con elevación (-1 px) y sombra suave.
 * - contorno: hover con fondo Cañaduzo suave y borde del mismo tono.
 * - fantasma: solo cambio de fondo/texto.
 * - disabled: opacidad 50 % y sin efectos de hover.
 */

export const CLASES_BASE =
  "inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-150 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export const CLASES_VARIANTE = {
  solido:
    "bg-primario text-primario-contraste hover:bg-primario-hover hover:-translate-y-px hover:shadow-sm " +
    "active:bg-primario-activo active:translate-y-0 " +
    "disabled:hover:bg-primario disabled:hover:translate-y-0 disabled:hover:shadow-none",
  contorno:
    "border border-borde-fuerte bg-superficie text-titulo " +
    "hover:border-primario-borde hover:bg-primario-suave hover:text-primario-texto " +
    "active:scale-[0.98] active:bg-primario-suave",
  fantasma:
    "text-texto hover:bg-interaccion hover:text-titulo active:bg-interaccion-fuerte",
  dorado:
    "bg-dorado text-white hover:bg-dorado-hover hover:-translate-y-px hover:shadow-sm " +
    "active:bg-dorado-activo active:translate-y-0 " +
    "disabled:hover:bg-dorado disabled:hover:translate-y-0 disabled:hover:shadow-none",
  peligro:
    "bg-peligro text-white hover:bg-peligro-fuerte active:bg-peligro-activo",
} as const;

export const CLASES_TAMANO = {
  sm: "min-h-9 gap-1.5 px-3 py-1.5 text-sm",
  md: "min-h-10 gap-2 px-4 py-2 text-sm",
  lg: "min-h-11 gap-2 px-5 py-2.5 text-base",
} as const;
