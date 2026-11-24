"use client";

import Link from "next/link";
import { useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import { Paginacion } from "@/components/ui/paginacion";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import { formatearFecha } from "@/lib/formato";
import { listarMisPermisos } from "@/lib/api-client";
import { formatearRangoFechas } from "@/features/espacios/estilos-espacio";
import {
  diasParaVencer,
  vencePronto,
} from "./estados-permiso";
import { EtiquetaEstadoPermiso } from "./etiqueta-estado-permiso";

const LIMITE = 20;

/**
 * «Mis permisos» del comerciante (HU-32, tarea 1220): listado de carnés con
 * estado visible y aviso de vencimiento con acceso a renovación (HU-34).
 */
export function MisPermisos() {
  const [pagina, setPagina] = useState(1);
  const { datos, cargando, error, recargar } = useConsultaApi(
    () => listarMisPermisos({ pagina, limite: LIMITE }),
    [pagina],
  );

  const porVencer = (datos?.datos ?? []).filter((permiso) =>
    vencePronto(permiso.estado, permiso.fechaFin),
  );

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-texto">
          Permisos digitales
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-titulo sm:text-3xl">
          Mis permisos
        </h1>
        <p className="mt-1 text-sm text-texto">
          Consulta tu carné con el código QR y descárgalo para presentarlo
          ante cualquier autoridad.
        </p>
      </header>

      {porVencer.length > 0 ? (
        <Alerta tono="advertencia">
          <p className="font-semibold">
            {porVencer.length === 1
              ? "Un permiso está próximo a vencer."
              : `${porVencer.length} permisos están próximos a vencer.`}
          </p>
          <p className="mt-1 text-sm">
            {porVencer.map((permiso) => (
              <span key={permiso.id} className="block">
                {permiso.numero}: vence en {diasParaVencer(permiso.fechaFin)}{" "}
                día(s). Ábrelo y pulsa «Renovar» para radicar la solicitud con
                tus datos precargados.
              </span>
            ))}
          </p>
        </Alerta>
      ) : null}

      {cargando && !datos ? <Cargando texto="Cargando tus permisos…" /> : null}
      {error && !datos ? <BloqueError error={error} onReintentar={recargar} /> : null}

      {datos ? (
        datos.datos.length === 0 ? (
          <Tarjeta>
            <EstadoVacio
              titulo="Aún no tienes permisos"
              descripcion="Cuando un gestor apruebe una de tus solicitudes, tu carné digital aparecerá aquí."
              accion={
                <Link
                  href="/comerciante/solicitudes"
                  className="text-sm font-semibold text-accent-texto hover:underline"
                >
                  Ir a mis solicitudes →
                </Link>
              }
            />
          </Tarjeta>
        ) : (
          <Tarjeta className="overflow-hidden">
            <ul className="divide-y divide-borde">
              {datos.datos.map((permiso) => (
                <li
                  key={permiso.id}
                  className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-titulo">
                        {permiso.numero}
                      </span>
                      <EtiquetaEstadoPermiso estado={permiso.estado} />
                    </p>
                    <p className="mt-1 text-sm text-texto">
                      {permiso.espacioNombre ?? "Espacio no asignado"} ·{" "}
                      {permiso.categoria}
                    </p>
                    <p className="text-sm text-tenue">
                      Vigencia:{" "}
                      {formatearRangoFechas(permiso.fechaInicio, permiso.fechaFin)}{" "}
                      · Emitido el {formatearFecha(permiso.emitidoEn)}
                    </p>
                  </div>
                  <Link
                    href={`/comerciante/permisos/${permiso.id}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-accent-borde bg-accent-suave px-4 text-sm font-semibold text-accent-texto transition-colors duration-150 hover:bg-accent-fuerte sm:min-h-10"
                  >
                    Ver carné
                  </Link>
                </li>
              ))}
            </ul>
            <Paginacion
              pagina={datos.paginacion.pagina}
              totalPaginas={datos.paginacion.totalPaginas}
              onCambiar={setPagina}
            />
          </Tarjeta>
        )
      ) : null}
    </div>
  );
}
