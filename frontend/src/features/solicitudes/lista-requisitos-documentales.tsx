"use client";

import { useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import {
  comoApiError,
  descargarDocumentoSolicitud,
} from "@/lib/api-client";
import { formatearFechaHora } from "@/lib/formato";
import type {
  DocumentoVersionSolicitud,
  RequisitoSolicitudEstado,
  RespuestaCargaDocumentoSolicitud,
} from "@/types/api";
import { CargaDocumento } from "./carga-documento";
import {
  CLASES_ESTADO_REQUISITO,
  DESCRIPCIONES_ESTADO_REQUISITO,
  ETIQUETAS_ESTADO_REQUISITO,
} from "./estado-requisito";
import { formatearBytes } from "./validaciones-solicitud";
import {
  VistaPreviaDocumento,
  type ArchivoVistaPrevia,
} from "./vista-previa-documento";

interface ListaRequisitosDocumentalesProps {
  solicitudId: string;
  requisitos: RequisitoSolicitudEstado[];
  puedeCargar: boolean;
  onDocumentoCargado: (respuesta: RespuestaCargaDocumentoSolicitud) => void;
}

function nombreDocumento(documento: DocumentoVersionSolicitud): string {
  return documento.nombreOriginal ?? documento.tipoDocumento;
}

function TarjetaRequisito({
  solicitudId,
  requisito,
  puedeCargar,
  onDocumentoCargado,
}: {
  solicitudId: string;
  requisito: RequisitoSolicitudEstado;
  puedeCargar: boolean;
  onDocumentoCargado: (respuesta: RespuestaCargaDocumentoSolicitud) => void;
}) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState<string | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<ArchivoVistaPrevia | null>(
    null,
  );
  const [documentoVista, setDocumentoVista] =
    useState<DocumentoVersionSolicitud | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const actual = requisito.documentoActual;
  const versionesAnteriores = requisito.versiones.filter(
    (version) => !version.esActual,
  );

  async function ver(documento: DocumentoVersionSolicitud): Promise<void> {
    setError(null);
    setDescargando(documento.id);
    try {
      const { blob, nombreArchivo } = await descargarDocumentoSolicitud(
        solicitudId,
        documento.id,
      );
      setDocumentoVista(documento);
      setVistaPrevia({
        nombre:
          documento.nombreOriginal ??
          nombreArchivo ??
          nombreDocumento(documento),
        tipo: documento.mimeType ?? blob.type,
        blob,
      });
      setModalAbierto(true);
    } catch (fallo) {
      setError(comoApiError(fallo).mensaje);
    } finally {
      setDescargando(null);
    }
  }

  async function descargar(documento: DocumentoVersionSolicitud): Promise<void> {
    setError(null);
    setDescargando(documento.id);
    try {
      const { blob, nombreArchivo } = await descargarDocumentoSolicitud(
        solicitudId,
        documento.id,
      );
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download =
        documento.nombreOriginal ??
        nombreArchivo ??
        nombreDocumento(documento);
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
    } catch (fallo) {
      setError(comoApiError(fallo).mensaje);
    } finally {
      setDescargando(null);
    }
  }

  return (
    <section className="rounded-xl border border-borde bg-superficie p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-titulo">{requisito.nombre}</h3>
          {requisito.descripcion ? (
            <p className="mt-1 text-xs text-texto">{requisito.descripcion}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CLASES_ESTADO_REQUISITO[requisito.estado]}`}
            title={DESCRIPCIONES_ESTADO_REQUISITO[requisito.estado]}
          >
            {ETIQUETAS_ESTADO_REQUISITO[requisito.estado]}
          </span>
          <span className="rounded-full border border-borde bg-interaccion px-2.5 py-0.5 text-xs font-semibold text-texto">
            {requisito.obligatorio ? "Obligatorio" : "Opcional"}
          </span>
        </div>
      </div>

      {actual ? (
        <div className="mt-3 rounded-lg border border-borde bg-fondo px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-titulo">
                {nombreDocumento(actual)}
              </p>
              <p className="text-xs text-tenue">
                Versión {actual.numeroVersion} ·{" "}
                {actual.tamanoBytes !== null
                  ? `${formatearBytes(actual.tamanoBytes)} · `
                  : ""}
                {formatearFechaHora(actual.cargadoEn)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Boton
                variante="contorno"
                tamano="sm"
                onClick={() => void ver(actual)}
                cargando={descargando === actual.id}
                aria-label={`Vista previa de ${requisito.nombre}`}
              >
                Vista previa
              </Boton>
              <Boton
                variante="fantasma"
                tamano="sm"
                onClick={() => void descargar(actual)}
                cargando={descargando === actual.id}
                aria-label={`Descargar ${requisito.nombre}`}
              >
                Descargar
              </Boton>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed border-borde bg-fondo px-3 py-2 text-sm text-tenue">
          Todavía no has adjuntado este documento.
        </p>
      )}

      {requisito.estado === "no_cumple" && actual?.observacion ? (
        <div className="mt-3">
          <Alerta tono="advertencia">
            <p className="font-semibold">Observación del gestor</p>
            <p className="mt-1">{actual.observacion}</p>
          </Alerta>
        </div>
      ) : null}

      {versionesAnteriores.length > 0 ? (
        <details className="mt-3 rounded-lg border border-borde bg-fondo px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-accent-texto">
            Versiones anteriores ({versionesAnteriores.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {versionesAnteriores.map((version) => (
              <li
                key={version.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-borde bg-superficie px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-titulo">
                    {nombreDocumento(version)}
                  </p>
                  <p className="text-xs text-tenue">
                    Versión {version.numeroVersion} ·{" "}
                    {ETIQUETAS_ESTADO_REQUISITO[
                      version.estado === "validado"
                        ? "cumple"
                        : version.estado === "observado"
                          ? "no_cumple"
                          : "cargado"
                    ]}{" "}
                    · {formatearFechaHora(version.cargadoEn)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Boton
                    variante="contorno"
                    tamano="sm"
                    onClick={() => void ver(version)}
                    cargando={descargando === version.id}
                    aria-label={`Ver versión ${version.numeroVersion} de ${requisito.nombre}`}
                  >
                    Ver
                  </Boton>
                  <Boton
                    variante="fantasma"
                    tamano="sm"
                    onClick={() => void descargar(version)}
                    cargando={descargando === version.id}
                    aria-label={`Descargar versión ${version.numeroVersion} de ${requisito.nombre}`}
                  >
                    Descargar
                  </Boton>
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {puedeCargar && !cargando ? (
        <div className="mt-3">
          <Boton
            variante={actual ? "contorno" : "solido"}
            tamano="sm"
            onClick={() => setCargando(true)}
            aria-label={`${actual ? "Reemplazar" : "Adjuntar"} ${requisito.nombre}`}
          >
            {actual ? "Reemplazar documento" : "Adjuntar documento"}
          </Boton>
        </div>
      ) : null}

      {puedeCargar && cargando ? (
        <CargaDocumento
          solicitudId={solicitudId}
          requisito={requisito}
          reemplazo={actual !== null}
          onCargado={(respuesta) => {
            setCargando(false);
            onDocumentoCargado(respuesta);
          }}
          onCancelar={() => setCargando(false)}
        />
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-peligro-texto">
          {error}
        </p>
      ) : null}

      <VistaPreviaDocumento
        abierto={modalAbierto}
        archivo={vistaPrevia}
        onCerrar={() => {
          setModalAbierto(false);
          setVistaPrevia(null);
          setDocumentoVista(null);
        }}
        onDescargar={
          documentoVista
            ? () => void descargar(documentoVista)
            : undefined
        }
      />
    </section>
  );
}

/** Lista de requisitos con estado, versión vigente y versiones anteriores. */
export function ListaRequisitosDocumentales({
  solicitudId,
  requisitos,
  puedeCargar,
  onDocumentoCargado,
}: ListaRequisitosDocumentalesProps) {
  if (requisitos.length === 0) {
    return (
      <Alerta tono="advertencia">
        No hay requisitos documentales configurados para la actividad de esta
        solicitud.
      </Alerta>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {requisitos.map((requisito) => (
        <TarjetaRequisito
          key={requisito.id}
          solicitudId={solicitudId}
          requisito={requisito}
          puedeCargar={puedeCargar}
          onDocumentoCargado={onDocumentoCargado}
        />
      ))}
    </div>
  );
}
