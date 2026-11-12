"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Campo, Selector } from "@/components/ui/campo";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import { Etiqueta } from "@/components/ui/etiqueta";
import { AccionesModal, Modal } from "@/components/ui/modal";
import { Paginacion } from "@/components/ui/paginacion";
import { Tabla, Td, Th } from "@/components/ui/tabla";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import {
  ApiError,
  comoApiError,
  eliminarEspacioGestor,
  listarEspaciosGestor,
  obtenerOpcionesEspaciosGestor,
} from "@/lib/api-client";
import type {
  EspacioGestorListado,
  EstadoEspacio,
  FiltrosEspaciosGestor,
  TipoEspacio,
} from "@/types/api";
import {
  ETIQUETAS_ESTADO_ESPACIO,
  ETIQUETAS_TIPO_ESPACIO,
  TONOS_ESTADO_ESPACIO,
} from "@/features/espacios/estilos-espacio";

type EstadoFiltro = "" | EstadoEspacio | "todos";
type TipoFiltro = "" | TipoEspacio;

export function ListaEspacios() {
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState<TipoFiltro>("");
  const [estado, setEstado] = useState<EstadoFiltro>("");
  const [sector, setSector] = useState("");
  const [zonaId, setZonaId] = useState("");
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState<FiltrosEspaciosGestor>({});

  const opciones = useConsultaApi(obtenerOpcionesEspaciosGestor, []);
  const lista = useConsultaApi(
    () => listarEspaciosGestor({ ...filtros, pagina, limite: 20 }),
    [filtros, pagina],
  );

  const [espacioEliminar, setEspacioEliminar] =
    useState<EspacioGestorListado | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<ApiError | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  function aplicar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    setPagina(1);
    setFiltros({
      busqueda: busqueda.trim() || undefined,
      tipo: tipo || undefined,
      estado: estado === "" ? undefined : estado,
      sector: sector || undefined,
      zonaId: zonaId || undefined,
    });
  }

  function limpiar(): void {
    setBusqueda("");
    setTipo("");
    setEstado("");
    setSector("");
    setZonaId("");
    setPagina(1);
    setFiltros({});
  }

  async function confirmarEliminar(): Promise<void> {
    if (!espacioEliminar || eliminando) return;
    setEliminando(true);
    setErrorAccion(null);
    try {
      await eliminarEspacioGestor(espacioEliminar.id);
      setExito(`El espacio «${espacioEliminar.nombre}» se eliminó.`);
      setEspacioEliminar(null);
      lista.recargar();
    } catch (capturado) {
      setErrorAccion(comoApiError(capturado));
    } finally {
      setEliminando(false);
    }
  }

  const datos = lista.datos;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primario">
            Espacio público · Administración
          </p>
          <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
            Catálogo de espacios temporales
          </h1>
          <p className="mt-2 max-w-3xl text-base text-texto">
            Crea y edita espacios, controla su estado y administra los bloqueos
            por rango de fechas desde una sola ficha.
          </p>
        </div>
        <Link
          href="/gestor/espacios/nuevo"
          className="inline-flex min-h-11 items-center rounded-lg bg-primario px-4 py-2.5 text-sm font-semibold text-white hover:bg-primario-hover"
        >
          Crear espacio
        </Link>
      </div>

      {exito ? <Alerta tono="exito">{exito}</Alerta> : null}
      {errorAccion && !espacioEliminar ? (
        <Alerta tono="error">{errorAccion.mensaje}</Alerta>
      ) : null}

      <Tarjeta className="p-4 sm:p-5">
        <form
          onSubmit={aplicar}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"
        >
          <Campo
            etiqueta="Buscar"
            placeholder="Nombre, sector o actividad…"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            maxLength={150}
          />
          <Selector
            etiqueta="Tipo"
            value={tipo}
            onChange={(evento) =>
              setTipo(evento.target.value as TipoFiltro)
            }
          >
            <option value="">Todos</option>
            {(opciones.datos?.tipos ?? []).map((valor) => (
              <option key={valor} value={valor}>
                {ETIQUETAS_TIPO_ESPACIO[valor]}
              </option>
            ))}
          </Selector>
          <Selector
            etiqueta="Estado"
            value={estado}
            onChange={(evento) =>
              setEstado(evento.target.value as EstadoFiltro)
            }
          >
            <option value="">Todos</option>
            <option value="disponible">Disponible</option>
            <option value="bloqueado">Bloqueado</option>
            <option value="asignado">Ocupado</option>
            <option value="mantenimiento">En mantenimiento</option>
          </Selector>
          <Selector
            etiqueta="Sector"
            value={sector}
            onChange={(evento) => setSector(evento.target.value)}
          >
            <option value="">Todos</option>
            {(opciones.datos?.sectores ?? []).map((valor) => (
              <option key={valor} value={valor}>
                {valor}
              </option>
            ))}
          </Selector>
          <Selector
            etiqueta="Zona"
            value={zonaId}
            onChange={(evento) => setZonaId(evento.target.value)}
          >
            <option value="">Todas</option>
            {(opciones.datos?.zonas ?? []).map((zona) => (
              <option key={zona.id} value={zona.id}>
                {zona.nombre}
              </option>
            ))}
          </Selector>
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-1">
            <Boton type="submit" variante="contorno">
              Aplicar
            </Boton>
            <Boton type="button" variante="fantasma" onClick={limpiar}>
              Limpiar
            </Boton>
          </div>
        </form>
        {opciones.error ? (
          <p className="mt-2 text-xs text-tenue">
            No se pudieron cargar las opciones de filtros. Puedes buscar por
            nombre.
          </p>
        ) : null}
      </Tarjeta>

      {lista.cargando && !datos ? (
        <Cargando texto="Cargando el catálogo de espacios…" />
      ) : lista.error ? (
        <BloqueError error={lista.error} onReintentar={lista.recargar} />
      ) : !datos || datos.datos.length === 0 ? (
        <Tarjeta>
          <EstadoVacio
            titulo="No hay espacios con esos criterios"
            descripcion="Ajusta los filtros o crea un espacio nuevo."
            accion={
              <Boton variante="contorno" tamano="sm" onClick={limpiar}>
                Limpiar filtros
              </Boton>
            }
          />
        </Tarjeta>
      ) : (
        <Tarjeta>
          <div className="hidden sm:block">
            <Tabla>
              <thead>
                <tr>
                  <Th>Espacio</Th>
                  <Th>Tipo</Th>
                  <Th>Sector / zona</Th>
                  <Th>Horario</Th>
                  <Th>Estado</Th>
                  <Th>Bloqueos</Th>
                  <Th>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {datos.datos.map((espacio) => (
                  <FilaEspacio
                    key={espacio.id}
                    espacio={espacio}
                    onEliminar={() => {
                      setErrorAccion(null);
                      setExito(null);
                      setEspacioEliminar(espacio);
                    }}
                  />
                ))}
              </tbody>
            </Tabla>
          </div>

          <div className="flex flex-col gap-3 p-4 sm:hidden">
            {datos.datos.map((espacio) => (
              <TarjetaEspacio
                key={espacio.id}
                espacio={espacio}
                onEliminar={() => {
                  setErrorAccion(null);
                  setExito(null);
                  setEspacioEliminar(espacio);
                }}
              />
            ))}
          </div>

          <Paginacion
            pagina={datos.pagina}
            totalPaginas={datos.totalPaginas}
            onCambiar={setPagina}
          />
        </Tarjeta>
      )}

      <Modal
        abierto={espacioEliminar !== null}
        titulo="Eliminar espacio temporal"
        descripcion="Se eliminarán el espacio y todos sus bloqueos. La operación no se puede deshacer."
        onCerrar={() => setEspacioEliminar(null)}
      >
        <div className="flex flex-col gap-4">
          {errorAccion ? (
            <Alerta tono="error">{errorAccion.mensaje}</Alerta>
          ) : null}
          <p className="text-sm text-texto">
            Espacio:{" "}
            <span className="font-semibold text-titulo">
              {espacioEliminar?.nombre}
            </span>
          </p>
          <AccionesModal
            onCancelar={() => setEspacioEliminar(null)}
            onConfirmar={() => void confirmarEliminar()}
            textoConfirmar="Eliminar espacio"
            variante="peligro"
            cargando={eliminando}
          />
        </div>
      </Modal>
    </div>
  );
}

function EstadoBadge({ espacio }: { espacio: EspacioGestorListado }) {
  return (
    <div className="flex flex-col gap-1">
      <Etiqueta tono={TONOS_ESTADO_ESPACIO[espacio.estadoEfectivo]}>
        {ETIQUETAS_ESTADO_ESPACIO[espacio.estadoEfectivo]}
      </Etiqueta>
      {espacio.estado !== espacio.estadoEfectivo ? (
        <span className="text-[11px] text-tenue">
          Registrado: {ETIQUETAS_ESTADO_ESPACIO[espacio.estado]}
        </span>
      ) : null}
      {espacio.asignacionManual ? (
        <span className="text-[11px] font-semibold text-primario">
          Asignación manual
        </span>
      ) : null}
    </div>
  );
}

function AccionesEspacio({
  espacio,
  onEliminar,
}: {
  espacio: EspacioGestorListado;
  onEliminar: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/gestor/espacios/${espacio.id}`}
        className="inline-flex min-h-9 items-center rounded-lg border border-primario px-3 py-1.5 text-sm font-semibold text-primario hover:bg-primario-suave"
      >
        Ver ficha
      </Link>
      <Link
        href={`/gestor/espacios/${espacio.id}/editar`}
        className="inline-flex min-h-9 items-center rounded-lg border border-borde px-3 py-1.5 text-sm font-semibold text-texto hover:bg-slate-100"
      >
        Editar
      </Link>
      <Boton
        variante="peligro"
        tamano="sm"
        onClick={onEliminar}
        disabled={espacio.tienePermisos || espacio.tieneSolicitudes}
        title={
          espacio.tienePermisos || espacio.tieneSolicitudes
            ? "El espacio tiene permisos o solicitudes asociadas"
            : undefined
        }
      >
        Eliminar
      </Boton>
    </div>
  );
}

function FilaEspacio({
  espacio,
  onEliminar,
}: {
  espacio: EspacioGestorListado;
  onEliminar: () => void;
}) {
  return (
    <tr>
      <Td>
        <span className="font-semibold text-titulo">{espacio.nombre}</span>
        <span className="block text-xs text-tenue">ID {espacio.id}</span>
      </Td>
      <Td>{ETIQUETAS_TIPO_ESPACIO[espacio.tipo]}</Td>
      <Td>
        <span className="block">{espacio.sector ?? "Sin sector"}</span>
        <span className="block text-xs text-tenue">
          {espacio.zona?.nombre ?? "Fuera de zona"}
        </span>
      </Td>
      <Td>
        {espacio.horario.inicio && espacio.horario.fin
          ? `${espacio.horario.inicio} a ${espacio.horario.fin}`
          : "Sin horario"}
      </Td>
      <Td>
        <EstadoBadge espacio={espacio} />
      </Td>
      <Td>{espacio.totalBloqueos}</Td>
      <Td>
        <AccionesEspacio espacio={espacio} onEliminar={onEliminar} />
      </Td>
    </tr>
  );
}

function TarjetaEspacio({
  espacio,
  onEliminar,
}: {
  espacio: EspacioGestorListado;
  onEliminar: () => void;
}) {
  return (
    <article className="rounded-lg border border-borde bg-superficie p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-titulo">{espacio.nombre}</h2>
          <p className="text-xs text-tenue">ID {espacio.id}</p>
        </div>
        <EstadoBadge espacio={espacio} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase text-tenue">Tipo</dt>
          <dd className="mt-1 text-texto">
            {ETIQUETAS_TIPO_ESPACIO[espacio.tipo]}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-tenue">
            Sector
          </dt>
          <dd className="mt-1 text-texto">
            {espacio.sector ?? "Sin sector"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-tenue">Zona</dt>
          <dd className="mt-1 text-texto">
            {espacio.zona?.nombre ?? "Fuera de zona"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-tenue">
            Bloqueos
          </dt>
          <dd className="mt-1 text-texto">{espacio.totalBloqueos}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <AccionesEspacio espacio={espacio} onEliminar={onEliminar} />
      </div>
    </article>
  );
}
