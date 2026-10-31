"use client";

import { Boton } from "./boton";

export function Paginacion({
  pagina,
  totalPaginas,
  onCambiar,
}: {
  pagina: number;
  totalPaginas: number;
  onCambiar: (pagina: number) => void;
}) {
  if (totalPaginas <= 1) return null;

  return (
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-borde px-4 py-3"
    >
      <p className="text-sm text-texto">
        Página <span className="font-semibold">{pagina}</span> de{" "}
        <span className="font-semibold">{totalPaginas}</span>
      </p>
      <div className="flex items-center gap-2">
        <Boton
          variante="contorno"
          tamano="sm"
          disabled={pagina <= 1}
          onClick={() => onCambiar(pagina - 1)}
        >
          Anterior
        </Boton>
        <Boton
          variante="contorno"
          tamano="sm"
          disabled={pagina >= totalPaginas}
          onClick={() => onCambiar(pagina + 1)}
        >
          Siguiente
        </Boton>
      </div>
    </nav>
  );
}
