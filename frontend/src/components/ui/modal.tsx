"use client";

import { useEffect, type ReactNode } from "react";
import { combinarClases } from "@/lib/clases";
import { Boton } from "./boton";
import { IconoCerrar } from "./iconos";

const MAX_ANCHO = {
  sm: "max-w-[400px]",
  md: "max-w-lg",
  lg: "max-w-[680px]",
  xl: "max-w-[860px]",
} as const;

export function Modal({
  abierto,
  titulo,
  descripcion,
  onCerrar,
  tamano = "md",
  children,
}: {
  abierto: boolean;
  titulo: string;
  descripcion?: string;
  onCerrar: () => void;
  /** Ancho máximo del diálogo — docs/DESIGN.md §9.6. */
  tamano?: keyof typeof MAX_ANCHO;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-velo p-4 backdrop-blur-sm sm:items-center"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        aria-describedby={descripcion ? "modal-descripcion" : undefined}
        className={combinarClases(
          "max-h-[85dvh] w-full overflow-y-auto rounded-2xl border border-borde bg-superficie p-5 shadow-xl sm:p-6",
          MAX_ANCHO[tamano],
        )}
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="modal-titulo" className="text-lg font-bold text-titulo">
              {titulo}
            </h2>
            {descripcion ? (
              <p id="modal-descripcion" className="mt-1 text-sm text-texto">
                {descripcion}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-tenue transition-colors duration-150 hover:bg-interaccion hover:text-titulo"
          >
            <IconoCerrar className="size-5" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export function AccionesModal({
  onCancelar,
  onConfirmar,
  textoConfirmar = "Confirmar",
  variante = "solido",
  cargando = false,
  deshabilitado = false,
}: {
  onCancelar: () => void;
  onConfirmar: () => void;
  textoConfirmar?: string;
  variante?: "solido" | "peligro";
  cargando?: boolean;
  deshabilitado?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Boton variante="fantasma" onClick={onCancelar}>
        Cancelar
      </Boton>
      <Boton
        variante={variante}
        onClick={onConfirmar}
        cargando={cargando}
        disabled={deshabilitado}
      >
        {textoConfirmar}
      </Boton>
    </div>
  );
}
