import type { ReactNode } from "react";
import { combinarClases } from "@/lib/clases";
import {
  IconoAlerta,
  IconoCheck,
  IconoInformacion,
} from "./iconos";

type Tono = "exito" | "error" | "advertencia" | "informacion";

const CLASES_TONO: Record<Tono, string> = {
  exito: "border-exito-borde bg-exito-suave text-exito-texto",
  error: "border-peligro-borde bg-peligro-suave text-peligro-texto",
  advertencia: "border-advertencia-borde bg-advertencia-suave text-advertencia-texto",
  informacion: "border-info-borde bg-info-suave text-info-texto",
};

interface PropiedadesAlerta {
  tono: Tono;
  children: ReactNode;
  className?: string;
  conIcono?: boolean;
}

export function Alerta({
  tono,
  children,
  className,
  conIcono = true,
}: PropiedadesAlerta) {
  const icono =
    tono === "exito" ? (
      <IconoCheck className="mt-0.5 size-5" />
    ) : tono === "error" || tono === "advertencia" ? (
      <IconoAlerta className="mt-0.5 size-5" />
    ) : (
      <IconoInformacion className="mt-0.5 size-5" />
    );

  return (
    <div
      role={tono === "exito" || tono === "informacion" ? "status" : "alert"}
      className={combinarClases(
        "flex gap-3 rounded-lg border px-4 py-3 text-sm leading-relaxed",
        CLASES_TONO[tono],
        className,
      )}
    >
      {conIcono ? icono : null}
      <div className="min-w-0 whitespace-pre-line break-words">
        {children}
      </div>
    </div>
  );
}
