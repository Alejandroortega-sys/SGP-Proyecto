"use client";

import { useEffect, useId, useState } from "react";
import { Boton } from "@/components/ui/boton";
import { urlArchivo } from "@/lib/api-client";
import { ACEPTAR_TIPOS_FOTO, MAX_BYTES_FOTO } from "./validaciones-modulo";

interface CampoFotoProps {
  foto: File | null;
  fotoActualUrl: string | null;
  error?: string | null;
  onCambiar: (foto: File | null) => void;
}

/** Selector de foto con vista previa y validación previa en el navegador. */
export function CampoFoto({
  foto,
  fotoActualUrl,
  error,
  onCambiar,
}: CampoFotoProps) {
  const id = useId();
  const idError = `${id}-error`;
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);

  useEffect(() => {
    if (!foto) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- la vista previa se sincroniza con el archivo elegido
      setVistaPrevia(null);
      return;
    }
    const url = URL.createObjectURL(foto);
    setVistaPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  const imagen = vistaPrevia ?? urlArchivo(fotoActualUrl);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-titulo">
          Foto del puesto
          <span className="ml-1 text-xs font-normal text-tenue">
            (opcional, JPG/PNG/WebP, máximo 5 MB)
          </span>
        </label>
        <input
          id={id}
          type="file"
          accept={ACEPTAR_TIPOS_FOTO}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? idError : undefined}
          onChange={(evento) => {
            const archivo = evento.target.files?.[0] ?? null;
            onCambiar(archivo);
          }}
          className="block w-full cursor-pointer rounded-lg border border-borde bg-white px-3 py-2 text-sm text-texto file:mr-3 file:rounded-md file:border-0 file:bg-primario file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-primario-hover"
        />
        {error ? (
          <p id={idError} className="text-sm text-rose-700">
            {error}
          </p>
        ) : (
          <p className="text-xs text-tenue">
            La foto se valida por tipo real y tamaño al guardar. Se mostrará en
            la ficha del módulo.
          </p>
        )}
      </div>

      {imagen ? (
        <div className="overflow-hidden rounded-lg border border-borde bg-fondo">
          {/* eslint-disable-next-line @next/next/no-img-element -- la foto viene del backend local y no requiere optimización */}
          <img
            src={imagen}
            alt="Vista previa de la foto del puesto"
            className="h-48 w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-borde bg-fondo text-sm text-tenue">
          Sin foto seleccionada
        </div>
      )}

      {foto ? (
        <div className="flex items-center justify-between gap-3 text-xs text-tenue">
          <span className="min-w-0 truncate">{foto.name}</span>
          <Boton
            variante="fantasma"
            tamano="sm"
            onClick={() => onCambiar(null)}
          >
            Quitar selección
          </Boton>
        </div>
      ) : null}

      <p className="sr-only">
        Tamaño máximo permitido: {Math.floor(MAX_BYTES_FOTO / (1024 * 1024))} MB.
      </p>
    </div>
  );
}
