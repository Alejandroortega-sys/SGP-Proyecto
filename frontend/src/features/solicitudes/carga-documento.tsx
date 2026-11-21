"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { Boton } from "@/components/ui/boton";
import {
  comoApiError,
  cargarDocumentoSolicitud,
} from "@/lib/api-client";
import type {
  ProgresoSubida,
  RequisitoSolicitudEstado,
  RespuestaCargaDocumentoSolicitud,
} from "@/types/api";
import {
  TAMANO_MAXIMO_DOCUMENTO,
  formatearBytes,
  validarArchivoDocumento,
} from "./validaciones-solicitud";
import {
  VistaPreviaDocumento,
  type ArchivoVistaPrevia,
} from "./vista-previa-documento";

interface CargaDocumentoProps {
  solicitudId: string;
  requisito: RequisitoSolicitudEstado;
  reemplazo: boolean;
  onCargado: (respuesta: RespuestaCargaDocumentoSolicitud) => void;
  onCancelar: () => void;
}

/** Selector, vista previa y carga de un documento con progreso real. */
export function CargaDocumento({
  solicitudId,
  requisito,
  reemplazo,
  onCargado,
  onCancelar,
}: CargaDocumentoProps) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<ProgresoSubida | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState(false);
  const idArchivo = `carga-documento-${requisito.id}`;

  const archivoVistaPrevia = useMemo<ArchivoVistaPrevia | null>(
    () =>
      archivo
        ? {
            nombre: archivo.name,
            tipo: archivo.type,
            blob: archivo,
          }
        : null,
    [archivo],
  );

  function elegir(evento: ChangeEvent<HTMLInputElement>): void {
    const seleccionado = evento.target.files?.[0];
    evento.target.value = "";
    if (!seleccionado) return;

    const validacion = validarArchivoDocumento(seleccionado);
    setError(validacion);
    setProgreso(null);
    if (validacion) return;
    setArchivo(seleccionado);
  }

  async function subir(): Promise<void> {
    if (!archivo || subiendo) return;
    setError(null);
    setProgreso({ cargados: 0, total: archivo.size, porcentaje: 0 });
    setSubiendo(true);

    try {
      const respuesta = await cargarDocumentoSolicitud(
        solicitudId,
        requisito.id,
        archivo,
        setProgreso,
      );
      setArchivo(null);
      setProgreso(null);
      onCargado(respuesta);
    } catch (fallo) {
      setError(comoApiError(fallo).mensaje);
    } finally {
      setSubiendo(false);
    }
  }

  function cancelar(): void {
    if (subiendo) return;
    setArchivo(null);
    setError(null);
    setProgreso(null);
    onCancelar();
  }

  return (
    <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-titulo">
            {reemplazo ? "Reemplazar documento" : "Adjuntar documento"}
          </p>
          <p className="mt-0.5 text-xs text-texto">
            PDF, JPG o PNG. Máximo {formatearBytes(TAMANO_MAXIMO_DOCUMENTO)} por
            archivo.
          </p>
        </div>
        <Boton
          variante="fantasma"
          tamano="sm"
          onClick={cancelar}
          disabled={subiendo}
        >
          Cancelar
        </Boton>
      </div>

      {archivo ? (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-borde bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-titulo">
                {archivo.name}
              </p>
              <p className="text-xs text-tenue">{formatearBytes(archivo.size)}</p>
            </div>
            <Boton
              variante="contorno"
              tamano="sm"
              onClick={() => setVistaPrevia(true)}
              disabled={subiendo}
            >
              Ver vista previa
            </Boton>
          </div>

          {progreso ? (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-texto">
                <span>{subiendo ? "Subiendo documento…" : "Carga completada"}</span>
                <span>{progreso.porcentaje}%</span>
              </div>
              <div
                role="progressbar"
                aria-label="Progreso de la carga del documento"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progreso.porcentaje}
                className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
              >
                <div
                  className="h-full rounded-full bg-primario transition-[width] duration-200"
                  style={{ width: `${progreso.porcentaje}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Boton variante="fantasma" onClick={cancelar} disabled={subiendo}>
              Elegir otro archivo
            </Boton>
            <Boton onClick={() => void subir()} cargando={subiendo}>
              {reemplazo ? "Subir reemplazo" : "Subir documento"}
            </Boton>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <input
            id={idArchivo}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            className="sr-only"
            aria-label={`Adjuntar ${requisito.nombre}`}
            onChange={elegir}
          />
          <label
            htmlFor={idArchivo}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-primario bg-white px-4 py-2 text-sm font-semibold text-primario hover:bg-primario-suave"
          >
            {reemplazo ? "Elegir archivo de reemplazo" : "Elegir archivo"}
          </label>
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <VistaPreviaDocumento
        abierto={vistaPrevia}
        archivo={archivoVistaPrevia}
        onCerrar={() => setVistaPrevia(false)}
      />
    </div>
  );
}
