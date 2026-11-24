"use client";

import { Boton } from "@/components/ui/boton";
import type { ParticipanteFeria } from "@/types/api";

interface ListaParticipantesProps {
  participantes: ParticipanteFeria[];
  bloqueado: boolean;
  onEditar: (participante: ParticipanteFeria) => void;
  onRetirar: (participante: ParticipanteFeria) => void;
}

/** Lista de vendedores activos de la feria. */
export function ListaParticipantes({
  participantes,
  bloqueado,
  onEditar,
  onRetirar,
}: ListaParticipantesProps) {
  return (
    <ul className="grid gap-3">
      {participantes.map((participante) => (
        <li
          key={participante.id}
          className="rounded-xl border border-borde bg-superficie p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-titulo">
                {participante.nombre}
              </h3>
              <p className="mt-1 text-sm text-texto">
                {participante.documento
                  ? `Documento: ${participante.documento}`
                  : "Sin documento registrado"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {participante.productos.length === 0 ? (
                  <span className="text-sm text-tenue">Sin productos</span>
                ) : (
                  participante.productos.map((producto) => (
                    <span
                      key={producto.id}
                      className="rounded-full border border-borde bg-fondo px-2.5 py-0.5 text-xs font-medium text-texto"
                    >
                      {producto.nombre}
                    </span>
                  ))
                )}
              </div>
            </div>
            {!bloqueado ? (
              <div className="flex flex-wrap gap-2">
                <Boton
                  variante="contorno"
                  tamano="sm"
                  onClick={() => onEditar(participante)}
                >
                  Editar
                </Boton>
                <Boton
                  variante="peligro"
                  tamano="sm"
                  onClick={() => onRetirar(participante)}
                >
                  Retirar
                </Boton>
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
