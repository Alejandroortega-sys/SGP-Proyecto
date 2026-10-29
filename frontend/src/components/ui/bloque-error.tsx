"use client";

import { Alerta } from "./alerta";
import { Boton } from "./boton";
import type { ApiError } from "@/lib/api-client";

export function BloqueError({
  error,
  onReintentar,
}: {
  error: ApiError;
  onReintentar?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Alerta tono="error">{error.mensaje}</Alerta>
      {onReintentar ? (
        <Boton variante="contorno" tamano="sm" onClick={onReintentar}>
          Reintentar
        </Boton>
      ) : null}
    </div>
  );
}
