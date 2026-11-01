"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/boton";
import { Campo, Selector } from "@/components/ui/campo";
import { IconoCerrar, IconoFiltro } from "@/components/ui/iconos";
import { Spinner } from "@/components/ui/spinner";
import type { OpcionesEspacios } from "@/types/api";
import {
  contarFiltrosActivos,
  FILTROS_FORMULARIO_VACIOS,
  type FiltrosFormulario,
  tieneErrores,
  validarFiltros,
} from "./filtros-espacios";

interface PanelFiltrosProps {
  filtros: FiltrosFormulario;
  opciones: OpcionesEspacios | null;
  cargandoOpciones?: boolean;
  totalResultados: number | null;
  onAplicar: (filtros: FiltrosFormulario) => void;
  onLimpiar: () => void;
}

interface FormularioFiltrosProps {
  borrador: FiltrosFormulario;
  opciones: OpcionesEspacios | null;
  cargandoOpciones: boolean;
  errores: ReturnType<typeof validarFiltros>;
  onCambiar: (campo: keyof FiltrosFormulario, valor: string) => void;
  onAplicar: () => void;
  onLimpiar: () => void;
  totalResultados: number | null;
}

function FormularioFiltros({
  borrador,
  opciones,
  cargandoOpciones,
  errores,
  onCambiar,
  onAplicar,
  onLimpiar,
  totalResultados,
}: FormularioFiltrosProps) {
  const invalido = tieneErrores(errores);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Selector
          etiqueta="Sector"
          value={borrador.sector}
          onChange={(evento) => onCambiar("sector", evento.target.value)}
          disabled={cargandoOpciones}
          ayuda={
            cargandoOpciones
              ? "Cargando sectores registrados…"
              : "Sectores del catálogo municipal."
          }
        >
          <option value="">Todos los sectores</option>
          {opciones?.sectores.map((sector) => (
            <option key={sector} value={sector}>
              {sector}
            </option>
          ))}
        </Selector>

        <Selector
          etiqueta="Actividad"
          value={borrador.actividad}
          onChange={(evento) => onCambiar("actividad", evento.target.value)}
          disabled={cargandoOpciones}
          ayuda={
            cargandoOpciones
              ? "Cargando actividades registradas…"
              : "Actividad permitida del espacio."
          }
        >
          <option value="">Todas las actividades</option>
          {opciones?.actividades.map((actividad) => (
            <option key={actividad} value={actividad}>
              {actividad}
            </option>
          ))}
        </Selector>

        <Campo
          etiqueta="Fecha"
          type="date"
          value={borrador.fecha}
          onChange={(evento) => onCambiar("fecha", evento.target.value)}
          error={errores.fecha}
          ayuda="Si la dejas vacía se consulta la fecha actual."
        />

        <div className="grid grid-cols-2 gap-3">
          <Campo
            etiqueta="Hora inicio"
            type="time"
            value={borrador.horaInicio}
            onChange={(evento) => onCambiar("horaInicio", evento.target.value)}
            error={errores.horario}
          />
          <Campo
            etiqueta="Hora fin"
            type="time"
            value={borrador.horaFin}
            onChange={(evento) => onCambiar("horaFin", evento.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-borde pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-texto" role="status" aria-live="polite">
          {totalResultados === null
            ? "Calculando resultados…"
            : `${totalResultados} ${totalResultados === 1 ? "espacio encontrado" : "espacios encontrados"}`}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Boton variante="fantasma" tamano="sm" onClick={onLimpiar}>
            Limpiar filtros
          </Boton>
          <Boton tamano="sm" onClick={onAplicar} disabled={invalido}>
            Aplicar filtros
          </Boton>
        </div>
      </div>
    </div>
  );
}

/**
 * Panel de filtros de espacios.
 *
 * En escritorio es una tarjeta visible; en móvil se abre como hoja inferior.
 */
export function PanelFiltros({
  filtros,
  opciones,
  cargandoOpciones = false,
  totalResultados,
  onAplicar,
  onLimpiar,
}: PanelFiltrosProps) {
  const [borrador, setBorrador] = useState<FiltrosFormulario>(filtros);
  const [abiertoMovil, setAbiertoMovil] = useState(false);
  const errores = validarFiltros(borrador);
  const activos = contarFiltrosActivos(filtros);

  const cambiar = (campo: keyof FiltrosFormulario, valor: string) => {
    setBorrador((actual) => ({ ...actual, [campo]: valor }));
  };

  const aplicar = () => {
    if (tieneErrores(errores)) return;
    onAplicar(borrador);
    setAbiertoMovil(false);
  };

  const limpiar = () => {
    setBorrador(FILTROS_FORMULARIO_VACIOS);
    onLimpiar();
    setAbiertoMovil(false);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <Boton
          variante="contorno"
          tamano="sm"
          onClick={() => setAbiertoMovil(true)}
          aria-label="Abrir panel de filtros"
        >
          <IconoFiltro className="size-4" />
          Filtros
          {activos > 0 ? (
            <span className="rounded-full bg-primario px-1.5 py-0.5 text-[10px] font-bold text-white">
              {activos}
            </span>
          ) : null}
        </Boton>
        <span className="text-sm text-texto" role="status" aria-live="polite">
          {totalResultados === null
            ? "Calculando…"
            : `${totalResultados} resultados`}
        </span>
      </div>

      <div
        data-testid="panel-filtros-escritorio"
        className="hidden rounded-xl border border-borde bg-superficie p-4 lg:block"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-titulo">
            <IconoFiltro className="size-5 text-primario" />
            Filtrar espacios
          </h2>
          {cargandoOpciones ? (
            <span className="inline-flex items-center gap-2 text-xs text-tenue">
              <Spinner className="size-3.5 text-primario" />
              Cargando opciones…
            </span>
          ) : null}
        </div>
        <FormularioFiltros
          borrador={borrador}
          opciones={opciones}
          cargandoOpciones={cargandoOpciones}
          errores={errores}
          onCambiar={cambiar}
          onAplicar={aplicar}
          onLimpiar={limpiar}
          totalResultados={totalResultados}
        />
      </div>

      {abiertoMovil ? (
        <div
          className="fixed inset-0 z-[900]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="filtros-movil-titulo"
        >
          <button
            type="button"
            aria-label="Cerrar panel de filtros"
            onClick={() => setAbiertoMovil(false)}
            className="absolute inset-0 bg-slate-900/40"
          />
          <aside
            data-testid="panel-filtros-movil"
            className="absolute inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-2xl border border-borde bg-superficie p-4 shadow-2xl"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300" />
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2
                id="filtros-movil-titulo"
                className="text-lg font-bold text-titulo"
              >
                Filtrar espacios
              </h2>
              <button
                type="button"
                onClick={() => setAbiertoMovil(false)}
                aria-label="Cerrar filtros"
                className="flex size-10 items-center justify-center rounded-lg text-titulo hover:bg-slate-100"
              >
                <IconoCerrar className="size-5" />
              </button>
            </div>
            <FormularioFiltros
              borrador={borrador}
              opciones={opciones}
              cargandoOpciones={cargandoOpciones}
              errores={errores}
              onCambiar={cambiar}
              onAplicar={aplicar}
              onLimpiar={limpiar}
              totalResultados={totalResultados}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}
