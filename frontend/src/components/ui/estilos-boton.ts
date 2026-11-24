/**
 * Clases compartidas entre <Boton> y <EnlaceBoton> para que un botón y un
 * enlace estilizado como botón nunca diverjan visualmente.
 */

export const CLASES_BASE =
  "inline-flex items-center justify-center rounded-lg font-semibold transition-colors duration-150 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export const CLASES_VARIANTE = {
  solido:
    "bg-primario text-white hover:bg-primario-hover active:bg-primario-activo disabled:hover:bg-primario",
  contorno:
    "border border-borde-fuerte bg-superficie text-titulo hover:border-accent-borde hover:bg-accent-suave hover:text-accent-texto active:bg-accent-suave",
  fantasma:
    "text-texto hover:bg-interaccion hover:text-titulo active:bg-interaccion-fuerte",
  peligro:
    "bg-peligro text-white hover:bg-peligro-fuerte active:bg-peligro-activo",
} as const;

export const CLASES_TAMANO = {
  sm: "min-h-9 gap-1.5 px-3 py-1.5 text-sm",
  md: "min-h-10 gap-2 px-4 py-2 text-sm",
  lg: "min-h-11 gap-2 px-5 py-2.5 text-base",
} as const;
