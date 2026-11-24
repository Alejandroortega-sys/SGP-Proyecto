/* eslint-disable react-hooks/set-state-in-effect -- sincroniza el formulario al abrir el diálogo */
"use client";

import { useEffect, useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { AccionesModal, Modal } from "@/components/ui/modal";
import { formatearRangoFechas } from "@/features/espacios/estilos-espacio";
import type { SolicitudRevisionDetalle } from "@/types/api";
import { validarMotivoRechazo } from "./validaciones-revision";

interface RechazarSolicitudModalProps {
  abierto: boolean;
  solicitud: SolicitudRevisionDetalle;
  onCerrar: () => void;
  onConfirmar: (motivo: string) => Promise<void>;
  cargando: boolean;
}

/** Confirmación del rechazo con motivo obligatorio (HU-20). */
export function RechazarSolicitudModal({
  abierto,
  solicitud,
  onCerrar,
  onConfirmar,
  cargando,
}: RechazarSolicitudModalProps) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setMotivo("");
    setError(null);
  }, [abierto]);

  async function confirmar(): Promise<void> {
    const errorMotivo = validarMotivoRechazo(motivo);
    if (errorMotivo) {
      setError(errorMotivo);
      return;
    }
    setError(null);
    try {
      await onConfirmar(motivo.trim());
    } catch (capturado) {
      setError(
        capturado instanceof Error
          ? capturado.message
          : "No se pudo rechazar la solicitud.",
      );
    }
  }

  return (
    <Modal
      abierto={abierto}
      titulo="Rechazar solicitud"
      descripcion="El motivo será visible para el solicitante y se enviará por notificación y correo. La decisión no se puede revertir."
      onCerrar={onCerrar}
    >
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-lg border border-borde bg-fondo p-3 text-sm">
          <dt className="font-semibold text-titulo">Radicado</dt>
          <dd>{solicitud.numeroRadicado}</dd>
          <dt className="font-semibold text-titulo">Espacio</dt>
          <dd>{solicitud.espacio?.nombre ?? "Espacio de la solicitud"}</dd>
          <dt className="font-semibold text-titulo">Fechas</dt>
          <dd>
            {formatearRangoFechas(
              solicitud.fechaInicio,
              solicitud.fechaFin,
            )}
          </dd>
        </dl>

        <div>
          <label
            htmlFor="motivo-rechazo"
            className="text-sm font-medium text-titulo"
          >
            Motivo del rechazo
            <span className="ml-1 text-peligro-texto" aria-hidden="true">
              *
            </span>
          </label>
          <textarea
            id="motivo-rechazo"
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            rows={4}
            maxLength={2_000}
            aria-describedby="ayuda-motivo-rechazo"
            aria-invalid={error ? true : undefined}
            className="mt-1.5 w-full rounded-lg border border-borde bg-superficie px-3.5 py-2.5 text-sm text-titulo focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primario"
            placeholder="Explica por qué no es posible aprobar la solicitud."
          />
          <p id="ayuda-motivo-rechazo" className="mt-1 text-xs text-tenue">
            {motivo.length}/2000 caracteres. Será visible para el solicitante.
          </p>
          {error ? (
            <p role="alert" className="mt-1 text-sm text-peligro-texto">
              {error}
            </p>
          ) : null}
        </div>

        <Alerta tono="advertencia">
          El espacio no quedará asignado y el comerciante podrá consultar el
          motivo en el detalle de su solicitud.
        </Alerta>

        <AccionesModal
          onCancelar={onCerrar}
          onConfirmar={() => void confirmar()}
          textoConfirmar="Rechazar solicitud"
          variante="peligro"
          cargando={cargando}
        />
      </div>
    </Modal>
  );
}
