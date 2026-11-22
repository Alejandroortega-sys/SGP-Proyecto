"use client";

import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import type { SolicitudRevisionDetalle } from "@/types/api";
import { describirBloqueo } from "./validaciones-revision";

export function AvisoBloqueoRevision({
  solicitud,
  onReintentar,
  reintentando,
}: {
  solicitud: Pick<
    SolicitudRevisionDetalle,
    "estado" | "bloqueo" | "motivoBloqueo"
  >;
  onReintentar?: () => void;
  reintentando?: boolean;
}) {
  const aviso = describirBloqueo(solicitud);
  const tono =
    aviso.tono === "info"
      ? "informacion"
      : aviso.tono === "advertencia"
        ? "advertencia"
        : "error";

  return (
    <Alerta tono={tono}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>{aviso.texto}</p>
        {!solicitud.bloqueo?.esPropio &&
        (solicitud.estado === "radicada" ||
          solicitud.estado === "en_revision") &&
        onReintentar ? (
          <Boton
            variante="contorno"
            tamano="sm"
            onClick={onReintentar}
            cargando={reintentando}
            className="shrink-0"
          >
            Volver a intentar
          </Boton>
        ) : null}
      </div>
    </Alerta>
  );
}
