"use client";

import { useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Cargando } from "@/components/ui/estado-vacio";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import {
  comoApiError,
  descargarDocumentoSolicitud,
  listarRequisitosSolicitud,
  type ApiError,
} from "@/lib/api-client";
import { formatearFechaHora } from "@/lib/formato";
import type {
  DocumentoSolicitud,
  RespuestaCargaDocumentoSolicitud,
  RespuestaRequisitosSolicitud,
} from "@/types/api";
import { ListaRequisitosDocumentales } from "./lista-requisitos-documentales";
import { formatearBytes } from "./validaciones-solicitud";
import {
  VistaPreviaDocumento,
  type ArchivoVistaPrevia,
} from "./vista-previa-documento";

interface DocumentosSolicitudProps {
  solicitudId: string;
  onActualizar?: () => void;
}

function OtrosDocumentos({
  solicitudId,
  documentos,
}: {
  solicitudId: string;
  documentos: DocumentoSolicitud[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState<string | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<ArchivoVistaPrevia | null>(
    null,
  );
  const [modalAbierto, setModalAbierto] = useState(false);

  if (documentos.length === 0) return null;

  async function abrirPreview(documento: DocumentoSolicitud): Promise<void> {
    setError(null);
    setDescargando(documento.id);
    try {
      const { blob, nombreArchivo } = await descargarDocumentoSolicitud(
        solicitudId,
        documento.id,
      );
      setVistaPrevia({
        nombre:
          documento.nombreOriginal ??
          nombreArchivo ??
          documento.tipoDocumento,
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

  return (
    <section className="rounded-xl border border-borde bg-superficie p-4">
      <h2 className="text-sm font-bold text-titulo">
        Documentos anteriores sin requisito asociado
      </h2>
      <p className="mt-1 text-xs text-tenue">
        Son documentos que ya estaban registrados antes de configurar el
        catálogo actual. Puedes consultarlos, pero para el trámite cuentan los
        requisitos de arriba.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {documentos.map((documento) => (
          <li
            key={documento.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-borde bg-fondo px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-titulo">
                {documento.nombreOriginal ?? documento.tipoDocumento}
              </p>
              <p className="text-xs text-tenue">
                {documento.tamanoBytes !== null
                  ? `${formatearBytes(documento.tamanoBytes)} · `
                  : ""}
                {formatearFechaHora(documento.cargadoEn)}
              </p>
            </div>
            <Boton
              variante="contorno"
              tamano="sm"
              onClick={() => void abrirPreview(documento)}
              cargando={descargando === documento.id}
            >
              Vista previa
            </Boton>
          </li>
        ))}
      </ul>
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
        }}
      />
    </section>
  );
}

/** Sección de documentos de una solicitud con requisitos y versionado. */
export function DocumentosSolicitud({
  solicitudId,
  onActualizar,
}: DocumentosSolicitudProps) {
  const { datos, cargando, error, recargar } = useConsultaApi(
    () => listarRequisitosSolicitud(solicitudId),
    [solicitudId],
  );
  const [mensaje, setMensaje] = useState<string | null>(null);

  function documentoCargado(
    respuesta: RespuestaCargaDocumentoSolicitud,
  ): void {
    setMensaje(
      respuesta.volvioARevision
        ? "Documento guardado. Corregiste todos los requisitos observados y la solicitud volvió a «En revisión»."
        : respuesta.mensaje,
    );
    recargar();
    onActualizar?.();
  }

  if (cargando && !datos) {
    return (
      <section className="rounded-xl border border-borde bg-superficie">
        <Cargando texto="Cargando los requisitos documentales…" />
      </section>
    );
  }

  if (error && !datos) {
    return (
      <section className="rounded-xl border border-borde bg-superficie p-4">
        <BloqueError error={error} onReintentar={recargar} />
      </section>
    );
  }

  if (!datos) return null;

  return (
    <ContenidoDocumentos
      datos={datos}
      mensaje={mensaje}
      error={error}
      onDocumentoCargado={documentoCargado}
      onRecargar={recargar}
      solicitudId={solicitudId}
    />
  );
}

function ContenidoDocumentos({
  datos,
  mensaje,
  error,
  solicitudId,
  onDocumentoCargado,
  onRecargar,
}: {
  datos: RespuestaRequisitosSolicitud;
  mensaje: string | null;
  error: ApiError | null;
  solicitudId: string;
  onDocumentoCargado: (respuesta: RespuestaCargaDocumentoSolicitud) => void;
  onRecargar: () => void;
}) {
  const faltantesObligatorios = datos.requisitos.filter(
    (requisito) => requisito.obligatorio && requisito.estado === "faltante",
  );
  const noCumple = datos.requisitos.filter(
    (requisito) => requisito.estado === "no_cumple",
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-titulo">Documentos</h2>
          <p className="mt-1 text-sm text-texto">
            Adjunta los documentos exigidos para la actividad y corrige los que
            el gestor haya observado. Al reemplazar un documento se conserva la
            versión anterior.
          </p>
        </div>
        <p className="text-sm text-texto">
          {datos.requisitos.filter((requisito) => requisito.documentoActual).length}{" "}
          de {datos.requisitos.length} requisitos con documento
        </p>
      </div>

      {mensaje ? (
        <Alerta tono="exito">{mensaje}</Alerta>
      ) : null}

      {!datos.puedeCargar ? (
        <Alerta tono="informacion">
          {datos.motivoBloqueo ??
            "La solicitud no admite cambios de documentos en su estado actual."}
        </Alerta>
      ) : null}

      {datos.estado === "devuelta" && noCumple.length > 0 ? (
        <Alerta tono="advertencia">
          El gestor marcó {noCumple.length} documento(s) como «No cumple».
          Reemplázalos para que la solicitud vuelva a «En revisión».
        </Alerta>
      ) : null}

      {faltantesObligatorios.length > 0 ? (
        <Alerta tono="advertencia">
          <p className="font-semibold">Faltan documentos obligatorios</p>
          <ul className="mt-1 list-inside list-disc">
            {faltantesObligatorios.map((requisito) => (
              <li key={requisito.id}>{requisito.nombre}</li>
            ))}
          </ul>
        </Alerta>
      ) : null}

      {error ? (
        <Alerta tono="error">
          No se pudieron actualizar los requisitos: {error.mensaje}.{" "}
          <button
            type="button"
            onClick={onRecargar}
            className="font-semibold underline"
          >
            Reintentar
          </button>
        </Alerta>
      ) : null}

      <ListaRequisitosDocumentales
        solicitudId={solicitudId}
        requisitos={datos.requisitos}
        puedeCargar={datos.puedeCargar}
        onDocumentoCargado={onDocumentoCargado}
      />

      <OtrosDocumentos
        solicitudId={solicitudId}
        documentos={datos.otrosDocumentos}
      />
    </section>
  );
}
