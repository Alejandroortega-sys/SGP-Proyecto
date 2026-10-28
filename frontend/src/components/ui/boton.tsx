import type { ComponentProps, ReactNode } from "react";
import { combinarClases } from "@/lib/clases";
import { Spinner } from "./spinner";

type Variante = "solido" | "contorno" | "fantasma" | "peligro";
type Tamano = "sm" | "md" | "lg";

interface PropiedadesBoton extends Omit<ComponentProps<"button">, "children"> {
  variante?: Variante;
  tamano?: Tamano;
  cargando?: boolean;
  anchoCompleto?: boolean;
  children?: ReactNode;
}

const CLASES_VARIANTE: Record<Variante, string> = {
  solido:
    "bg-primario text-white hover:bg-primario-hover active:bg-primario-activo disabled:hover:bg-primario",
  contorno:
    "border border-primario bg-white text-primario hover:bg-primario-suave active:bg-primario-suave",
  fantasma: "text-texto hover:bg-slate-100 active:bg-slate-200",
  peligro: "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800",
};

const CLASES_TAMANO: Record<Tamano, string> = {
  sm: "min-h-9 gap-1.5 px-3 py-1.5 text-sm",
  md: "min-h-11 gap-2 px-4 py-2.5 text-sm",
  lg: "min-h-12 gap-2 px-6 py-3 text-base",
};

export function Boton({
  variante = "solido",
  tamano = "md",
  cargando = false,
  anchoCompleto = false,
  className,
  children,
  disabled,
  type = "button",
  ...resto
}: PropiedadesBoton) {
  return (
    <button
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando}
      className={combinarClases(
        "inline-flex items-center justify-center rounded-lg font-semibold transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario",
        "disabled:cursor-not-allowed disabled:opacity-60",
        CLASES_VARIANTE[variante],
        CLASES_TAMANO[tamano],
        anchoCompleto && "w-full",
        className,
      )}
      {...resto}
    >
      {cargando ? <Spinner className="size-4" /> : null}
      {children}
    </button>
  );
}
