/* eslint-disable react-hooks/set-state-in-effect -- sincroniza el formulario al abrir el diálogo */
"use client";

import { useEffect, useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { AccionesModal, Modal } from "@/components/ui/modal";
import { formatearRangoFechas } from "@/features/espacios/estilos-espacio";
import { nombreCompleto } from "@/lib/formato";
import type { SolicitudRevisionDetalle } from "@/types/api";
import { validarDictamenAprobacion } from "./validaciones-revision";

interface AprobarSolicitudModalProps {
  abierto: boolean;
  solicitud: SolicitudRevisionDetalle;
  onCerrar: () => void;
  onConfirmar: (dictamen: string | undefined) => Promise<void>;
  cargando: boolean;
}

/** Confirmación de la aprobación y asignación del espacio (HU-20). */
export function AprobarSolicitudModal({
  abierto,
  solicitud,
  onCerrar,
  onConfirmar,
  cargando,
}: AprobarSolicitudModalProps) {
  const [dictamen, setDictamen] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setDictamen("");
    setError(null);
  }, [abierto]);

  async function confirmar(): Promise<void> {
    const errorDictamen = validarDictamenAprobacion(dictamen);
    if (errorDictamen) {
      setError(errorDictamen);
      return;
    }
    setError(null);
    try {
      await onConfirmar(dictamen.trim() || undefined);
    } catch (capturado) {
      setError(
        capturado instanceof Error
          ? capturado.message
          : "No se pudo aprobar la solicitud.",
      );
    }
  }

  return (
    <Modal
      abierto={abierto}
      titulo="Aprobar y asignar espacio"
      descripcion="La solicitud pasará a «Aprobada» y el espacio quedará ocupado en el rango de fechas y horas indicado. La decisión no se puede revertir."
      onCerrar={onCerrar}
    >
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-lg border border-borde bg-fondo p-3 text-sm">
          <dt className="font-semibold text-titulo">Radicado</dt>
          <dd>{solicitud.numeroRadicado}</dd>
          <dt className="font-semibold text-titulo">Comerciante</dt>
          <dd>
            {nombreCompleto(
              solicitud.comerciante.nombre,
              solicitud.comerciante.apellido,
            )}
          </dd>
          <dt className="font-semibold text-titulo">Espacio</dt>
          <dd>{solicitud.espacio?.nombre ?? "Espacio de la solicitud"}</dd>
          <dt className="font-semibold text-titulo">Fechas</dt>
          <dd>
            {formatearRangoFechas(
              solicitud.fechaInicio,
              solicitud.fechaFin,
            )}
          </dd>
          <dt className="font-semibold text-titulo">Horario</dt>
          <dd>
            {solicitud.horaInicio} a {solicitud.horaFin}
          </dd>
        </dl>

        <Alerta tono="advertencia">
          Al aprobar, el espacio quedará ocupado para esas fechas. Si otro gestor
          o un permiso ya lo asignó, la operación se rechazará.
        </Alerta>

        <div>
          <label
            htmlFor="dictamen-aprobacion"
            className="text-sm font-medium text-titulo"
          >
            Dictamen (opcional)
          </label>
          <textarea
            id="dictamen-aprobacion"
            value={dictamen}
            onChange={(evento) => setDictamen(evento.target.value)}
            rows={4}
            maxLength={2_000}
            aria-describedby="ayuda-dictamen-aprobacion"
            aria-invalid={error ? true : undefined}
            className="mt-1.5 w-full rounded-lg border border-borde bg-superficie px-3.5 py-2.5 text-sm text-titulo focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primario"
            placeholder="Opcional: explica por qué la solicitud cumple y se aprueba."
          />
          <p
            id="ayuda-dictamen-aprobacion"
            className="mt-1 text-xs text-tenue"
          >
            {dictamen.length}/2000 caracteres. Será visible para el solicitante.
          </p>
          {error ? (
            <p role="alert" className="mt-1 text-sm text-peligro-texto">
              {error}
            </p>
          ) : null}
        </div>

        <AccionesModal
          onCancelar={onCerrar}
          onConfirmar={() => void confirmar()}
          textoConfirmar="Aprobar y asignar espacio"
          cargando={cargando}
        />
      </div>
    </Modal>
  );
}
