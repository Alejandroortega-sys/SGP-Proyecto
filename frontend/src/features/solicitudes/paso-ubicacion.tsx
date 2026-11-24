"use client";

import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Cargando } from "@/components/ui/estado-vacio";
import { Spinner } from "@/components/ui/spinner";
import { MapaEspacios } from "@/features/espacios/mapa-espacios";
import { EtiquetaEstadoEspacio } from "@/features/espacios/etiqueta-espacio";
import {
  ETIQUETAS_ESTADO_ESPACIO,
  formatearDimensiones,
  formatearHorarioEspacio,
  formatearProductos,
  formatearTipoEspacio,
} from "@/features/espacios/estilos-espacio";
import {
  ETIQUETAS_TIPO,
  formatearAforo,
  formatearHorario,
} from "@/features/mapa/estilos-zona";
import { comoApiError, type ApiError } from "@/lib/api-client";
import type { EspacioDetalle, EspacioListado } from "@/types/api";

interface PasoUbicacionProps {
  espacios: EspacioListado[];
  cargandoEspacios: boolean;
  errorEspacios: ApiError | null;
  onReintentarEspacios: () => void;
  seleccionadoId: string | null;
  onSeleccionar: (id: string) => void;
  espacio: EspacioDetalle | null;
  cargandoDetalle: boolean;
  errorDetalle: ApiError | null;
  onReintentarDetalle: () => void;
  errorSeleccion?: string;
}

/**
 * Primer paso: elegir el espacio desde el mapa.
 *
 * Se muestran todos los espacios con su estado efectivo. Elegir uno no
 * garantiza la disponibilidad para las fechas del paso de horario; por eso el
 * formulario vuelve a consultarla antes de radicar.
 */
export function PasoUbicacion({
  espacios,
  cargandoEspacios,
  errorEspacios,
  onReintentarEspacios,
  seleccionadoId,
  onSeleccionar,
  espacio,
  cargandoDetalle,
  errorDetalle,
  onReintentarDetalle,
  errorSeleccion,
}: PasoUbicacionProps) {
  const errorMapa = errorEspacios ? comoApiError(errorEspacios) : null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-bold text-titulo">Ubicación</h2>
        <p className="mt-1 text-sm text-texto">
          Selecciona el espacio del catálogo municipal. El mapa muestra también
          los espacios bloqueados u ocupados para que puedas consultar su
          estado antes de elegir.
        </p>
      </div>

      {errorSeleccion ? (
        <Alerta tono="error">{errorSeleccion}</Alerta>
      ) : null}

      {cargandoEspacios && espacios.length === 0 ? (
        <div className="rounded-xl border border-borde bg-superficie">
          <Cargando texto="Cargando los espacios del municipio…" />
        </div>
      ) : errorMapa && espacios.length === 0 ? (
        <div className="rounded-xl border border-borde bg-superficie p-4">
          <BloqueError error={errorMapa} onReintentar={onReintentarEspacios} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {errorMapa ? (
            <Alerta tono="error">
              <span className="flex flex-wrap items-start gap-2">
                <span className="flex-1">{errorMapa.mensaje}</span>
                <button
                  type="button"
                  onClick={onReintentarEspacios}
                  className="rounded border border-current px-2 py-1 text-xs font-semibold"
                >
                  Reintentar
                </button>
              </span>
            </Alerta>
          ) : null}

          <div className="h-[clamp(380px,55dvh,620px)]">
            <MapaEspacios
              espacios={espacios}
              seleccionadoId={seleccionadoId}
              onSeleccionar={onSeleccionar}
            />
          </div>

          <p className="text-xs text-tenue">
            Toca un marcador para seleccionar el espacio. Los marcadores verdes
            están disponibles; los rojos, azules y grises están bloqueados,
            ocupados o en mantenimiento.
          </p>

          <div className="rounded-lg border border-borde bg-fondo p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-tenue">
              También puedes seleccionar desde la lista
            </p>
            <ul className="mt-2 grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {espacios.map((candidato) => {
                const activo = candidato.id === seleccionadoId;
                return (
                  <li key={candidato.id}>
                    <button
                      type="button"
                      onClick={() => onSeleccionar(candidato.id)}
                      aria-label={`Seleccionar ${candidato.nombre}`}
                      aria-pressed={activo}
                      className={
                        activo
                          ? "flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-primario bg-primario-suave px-3 py-2 text-left text-sm font-semibold text-accent-texto"
                          : "flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-borde bg-superficie px-3 py-2 text-left text-sm text-texto hover:bg-interaccion"
                      }
                    >
                      <span className="min-w-0 truncate">{candidato.nombre}</span>
                      <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-tenue">
                        {ETIQUETAS_ESTADO_ESPACIO[candidato.estadoEfectivo]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {seleccionadoId ? (
        <section className="rounded-xl border border-borde bg-fondo p-4">
          {cargandoDetalle ? (
            <span
              role="status"
              className="inline-flex items-center gap-2 text-sm text-texto"
            >
              <Spinner className="size-4 text-accent-texto" />
              Cargando la ficha del espacio…
            </span>
          ) : errorDetalle ? (
            <BloqueError error={errorDetalle} onReintentar={onReintentarDetalle} />
          ) : espacio ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent-texto">
                    Espacio seleccionado
                  </p>
                  <h3 className="mt-1 text-lg font-extrabold text-titulo">
                    {espacio.nombre}
                  </h3>
                </div>
                <EtiquetaEstadoEspacio estado={espacio.estadoEfectivo} />
              </div>

              {!espacio.disponible ? (
                <Alerta tono="advertencia">
                  <p className="font-semibold">Este espacio no está disponible.</p>
                  <p className="mt-1">{espacio.motivoEstado}</p>
                  <p className="mt-1 text-xs">
                    Puedes elegir otro espacio o volver a intentarlo con otras
                    fechas desde el paso de horario.
                  </p>
                </Alerta>
              ) : null}

              {espacio.zona && !espacio.zona.activa ? (
                <Alerta tono="advertencia">
                  La zona {espacio.zona.nombre} está inactiva y no admite
                  solicitudes nuevas.
                </Alerta>
              ) : null}

              <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                <dt className="font-semibold text-titulo">Tipo</dt>
                <dd>{formatearTipoEspacio(espacio.tipo)}</dd>
                <dt className="font-semibold text-titulo">Sector</dt>
                <dd>{espacio.sector ?? "Sin sector registrado"}</dd>
                <dt className="font-semibold text-titulo">Dimensiones</dt>
                <dd>{formatearDimensiones(espacio.dimensiones)}</dd>
                <dt className="font-semibold text-titulo">Actividad</dt>
                <dd>{espacio.actividadPermitida ?? "Sin actividad registrada"}</dd>
                <dt className="font-semibold text-titulo">Horario</dt>
                <dd>{formatearHorarioEspacio(espacio.horario)}</dd>
              </dl>

              {espacio.zona ? (
                <div className="rounded-lg border border-borde bg-superficie p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-titulo">
                      Zona: {espacio.zona.nombre}
                    </p>
                    <span className="rounded-full bg-fondo px-2 py-0.5 text-xs font-semibold text-tenue">
                      {ETIQUETAS_TIPO[espacio.zona.tipo] ?? espacio.zona.tipo}
                    </span>
                  </div>
                  <dl className="mt-2 grid gap-x-3 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
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
                </div>
              ) : (
                <p className="text-sm text-tenue">
                  Este espacio no está asociado a una zona normativa.
                </p>
              )}
            </div>
          ) : null}
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-borde bg-fondo px-4 py-6 text-center text-sm text-tenue">
          Aún no has seleccionado un espacio.
        </p>
      )}
    </div>
  );
}
