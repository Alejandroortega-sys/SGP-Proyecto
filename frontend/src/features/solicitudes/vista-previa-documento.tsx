"use client";

import { useEffect, useMemo } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Modal } from "@/components/ui/modal";

export interface ArchivoVistaPrevia {
  nombre: string;
  tipo: string;
  blob: Blob;
}

interface VistaPreviaDocumentoProps {
  abierto: boolean;
  archivo: ArchivoVistaPrevia | null;
  onCerrar: () => void;
  onDescargar?: () => void;
}

function esImagen(tipo: string): boolean {
  return tipo === "image/jpeg" || tipo === "image/png";
}

function esPdf(tipo: string): boolean {
  return tipo === "application/pdf";
}

/** Vista previa autenticada de un PDF o imagen, sin exponer una URL pública. */
export function VistaPreviaDocumento({
  abierto,
  archivo,
  onCerrar,
  onDescargar,
}: VistaPreviaDocumentoProps) {
  const url = useMemo(
    () => (archivo ? URL.createObjectURL(archivo.blob) : null),
    [archivo],
  );

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  return (
    <Modal
      abierto={abierto}
      titulo={archivo?.nombre ?? "Vista previa del documento"}
      descripcion="Vista previa del archivo asociado a tu solicitud."
      onCerrar={onCerrar}
    >
      <div className="flex flex-col gap-4">
        {!archivo || !url ? (
          <Alerta tono="informacion">Selecciona un documento para verlo.</Alerta>
        ) : esImagen(archivo.tipo) ? (
          // eslint-disable-next-line @next/next/no-img-element -- la imagen llega como blob autenticado
          <img
            src={url}
            alt={`Vista previa de ${archivo.nombre}`}
            className="mx-auto max-h-[65vh] w-auto max-w-full rounded-lg border border-borde object-contain"
          />
        ) : esPdf(archivo.tipo) ? (
          <iframe
            src={url}
            title={`Vista previa de ${archivo.nombre}`}
            className="h-[65vh] w-full rounded-lg border border-borde bg-superficie"
          />
        ) : (
          <Alerta tono="advertencia">
            Este tipo de archivo no se puede previsualizar en el navegador.
          </Alerta>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton variante="fantasma" onClick={onCerrar}>
            Cerrar
          </Boton>
          {onDescargar && archivo ? (
            <Boton variante="contorno" onClick={onDescargar}>
              Descargar
            </Boton>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
