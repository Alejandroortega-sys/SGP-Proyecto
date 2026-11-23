"use client";

import { useMemo, useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Selector } from "@/components/ui/campo";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import { Etiqueta } from "@/components/ui/etiqueta";
import {
  Tarjeta,
  TarjetaCuerpo,
  TarjetaEncabezado,
} from "@/components/ui/tarjeta";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import {
  listarFeriasGestor,
  obtenerAgendaFeriasGestor,
} from "@/lib/api-client";
import type {
  EventoAgendaFeria,
  FeriaGestorListado,
  ZonaFeriaGestor,
} from "@/types/api";
import {
  ModalAprobarFeria,
  ModalCancelarFeria,
  ModalMoverFeria,
} from "./acciones-feria";
import {
  contarPorEstado,
  desplazarMes,
  desplazarSemana,
  ESTADOS_FERIA_CALENDARIO,
  generarCuadricula,
  hoyISO,
  mesActual,
  nombreMes,
  nombreSemana,
  rangoMes,
  rangoSemana,
  type MesCalendario,
} from "./calendario-ferias-utilidades";
import { CalendarioMensualFerias } from "./calendario-mensual-ferias";
import { CalendarioSemanalFerias } from "./calendario-semanal-ferias";
import { ESTILOS_ESTADO_FERIA, estiloEstado } from "./estilos-estado-feria";
import { PanelFeria } from "./panel-feria";

type Vista = "mes" | "semana";
type Accion = "aprobar" | "mover" | "cancelar" | null;

function aMesDeFecha(fecha: string): MesCalendario {
  const [anio, mes] = fecha.split("-").map(Number);
  return {
    anio: anio ?? new Date().getFullYear(),
    mes: mes ?? new Date().getMonth() + 1,
  };
}

function indicador(
  etiqueta: string,
  valor: number,
  tono: "neutro" | "info" | "exito" | "peligro" = "neutro",
) {
  const clases = {
    neutro: "border-borde bg-fondo text-titulo",
    info: "border-sky-200 bg-sky-50 text-sky-800",
    exito: "border-emerald-200 bg-emerald-50 text-emerald-800",
    peligro: "border-rose-200 bg-rose-50 text-rose-800",
  }[tono];

  return (
    <div className={`rounded-lg border px-4 py-3 ${clases}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
        {etiqueta}
      </p>
      <p className="mt-1 text-2xl font-extrabold">{valor}</p>
    </div>
  );
}

/** Calendario mensual y semanal de ferias para el gestor municipal. */
export function CalendarioFerias() {
  const [vista, setVista] = useState<Vista>("mes");
  const [mes, setMes] = useState<MesCalendario>(() => mesActual());
  const [semana, setSemana] = useState(() => hoyISO());
  const [zonaId, setZonaId] = useState("");
  const [incluirTodos, setIncluirTodos] = useState(false);
  const [seleccionado, setSeleccionado] =
    useState<EventoAgendaFeria | null>(null);
  const [eventoAccion, setEventoAccion] =
    useState<EventoAgendaFeria | null>(null);
  const [accion, setAccion] = useState<Accion>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  const rango = useMemo(
    () => (vista === "mes" ? rangoMes(mes) : rangoSemana(semana)),
    [vista, mes, semana],
  );

  const {
    datos,
    cargando,
    error,
    recargar,
  } = useConsultaApi(
    () =>
      obtenerAgendaFeriasGestor({
        desde: rango.desde,
        hasta: rango.hasta,
        zonaId: zonaId || undefined,
        incluirTodos,
      }),
    [rango.desde, rango.hasta, zonaId, incluirTodos],
  );

  const {
    datos: pendientes,
    cargando: cargandoPendientes,
    error: errorPendientes,
    recargar: recargarPendientes,
  } = useConsultaApi(
    () => listarFeriasGestor({ estado: "radicada", pagina: 1, limite: 8 }),
    [],
  );

  const zonas = datos?.zonas ?? [];
  const eventos = datos?.eventos ?? [];
  const conteo = contarPorEstado(eventos);
  const zonasVisibles: ZonaFeriaGestor[] = zonaId
    ? zonas.filter((zona) => zona.id === zonaId)
    : zonas;

  function cambiarVista(nueva: Vista) {
    if (nueva === vista) return;
    if (nueva === "semana") {
      setSemana(rangoMes(mes).desde);
    } else {
      setMes(aMesDeFecha(semana));
    }
    setVista(nueva);
  }

  function irHoy() {
    setMes(mesActual());
    setSemana(hoyISO());
  }

  function navegar(delta: number) {
    if (vista === "mes") {
      setMes((actual) => desplazarMes(actual, delta));
    } else {
      setSemana((actual) => desplazarSemana(actual, delta));
    }
  }

  function abrirAccion(tipo: Exclude<Accion, null>, evento: EventoAgendaFeria) {
    setSeleccionado(null);
    setEventoAccion(evento);
    setAccion(tipo);
    setMensajeExito(null);
  }

  function cerrarAccion() {
    setAccion(null);
    setEventoAccion(null);
  }

  function alCompletar(mensaje: string) {
    setAccion(null);
    setEventoAccion(null);
    setSeleccionado(null);
    setMensajeExito(mensaje);
    recargar();
    recargarPendientes();
  }

  function seleccionarPendiente(feria: FeriaGestorListado) {
    setSeleccionado(feria);
    setAccion(null);
  }

  const tituloPeriodo =
    vista === "mes" ? nombreMes(mes) : nombreSemana(semana);

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-primario">
          Programación municipal
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
              Calendario de ferias y eventos
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-texto sm:text-base">
              Consulta la agenda por zona, aprueba o cancela ferias y mueve sus
              fechas sin cruces. Aprobar una feria bloquea los espacios de la
              zona; cancelarla los libera.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Boton
              variante="contorno"
              onClick={() => cambiarVista("mes")}
              aria-pressed={vista === "mes"}
              className={vista === "mes" ? "bg-primario-suave" : undefined}
            >
              Mes
            </Boton>
            <Boton
              variante="contorno"
              onClick={() => cambiarVista("semana")}
              aria-pressed={vista === "semana"}
              className={vista === "semana" ? "bg-primario-suave" : undefined}
            >
              Semana
            </Boton>
          </div>
        </div>
      </header>

      {mensajeExito ? (
        <Alerta tono="exito" className="items-start">
          {mensajeExito}
        </Alerta>
      ) : null}

      <Tarjeta>
        <TarjetaCuerpo className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <Selector
              etiqueta="Zona"
              value={zonaId}
              onChange={(evento) => setZonaId(evento.target.value)}
            >
              <option value="">Todas las zonas</option>
              {zonas.map((zona) => (
                <option key={zona.id} value={zona.id}>
                  {zona.nombre}
                </option>
              ))}
            </Selector>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-titulo">Estados</span>
              <label className="flex min-h-11 items-center gap-3 rounded-lg border border-borde bg-white px-3.5 py-2.5 text-sm text-texto">
                <input
                  type="checkbox"
                  checked={incluirTodos}
                  onChange={(evento) => setIncluirTodos(evento.target.checked)}
                  className="size-4 accent-primario"
                />
                Ver también canceladas, rechazadas y realizadas
              </label>
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-titulo">Periodo</span>
              <div className="flex flex-wrap items-center gap-2">
                <Boton
                  variante="contorno"
                  tamano="sm"
                  aria-label="Periodo anterior"
                  onClick={() => navegar(-1)}
                >
                  ←
                </Boton>
                <span className="min-w-44 text-center text-sm font-bold capitalize text-titulo">
                  {tituloPeriodo}
                </span>
                <Boton
                  variante="contorno"
                  tamano="sm"
                  aria-label="Periodo siguiente"
                  onClick={() => navegar(1)}
                >
                  →
                </Boton>
                <Boton variante="fantasma" tamano="sm" onClick={irHoy}>
                  Hoy
                </Boton>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {indicador("Eventos en el periodo", eventos.length)}
            {indicador("Por aprobar", conteo.radicada, "info")}
            {indicador("Aprobadas", conteo.aprobada, "exito")}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-texto">
            <span className="font-semibold text-titulo">Estados:</span>
            {ESTADOS_FERIA_CALENDARIO.map((estado) => {
              const estilo = ESTILOS_ESTADO_FERIA[estado];
              return (
                <span key={estado} className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={`size-2.5 rounded-full ${estilo.punto}`}
                  />
                  <span aria-hidden="true">{estilo.simbolo}</span>
                  {estilo.etiqueta}
                </span>
              );
            })}
          </div>
        </TarjetaCuerpo>
      </Tarjeta>

      {datos && datos.cruces.length > 0 ? (
        <Alerta tono="advertencia">
          <p className="font-semibold">
            Se detectaron {datos.cruces.length} posible(s) cruce(s) de agenda.
          </p>
          <ul className="mt-1 list-disc pl-5">
            {datos.cruces.slice(0, 4).map((cruce, indice) => (
              <li key={`${cruce.tipo}-${indice}`}>{cruce.mensaje}</li>
            ))}
          </ul>
        </Alerta>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          {cargando && datos === null ? (
            <Cargando texto="Consultando el calendario…" />
          ) : error ? (
            <BloqueError error={error} onReintentar={recargar} />
          ) : (
            <div className="flex flex-col gap-3">
              {vista === "mes" ? (
                <CalendarioMensualFerias
                  mes={mes}
                  dias={generarCuadricula(mes)}
                  eventos={eventos}
                  onSeleccionar={setSeleccionado}
                />
              ) : (
                <CalendarioSemanalFerias
                  fecha={semana}
                  zonas={zonasVisibles}
                  eventos={eventos}
                  onSeleccionar={setSeleccionado}
                />
              )}
              {eventos.length === 0 ? (
                <div className="rounded-xl border border-borde bg-superficie">
                  <EstadoVacio
                    titulo="No hay ferias en este periodo"
                    descripcion="Cambia de mes o semana, elige otra zona o activa la vista de todos los estados."
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-3">
          <Tarjeta>
            <TarjetaEncabezado>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-titulo">
                  Por aprobar
                </h2>
                <Etiqueta tono="pendiente">
                  {pendientes?.paginacion.total ?? 0}
                </Etiqueta>
              </div>
            </TarjetaEncabezado>
            <TarjetaCuerpo className="flex flex-col gap-3">
              {cargandoPendientes && !pendientes ? (
                <p className="text-sm text-tenue">Cargando pendientes…</p>
              ) : errorPendientes ? (
                <p className="text-sm text-rose-700">
                  No pudimos cargar las ferias pendientes.
                </p>
              ) : !pendientes || pendientes.datos.length === 0 ? (
                <p className="text-sm text-tenue">
                  No hay ferias radicadas pendientes de aprobación.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {pendientes.datos.map((feria) => {
                    const estilo = estiloEstado(feria.estado);
                    return (
                      <li key={feria.id}>
                        <button
                          type="button"
                          onClick={() => seleccionarPendiente(feria)}
                          className="flex min-h-11 w-full flex-col rounded-lg border border-borde bg-fondo px-3 py-2 text-left text-sm hover:border-primario"
                        >
                          <span className="truncate font-semibold text-titulo">
                            {feria.nombre}
                          </span>
                          <span className="truncate text-xs text-tenue">
                            {feria.zona.nombre} · {feria.fechaInicio}
                          </span>
                          <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-texto">
                            <span
                              aria-hidden="true"
                              className={`size-2 rounded-full ${estilo.punto}`}
                            />
                            {estilo.etiqueta}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </TarjetaCuerpo>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCuerpo className="text-sm text-texto">
              <p className="font-semibold text-titulo">Cómo funciona</p>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                <li>Radicada: pendiente de decisión del gestor.</li>
                <li>Aprobada: bloquea los espacios de la zona.</li>
                <li>Cancelada: libera los espacios bloqueados.</li>
                <li>Mover revalida la agenda antes de guardar.</li>
              </ul>
            </TarjetaCuerpo>
          </Tarjeta>
        </aside>
      </div>

      <PanelFeria
        evento={seleccionado}
        onCerrar={() => {
          setSeleccionado(null);
          setAccion(null);
        }}
        onAprobar={(evento) => abrirAccion("aprobar", evento)}
        onMover={(evento) => abrirAccion("mover", evento)}
        onCancelar={(evento) => abrirAccion("cancelar", evento)}
      />

      {eventoAccion ? (
        <>
          <ModalAprobarFeria
            evento={eventoAccion}
            abierto={accion === "aprobar"}
            onCerrar={cerrarAccion}
            onExito={alCompletar}
          />
          <ModalMoverFeria
            evento={eventoAccion}
            zonas={zonas}
            abierto={accion === "mover"}
            onCerrar={cerrarAccion}
            onExito={alCompletar}
          />
          <ModalCancelarFeria
            evento={eventoAccion}
            abierto={accion === "cancelar"}
            onCerrar={cerrarAccion}
            onExito={alCompletar}
          />
        </>
      ) : null}
    </section>
  );
}
