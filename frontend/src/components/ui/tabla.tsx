import type { ReactNode } from "react";
import { combinarClases } from "@/lib/clases";

export function Tabla({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table
        className={combinarClases(
          "min-w-full border-collapse text-left text-sm",
          className,
        )}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={combinarClases(
        "whitespace-nowrap border-b border-borde bg-fondo px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-tenue",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={combinarClases(
        "border-b border-borde px-3 py-3 align-top text-texto",
        className,
      )}
    >
      {children}
    </td>
  );
}
