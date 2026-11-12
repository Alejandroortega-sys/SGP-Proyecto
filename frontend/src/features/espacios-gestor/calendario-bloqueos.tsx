"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/boton";
import type { BloqueoEspacioGestor } from "@/types/api";
import {
  DIAS_SEMANA,
  bloqueosDelDia,
  desplazarMes,
  generarCuadricula,
  mesActual,
  nombreMes,
  type MesCalendario,
} from "./calendario-utilidades";

interface CalendarioBloqueosProps {
  bloqueos: BloqueoEspacioGestor[];
  onSeleccionarDia?: (fecha: string) => void;
  onEditarBloqueo?: (bloqueo: BloqueoEspacioGestor) => void;
}

/** Calendario mensual propio para visualizar y gestionar bloqueos. */
export function CalendarioBloqueos({
  bloqueos,
  onSeleccionarDia,
  onEditarBloqueo,
}: CalendarioBloqueosProps) {
  const [mes, setMes] = useState<MesCalendario>(() => {
    const primero = bloqueos[0];
    if (primero) {
      const [anio, numeroMes] = primero.fechaInicio
        .slice(0, 10)
        .split("-")
        .map(Number);
      if (anio && numeroMes) return { anio, mes: numeroMes };
    }
    return mesActual();
  });

  const dias = generarCuadricula(mes);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Boton
            variante="contorno"
            tamano="sm"
            aria-label="Mes anterior"
            onClick={() => setMes((actual) => desplazarMes(actual, -1))}
          >
            ←
          </Boton>
          <h3 className="min-w-44 text-center text-base font-bold capitalize text-titulo">
            {nombreMes(mes)}
          </h3>
          <Boton
            variante="contorno"
            tamano="sm"
            aria-label="Mes siguiente"
            onClick={() => setMes((actual) => desplazarMes(actual, 1))}
          >
            →
          </Boton>
        </div>
        <Boton
          variante="fantasma"
          tamano="sm"
          onClick={() => setMes(mesActual())}
        >
          Hoy
        </Boton>
      </div>

      <div className="overflow-hidden rounded-lg border border-borde">
        <div className="grid grid-cols-7 bg-fondo">
          {DIAS_SEMANA.map((dia) => (
            <span
              key={dia}
              className="px-1 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-tenue"
            >
              {dia}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {dias.map((dia) => {
            const delDia = bloqueosDelDia(dia.fecha, bloqueos);
            const principales = delDia.slice(0, 2);
            return (
              <button
                key={dia.fecha}
                type="button"
                onClick={() => onSeleccionarDia?.(dia.fecha)}
                aria-label={
                  delDia.length > 0
                    ? `${dia.fecha}: ${delDia.length} bloqueo(s)`
                    : dia.fecha
                }
                className={[
                  "min-h-16 border-b border-r border-borde p-1 text-left align-top transition-colors last:border-r-0",
                  dia.delMes ? "bg-superficie" : "bg-fondo/60",
                  delDia.length > 0 ? "hover:bg-primario-suave" : "hover:bg-slate-50",
                ].join(" ")}
              >
                <span
                  className={[
                    "block text-xs font-semibold",
                    dia.delMes ? "text-titulo" : "text-tenue/60",
                  ].join(" ")}
                >
                  {dia.dia}
                </span>
                <span className="mt-1 flex flex-col gap-0.5">
                  {principales.map((bloqueo) => (
                    <span
                      key={bloqueo.id}
                      className="block truncate rounded bg-sky-100 px-1 py-0.5 text-[10px] font-medium text-sky-800"
                      title={bloqueo.motivo ?? "Bloqueo"}
                    >
                      {bloqueo.motivo ?? "Bloqueo"}
                    </span>
                  ))}
                  {delDia.length > 2 ? (
                    <span className="text-[10px] font-semibold text-tenue">
                      +{delDia.length - 2} más
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {bloqueos.length > 0 ? (
        <div className="rounded-lg border border-borde bg-fondo p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-tenue">
            Bloqueos del periodo
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {bloqueos.map((bloqueo) => (
              <li
                key={bloqueo.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="text-texto">
                  {bloqueo.fechaInicio} a {bloqueo.fechaFin}
                  {bloqueo.motivo ? ` · ${bloqueo.motivo}` : ""}
                </span>
                {onEditarBloqueo ? (
                  <button
                    type="button"
                    className="font-semibold text-primario hover:underline"
                    onClick={() => onEditarBloqueo(bloqueo)}
                  >
                    Editar
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-tenue">
          Este espacio no tiene bloqueos registrados.
        </p>
      )}
    </div>
  );
}
