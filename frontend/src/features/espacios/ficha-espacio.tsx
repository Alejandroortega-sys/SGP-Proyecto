"use client";

import { useEffect, useRef } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Cargando } from "@/components/ui/estado-vacio";
import { IconoCerrar, IconoUbicacion } from "@/components/ui/iconos";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import { obtenerEspacio } from "@/lib/api-client";
import { formatearFecha } from "@/lib/formato";
import {
  ETIQUETAS_TIPO,
  formatearAforo,
  formatearHorario,
} from "../mapa/estilos-zona";
import {
  formatearDimensiones,
  formatearHorarioEspacio,
  formatearProductos,
  formatearRangoFechas,
  formatearTipoEspacio,
} from "./estilos-espacio";
import { EtiquetaEstadoEspacio } from "./etiqueta-espacio";

interface FichaEspacioProps {
  espacioId: string;
  onCerrar: () => void;
  onCentrar?: () => void;
}

/** Ficha del espacio: panel lateral en escritorio y hoja inferior en móvil. */
export function FichaEspacio({
  espacioId,
  onCerrar,
  onCentrar,
}: FichaEspacioProps) {
  const cerrarRef = useRef<HTMLButtonElement | null>(null);
  const { datos: espacio, cargando, error, recargar } = useConsultaApi(
    () => obtenerEspacio(espacioId),
    [espacioId],
  );

  // Foco inicial, cierre con Escape y bloqueo del scroll en móvil.
  useEffect(() => {
    const elementoAnterior = document.activeElement as HTMLElement | null;
    cerrarRef.current?.focus();

    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        onCerrar();
      }
    };
    document.addEventListener("keydown", alPresionar);

    const esMovil = window.matchMedia("(max-width: 1023px)").matches;
    const overflowAnterior = document.body.style.overflow;
    if (esMovil) document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", alPresionar);
      document.body.style.overflow = overflowAnterior;
      elementoAnterior?.focus?.();
    };
  }, [onCerrar]);

  return (
    <div
      className="fixed inset-0 z-[900] lg:static lg:z-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ficha-espacio-titulo"
    >
      <button
        type="button"
        aria-label="Cerrar ficha del espacio"
        onClick={onCerrar}
        className="absolute inset-0 bg-slate-900/40 lg:hidden"
      />

      <aside className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-2xl border border-borde bg-superficie p-4 shadow-2xl lg:static lg:max-h-none lg:rounded-xl lg:p-5 lg:shadow-sm">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 lg:hidden" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-primario">
              Ficha del espacio
            </p>
            <h2
              id="ficha-espacio-titulo"
              className="mt-1 text-lg font-extrabold leading-tight text-titulo"
            >
              {espacio?.nombre ?? "Cargando espacio…"}
            </h2>
            {espacio ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <EtiquetaEstadoEspacio estado={espacio.estadoEfectivo} />
                <span className="text-xs text-tenue">
                  {formatearTipoEspacio(espacio.tipo)}
                </span>
              </div>
            ) : null}
          </div>
          <button
            ref={cerrarRef}
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar ficha"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-titulo hover:bg-slate-100"
          >
            <IconoCerrar className="size-5" />
          </button>
        </div>

        {cargando ? (
          <div className="mt-6 flex justify-center">
            <Cargando texto="Cargando la ficha del espacio…" />
          </div>
        ) : error ? (
          <div className="mt-4">
            <BloqueError error={error} onReintentar={recargar} />
          </div>
        ) : espacio ? (
          <div className="mt-4 flex flex-col gap-4">
            {!espacio.disponible ? (
              <Alerta tono="advertencia">
                <p className="font-semibold">Este espacio no está disponible.</p>
                <p className="mt-1">{espacio.motivoEstado}</p>
              </Alerta>
            ) : null}

            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="font-semibold text-titulo">Sector</dt>
              <dd>{espacio.sector ?? "Sin sector registrado"}</dd>
              <dt className="font-semibold text-titulo">Dimensiones</dt>
              <dd>{formatearDimensiones(espacio.dimensiones)}</dd>
              <dt className="font-semibold text-titulo">Actividad</dt>
              <dd>{espacio.actividadPermitida ?? "Sin actividad registrada"}</dd>
              <dt className="font-semibold text-titulo">Horario</dt>
              <dd>{formatearHorarioEspacio(espacio.horario)}</dd>
              <dt className="font-semibold text-titulo">Registrado</dt>
              <dd>{formatearFecha(espacio.creadoEn)}</dd>
            </dl>

            {espacio.bloqueo ? (
              <section className="rounded-lg border border-borde bg-fondo p-3">
                <h3 className="text-sm font-bold text-titulo">
                  Bloqueo de fechas
                </h3>
                <p className="mt-1 text-sm">
                  {formatearRangoFechas(
                    espacio.bloqueo.fechaInicio,
                    espacio.bloqueo.fechaFin,
                  )}
                </p>
                <p className="mt-1 text-sm text-texto">
                  {espacio.bloqueo.motivo ?? "Sin motivo registrado"}
                </p>
                <p className="mt-1 text-xs font-semibold text-tenue">
                  {espacio.bloqueo.activo
                    ? "El bloqueo cubre la fecha consultada."
                    : "El bloqueo no cubre la fecha consultada."}
                </p>
              </section>
            ) : null}

            {espacio.permiso ? (
              <section className="rounded-lg border border-borde bg-fondo p-3">
                <h3 className="text-sm font-bold text-titulo">
                  Permiso vigente
                </h3>
                <p className="mt-1 text-sm font-medium text-titulo">
                  {espacio.permiso.numero}
                </p>
                <p className="text-sm">
                  {formatearRangoFechas(
                    espacio.permiso.fechaInicio,
                    espacio.permiso.fechaFin,
                  )}
                </p>
              </section>
            ) : null}

            <section className="rounded-lg border border-borde p-3">
              <h3 className="text-sm font-bold text-titulo">
                Restricciones de la zona
              </h3>
              {espacio.zona ? (
                <>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="font-medium text-titulo">
                      {espacio.zona.nombre}
                    </span>
                    <span className="rounded-full bg-fondo px-2 py-0.5 text-xs font-semibold text-tenue">
                      {ETIQUETAS_TIPO[espacio.zona.tipo] ?? espacio.zona.tipo}
                    </span>
                    {!espacio.zona.activa ? (
                      <span className="text-xs font-semibold text-rose-700">
                        Zona inactiva
                      </span>
                    ) : null}
                  </div>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                    <dt className="font-semibold text-titulo">Horario</dt>
                    <dd>
                      {formatearHorario({
                        inicio: espacio.zona.horarioInicio,
                        fin: espacio.zona.horarioFin,
                      })}
                    </dd>
                    <dt className="font-semibold text-titulo">Aforo</dt>
                    <dd>{formatearAforo(espacio.zona.aforoMaximo)}</dd>
                    <dt className="font-semibold text-titulo">Productos</dt>
                    <dd>{formatearProductos(espacio.zona.productos)}</dd>
                  </dl>
                </>
              ) : (
                <p className="mt-2 text-sm text-tenue">
                  Este espacio no está asociado a una zona normativa.
                </p>
              )}
            </section>

            {onCentrar ? (
              <Boton
                variante="contorno"
                tamano="sm"
                onClick={onCentrar}
                className="w-full"
              >
                <IconoUbicacion className="size-4" />
                Centrar en el mapa
              </Boton>
            ) : null}

            {espacio.disponible ? (
              <p className="text-xs leading-relaxed text-tenue">
                La solicitud formal de este espacio estará disponible en el
                Sprint 3.
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-tenue">
                Consulta otro espacio disponible para continuar.
              </p>
            )}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
