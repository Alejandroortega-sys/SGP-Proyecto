"use client";
/* eslint-disable react-hooks/set-state-in-effect -- el formulario y la vista previa se reinician al abrir cada diálogo */

import { useEffect, useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Campo, Selector } from "@/components/ui/campo";
import { AccionesModal, Modal } from "@/components/ui/modal";
import {
  ApiError,
  aprobarFeriaGestor,
  cancelarFeriaGestor,
  comoApiError,
  consultarCrucesFeria,
  moverFeriaGestor,
} from "@/lib/api-client";
import type {
  ConflictoAgendaFeria,
  CrucesFeria,
  EventoAgendaFeria,
  RangoFeria,
  ZonaFeriaGestor,
} from "@/types/api";
import { formatearCorta, rangoEvento } from "./calendario-ferias-utilidades";

interface BaseModalProps {
  evento: EventoAgendaFeria;
  abierto: boolean;
  onCerrar: () => void;
  onExito: (mensaje: string) => void;
}

function mensajeError(error: unknown): string {
  const apiError = comoApiError(error);
  if (apiError.message) return apiError.message;
  return "No pudimos completar la operación. Intenta de nuevo.";
}

function ListaConflictos({ conflictos }: { conflictos: ConflictoAgendaFeria[] }) {
  if (conflictos.length === 0) return null;

  return (
    <div className="rounded-lg border border-advertencia-borde bg-advertencia-suave p-3">
      <p className="text-sm font-semibold text-advertencia-texto">
        No se puede aplicar el cambio por estos cruces:
      </p>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-advertencia-texto">
        {conflictos.map((conflicto, indice) => (
          <li key={`${conflicto.tipo}-${conflicto.referencia ?? indice}-${indice}`}>
            {conflicto.mensaje}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sugerencias({
  sugerencias,
  onAplicar,
}: {
  sugerencias: RangoFeria[];
  onAplicar: (rango: RangoFeria) => void;
}) {
  if (sugerencias.length === 0) return null;

  return (
    <div className="rounded-lg border border-info-borde bg-info-suave p-3">
      <p className="text-sm font-semibold text-info-texto">
        Fechas alternativas disponibles
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {sugerencias.map((rango) => (
          <Boton
            key={`${rango.fechaInicio}-${rango.fechaFin}`}
            variante="contorno"
            tamano="sm"
            onClick={() => onAplicar(rango)}
          >
            Del {formatearCorta(rango.fechaInicio)} al{" "}
            {formatearCorta(rango.fechaFin)}
          </Boton>
        ))}
      </div>
    </div>
  );
}

export function ModalAprobarFeria({
  evento,
  abierto,
  onCerrar,
  onExito,
}: BaseModalProps) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function aprobar() {
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await aprobarFeriaGestor(evento.id);
      onExito(respuesta.mensaje);
    } catch (capturado) {
      setError(mensajeError(capturado));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto={abierto}
      titulo="Aprobar feria"
      descripcion="La feria quedará aprobada y se bloquearán todos los espacios de la zona en las fechas indicadas."
      onCerrar={onCerrar}
    >
      <div className="flex flex-col gap-4">
        <dl className="grid gap-2 rounded-lg border border-borde bg-fondo p-3 text-sm text-texto sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-titulo">Feria</dt>
            <dd>{evento.nombre}</dd>
          </div>
          <div>
            <dt className="font-semibold text-titulo">Radicado</dt>
            <dd>{evento.numeroRadicado}</dd>
          </div>
          <div>
            <dt className="font-semibold text-titulo">Zona</dt>
            <dd>{evento.zona.nombre}</dd>
          </div>
          <div>
            <dt className="font-semibold text-titulo">Fechas</dt>
            <dd>{rangoEvento(evento)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-titulo">Puestos</dt>
            <dd>{evento.numeroPuestos}</dd>
          </div>
          <div>
            <dt className="font-semibold text-titulo">Organización</dt>
            <dd>{evento.organizador.organizacion}</dd>
          </div>
        </dl>

        {error ? <Alerta tono="error">{error}</Alerta> : null}

        <AccionesModal
          onCancelar={onCerrar}
          onConfirmar={aprobar}
          textoConfirmar="Aprobar y bloquear espacios"
          cargando={enviando}
        />
      </div>
    </Modal>
  );
}

export function ModalMoverFeria({
  evento,
  zonas,
  abierto,
  onCerrar,
  onExito,
}: BaseModalProps & { zonas: ZonaFeriaGestor[] }) {
  const [zonaId, setZonaId] = useState(evento.zona.id);
  const [fechaInicio, setFechaInicio] = useState(evento.fechaInicio);
  const [fechaFin, setFechaFin] = useState(evento.fechaFin);
  const [motivo, setMotivo] = useState("");
  const [cruces, setCruces] = useState<CrucesFeria | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [errorPreview, setErrorPreview] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setZonaId(evento.zona.id);
    setFechaInicio(evento.fechaInicio);
    setFechaFin(evento.fechaFin);
    setMotivo("");
    setCruces(null);
    setError(null);
    setErrorPreview(null);
  }, [evento, abierto]);

  useEffect(() => {
    if (!abierto) return;
    if (!zonaId || !fechaInicio || !fechaFin || fechaFin < fechaInicio) {
      setCruces(null);
      return;
    }

    let activo = true;
    setConsultando(true);
    setErrorPreview(null);
    const temporizador = setTimeout(() => {
      consultarCrucesFeria(evento.id, {
        zonaId,
        fechaInicio,
        fechaFin,
      })
        .then((respuesta) => {
          if (activo) setCruces(respuesta);
        })
        .catch((capturado) => {
          if (!activo) return;
          setCruces(null);
          setErrorPreview(mensajeError(capturado));
        })
        .finally(() => {
          if (activo) setConsultando(false);
        });
    }, 350);

    return () => {
      activo = false;
      clearTimeout(temporizador);
    };
  }, [abierto, evento.id, zonaId, fechaInicio, fechaFin]);

  function aplicarSugerencia(rango: RangoFeria) {
    setFechaInicio(rango.fechaInicio);
    setFechaFin(rango.fechaFin);
  }

  async function mover() {
    if (enviando || !cruces?.disponible) return;
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await moverFeriaGestor(evento.id, {
        zonaId,
        fechaInicio,
        fechaFin,
        motivo: motivo.trim() || undefined,
      });
      onExito(respuesta.mensaje);
    } catch (capturado) {
      const apiError = comoApiError(capturado);
      setError(apiError.message);
      if (apiError instanceof ApiError && apiError.status === 409) {
        setCruces({
          disponible: false,
          conflictos: [
            {
              tipo: "feria",
              feriaId: null,
              feriaNombre: null,
              espacioId: null,
              espacioNombre: null,
              referencia: null,
              fechaInicio,
              fechaFin,
              mensaje: apiError.message,
            },
          ],
          sugerencias: [],
        });
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto={abierto}
      titulo="Mover feria"
      descripcion="Cambia la zona o las fechas. La agenda se valida antes de guardar para evitar cruces."
      onCerrar={onCerrar}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Selector
            etiqueta="Zona"
            requerido
            value={zonaId}
            onChange={(eventoCambio) => setZonaId(eventoCambio.target.value)}
          >
            {zonas.map((zona) => (
              <option key={zona.id} value={zona.id}>
                {zona.nombre}
              </option>
            ))}
          </Selector>
          <Campo
            etiqueta="Fecha de inicio"
            requerido
            type="date"
            value={fechaInicio}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(eventoCambio) => setFechaInicio(eventoCambio.target.value)}
          />
          <Campo
            etiqueta="Fecha de fin"
            requerido
            type="date"
            value={fechaFin}
            min={fechaInicio || new Date().toISOString().slice(0, 10)}
            onChange={(eventoCambio) => setFechaFin(eventoCambio.target.value)}
          />
          <Campo
            etiqueta="Motivo del cambio (opcional)"
            value={motivo}
            maxLength={2000}
            onChange={(eventoCambio) => setMotivo(eventoCambio.target.value)}
          />
        </div>

        {consultando ? (
          <p className="text-sm text-tenue" role="status">
            Consultando disponibilidad…
          </p>
        ) : null}
        {errorPreview ? <Alerta tono="error">{errorPreview}</Alerta> : null}
        {cruces ? (
          cruces.disponible ? (
            <Alerta tono="exito">
              La zona está libre para las fechas indicadas.
            </Alerta>
          ) : (
            <>
              <ListaConflictos conflictos={cruces.conflictos} />
              <Sugerencias
                sugerencias={cruces.sugerencias}
                onAplicar={aplicarSugerencia}
              />
            </>
          )
        ) : null}

        {error ? <Alerta tono="error">{error}</Alerta> : null}

        <AccionesModal
          onCancelar={onCerrar}
          onConfirmar={mover}
          textoConfirmar="Guardar cambio"
          cargando={enviando}
          deshabilitado={!cruces?.disponible || consultando}
        />
      </div>
    </Modal>
  );
}

export function ModalCancelarFeria({
  evento,
  abierto,
  onCerrar,
  onExito,
}: BaseModalProps) {
  const [motivo, setMotivo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setMotivo("");
    setErrorMotivo(null);
    setError(null);
  }, [abierto, evento.id]);

  async function cancelar() {
    if (enviando) return;
    if (!motivo.trim()) {
      setErrorMotivo("Debes escribir el motivo de la cancelación.");
      return;
    }
    setErrorMotivo(null);
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await cancelarFeriaGestor(evento.id, motivo.trim());
      onExito(respuesta.mensaje);
    } catch (capturado) {
      setError(mensajeError(capturado));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto={abierto}
      titulo="Cancelar feria"
      descripcion="La feria quedará cancelada, sus espacios se liberarán y el organizador recibirá el motivo."
      onCerrar={onCerrar}
    >
      <div className="flex flex-col gap-4">
        <p className="rounded-lg border border-borde bg-fondo p-3 text-sm text-texto">
          <span className="font-semibold text-titulo">{evento.nombre}</span> ·{" "}
          {evento.zona.nombre} · {rangoEvento(evento)}
        </p>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`motivo-cancelacion-${evento.id}`}
            className="text-sm font-medium text-titulo"
          >
            Motivo de la cancelación
            <span className="ml-1 text-peligro-texto" aria-hidden="true">
              *
            </span>
          </label>
          <textarea
            id={`motivo-cancelacion-${evento.id}`}
            value={motivo}
            required
            maxLength={2000}
            rows={4}
            aria-required="true"
            aria-invalid={errorMotivo ? true : undefined}
            onChange={(eventoCambio) => {
              setMotivo(eventoCambio.target.value);
              if (errorMotivo) setErrorMotivo(null);
            }}
            className={[
              "w-full rounded-lg border bg-superficie px-3.5 py-2.5 text-base text-titulo",
              "placeholder:text-tenue focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primario",
              errorMotivo ? "border-peligro" : "border-borde",
            ].join(" ")}
            placeholder="Explica por qué se cancela la feria. El organizador verá este texto."
          />
          {errorMotivo ? (
            <p className="text-sm text-peligro-texto">{errorMotivo}</p>
          ) : (
            <p className="text-sm text-tenue">
              Obligatorio, máximo 2000 caracteres.
            </p>
          )}
        </div>

        {error ? <Alerta tono="error">{error}</Alerta> : null}

        <AccionesModal
          onCancelar={onCerrar}
          onConfirmar={cancelar}
          textoConfirmar="Cancelar feria"
          variante="peligro"
          cargando={enviando}
        />
      </div>
    </Modal>
  );
}
