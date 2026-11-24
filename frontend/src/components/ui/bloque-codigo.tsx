"use client";

import { useRef, useState } from "react";
import { combinarClases } from "@/lib/clases";
import { IconoArchivoCodigo, IconoCheck, IconoCopiar } from "./iconos";

interface PropiedadesBloqueCodigo {
  /** Nombre de archivo que se muestra en la cabecera. */
  nombreArchivo?: string;
  /** Contenido en texto plano (sin resaltado). */
  codigo: string;
  className?: string;
}

/** Bloque de código con nombre de archivo y botón de copiar. */
export function BloqueCodigo({
  nombreArchivo,
  codigo,
  className,
}: PropiedadesBloqueCodigo) {
  const [copiado, setCopiado] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setCopiado(false), 2000);
    } catch {
      // El portapapeles no está disponible (permiso o contexto no seguro):
      // no hacemos nada; el usuario aún puede seleccionar el texto.
    }
  }

  return (
    <figure
      className={combinarClases(
        "overflow-hidden rounded-lg border border-codigo-borde bg-codigo-fondo",
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-2 border-b border-codigo-borde px-3 py-2">
        <span className="flex min-w-0 items-center gap-2 font-mono text-xs text-codigo-tenue">
          <IconoArchivoCodigo className="size-4 shrink-0" />
          <span className="truncate">{nombreArchivo ?? "fragmento.txt"}</span>
        </span>
        <button
          type="button"
          onClick={copiar}
          aria-label={copiado ? "Código copiado" : "Copiar código"}
          className={combinarClases(
            "inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md px-2 font-mono text-xs font-medium transition-colors duration-150",
            "text-codigo-tenue hover:bg-codigo-hover hover:text-codigo-texto",
            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
          )}
        >
          {copiado ? (
            <IconoCheck className="size-3.5" />
          ) : (
            <IconoCopiar className="size-3.5" />
          )}
          <span>{copiado ? "Copiado" : "Copiar"}</span>
        </button>
      </figcaption>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-sm leading-relaxed text-codigo-texto">
        <code>{codigo}</code>
      </pre>
    </figure>
  );
}
