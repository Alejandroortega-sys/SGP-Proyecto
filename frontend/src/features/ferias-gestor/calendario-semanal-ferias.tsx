"use client";

import type { EventoAgendaFeria, ZonaFeriaGestor } from "@/types/api";
import {
  DIAS_SEMANA,
  diasDeSemana,
  eventosDelDia,
  eventosDeZona,
  formatearCorta,
  iniciaEnDia,
} from "./calendario-ferias-utilidades";
import { estiloEstado } from "./estilos-estado-feria";

interface CalendarioSemanalFeriasProps {
  fecha: string;
  zonas: ZonaFeriaGestor[];
  eventos: EventoAgendaFeria[];
  onSeleccionar: (evento: EventoAgendaFeria) => void;
}

/** Semana con una fila por zona y siete columnas de días. */
export function CalendarioSemanalFerias({
  fecha,
  zonas,
  eventos,
  onSeleccionar,
}: CalendarioSemanalFeriasProps) {
  const dias = diasDeSemana(fecha);

  return (
    <div className="flex flex-col gap-4">
      <div className="hidden overflow-hidden rounded-xl border border-borde bg-superficie md:block">
        <div className="grid grid-cols-[8rem_repeat(7,minmax(0,1fr))] bg-fondo">
          <span className="px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-tenue">
            Zona
          </span>
          {dias.map((dia, indice) => (
            <span
              key={dia}
              className="border-l border-borde px-1 py-2 text-center text-[11px] font-semibold text-texto"
            >
              <span className="block text-tenue">{DIAS_SEMANA[indice]}</span>
              <span className="block text-titulo">{formatearCorta(dia)}</span>
            </span>
          ))}
        </div>

        {zonas.map((zona) => {
          const deZona = eventosDeZona(eventos, zona.id);
          return (
            <div
              key={zona.id}
              data-testid={`zona-semana-${zona.id}`}
              className="grid grid-cols-[8rem_repeat(7,minmax(0,1fr))] border-t border-borde"
            >
              <div className="px-2 py-2">
                <p className="text-xs font-bold text-titulo">{zona.nombre}</p>
                <p className="mt-0.5 text-[10px] text-tenue">
                  Aforo {zona.aforoMaximo ?? "sin definir"}
                </p>
              </div>
              {dias.map((dia) => {
                const delDia = eventosDelDia(dia, deZona);
                return (
                  <div
                    key={`${zona.id}-${dia}`}
                    className="min-h-20 border-l border-borde p-1"
                  >
                    <span className="flex flex-col gap-1">
                      {delDia.map((evento) => {
                        const estilo = estiloEstado(evento.estado);
                        return (
                          <button
                            key={evento.id}
                            type="button"
                            onClick={() => onSeleccionar(evento)}
                            aria-label={`${evento.nombre}, ${evento.zona.nombre}, ${estilo.etiqueta}, ${formatearCorta(dia)}`}
                            title={`${evento.nombre} · ${estilo.etiqueta}`}
                            className={[
                              "flex min-h-11 items-start gap-1 rounded border px-1 py-1 text-left text-[10px] font-semibold leading-tight hover:brightness-95",
                              estilo.chip,
                            ].join(" ")}
                          >
                            <span aria-hidden="true">{estilo.simbolo}</span>
                            <span className="min-w-0">
                              <span className="block truncate">
                                {evento.nombre}
                              </span>
                              {iniciaEnDia(evento, dia) ? (
                                <span className="block truncate font-normal opacity-80">
                                  {evento.zona.nombre}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {dias.map((dia, indice) => {
          const delDia = eventosDelDia(dia, eventos);
          return (
            <div
              key={dia}
              className="rounded-xl border border-borde bg-superficie p-3"
            >
              <p className="text-sm font-bold text-titulo">
                {DIAS_SEMANA[indice]} {formatearCorta(dia)}
              </p>
              {delDia.length === 0 ? (
                <p className="mt-1 text-xs text-tenue">Sin eventos.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {delDia.map((evento) => {
                    const estilo = estiloEstado(evento.estado);
                    return (
                      <li key={evento.id}>
                        <button
                          type="button"
                          onClick={() => onSeleccionar(evento)}
                          className={[
                            "flex min-h-11 w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm",
                            estilo.chip,
                          ].join(" ")}
                        >
                          <span aria-hidden="true" className="mt-0.5">
                            {estilo.simbolo}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">
                              {evento.nombre}
                            </span>
                            <span className="block truncate text-xs opacity-80">
                              {evento.zona.nombre} · {estilo.etiqueta}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {zonas.length === 0 ? (
        <p className="rounded-lg border border-borde bg-fondo p-4 text-sm text-tenue">
          No hay zonas activas para mostrar en esta semana.
        </p>
      ) : null}
    </div>
  );
}
