/* eslint-disable react-hooks/set-state-in-effect -- sincroniza estado local con props y respuestas externas */
"use client";

import { useEffect, useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { AccionesModal, Modal } from "@/components/ui/modal";
import type { RequisitoRevision } from "@/types/api";
import {
  requisitosNoCumple,
  validarObservacionDevolucion,
} from "./validaciones-revision";

interface DevolverSolicitudModalProps {
  abierto: boolean;
  requisitos: RequisitoRevision[];
  onCerrar: () => void;
  onConfirmar: (observacion: string) => Promise<void>;
  cargando: boolean;
}

export function DevolverSolicitudModal({
  abierto,
  requisitos,
  onCerrar,
  onConfirmar,
  cargando,
}: DevolverSolicitudModalProps) {
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const noCumple = requisitosNoCumple(requisitos);

  useEffect(() => {
    if (!abierto) return;
    setObservacion("");
    setError(null);
  }, [abierto]);

  async function confirmar(): Promise<void> {
    const errorObservacion = validarObservacionDevolucion(observacion);
    if (errorObservacion) {
      setError(errorObservacion);
      return;
    }
    setError(null);
    try {
      await onConfirmar(observacion.trim());
    } catch (capturado) {
      setError(
        capturado instanceof Error
          ? capturado.message
          : "No se pudo devolver la solicitud.",
      );
    }
  }

  return (
    <Modal
      abierto={abierto}
      titulo="Devolver para corrección"
      descripcion="La solicitud pasará a «Requiere corrección» y el comerciante recibirá la observación por notificación y correo."
      onCerrar={onCerrar}
    >
      <div className="flex flex-col gap-4">
        {noCumple.length > 0 ? (
          <Alerta tono="advertencia">
            <p className="font-semibold">
              Requisitos marcados como «No cumple»
            </p>
            <ul className="mt-1 list-inside list-disc">
              {noCumple.map((requisito) => (
                <li key={requisito.id}>
                  {requisito.nombre}
                  {requisito.observacion
                    ? `: ${requisito.observacion}`
                    : ""}
                </li>
              ))}
            </ul>
          </Alerta>
        ) : null}

        <div>
          <label
            htmlFor="observacion-devolucion"
            className="text-sm font-medium text-titulo"
          >
            Observación general
            <span className="ml-1 text-peligro-texto" aria-hidden="true">
              *
            </span>
          </label>
          <textarea
            id="observacion-devolucion"
            value={observacion}
            onChange={(evento) => setObservacion(evento.target.value)}
            rows={4}
            maxLength={2_000}
            aria-invalid={error ? true : undefined}
            className="mt-1.5 w-full rounded-lg border border-borde bg-superficie px-3.5 py-2.5 text-sm text-titulo focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primario"
            placeholder="Explica qué documentos o datos debe corregir el comerciante."
          />
          <p className="mt-1 text-xs text-tenue">
            {observacion.length}/2000 caracteres
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
          textoConfirmar="Devolver solicitud"
          variante="peligro"
          cargando={cargando}
        />
      </div>
    </Modal>
  );
}

