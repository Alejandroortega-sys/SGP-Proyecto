"use client";

import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";
import { formatearFechaHora, nombreCompleto } from "@/lib/formato";
import { EtiquetaEstadoSolicitud } from "@/features/solicitudes/etiqueta-estado-solicitud";
import { formatearRangoFechas } from "@/features/espacios/estilos-espacio";
import type { SolicitudRevisionDetalle } from "@/types/api";
import { puedeResolverRevision, requisitosNoCumple } from "./validaciones-revision";

interface ResolucionSolicitudProps {
  solicitud: SolicitudRevisionDetalle;
  onAprobar: () => void;
  onRechazar: () => void;
}

/**
 * Sección de resolución de la solicitud (HU-20).
 *
 * Muestra el estado de la decisión, el dictamen cuando ya fue resuelta y las
 * acciones de aprobar o rechazar cuando el gestor posee el bloqueo.
 */
export function ResolucionSolicitud({
  solicitud,
  onAprobar,
  onRechazar,
}: ResolucionSolicitudProps) {
  const resuelta =
    solicitud.estado === "aprobada" ||
    solicitud.estado === "rechazada" ||
    solicitud.estado === "cancelada";
  const habilitada = puedeResolverRevision(solicitud);
  const noCumplen = requisitosNoCumple(solicitud.requisitos);

  return (
    <Tarjeta className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-titulo">Resolución</h2>
          <p className="mt-1 text-sm text-texto">
            Aprobar asigna el espacio en las fechas y horas solicitadas.
            Rechazar exige un motivo visible para el comerciante.
          </p>
        </div>
        <EtiquetaEstadoSolicitud estado={solicitud.estado} />
      </div>

      {resuelta ? (
        <ResolucionRegistrada solicitud={solicitud} />
      ) : (
        <>
          {noCumplen.length > 0 ? (
            <Alerta tono="advertencia" className="mt-4">
              <p className="font-semibold">
                No se puede aprobar: hay requisitos marcados como «No cumple».
              </p>
              <ul className="mt-1 list-inside list-disc text-sm">
                {noCumplen.map((requisito) => (
                  <li key={requisito.id}>
                    {requisito.nombre}
                    {requisito.observacion
                      ? `: ${requisito.observacion}`
                      : ""}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm">
                Corrige la verificación o rechaza la solicitud con el motivo
                correspondiente.
              </p>
            </Alerta>
          ) : null}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Boton
              onClick={onAprobar}
              disabled={!habilitada || noCumplen.length > 0}
              anchoCompleto
            >
              Aprobar y asignar espacio
            </Boton>
            <Boton
              variante="peligro"
              onClick={onRechazar}
              disabled={!habilitada}
              anchoCompleto
            >
              Rechazar solicitud
            </Boton>
          </div>
        </>
      )}
    </Tarjeta>
  );
}

function ResolucionRegistrada({
  solicitud,
}: {
  solicitud: SolicitudRevisionDetalle;
}) {
  const aprobada = solicitud.estado === "aprobada";
  return (
    <div className="mt-4 flex flex-col gap-3">
      <Alerta tono={aprobada ? "exito" : "advertencia"}>
        <p className="font-semibold">
          {aprobada
            ? "Solicitud aprobada y espacio asignado."
            : solicitud.estado === "rechazada"
              ? "Solicitud rechazada."
              : "La solicitud fue cancelada."}
        </p>
        {solicitud.decididaEn ? (
          <p className="mt-1 text-sm">
            Decidida el {formatearFechaHora(solicitud.decididaEn)}.
          </p>
        ) : null}
        {solicitud.resueltaPor ? (
          <p className="mt-1 text-sm">
            Por{" "}
            {nombreCompleto(
              solicitud.resueltaPor.nombre,
              solicitud.resueltaPor.apellido,
            )}
            .
          </p>
        ) : null}
      </Alerta>

      {aprobada && solicitud.asignacion ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="font-semibold text-titulo">Espacio</dt>
          <dd>{solicitud.asignacion.espacioNombre ?? "Espacio asignado"}</dd>
          <dt className="font-semibold text-titulo">Fechas</dt>
          <dd>
            {formatearRangoFechas(
              solicitud.asignacion.fechaInicio,
              solicitud.asignacion.fechaFin,
            )}
          </dd>
          <dt className="font-semibold text-titulo">Horario</dt>
          <dd>
            {solicitud.asignacion.horaInicio} a {solicitud.asignacion.horaFin}
          </dd>
        </dl>
      ) : null}

      {aprobada && solicitud.dictamen ? (
        <div className="rounded-lg border border-borde bg-fondo p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-tenue">
            Dictamen del gestor
          </p>
          <p className="mt-1 text-sm text-texto">{solicitud.dictamen}</p>
        </div>
      ) : null}

      {solicitud.estado === "rechazada" && solicitud.motivoRechazo ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-rose-700">
            Motivo del rechazo
          </p>
          <p className="mt-1 text-sm text-rose-900">
            {solicitud.motivoRechazo}
          </p>
        </div>
      ) : null}
    </div>
  );
}
