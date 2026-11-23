"use client";

import { useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";

/** Tamaño máximo de cada adjunto: 5 MB, igual que en el backend. */
export const MAX_BYTES_ADJUNTO = 5 * 1024 * 1024;

/** Cantidad máxima de adjuntos por feria. */
export const MAX_ADJUNTOS_FERIA = 10;

const MIMES_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

/** Formatea un tamaño en bytes de forma legible. */
export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AdjuntosFeriaProps {
  archivos: File[];
  onAgregar: (archivos: File[]) => void;
  onQuitar: (indice: number) => void;
  error?: string;
  deshabilitado?: boolean;
}

/** Selector de documentación opcional del evento con vista previa local. */
export function AdjuntosFeria({
  archivos,
  onAgregar,
  onQuitar,
  error,
  deshabilitado = false,
}: AdjuntosFeriaProps) {
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  function seleccionar(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    const nuevos = Array.from(lista);
    const errores: string[] = [];

    if (archivos.length + nuevos.length > MAX_ADJUNTOS_FERIA) {
      errores.push(
        `Puedes adjuntar como máximo ${MAX_ADJUNTOS_FERIA} documentos.`,
      );
    }

    for (const archivo of nuevos) {
      if (!MIMES_PERMITIDOS.includes(archivo.type.toLowerCase())) {
        errores.push(`${archivo.name}: solo se permiten PDF, JPG o PNG.`);
      }
      if (archivo.size > MAX_BYTES_ADJUNTO) {
        errores.push(`${archivo.name}: supera el límite de 5 MB.`);
      }
    }

    if (errores.length > 0) {
      setErrorLocal(errores.join(" "));
      return;
    }

    setErrorLocal(null);
    onAgregar(nuevos);
  }

  function previsualizar(archivo: File) {
    const url = URL.createObjectURL(archivo);
    window.open(url, "_blank", "noopener,noreferrer");
    // El navegador libera la URL al cerrar la pestaña; se revoca al cabo de un
    // tiempo para no filtrar memoria si la pestaña sigue abierta.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-titulo">Adjuntos del evento</h2>
        <p className="mt-1 text-sm text-texto">
          Puedes adjuntar actas, permisos o documentación de la feria. Es
          opcional: máximo 10 archivos PDF, JPG o PNG de 5 MB cada uno.
        </p>
      </div>

      <div>
        <label
          htmlFor="adjuntos-feria"
          className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-primario bg-white px-4 py-2.5 text-sm font-semibold text-primario hover:bg-primario-suave"
        >
          Seleccionar archivos
        </label>
        <input
          id="adjuntos-feria"
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="sr-only"
          disabled={deshabilitado}
          onChange={(evento) => {
            seleccionar(evento.target.files);
            evento.target.value = "";
          }}
        />
        <p className="mt-1 text-xs text-tenue">
          Los archivos se envían al radicar la feria.
        </p>
      </div>

      {errorLocal ? <Alerta tono="error">{errorLocal}</Alerta> : null}
      {error ? <Alerta tono="error">{error}</Alerta> : null}

      {archivos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-borde bg-fondo px-4 py-6 text-center text-sm text-tenue">
          No has adjuntado documentos.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {archivos.map((archivo, indice) => (
            <li
              key={`${archivo.name}-${archivo.lastModified}-${indice}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-borde bg-superficie px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-titulo">
                  {archivo.name}
                </p>
                <p className="text-xs text-tenue">
                  {formatearTamano(archivo.size)}
                </p>
              </div>
              <div className="flex gap-1">
                <Boton
                  variante="fantasma"
                  tamano="sm"
                  onClick={() => previsualizar(archivo)}
                >
                  Vista previa
                </Boton>
                <Boton
                  variante="fantasma"
                  tamano="sm"
                  onClick={() => onQuitar(indice)}
                  disabled={deshabilitado}
                >
                  Quitar
                </Boton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
