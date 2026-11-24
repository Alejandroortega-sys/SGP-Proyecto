import type { ReactNode } from "react";
import { combinarClases } from "@/lib/clases";

type Lado = "arriba" | "abajo" | "izquierda" | "derecha";

const CLASES_LADO: Record<Lado, string> = {
  arriba: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  abajo: "top-full left-1/2 mt-2 -translate-x-1/2",
  izquierda: "right-full top-1/2 mr-2 -translate-y-1/2",
  derecha: "left-full top-1/2 ml-2 -translate-y-1/2",
};

interface PropiedadesTooltip {
  /** Texto del tooltip (se recomienda breve). */
  contenido: string;
  lado?: Lado;
  /** Elemento interactivo que dispara el tooltip al pasar el cursor o enfocar. */
  children: ReactNode;
}

/**
 * Tooltip sin JavaScript: se muestra con hover (`group-hover`) y con
 * foco de teclado (`group-focus-within`). El hijo debe ser enfocable
 * (botón, enlace, input…) para que también funcione con teclado.
 */
export function Tooltip({ contenido, lado = "arriba", children }: PropiedadesTooltip) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={combinarClases(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-borde-fuerte bg-elevada px-2 py-1 text-xs font-medium text-titulo opacity-0 shadow-md transition-opacity duration-150",
          "group-hover:opacity-100 group-focus-within:opacity-100",
          CLASES_LADO[lado],
        )}
      >
        {contenido}
      </span>
    </span>
  );
}
