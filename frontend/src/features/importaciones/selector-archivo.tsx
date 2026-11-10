"use client";

import { useId, useState, type DragEvent } from "react";
import { Boton } from "@/components/ui/boton";
import type { TipoImportacion } from "@/types/api";
import {
  EXTENSIONES_IMPORTACION,
  formatearBytes,
} from "./validaciones-importacion";

interface SelectorArchivoProps {
  tipo: TipoImportacion;
  archivo: File | null;
  error?: string | null;
  deshabilitado?: boolean;
  onCambiar: (archivo: File | null) => void;
}

/** Selector de archivo con arrastrar y soltar y validación visual. */
export function SelectorArchivo({
  tipo,
  archivo,
  error,
  deshabilitado = false,
  onCambiar,
}: SelectorArchivoProps) {
  const id = useId();
  const idError = `${id}-error`;
  const [arrastrando, setArrastrando] = useState(false);

  function soltar(evento: DragEvent<HTMLDivElement>): void {
    evento.preventDefault();
    setArrastrando(false);
    if (deshabilitado) return;
    const seleccionado = evento.dataTransfer.files?.[0] ?? null;
    if (seleccionado) onCambiar(seleccionado);
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-titulo">
        Archivo {tipo === "zonas" ? "GeoJSON" : "CSV"}
        <span className="ml-1 text-xs font-normal text-tenue">
          ({tipo === "zonas" ? ".geojson o .json" : ".csv"}, máximo{" "}
          {formatearBytes(10 * 1024 * 1024)})
        </span>
      </label>

      <div
        onDragOver={(evento) => {
          evento.preventDefault();
          if (!deshabilitado) setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={soltar}
        className={[
          "rounded-xl border-2 border-dashed p-4 transition-colors",
          arrastrando
            ? "border-primario bg-primario-suave"
            : "border-borde bg-fondo",
          error ? "border-rose-400" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <input
          id={id}
          type="file"
          accept={EXTENSIONES_IMPORTACION[tipo]}
          disabled={deshabilitado}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? idError : undefined}
          onChange={(evento) => {
            const seleccionado = evento.target.files?.[0] ?? null;
            onCambiar(seleccionado);
          }}
          className="block w-full cursor-pointer rounded-lg border border-borde bg-white px-3 py-2 text-sm text-texto file:mr-3 file:rounded-md file:border-0 file:bg-primario file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-primario-hover disabled:cursor-not-allowed disabled:opacity-60"
        />
        <p className="mt-2 text-xs text-tenue">
          También puedes arrastrar el archivo y soltarlo aquí.
        </p>
      </div>

      {error ? (
        <p id={idError} className="text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {archivo ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-borde bg-superficie px-3 py-2 text-sm">
          <span className="min-w-0 truncate text-texto">
            <span className="font-semibold text-titulo">{archivo.name}</span>{" "}
            <span className="text-tenue">({formatearBytes(archivo.size)})</span>
          </span>
          <Boton
            variante="fantasma"
            tamano="sm"
            disabled={deshabilitado}
            onClick={() => onCambiar(null)}
          >
            Quitar archivo
          </Boton>
        </div>
      ) : null}
    </div>
  );
}
