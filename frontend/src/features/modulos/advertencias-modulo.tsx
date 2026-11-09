"use client";

import { useId } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Etiqueta } from "@/components/ui/etiqueta";
import {
  ETIQUETAS_TIPO,
  formatearAforo,
  formatearHorario,
  formatearProductos,
} from "@/features/mapa/estilos-zona";
import type {
  AdvertenciaModulo,
  ZonaContenedoraModulo,
} from "@/types/api";
import {
  ETIQUETAS_ADVERTENCIA,
  TONO_ADVERTENCIA,
} from "./estilos-modulo";

interface AdvertenciasModuloProps {
  zona: ZonaContenedoraModulo | null;
  advertencias: AdvertenciaModulo[];
  requiereConfirmacion: boolean;
  aceptaAdvertencia?: boolean;
  onAceptar?: (acepta: boolean) => void;
}

/** Muestra la zona contenedora, sus restricciones y las advertencias. */
export function AdvertenciasModulo({
  zona,
  advertencias,
  requiereConfirmacion,
  aceptaAdvertencia = false,
  onAceptar,
}: AdvertenciasModuloProps) {
  const idAceptacion = useId();

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-lg border border-borde bg-fondo px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-titulo">Zona contenedora</h3>
          {zona ? (
            <Etiqueta
              tono={
                zona.tipo === "permitida"
                  ? "exitoso"
                  : zona.tipo === "restringida"
                    ? "pendiente"
                    : "peligro"
              }
            >
              {ETIQUETAS_TIPO[zona.tipo]}
            </Etiqueta>
          ) : (
            <Etiqueta tono="neutro">Sin zona</Etiqueta>
          )}
        </div>

        {zona ? (
          <>
            <p className="mt-2 text-sm font-semibold text-titulo">
              {zona.nombre}
            </p>
            <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase text-tenue">
                  Horario
                </dt>
                <dd className="mt-0.5 text-texto">
                  {formatearHorario({
                    inicio: zona.horarioInicio,
                    fin: zona.horarioFin,
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-tenue">
                  Aforo
                </dt>
                <dd className="mt-0.5 text-texto">
                  {formatearAforo(zona.aforoMaximo)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase text-tenue">
                  Productos permitidos
                </dt>
                <dd className="mt-0.5 text-texto">
                  {formatearProductos(zona.productos)}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="mt-2 text-sm text-texto">
            El punto no cae dentro de ninguna zona activa. Puedes continuar,
            pero el módulo no tendrá restricciones de zona asociadas.
          </p>
        )}
      </section>

      {advertencias.map((advertencia) => (
        <Alerta
          key={`${advertencia.tipo}-${advertencia.mensaje}`}
          tono={TONO_ADVERTENCIA[advertencia.tipo]}
        >
          <span className="flex flex-col gap-1">
            <span className="font-semibold">
              {ETIQUETAS_ADVERTENCIA[advertencia.tipo]}
            </span>
            <span>{advertencia.mensaje}</span>
          </span>
        </Alerta>
      ))}

      {requiereConfirmacion && onAceptar ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <label
            htmlFor={idAceptacion}
            className="flex cursor-pointer items-start gap-3 text-sm font-medium text-amber-900"
          >
            <input
              id={idAceptacion}
              type="checkbox"
              checked={aceptaAdvertencia}
              onChange={(evento) => onAceptar(evento.target.checked)}
              className="mt-0.5 size-5 shrink-0 rounded border-amber-400 accent-amber-600"
            />
            <span>
              Entiendo que el punto está en una zona restringida y deseo
              continuar con el censo.
            </span>
          </label>
        </div>
      ) : null}
    </div>
  );
}
