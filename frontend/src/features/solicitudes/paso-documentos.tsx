"use client";

import { useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Cargando } from "@/components/ui/estado-vacio";
import { IconoCerrar } from "@/components/ui/iconos";
import type { RequisitoDocumental } from "@/types/api";
import {
  formatearBytes,
  validarArchivoDocumento,
  type ArchivoAdjuntoSolicitud,
  type ErroresSolicitud,
} from "./validaciones-solicitud";

interface PasoDocumentosProps {
  requisitos: RequisitoDocumental[];
  adjuntos: ArchivoAdjuntoSolicitud[];
  errores: ErroresSolicitud;
  cargandoRequisitos: boolean;
  onAdjuntar: (requisitoId: string, archivo: File) => void;
  onQuitar: (requisitoId: string) => void;
}

/** Tercer paso: documentos obligatorios y opcionales de la actividad. */
export function PasoDocumentos({
  requisitos,
  adjuntos,
  errores,
  cargandoRequisitos,
  onAdjuntar,
  onQuitar,
}: PasoDocumentosProps) {
  const [erroresArchivo, setErroresArchivo] = useState<
    Record<string, string | null>
  >({});

  function elegirArchivo(requisitoId: string, archivo: File | undefined): void {
    if (!archivo) return;
    const error = validarArchivoDocumento(archivo);
    setErroresArchivo((actual) => ({ ...actual, [requisitoId]: error }));
    if (!error) onAdjuntar(requisitoId, archivo);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-bold text-titulo">Documentos</h2>
        <p className="mt-1 text-sm text-texto">
          Adjunta los documentos exigidos para la actividad del espacio. Los
          marcados como obligatorios deben estar presentes para radicar.
        </p>
      </div>

      <Alerta tono="informacion" conIcono={false}>
        Formatos permitidos: PDF, JPG y PNG. Tamaño máximo: 5 MB por archivo.
      </Alerta>

      {errores.documentos ? (
        <Alerta tono="error">{errores.documentos}</Alerta>
      ) : null}

      {cargandoRequisitos ? (
        <div className="rounded-xl border border-borde bg-superficie">
          <Cargando texto="Consultando los requisitos documentales…" />
        </div>
      ) : requisitos.length === 0 ? (
        <Alerta tono="advertencia">
          No hay requisitos documentales configurados para esta actividad.
        </Alerta>
      ) : (
        <div className="flex flex-col gap-3">
          {requisitos.map((requisito) => {
            const adjunto = adjuntos.find(
              (candidato) => candidato.requisitoId === requisito.id,
            );
            const idArchivo = `documento-${requisito.id}`;
            const errorArchivo = erroresArchivo[requisito.id];

            return (
              <section
                key={requisito.id}
                className="rounded-xl border border-borde bg-superficie p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-titulo">
                      {requisito.nombre}
                    </h3>
                    {requisito.descripcion ? (
                      <p className="mt-1 text-xs text-texto">
                        {requisito.descripcion}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={
                      requisito.obligatorio
                        ? "rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700"
                        : "rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700"
                    }
                  >
                    {requisito.obligatorio ? "Obligatorio" : "Opcional"}
                  </span>
                </div>

                {adjunto ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-emerald-800">
                        {adjunto.nombre}
                      </p>
                      <p className="text-xs text-emerald-700">
                        {formatearBytes(adjunto.tamano)}
                      </p>
                    </div>
                    <Boton
                      variante="fantasma"
                      tamano="sm"
                      onClick={() => onQuitar(requisito.id)}
                      aria-label={`Quitar ${requisito.nombre}`}
                    >
                      <IconoCerrar className="size-4" />
                      Quitar
                    </Boton>
                  </div>
                ) : (
                  <div className="mt-3">
                    <input
                      id={idArchivo}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      className="sr-only"
                      aria-label={`Adjuntar ${requisito.nombre}`}
                      onChange={(evento) => {
                        elegirArchivo(requisito.id, evento.target.files?.[0]);
                        evento.target.value = "";
                      }}
                    />
                    <label
                      htmlFor={idArchivo}
                      className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-primario bg-white px-4 py-2 text-sm font-semibold text-primario hover:bg-primario-suave"
                    >
                      Adjuntar archivo
                    </label>
                  </div>
                )}

                {errorArchivo ? (
                  <p className="mt-2 text-sm text-rose-700">{errorArchivo}</p>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
