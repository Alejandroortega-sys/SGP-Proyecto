"use client";

import { useCallback, useMemo, useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoMapa, IconoTienda } from "@/components/ui/iconos";
import { Spinner } from "@/components/ui/spinner";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import { obtenerEspacios } from "@/lib/api-client";
import type { EstadoEspacio } from "@/types/api";
import {
  COLORES_ESTADO_ESPACIO,
  DESCRIPCIONES_ESTADO_ESPACIO,
  ESTADOS_ESPACIO,
  ETIQUETAS_ESTADO_ESPACIO,
  SIMBOLOS_ESTADO_ESPACIO,
} from "./estilos-espacio";
import { FichaEspacio } from "./ficha-espacio";
import { MapaEspacios } from "./mapa-espacios";
import { TablaEspacios } from "./tabla-espacios";

type Vista = "mapa" | "tabla";

const CONTEO_VACIO: Record<EstadoEspacio, number> = {
  disponible: 0,
  bloqueado: 0,
  asignado: 0,
  mantenimiento: 0,
};

/**
 * Pantalla del comerciante para consultar los espacios disponibles en tabla o
 * mapa y abrir su ficha. En escritorio la ficha es un panel lateral; en móvil
 * se convierte en una hoja inferior.
 */
export function EspaciosComerciante() {
  const [vista, setVista] = useState<Vista>("mapa");
  const [incluirNoDisponibles, setIncluirNoDisponibles] = useState(false);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);

  const { datos, cargando, error, recargar } = useConsultaApi(
    () => obtenerEspacios({ incluirNoDisponibles }),
    [incluirNoDisponibles],
  );

  const seleccionar = useCallback((id: string) => {
    setSeleccionadoId(id);
  }, []);

  const cerrarFicha = useCallback(() => {
    setSeleccionadoId(null);
  }, []);

  const conteos = useMemo(() => {
    const resultado = { ...CONTEO_VACIO };
    for (const espacio of datos?.datos ?? []) {
      resultado[espacio.estadoEfectivo] += 1;
    }
    return resultado;
  }, [datos]);

  const sinResultados = datos !== null && datos.datos.length === 0;
  const mostrarCargaInicial = cargando && datos === null;

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-primario">
          Espacio público · Tuluá
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
              Espacios disponibles
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-texto sm:text-base">
              Consulta los módulos, kioscos, puestos y espacios móviles que
              puedes solicitar. Abre la ficha para conocer sus dimensiones, su
              horario y las restricciones de su zona.
            </p>
          </div>

          {datos ? (
            <div
              className="flex flex-wrap items-center gap-2 text-xs font-semibold"
              aria-live="polite"
            >
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                {datos.disponibles} disponibles
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-slate-700">
                {datos.noDisponibles} no disponibles
              </span>
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex flex-col gap-3 rounded-xl border border-borde bg-superficie p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="inline-flex rounded-lg border border-borde bg-fondo p-1"
            role="group"
            aria-label="Vista de espacios"
          >
            <Boton
              variante={vista === "mapa" ? "solido" : "fantasma"}
              tamano="sm"
              aria-pressed={vista === "mapa"}
              onClick={() => setVista("mapa")}
            >
              <IconoMapa className="size-4" />
              Mapa
            </Boton>
            <Boton
              variante={vista === "tabla" ? "solido" : "fantasma"}
              tamano="sm"
              aria-pressed={vista === "tabla"}
              onClick={() => setVista("tabla")}
            >
              <IconoTienda className="size-4" />
              Tabla
            </Boton>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {cargando && datos ? (
              <span
                role="status"
                className="inline-flex items-center gap-2 text-xs text-tenue"
              >
                <Spinner className="size-3.5 text-primario" />
                Actualizando…
              </span>
            ) : null}

            <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-texto hover:bg-fondo">
              <input
                type="checkbox"
                checked={incluirNoDisponibles}
                onChange={(evento) =>
                  setIncluirNoDisponibles(evento.target.checked)
                }
                className="size-4 accent-primario"
              />
              Mostrar no disponibles
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-borde pt-3">
          {ESTADOS_ESPACIO.map((estado) => (
            <span
              key={estado}
              className="inline-flex items-center gap-2 text-xs text-texto"
              title={DESCRIPCIONES_ESTADO_ESPACIO[estado]}
            >
              <span
                className="inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: COLORES_ESTADO_ESPACIO[estado] }}
                aria-hidden="true"
              >
                {SIMBOLOS_ESTADO_ESPACIO[estado]}
              </span>
              <span>{ETIQUETAS_ESTADO_ESPACIO[estado]}</span>
              {incluirNoDisponibles ? (
                <span className="rounded-full bg-fondo px-1.5 py-0.5 font-semibold text-tenue">
                  {conteos[estado]}
                </span>
              ) : null}
            </span>
          ))}
        </div>
      </div>

      {error && datos ? (
        <Alerta tono="error">
          <span className="flex flex-wrap items-start gap-2">
            <span className="flex-1">{error.mensaje}</span>
            <button
              type="button"
              onClick={recargar}
              className="rounded border border-current px-2 py-1 text-xs font-semibold"
            >
              Reintentar
            </button>
          </span>
        </Alerta>
      ) : null}

      {mostrarCargaInicial ? (
        <div className="rounded-xl border border-borde bg-superficie">
          <Cargando texto="Cargando espacios de Tuluá…" />
        </div>
      ) : error && datos === null ? (
        <div className="rounded-xl border border-borde bg-superficie p-4">
          <BloqueError error={error} onReintentar={recargar} />
        </div>
      ) : sinResultados ? (
        <div className="rounded-xl border border-borde bg-superficie">
          <EstadoVacio
            titulo={
              incluirNoDisponibles
                ? "No hay espacios registrados"
                : "No hay espacios disponibles"
            }
            descripcion={
              incluirNoDisponibles
                ? "Todavía no se han registrado espacios en el catálogo municipal."
                : "No hay espacios disponibles con la fecha actual. Activa «Mostrar no disponibles» para consultar los bloqueados u ocupados."
            }
            accion={
              <Boton variante="contorno" tamano="sm" onClick={recargar}>
                Reintentar
              </Boton>
            }
          />
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0">
            {vista === "mapa" ? (
              <div className="h-[clamp(420px,62dvh,720px)]">
                <MapaEspacios
                  espacios={datos?.datos ?? []}
                  seleccionadoId={seleccionadoId}
                  onSeleccionar={seleccionar}
                />
              </div>
            ) : (
              <TablaEspacios
                espacios={datos?.datos ?? []}
                seleccionadoId={seleccionadoId}
                onSeleccionar={seleccionar}
              />
            )}
          </div>

          <div className="min-w-0">
            {seleccionadoId ? (
              <FichaEspacio
                espacioId={seleccionadoId}
                onCerrar={cerrarFicha}
              />
            ) : (
              <aside className="hidden rounded-xl border border-dashed border-borde bg-superficie p-6 text-center lg:block">
                <p className="text-sm font-semibold text-titulo">
                  Selecciona un espacio
                </p>
                <p className="mt-2 text-sm text-texto">
                  Toca un marcador del mapa o el botón «Ver ficha» de la tabla
                  para consultar el detalle y las restricciones de su zona.
                </p>
              </aside>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
