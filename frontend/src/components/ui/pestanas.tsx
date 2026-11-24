"use client";

import { useId, type KeyboardEvent, type ReactNode } from "react";
import { combinarClases } from "@/lib/clases";

export interface Pestana {
  id: string;
  texto: string;
}

interface PropiedadesPestanas {
  /** Definición de las pestañas (id + texto visible). */
  pestanas: Pestana[];
  /** id de la pestaña activa (componente controlado). */
  activa: string;
  onCambiar: (id: string) => void;
  /**
   * Prefijo para conectar `role="tab"` y `role="tabpanel"` vía aria.
   * Pásalo también a <PestanaPanel> para mantener el enlace accesible.
   */
  idBase?: string;
  className?: string;
}

export function Pestanas({
  pestanas,
  activa,
  onCambiar,
  idBase: idBaseExterno,
  className,
}: PropiedadesPestanas) {
  const idGenerado = useId();
  const idBase = idBaseExterno ?? idGenerado;

  function alPulsarTecla(evento: KeyboardEvent<HTMLDivElement>) {
    if (pestanas.length === 0) return;
    const indice = pestanas.findIndex((pestana) => pestana.id === activa);
    if (evento.key === "ArrowRight") {
      evento.preventDefault();
      const siguiente = pestanas[(indice + 1) % pestanas.length];
      onCambiar(siguiente.id);
    } else if (evento.key === "ArrowLeft") {
      evento.preventDefault();
      const anterior = pestanas[(indice - 1 + pestanas.length) % pestanas.length];
      onCambiar(anterior.id);
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Pestañas"
      onKeyDown={alPulsarTecla}
      className={combinarClases("flex gap-1 overflow-x-auto border-b border-borde", className)}
    >
      {pestanas.map((pestana) => {
        const esActiva = pestana.id === activa;
        return (
          <button
            key={pestana.id}
            type="button"
            role="tab"
            id={`${idBase}-${pestana.id}`}
            aria-selected={esActiva}
            aria-controls={`${idBase}-${pestana.id}-panel`}
            tabIndex={esActiva ? 0 : -1}
            onClick={() => onCambiar(pestana.id)}
            className={combinarClases(
              "relative mb-[-1px] min-h-10 shrink-0 whitespace-nowrap rounded-t-md px-3.5 text-sm font-medium transition-colors duration-150",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
              esActiva
                ? "text-accent-texto after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent"
                : "text-tenue hover:text-texto",
            )}
          >
            {pestana.texto}
          </button>
        );
      })}
    </div>
  );
}

interface PropiedadesPestanaPanel {
  /** id de la pestaña a la que pertenece este panel. */
  idPestana: string;
  /** Mismo prefijo usado en <Pestanas>. */
  idBase: string;
  activa: boolean;
  children: ReactNode;
  className?: string;
}

export function PestanaPanel({
  idPestana,
  idBase,
  activa,
  children,
  className,
}: PropiedadesPestanaPanel) {
  return (
    <div
      role="tabpanel"
      id={`${idBase}-${idPestana}-panel`}
      aria-labelledby={`${idBase}-${idPestana}`}
      hidden={!activa}
      className={combinarClases("pt-4", className)}
    >
      {children}
    </div>
  );
}
