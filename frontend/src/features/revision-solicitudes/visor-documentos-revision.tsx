/* eslint-disable react-hooks/set-state-in-effect -- sincroniza estado local con props y respuestas externas */
"use client";

import { useEffect, useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Cargando } from "@/components/ui/estado-vacio";
import { comoApiError, descargarDocumentoSolicitud } from "@/lib/api-client";
import { formatearFechaHora } from "@/lib/formato";
import type {
  DocumentoRevision,
  RequisitoRevision,
} from "@/types/api";
import { formatearBytes } from "@/features/solicitudes/validaciones-solicitud";

interface VisorDocumentosRevisionProps {
  solicitudId: string;
  requisito: RequisitoRevision | null;
}

interface ArchivoVisible {
  url: string;
  tipo: string;
  nombre: string;
  blob: Blob;
}

function nombreDocumento(documento: DocumentoRevision): string {
  return documento.nombreOriginal ?? documento.tipoDocumento;
}

/** Visor de la versión vigente o de una versión anterior de un requisito. */
export function VisorDocumentosRevision({
  solicitudId,
  requisito,
}: VisorDocumentosRevisionProps) {
  const [documento, setDocumento] = useState<DocumentoRevision | null>(
    requisito?.documentoActual ?? null,
  );
  const [archivo, setArchivo] = useState<ArchivoVisible | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const actual = requisito?.documentoActual ?? null;
    setDocumento(actual);
    setArchivo(null);
    setError(null);
  }, [requisito?.documentoActual, requisito?.id]);

  useEffect(() => {
    if (!documento) {
      setArchivo(null);
      return;
    }

    let cancelado = false;
    let urlTemporal: string | null = null;
    setCargando(true);
    setError(null);

    descargarDocumentoSolicitud(solicitudId, documento.id)
      .then(({ blob }) => {
        if (cancelado) return;
        urlTemporal = URL.createObjectURL(blob);
        setArchivo({
          url: urlTemporal,
          tipo: documento.mimeType ?? blob.type,
          nombre: nombreDocumento(documento),
          blob,
        });
      })
      .catch((capturado) => {
        if (!cancelado) setError(comoApiError(capturado).mensaje);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
      if (urlTemporal) URL.revokeObjectURL(urlTemporal);
    };
  }, [documento, solicitudId]);

  function descargar(): void {
    if (!archivo) return;
    const url = URL.createObjectURL(archivo.blob);
    const enlace = window.document.createElement("a");
    enlace.href = url;
    enlace.download = archivo.nombre;
    window.document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  }

  if (!requisito) {
    return (
      <section className="rounded-xl border border-dashed border-borde bg-fondo p-6 text-center">
        <p className="text-sm font-semibold text-titulo">
          Selecciona un requisito
        </p>
        <p className="mt-1 text-sm text-texto">
          Elige un documento de la lista de verificación para verlo aquí.
        </p>
      </section>
    );
  }

  const versiones = requisito.versiones;
  const esPdf = archivo?.tipo === "application/pdf";
  const esImagen =
    archivo?.tipo === "image/jpeg" || archivo?.tipo === "image/png";

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-borde bg-superficie p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-titulo">Visor de documentos</h2>
          <p className="mt-0.5 truncate text-sm font-medium text-texto">
            {requisito.nombre}
          </p>
          {documento ? (
            <p className="text-xs text-tenue">
              {nombreDocumento(documento)}
              {documento.tamanoBytes !== null
                ? ` · ${formatearBytes(documento.tamanoBytes)}`
                : ""}
            </p>
          ) : null}
        </div>
        <Boton
          variante="contorno"
          tamano="sm"
          onClick={descargar}
          disabled={!archivo}
        >
          Descargar
        </Boton>
      </header>

      {!documento ? (
        <Alerta tono="advertencia">
          Este requisito no tiene un documento vigente.
        </Alerta>
      ) : cargando ? (
        <div className="flex min-h-64 items-center justify-center rounded-lg border border-borde bg-fondo">
          <Cargando texto="Cargando la vista previaâ€¦" />
        </div>
      ) : error ? (
        <Alerta tono="error">{error}</Alerta>
      ) : archivo ? (
        <div className="overflow-hidden rounded-lg border border-borde bg-fondo">
          {esPdf ? (
            <iframe
              title={`Vista previa de ${archivo.nombre}`}
              src={archivo.url}
              className="h-[28rem] w-full bg-white"
            />
          ) : esImagen ? (
            // eslint-disable-next-line @next/next/no-img-element -- la imagen viene de un blob autenticado
            <img
              src={archivo.url}
              alt={`Vista previa de ${archivo.nombre}`}
              className="mx-auto max-h-[28rem] w-auto max-w-full object-contain"
            />
          ) : (
            <p className="p-6 text-sm text-texto">
              No se puede previsualizar este formato. Descárgalo para
              consultarlo.
            </p>
          )}
        </div>
      ) : null}

      {versiones.length > 1 ? (
        <div className="border-t border-borde pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-tenue">
            Versiones
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {versiones.map((version) => (
              <li key={version.id}>
                <button
                  type="button"
                  onClick={() => setDocumento(version)}
                  aria-pressed={documento?.id === version.id}
                  className={
                    documento?.id === version.id
                      ? "min-h-9 rounded-lg border border-primario bg-primario-suave px-3 py-1.5 text-xs font-semibold text-primario"
                      : "min-h-9 rounded-lg border border-borde px-3 py-1.5 text-xs font-medium text-texto hover:bg-fondo"
                  }
                >
                  Versión {version.numeroVersion}
                  {version.esActual ? " (vigente)" : ""}
                </button>
              </li>
            ))}
          </ul>
          {documento && !documento.esActual ? (
            <p className="mt-2 text-xs text-amber-800">
              Estás viendo una versión anterior cargada el{" "}
              {formatearFechaHora(documento.cargadoEn)}.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

