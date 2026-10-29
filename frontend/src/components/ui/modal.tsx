"use client";

import { useEffect, type ReactNode } from "react";
import { Boton } from "./boton";

export function Modal({
  abierto,
  titulo,
  descripcion,
  onCerrar,
  children,
}: {
  abierto: boolean;
  titulo: string;
  descripcion?: string;
  onCerrar: () => void;
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        aria-describedby={descripcion ? "modal-descripcion" : undefined}
        className="w-full max-w-lg rounded-xl border border-borde bg-superficie p-5 shadow-xl sm:p-6"
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
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-tenue hover:bg-slate-100 hover:text-titulo"
          >
            ✕
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
