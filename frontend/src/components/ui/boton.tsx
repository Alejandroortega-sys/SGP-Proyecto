import type { ComponentProps, ReactNode } from "react";
import { combinarClases } from "@/lib/clases";
import { Spinner } from "./spinner";
import {
  CLASES_BASE,
  CLASES_TAMANO,
  CLASES_VARIANTE,
} from "./estilos-boton";

type Variante = keyof typeof CLASES_VARIANTE;
type Tamano = keyof typeof CLASES_TAMANO;

interface PropiedadesBoton extends Omit<ComponentProps<"button">, "children"> {
  variante?: Variante;
  tamano?: Tamano;
  cargando?: boolean;
  anchoCompleto?: boolean;
  children?: ReactNode;
}

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
        CLASES_BASE,
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
