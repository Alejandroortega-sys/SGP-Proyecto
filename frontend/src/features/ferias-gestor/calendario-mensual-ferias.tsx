"use client";

import type { EventoAgendaFeria } from "@/types/api";
import {
  DIAS_SEMANA,
  eventosDelDia,
  formatearCorta,
  iniciaEnDia,
  type DiaCalendario,
  type MesCalendario,
} from "./calendario-ferias-utilidades";
import { estiloEstado } from "./estilos-estado-feria";

interface CalendarioMensualFeriasProps {
  mes: MesCalendario;
  dias: DiaCalendario[];
  eventos: EventoAgendaFeria[];
  onSeleccionar: (evento: EventoAgendaFeria) => void;
}

/** Cuadrícula mensual con las ferias y eventos de cada día. */
export function CalendarioMensualFerias({
  mes,
  dias,
  eventos,
  onSeleccionar,
}: CalendarioMensualFeriasProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
      <div className="grid grid-cols-7 bg-fondo">
        {DIAS_SEMANA.map((dia) => (
          <span
            key={dia}
            className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-tenue sm:text-[11px]"
          >
            {dia}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((dia) => {
          const delDia = eventosDelDia(dia.fecha, eventos);
          const visibles = delDia.slice(0, 2);
          const restantes = delDia.length - visibles.length;
          return (
            <div
              key={dia.fecha}
              className={[
                "min-h-24 border-b border-r border-borde p-1 align-top last:border-r-0 sm:min-h-32 sm:p-1.5",
                dia.delMes ? "bg-superficie" : "bg-fondo/60",
              ].join(" ")}
            >
              <span
                className={[
                  "mb-1 block text-xs font-semibold",
                  dia.delMes ? "text-titulo" : "text-tenue/60",
                ].join(" ")}
              >
                {dia.dia}
              </span>
              <span className="flex flex-col gap-1">
                {visibles.map((evento) => {
                  const estilo = estiloEstado(evento.estado);
                  return (
                    <button
                      key={evento.id}
                      type="button"
                      onClick={() => onSeleccionar(evento)}
                      title={`${evento.nombre} · ${evento.zona.nombre} · ${estilo.etiqueta}`}
                      aria-label={`${evento.nombre}, ${evento.zona.nombre}, ${estilo.etiqueta}, del ${formatearCorta(evento.fechaInicio)} al ${formatearCorta(evento.fechaFin)}`}
                      className={[
                        "flex min-h-11 w-full items-start gap-1 overflow-hidden rounded border px-1 py-1 text-left text-[10px] font-semibold leading-tight transition-colors hover:brightness-95 sm:text-[11px]",
                        estilo.chip,
                      ].join(" ")}
                    >
                      <span aria-hidden="true" className="shrink-0">
                        {estilo.simbolo}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate">{evento.nombre}</span>
                        {iniciaEnDia(evento, dia.fecha) ? (
                          <span className="block truncate font-normal opacity-80">
                            {evento.zona.nombre}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
                {restantes > 0 ? (
                  <span className="px-1 text-[10px] font-semibold text-tenue">
                    +{restantes} más
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
      <p className="border-t border-borde bg-fondo px-3 py-2 text-xs text-tenue">
        {mes.anio} · Cada tarjeta indica el estado con color, símbolo y texto en
        el detalle.
      </p>
    </div>
  );
}
