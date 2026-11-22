"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Selector } from "@/components/ui/campo";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import { Paginacion } from "@/components/ui/paginacion";
import { Tabla, Td, Th } from "@/components/ui/tabla";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import {
  listarSolicitudesRevision,
  obtenerOpcionesRevisionSolicitudes,
} from "@/lib/api-client";
import { formatearFecha, nombreCompleto } from "@/lib/formato";
import type {
  EstadoSolicitud,
  FiltrosRevisionSolicitudes,
  OrdenRevisionSolicitudes,
  SolicitudRevisionListado,
} from "@/types/api";
import { EtiquetaEstadoSolicitud } from "@/features/solicitudes/etiqueta-estado-solicitud";
import {
  ESTADOS_BANDEJA_REVISION,
  ETIQUETAS_ORDEN_REVISION,
  textoAntiguedad,
} from "./validaciones-revision";

const LIMITE = 20;

export function ListaSolicitudesRevision() {
  const [estado, setEstado] = useState<EstadoSolicitud | "">("");
  const [sector, setSector] = useState("");
  const [actividad, setActividad] = useState("");
  const [orden, setOrden] =
    useState<OrdenRevisionSolicitudes>("antiguedad");
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState<FiltrosRevisionSolicitudes>({
    orden: "antiguedad",
  });

  const opciones = useConsultaApi(obtenerOpcionesRevisionSolicitudes, []);
  const lista = useConsultaApi(
    () => listarSolicitudesRevision({ ...filtros, pagina, limite: LIMITE }),
    [filtros, pagina],
  );

  function aplicar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    setPagina(1);
    setFiltros({
      estado: estado || undefined,
      sector: sector || undefined,
      actividad: actividad || undefined,
      orden,
    });
  }

  function limpiar(): void {
    setEstado("");
    setSector("");
    setActividad("");
    setOrden("antiguedad");
    setPagina(1);
    setFiltros({ orden: "antiguedad" });
  }

  const datos = lista.datos;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-primario">
          Gestión municipal · Revisión documental
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-titulo sm:text-3xl">
          Revisión de solicitudes
        </h1>
        <p className="mt-2 max-w-3xl text-base text-texto">
          Consulta las solicitudes radicadas, revisa los documentos y verifica
          cada requisito. El bloqueo de revisión evita que dos gestores editen
          la misma solicitud al mismo tiempo.
        </p>
      </div>

      <Tarjeta className="p-4 sm:p-5">
        <form
          onSubmit={aplicar}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"
        >
          <Selector
            etiqueta="Estado"
            value={estado}
            onChange={(evento) =>
              setEstado(evento.target.value as EstadoSolicitud | "")
            }
          >
            {ESTADOS_BANDEJA_REVISION.map((opcion) => (
              <option key={opcion.valor || "cola"} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
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
            etiqueta="Tipo de actividad"
            value={actividad}
            onChange={(evento) => setActividad(evento.target.value)}
          >
            <option value="">Todas</option>
            {(opciones.datos?.actividades ?? []).map((valor) => (
              <option key={valor} value={valor}>
                {valor}
              </option>
            ))}
          </Selector>

          <Selector
            etiqueta="Orden"
            value={orden}
            onChange={(evento) =>
              setOrden(evento.target.value as OrdenRevisionSolicitudes)
            }
          >
            {Object.entries(ETIQUETAS_ORDEN_REVISION).map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </Selector>

          <div className="flex items-end gap-2">
            <Boton type="submit" className="flex-1">
              Filtrar
            </Boton>
            <Boton variante="fantasma" onClick={limpiar}>
              Limpiar
            </Boton>
          </div>
        </form>
      </Tarjeta>

      <Tarjeta>
        {lista.cargando ? (
          <Cargando texto="Cargando la bandeja de revisión…" />
        ) : lista.error ? (
          <div className="p-4">
            <BloqueError error={lista.error} onReintentar={lista.recargar} />
          </div>
        ) : !datos || datos.datos.length === 0 ? (
          <EstadoVacio
            titulo="No hay solicitudes que coincidan"
            descripcion="Prueba con otros filtros o vuelve cuando existan solicitudes radicadas."
            accion={
              <Boton variante="contorno" onClick={limpiar}>
                Limpiar filtros
              </Boton>
            }
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-4 py-3">
              <p className="text-sm text-texto">
                {datos.paginacion.total} solicitud
                {datos.paginacion.total === 1 ? "" : "es"} en la bandeja
              </p>
              <p className="text-xs text-tenue">
                {ETIQUETAS_ORDEN_REVISION[orden]}
              </p>
            </div>

            <div className="hidden md:block">
              <Tabla>
                <thead>
                  <tr>
                    <Th>Solicitud</Th>
                    <Th>Comerciante</Th>
                    <Th>Espacio</Th>
                    <Th>Fechas</Th>
                    <Th>Antigüedad</Th>
                    <Th>Estado</Th>
                    <Th>Revisión</Th>
                    <Th>Acciones</Th>
                  </tr>
                </thead>
                <tbody>
                  {datos.datos.map((solicitud) => (
                    <tr key={solicitud.id} className="hover:bg-fondo">
                      <Td>
                        <p className="font-semibold text-titulo">
                          {solicitud.numeroRadicado}
                        </p>
                        <p className="text-xs text-tenue">
                          {solicitud.actividad}
                        </p>
                      </Td>
                      <Td>
                        <p className="font-medium text-titulo">
                          {nombreCompleto(
                            solicitud.comerciante.nombre,
                            solicitud.comerciante.apellido,
                          )}
                        </p>
                        <p className="text-xs text-tenue">
                          {solicitud.comerciante.correo}
                        </p>
                      </Td>
                      <Td>
                        <p className="font-medium text-titulo">
                          {solicitud.espacio?.nombre ?? "Sin espacio"}
                        </p>
                        <p className="text-xs text-tenue">
                          {solicitud.espacio?.sector ?? "Sin sector"} ·{" "}
                          {solicitud.espacio?.actividadPermitida ??
                            "Sin actividad"}
                        </p>
                      </Td>
                      <Td>
                        <p>{formatearFecha(solicitud.fechaInicio)}</p>
                        <p className="text-xs text-tenue">
                          al {formatearFecha(solicitud.fechaFin)} ·{" "}
                          {solicitud.horaInicio}–{solicitud.horaFin}
                        </p>
                      </Td>
                      <Td>
                        <p className="text-sm">
                          {textoAntiguedad(solicitud.radicadaEn)}
                        </p>
                        <p className="text-xs text-tenue">
                          {solicitud.documentosCargados} documento
                          {solicitud.documentosCargados === 1 ? "" : "s"} ·{" "}
                          {solicitud.requisitosVerificados} verificados
                        </p>
                      </Td>
                      <Td>
                        <EtiquetaEstadoSolicitud estado={solicitud.estado} />
                      </Td>
                      <Td>
                        <EstadoBloqueo solicitud={solicitud} />
                      </Td>
                      <Td>
                        <Link
                          href={`/gestor/solicitudes/${solicitud.id}`}
                          className="font-semibold text-primario hover:underline"
                        >
                          {solicitud.bloqueo && !solicitud.bloqueo.esPropio
                            ? "Ver en solo lectura"
                            : "Revisar"}
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            </div>

            <ul className="flex flex-col divide-y divide-borde md:hidden">
              {datos.datos.map((solicitud) => (
                <li key={solicitud.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-titulo">
                        {solicitud.numeroRadicado}
                      </p>
                      <p className="truncate text-xs text-tenue">
                        {solicitud.espacio?.nombre ?? "Sin espacio"}
                      </p>
                    </div>
                    <EtiquetaEstadoSolicitud estado={solicitud.estado} />
                  </div>
                  <p className="mt-2 text-sm font-medium text-titulo">
                    {nombreCompleto(
                      solicitud.comerciante.nombre,
                      solicitud.comerciante.apellido,
                    )}
                  </p>
                  <p className="text-xs text-tenue">{solicitud.actividad}</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-texto">
                    <span>
                      {formatearFecha(solicitud.fechaInicio)} –{" "}
                      {formatearFecha(solicitud.fechaFin)}
                    </span>
                    <span>{textoAntiguedad(solicitud.radicadaEn)}</span>
                    <span>
                      {solicitud.requisitosVerificados} de{" "}
                      {solicitud.documentosCargados} verificados
                    </span>
                  </div>
                  <div className="mt-2">
                    <EstadoBloqueo solicitud={solicitud} />
                  </div>
                  <Link
                    href={`/gestor/solicitudes/${solicitud.id}`}
                    className="mt-3 inline-flex min-h-11 items-center font-semibold text-primario hover:underline"
                  >
                    {solicitud.bloqueo && !solicitud.bloqueo.esPropio
                      ? "Ver en solo lectura"
                      : "Revisar solicitud"}
                  </Link>
                </li>
              ))}
            </ul>

            <Paginacion
              pagina={datos.paginacion.pagina}
              totalPaginas={datos.paginacion.totalPaginas}
              onCambiar={setPagina}
            />
          </>
        )}
      </Tarjeta>
    </div>
  );
}

function EstadoBloqueo({
  solicitud,
}: {
  solicitud: SolicitudRevisionListado;
}) {
  if (!solicitud.bloqueo) {
    return (
      <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
        Libre
      </span>
    );
  }
  if (solicitud.bloqueo.esPropio) {
    return (
      <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
        Tú la estás revisando
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col text-xs text-amber-800">
      <span className="font-semibold">En revisión por</span>
      <span>
        {solicitud.bloqueo.gestor.nombre}
        {solicitud.bloqueo.gestor.apellido
          ? ` ${solicitud.bloqueo.gestor.apellido}`
          : ""}
      </span>
    </span>
  );
}
