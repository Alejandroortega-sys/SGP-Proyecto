import type { ComponentProps, ReactNode } from "react";
import { combinarClases } from "@/lib/clases";

/**
 * Tarjeta — docs/DESIGN.md §9.3.
 * - Reposo: borde sutil + sombra xs (sin elevar el ruido visual).
 * - `interactiva`: hover con borde más firme y sombra sm.
 * - `destacada`: barra izquierda de 3 px en Cañaduzo + sombra sm.
 */
export function Tarjeta({
  className,
  children,
  interactiva = false,
  destacada = false,
  ...resto
}: ComponentProps<"div"> & {
  interactiva?: boolean;
  destacada?: boolean;
}) {
  return (
    <div
      className={combinarClases(
        "rounded-xl border border-borde bg-superficie shadow-xs",
        destacada && "border-l-[3px] border-l-primario shadow-sm",
        interactiva &&
          "transition-all duration-200 hover:border-borde-fuerte hover:shadow-sm",
        className,
      )}
      {...resto}
    >
      {children}
    </div>
  );
}

export function TarjetaEncabezado({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={combinarClases(
        "border-b border-borde px-5 py-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TarjetaCuerpo({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={combinarClases("p-5", className)}>{children}</div>;
}

export function TarjetaPie({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={combinarClases(
        "border-t border-borde px-5 py-4 text-center",
        className,
      )}
    >
      {children}
    </div>
  );
}
