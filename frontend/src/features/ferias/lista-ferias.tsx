"use client";

import { useState } from "react";
import { BloqueError } from "@/components/ui/bloque-error";
import { EnlaceBoton } from "@/components/ui/enlace-boton";
import { Selector } from "@/components/ui/campo";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import { Paginacion } from "@/components/ui/paginacion";
import { formatearRangoFechas } from "@/features/espacios/estilos-espacio";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import { listarMisFerias } from "@/lib/api-client";
import { formatearFechaHora } from "@/lib/formato";
import type { EstadoFeria } from "@/types/api";
import { EtiquetaEstadoFeria } from "./etiqueta-estado-feria";
import { ETIQUETAS_ESTADO_FERIA } from "./validaciones-feria";

const ESTADOS: EstadoFeria[] = [
  "radicada",
  "aprobada",
  "rechazada",
  "cancelada",
  "realizada",
];

/** Listado de ferias del organizador autenticado. */
export function ListaFerias() {
  const [estado, setEstado] = useState<EstadoFeria | "todos">("todos");
  const [pagina, setPagina] = useState(1);

  const { datos, cargando, error, recargar } = useConsultaApi(
    () =>
      listarMisFerias({
        estado: estado === "todos" ? undefined : estado,
        pagina,
        limite: 10,
      }),
    [estado, pagina],
  );

  if (cargando && datos === null) {
    return <Cargando texto="Consultando tus ferias…" />;
  }

  if (error) {
    return <BloqueError error={error} onReintentar={recargar} />;
  }

  const ferias = datos?.datos ?? [];

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-texto">
          Portal del organizador
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
              Mis ferias
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-texto sm:text-base">
              Consulta el estado de tus solicitudes de feria y radica una nueva
              cuando tu organización esté activa.
            </p>
          </div>
          <EnlaceBoton href="/organizador/ferias/nueva">
            Nueva feria
          </EnlaceBoton>
        </div>
      </header>

      <div className="flex flex-col gap-3 rounded-xl border border-borde bg-superficie p-4 sm:flex-row sm:items-end sm:justify-between">
        <Selector
          etiqueta="Filtrar por estado"
          value={estado}
          onChange={(evento) => {
            setEstado(evento.target.value as EstadoFeria | "todos");
            setPagina(1);
          }}
          className="sm:max-w-xs"
        >
          <option value="todos">Todos los estados</option>
          {ESTADOS.map((opcion) => (
            <option key={opcion} value={opcion}>
              {ETIQUETAS_ESTADO_FERIA[opcion]}
            </option>
          ))}
        </Selector>
        <p className="text-sm text-texto" role="status">
          {datos?.paginacion.total ?? 0} feria(s)
        </p>
      </div>

      {ferias.length === 0 ? (
        <EstadoVacio
          titulo="Aún no tienes ferias radicadas"
          descripcion="Cuando solicites una feria, aparecerá aquí con su número de radicado y su estado."
          accion={
            <EnlaceBoton href="/organizador/ferias/nueva">
              Solicitar una feria
            </EnlaceBoton>
          }
        />
      ) : (
        <ul className="grid gap-3">
          {ferias.map((feria) => (
            <li
              key={feria.id}
              className="rounded-xl border border-borde bg-superficie p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-titulo">
                      {feria.nombre}
                    </h2>
                    <EtiquetaEstadoFeria estado={feria.estado} />
                  </div>
                  <p className="mt-1 text-sm font-semibold text-accent-texto">
                    {feria.numeroRadicado}
                  </p>
                  <p className="mt-1 text-sm text-texto">
                    {feria.zona.nombre} · {feria.numeroPuestos} puestos
                  </p>
                  <p className="mt-1 text-sm text-texto">
                    {formatearRangoFechas(feria.fechaInicio, feria.fechaFin)}
                  </p>
                  <p className="mt-1 text-xs text-tenue">
                    Radicada el {formatearFechaHora(feria.radicadaEn)}
                  </p>
                </div>
                <EnlaceBoton
                  href={`/organizador/ferias/${feria.id}`}
                  variante="contorno"
                >
                  Ver detalle
                </EnlaceBoton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {datos ? (
        <Paginacion
          pagina={datos.paginacion.pagina}
          totalPaginas={datos.paginacion.totalPaginas}
          onCambiar={setPagina}
        />
      ) : null}
    </section>
  );
}
