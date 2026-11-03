"use client";

import Link from "next/link";
import { useState } from "react";
import { BloqueError } from "@/components/ui/bloque-error";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Paginacion } from "@/components/ui/paginacion";
import { Tarjeta, TarjetaCuerpo } from "@/components/ui/tarjeta";
import { ETIQUETAS_TIPO } from "@/features/mapa/estilos-zona";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import { useSesion } from "@/hooks/use-sesion";
import { obtenerHistorialZona } from "@/lib/api-client";
import { formatearFechaHora, nombreCompleto } from "@/lib/formato";
import type { ZonaVersion } from "@/types/api";
import {
  clasesAccionVersion,
  formatearValorCambio,
  textoAccionVersion,
} from "./formato-historial-zona";
import { MapaHistorialZonaCarga } from "./mapa-historial-zona-carga";

const LIMITE = 10;

export function HistorialZona({ id }: { id: string }) {
  const { usuario } = useSesion();
  const esAdministrador = usuario?.perfil === "administrador";
  const [pagina, setPagina] = useState(1);
  const [versionSeleccionada, setVersionSeleccionada] = useState<
    number | null
  >(null);

  const { datos, cargando, error, recargar } = useConsultaApi(
    () => obtenerHistorialZona(id, { pagina, limite: LIMITE }),
    [id, pagina],
  );

  if (cargando && !datos) {
    return <Cargando texto="Cargando el historial de la zona…" />;
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <EncabezadoHistorial id={id} nombre={null} activa={null} />
        <BloqueError error={error} onReintentar={recargar} />
      </div>
    );
  }

  if (!datos) return null;

  const versiones = datos.datos;
  const indiceEncontrado = versiones.findIndex(
    (version) => version.version === versionSeleccionada,
  );
  const indiceSeleccionado = indiceEncontrado >= 0 ? indiceEncontrado : 0;
  const versionActual = versiones[indiceSeleccionado] ?? null;
  const versionAnterior = versiones[indiceSeleccionado + 1] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoHistorial
        id={id}
        nombre={datos.zona.nombre}
        activa={datos.zona.activa}
        esAdministrador={esAdministrador}
      />

      {versiones.length === 0 ? (
        <Tarjeta>
          <EstadoVacio
            titulo="La zona aún no tiene versiones registradas"
            descripcion="Cuando se edite o cambie su estado, aquí aparecerá el historial completo con el actor y la fecha."
            accion={
              <Link
                href={`/gestor/zonas/${id}/editar`}
                className="font-semibold text-primario hover:underline"
              >
                Volver a la zona
              </Link>
            }
          />
        </Tarjeta>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="flex min-w-0 flex-col gap-4">
            <ol className="flex flex-col gap-4">
              {versiones.map((version, indice) => (
                <ItemTimeline
                  key={version.version}
                  version={version}
                  ultimo={indice === versiones.length - 1}
                  seleccionada={version.version === versionActual?.version}
                  onSeleccionar={() =>
                    setVersionSeleccionada(version.version)
                  }
                />
              ))}
            </ol>

            {datos.paginacion.totalPaginas > 1 ? (
              <Tarjeta>
                <Paginacion
                  pagina={datos.paginacion.pagina}
                  totalPaginas={datos.paginacion.totalPaginas}
                  onCambiar={(nuevaPagina) => {
                    setPagina(nuevaPagina);
                    setVersionSeleccionada(null);
                  }}
                />
              </Tarjeta>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 xl:sticky xl:top-4 xl:self-start">
            {versionActual ? (
              <>
                <MapaHistorialZonaCarga
                  geometria={versionActual.estado.geometria}
                  geometriaAnterior={versionAnterior?.estado.geometria ?? null}
                  tipo={versionActual.estado.tipo}
                />
                <Tarjeta>
                  <TarjetaCuerpo className="flex flex-col gap-2 text-sm">
                    <p className="font-semibold text-titulo">
                      Versión {versionActual.version} ·{" "}
                      {textoAccionVersion(versionActual.accion)}
                    </p>
                    <p className="text-texto">
                      {versionActual.estado.nombre} ·{" "}
                      {ETIQUETAS_TIPO[versionActual.estado.tipo]} ·{" "}
                      {versionActual.estado.activa ? "Activa" : "Inactiva"}
                    </p>
                    <p className="text-xs text-tenue">
                      {versionActual.estado.resumenGeometria.vertices} vértice
                      {versionActual.estado.resumenGeometria.vertices === 1
                        ? ""
                        : "s"}
                      {versionActual.estado.resumenGeometria.areaM2 !== null
                        ? ` · ${new Intl.NumberFormat("es-CO", {
                            maximumFractionDigits: 0,
                          }).format(
                            versionActual.estado.resumenGeometria.areaM2,
                          )} m²`
                        : ""}
                    </p>
                    {versionAnterior ? (
                      <p className="text-xs text-tenue">
                        Comparada con la versión {versionAnterior.version}.
                      </p>
                    ) : null}
                  </TarjetaCuerpo>
                </Tarjeta>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemTimeline({
  version,
  ultimo,
  seleccionada,
  onSeleccionar,
}: {
  version: ZonaVersion;
  ultimo: boolean;
  seleccionada: boolean;
  onSeleccionar: () => void;
}) {
  return (
    <li className="flex gap-3">
      <div className="flex w-4 flex-col items-center">
        <span
          className={`mt-4 size-3 rounded-full border-2 border-superficie ${
            seleccionada ? "bg-primario" : "bg-slate-400"
          }`}
          aria-hidden="true"
        />
        {!ultimo ? (
          <span className="mt-1 w-px flex-1 bg-borde" aria-hidden="true" />
        ) : null}
      </div>

      <Tarjeta
        className={`min-w-0 flex-1 ${
          seleccionada ? "ring-2 ring-primario/40" : ""
        }`}
      >
        <TarjetaCuerpo className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-bold text-white">
                v{version.version}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${clasesAccionVersion(
                  version.accion,
                )}`}
              >
                {textoAccionVersion(version.accion)}
              </span>
              <Etiqueta tono={version.estado.activa ? "exitoso" : "neutro"}>
                {version.estado.activa ? "Activa" : "Inactiva"}
              </Etiqueta>
            </div>
            <button
              type="button"
              onClick={onSeleccionar}
              className="inline-flex min-h-9 items-center rounded-lg border border-primario px-3 py-1.5 text-sm font-semibold text-primario hover:bg-primario-suave"
              aria-pressed={seleccionada}
            >
              {seleccionada ? "En el mapa" : "Ver geometría"}
            </button>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-texto">
            <span>
              <span className="font-semibold text-titulo">Cuándo:</span>{" "}
              <time dateTime={version.creadoEn}>
                {formatearFechaHora(version.creadoEn)}
              </time>
            </span>
            <span>
              <span className="font-semibold text-titulo">Quién:</span>{" "}
              {version.actor
                ? `${nombreCompleto(
                    version.actor.nombre,
                    version.actor.apellido,
                  )} (${version.actor.correo})`
                : "Actor no identificado"}
            </span>
          </div>

          {version.accion === "creacion" ? (
            <p className="rounded-lg border border-borde bg-fondo px-3 py-2 text-sm text-texto">
              Versión inicial de la zona: {version.estado.nombre} ·{" "}
              {ETIQUETAS_TIPO[version.estado.tipo]}.
            </p>
          ) : version.cambios.length === 0 ? (
            <p className="text-sm text-tenue">
              La versión se registró sin cambios visibles en los campos
              auditados.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {version.cambios.map((cambio) => (
                <li
                  key={cambio.campo}
                  className="grid gap-1 rounded-lg border border-borde bg-fondo px-3 py-2 text-sm sm:grid-cols-[170px_minmax(0,1fr)]"
                >
                  <span className="font-semibold text-titulo">
                    {cambio.etiqueta}
                  </span>
                  <span className="text-texto">
                    {formatearValorCambio(cambio.campo, cambio.anterior)} →{" "}
                    <span className="font-semibold text-titulo">
                      {formatearValorCambio(cambio.campo, cambio.nuevo)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TarjetaCuerpo>
      </Tarjeta>
    </li>
  );
}

function EncabezadoHistorial({
  id,
  nombre,
  activa,
  esAdministrador = false,
}: {
  id: string;
  nombre: string | null;
  activa: boolean | null;
  esAdministrador?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Link
        href="/gestor/zonas"
        className="text-sm font-semibold text-primario hover:underline"
      >
        ← Volver al listado de zonas
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primario">
            Gestión del espacio público
          </p>
          <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
            {nombre ? `Historial de «${nombre}»` : "Historial de la zona"}
          </h1>
          <p className="mt-2 max-w-3xl text-base text-texto">
            Consulta cada versión de la geometría y de las restricciones. Cada
            cambio conserva el estado anterior, el gestor responsable y la
            fecha.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activa !== null ? (
            <Etiqueta tono={activa ? "exitoso" : "neutro"}>
              {activa ? "Activa" : "Inactiva"}
            </Etiqueta>
          ) : null}
          {esAdministrador ? (
            <Link
              href={`/gestor/zonas/${id}/editar`}
              className="inline-flex min-h-11 items-center rounded-lg bg-primario px-4 py-2.5 text-sm font-semibold text-white hover:bg-primario-hover"
            >
              Editar zona
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
