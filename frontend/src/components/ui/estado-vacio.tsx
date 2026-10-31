import type { ReactNode } from "react";
import { Spinner } from "./spinner";

export function EstadoVacio({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <p className="text-base font-semibold text-titulo">{titulo}</p>
      {descripcion ? (
        <p className="max-w-md text-sm text-texto">{descripcion}</p>
      ) : null}
      {accion ? <div className="mt-3">{accion}</div> : null}
    </div>
  );
}

export function Cargando({ texto = "Cargando información…" }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 px-4 py-12 text-sm text-texto">
      <Spinner className="size-5 animate-spin text-primario" />
      <span>{texto}</span>
    </div>
  );
}
