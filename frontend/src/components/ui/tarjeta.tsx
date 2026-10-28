import type { ComponentProps, ReactNode } from "react";
import { combinarClases } from "@/lib/clases";

export function Tarjeta({
  className,
  children,
  ...resto
}: ComponentProps<"div">) {
  return (
    <div
      className={combinarClases(
        "rounded-xl border border-borde bg-superficie shadow-sm",
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
        "border-b border-borde px-5 py-4 sm:px-6",
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
  return (
    <div className={combinarClases("px-5 py-5 sm:px-6", className)}>
      {children}
    </div>
  );
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
        "border-t border-borde px-5 py-4 text-center sm:px-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
