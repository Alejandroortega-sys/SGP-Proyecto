import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { combinarClases } from "@/lib/clases";
import {
  CLASES_BASE,
  CLASES_TAMANO,
  CLASES_VARIANTE,
} from "./estilos-boton";

type Variante = keyof typeof CLASES_VARIANTE;
type Tamano = keyof typeof CLASES_TAMANO;

interface PropiedadesEnlaceBoton
  extends Omit<ComponentProps<typeof Link>, "children"> {
  variante?: Variante;
  tamano?: Tamano;
  anchoCompleto?: boolean;
  children?: ReactNode;
}

/**
 * Enlace con la misma apariencia y estados que <Boton> (hover,
 * focus-visible, tamaños y variantes). Úsalo en vez de duplicar
 * clases de botón dentro de <Link>.
 */
export function EnlaceBoton({
  variante = "solido",
  tamano = "md",
  anchoCompleto = false,
  className,
  children,
  ...resto
}: PropiedadesEnlaceBoton) {
  return (
    <Link
      className={combinarClases(
        CLASES_BASE,
        CLASES_VARIANTE[variante],
        CLASES_TAMANO[tamano],
        anchoCompleto && "w-full",
        className,
      )}
      {...resto}
    >
      {children}
    </Link>
  );
}
