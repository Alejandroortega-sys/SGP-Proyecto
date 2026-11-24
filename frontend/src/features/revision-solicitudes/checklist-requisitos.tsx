/* eslint-disable react-hooks/set-state-in-effect -- sincroniza estado local con props y respuestas externas */
"use client";

import { useEffect, useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { formatearFechaHora, nombreCompleto } from "@/lib/formato";
import type { RequisitoRevision } from "@/types/api";
import {
  CLASES_ESTADO_REQUISITO,
  ETIQUETAS_ESTADO_REQUISITO,
} from "@/features/solicitudes/estado-requisito";
import { formatearBytes } from "@/features/solicitudes/validaciones-solicitud";
import { validarObservacionNoCumple } from "./validaciones-revision";

interface ChecklistRequisitosProps {
  requisitos: RequisitoRevision[];
  puedeVerificar: boolean;
  seleccionadoId: string | null;
  onSeleccionar: (requisito: RequisitoRevision) => void;
  onVerificar: (
    requisitoId: string,
    datos: { estado: "cumple" | "no_cumple"; observacion?: string },
  ) => Promise<void>;
}

export function ChecklistRequisitos({
  requisitos,
  puedeVerificar,
  seleccionadoId,
  onSeleccionar,
  onVerificar,
}: ChecklistRequisitosProps) {
  if (requisitos.length === 0) {
    return (
      <Alerta tono="informacion">
        El catálogo de la actividad no tiene requisitos documentales
        configurados.
      </Alerta>
    );
  }

  return (
    <ol className="flex flex-col gap-3" aria-label="Lista de verificación">
      {requisitos.map((requisito) => (
        <li key={requisito.id}>
          <TarjetaRequisitoRevision
            requisito={requisito}
            puedeVerificar={puedeVerificar}
            seleccionado={seleccionadoId === requisito.id}
            onSeleccionar={() => onSeleccionar(requisito)}
            onVerificar={onVerificar}
          />
        </li>
      ))}
    </ol>
  );
}

function TarjetaRequisitoRevision({
  requisito,
  puedeVerificar,
  seleccionado,
  onSeleccionar,
  onVerificar,
}: {
  requisito: RequisitoRevision;
  puedeVerificar: boolean;
  seleccionado: boolean;
  onSeleccionar: () => void;
  onVerificar: (
    requisitoId: string,
    datos: { estado: "cumple" | "no_cumple"; observacion?: string },
  ) => Promise<void>;
}) {
  const [verificacion, setVerificacion] = useState<"cumple" | "no_cumple" | "">(
    requisito.estado === "cumple" || requisito.estado === "no_cumple"
      ? requisito.estado
      : "",
  );
  const [observacion, setObservacion] = useState(requisito.observacion ?? "");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setVerificacion(
      requisito.estado === "cumple" || requisito.estado === "no_cumple"
        ? requisito.estado
        : "",
    );
    setObservacion(requisito.observacion ?? "");
    setError(null);
  }, [requisito.estado, requisito.observacion, requisito.verificadoEn]);

  const documento = requisito.documentoActual;
  const puedeEditar = puedeVerificar && documento !== null;

  async function guardar(): Promise<void> {
    if (verificacion === "") {
      setError("Selecciona «Cumple» o «No cumple».");
      return;
    }
    if (verificacion === "no_cumple") {
      const errorObservacion = validarObservacionNoCumple(observacion);
      if (errorObservacion) {
        setError(errorObservacion);
        return;
      }
    }
    setError(null);
    setGuardando(true);
    try {
      await onVerificar(requisito.id, {
        estado: verificacion,
        observacion:
          verificacion === "no_cumple" ? observacion.trim() : undefined,
      });
    } catch (capturado) {
      setError(
        capturado instanceof Error
          ? capturado.message
          : "No se pudo guardar la verificación.",
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <article
      className={
        seleccionado
          ? "rounded-xl border-2 border-primario bg-primario-suave/30 p-4"
          : "rounded-xl border border-borde bg-superficie p-4"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button
          type="button"
          onClick={onSeleccionar}
          className="min-w-0 text-left"
          aria-pressed={seleccionado}
        >
          <span className="block text-sm font-bold text-titulo">
            {requisito.nombre}
            {requisito.obligatorio ? (
              <span className="ml-1 text-peligro-texto" aria-label="obligatorio">
                *
              </span>
            ) : null}
          </span>
          {requisito.descripcion ? (
            <span className="mt-0.5 block text-xs text-texto">
              {requisito.descripcion}
            </span>
          ) : null}
        </button>
        <span
          className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CLASES_ESTADO_REQUISITO[requisito.estado]}`}
        >
          {ETIQUETAS_ESTADO_REQUISITO[requisito.estado]}
        </span>
      </div>

      {documento ? (
        <button
          type="button"
          onClick={onSeleccionar}
          className="mt-2 block w-full text-left text-xs text-tenue hover:text-accent-texto"
        >
          {documento.nombreOriginal ?? documento.tipoDocumento}
          {documento.tamanoBytes !== null
            ? ` · ${formatearBytes(documento.tamanoBytes)}`
            : ""}{" "}
          · {formatearFechaHora(documento.cargadoEn)}
        </button>
      ) : (
        <p className="mt-2 text-xs font-semibold text-peligro-texto">
          Sin documento vigente cargado.
        </p>
      )}

      {requisito.verificadoPor ? (
        <p className="mt-1 text-xs text-tenue">
          Verificado por{" "}
          {nombreCompleto(
            requisito.verificadoPor.nombre,
            requisito.verificadoPor.apellido,
          )}
          {requisito.verificadoEn
            ? ` el ${formatearFechaHora(requisito.verificadoEn)}`
            : ""}
        </p>
      ) : null}

      {requisito.observacion ? (
        <p className="mt-2 rounded-lg bg-advertencia-suave px-3 py-2 text-sm text-advertencia-texto">
          <span className="font-semibold">Observación: </span>
          {requisito.observacion}
        </p>
      ) : null}

      {puedeEditar ? (
        <div className="mt-3 border-t border-borde pt-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label={`Verificación de ${requisito.nombre}`}>
            <Boton
              variante={verificacion === "cumple" ? "solido" : "contorno"}
              tamano="sm"
              onClick={() => setVerificacion("cumple")}
              aria-pressed={verificacion === "cumple"}
            >
              Cumple
            </Boton>
            <Boton
              variante={verificacion === "no_cumple" ? "peligro" : "contorno"}
              tamano="sm"
              onClick={() => setVerificacion("no_cumple")}
              aria-pressed={verificacion === "no_cumple"}
            >
              No cumple
            </Boton>
          </div>

          {verificacion === "no_cumple" ? (
            <div className="mt-2">
              <label
                htmlFor={`observacion-${requisito.id}`}
                className="text-sm font-medium text-titulo"
              >
                Observación para el comerciante
                <span className="ml-1 text-peligro-texto" aria-hidden="true">
                  *
                </span>
              </label>
              <textarea
                id={`observacion-${requisito.id}`}
                value={observacion}
                onChange={(evento) => setObservacion(evento.target.value)}
                maxLength={2_000}
                rows={3}
                aria-invalid={error ? true : undefined}
                className="mt-1.5 w-full rounded-lg border border-borde bg-superficie px-3.5 py-2.5 text-sm text-titulo focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primario"
                placeholder="Explica qué debe corregir el comerciante."
              />
              <p className="mt-1 text-xs text-tenue">
                {observacion.length}/2000 caracteres
              </p>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-2 text-sm text-peligro-texto">
              {error}
            </p>
          ) : null}

          <Boton
            tamano="sm"
            className="mt-3"
            onClick={() => void guardar()}
            cargando={guardando}
            disabled={verificacion === ""}
          >
            Guardar verificación
          </Boton>
        </div>
      ) : null}
    </article>
  );
}

