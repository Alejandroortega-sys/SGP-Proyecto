"use client";

import Link from "next/link";
import { useState } from "react";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import { Paginacion } from "@/components/ui/paginacion";
import { BloqueError } from "@/components/ui/bloque-error";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import { formatearFecha } from "@/lib/formato";
import { listarPermisosGestor } from "@/lib/api-client";
import { formatearRangoFechas } from "@/features/espacios/estilos-espacio";
import type { EstadoPermiso } from "@/types/api";
import { EtiquetaEstadoPermiso } from "./etiqueta-estado-permiso";
import { ESTADOS_PERMISO, ETIQUETAS_ESTADO_PERMISO } from "./estados-permiso";

const LIMITE = 20;

/**
 * Búsqueda y filtros de permisos del panel del gestor (HU-37, tareas 1252
 * y 1253): texto por número/titular/espacio, estado y rango de fechas de
 * vigencia.
 */
export function ListaPermisosGestor() {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<EstadoPermiso | "">("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [pagina, setPagina] = useState(1);

  const { datos, cargando, error, recargar } = useConsultaApi(
    () =>
      listarPermisosGestor({
        q: q.trim() || undefined,
        estado: estado || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
        pagina,
        limite: LIMITE,
      }),
    [q, estado, desde, hasta, pagina],
  );

  function aplicarBusqueda(): void {
    setPagina(1);
    recargar();
  }

  function limpiarFiltros(): void {
    setQ("");
    setEstado("");
    setDesde("");
    setHasta("");
    setPagina(1);
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-texto">
          Permisos digitales
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-titulo sm:text-3xl">
          Permisos y trazabilidad
        </h1>
        <p className="mt-1 text-sm text-texto">
          Busca por número, titular o espacio; filtra por estado y rango de
          fechas de vigencia.
        </p>
      </header>

      <Tarjeta className="p-4 sm:p-5">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(evento) => {
            evento.preventDefault();
            aplicarBusqueda();
          }}
        >
          <div className="sm:col-span-2 lg:col-span-2">
            <Campo
              etiqueta="Buscar"
              placeholder="Número, titular o espacio"
              value={q}
              onChange={(evento) => setQ(evento.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="filtro-estado-permiso"
              className="text-sm font-medium text-titulo"
            >
              Estado
            </label>
            <select
              id="filtro-estado-permiso"
              value={estado}
              onChange={(evento) => {
                setEstado(evento.target.value as EstadoPermiso | "");
                setPagina(1);
              }}
              className="mt-1.5 w-full min-h-10 rounded-lg border border-borde bg-superficie px-3 py-2 text-base text-titulo focus-visible:outline-2 focus-visible:outline-accent"
            >
              <option value="">Todos</option>
              {ESTADOS_PERMISO.map((valor) => (
                <option key={valor} value={valor}>
                  {ETIQUETAS_ESTADO_PERMISO[valor]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Campo
              etiqueta="Desde"
              type="date"
              value={desde}
              onChange={(evento) => {
                setDesde(evento.target.value);
                setPagina(1);
              }}
            />
          </div>
          <div>
            <Campo
              etiqueta="Hasta"
              type="date"
              value={hasta}
              onChange={(evento) => {
                setHasta(evento.target.value);
                setPagina(1);
              }}
            />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
            <Boton type="submit">Aplicar filtros</Boton>
            <Boton type="button" variante="fantasma" onClick={limpiarFiltros}>
              Limpiar
            </Boton>
          </div>
        </form>
      </Tarjeta>

      {cargando && !datos ? <Cargando texto="Buscando permisos…" /> : null}
      {error && !datos ? <BloqueError error={error} onReintentar={recargar} /> : null}
      {error && datos ? (
        <p className="text-sm text-peligro-texto">{error.mensaje}</p>
      ) : null}

      {datos ? (
        <Tarjeta className="overflow-hidden">
          {datos.datos.length === 0 ? (
            <EstadoVacio
              titulo="No hay permisos con esos criterios"
              descripcion="Ajusta la búsqueda o emite un permiso desde una solicitud aprobada."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-fondo text-left text-xs font-bold uppercase tracking-wide text-tenue">
                    <tr>
                      <th className="px-4 py-3">Permiso</th>
                      <th className="px-4 py-3">Titular</th>
                      <th className="px-4 py-3">Espacio</th>
                      <th className="px-4 py-3">Vigencia</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Emitido</th>
                      <th className="px-4 py-3 sr-only">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde">
                    {datos.datos.map((permiso) => (
                      <tr key={permiso.id} className="align-top">
                        <td className="px-4 py-3 font-semibold text-titulo">
                          {permiso.numero}
                          {permiso.renovadoDesdeNumero ? (
                            <span className="block text-xs font-normal text-tenue">
                              Renueva a {permiso.renovadoDesdeNumero}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">{permiso.titularNombre}</td>
                        <td className="px-4 py-3">
                          {permiso.espacioNombre ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {formatearRangoFechas(
                            permiso.fechaInicio,
                            permiso.fechaFin,
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <EtiquetaEstadoPermiso estado={permiso.estado} />
                        </td>
                        <td className="px-4 py-3 text-texto">
                          {formatearFecha(permiso.emitidoEn)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/gestor/permisos/${permiso.id}`}
                            className="font-semibold text-accent-texto hover:underline"
                          >
                            Ver detalle
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginacion
                pagina={datos.paginacion.pagina}
                totalPaginas={datos.paginacion.totalPaginas}
                onCambiar={setPagina}
              />
            </>
          )}
        </Tarjeta>
      ) : null}
    </div>
  );
}
