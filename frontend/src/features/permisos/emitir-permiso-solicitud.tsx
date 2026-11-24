"use client";

import Link from "next/link";
import { useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { AccionesModal, Modal } from "@/components/ui/modal";
import { Tarjeta } from "@/components/ui/tarjeta";
import { comoApiError, emitirPermiso } from "@/lib/api-client";
import { formatearRangoFechas } from "@/features/espacios/estilos-espacio";
import type { PermisoEmitido, SolicitudRevisionDetalle } from "@/types/api";

/**
 * Emisión del permiso digital sobre una solicitud aprobada (HU-31, tarea
 * 1216). El número y el token QR los genera la base de datos; el gestor
 * solo confirma la emisión y el titular queda notificado del carné.
 */
export function EmitirPermisoSolicitud({
  solicitud,
}: {
  solicitud: SolicitudRevisionDetalle;
}) {
  const [abierto, setAbierto] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  const [emitido, setEmitido] = useState<PermisoEmitido | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (solicitud.estado !== "aprobada") return null;

  async function confirmar(): Promise<void> {
    setEmitiendo(true);
    setError(null);
    try {
      const respuesta = await emitirPermiso(solicitud.id);
      setEmitido(respuesta);
      setAbierto(false);
    } catch (capturado) {
      setError(comoApiError(capturado).mensaje);
      setAbierto(false);
    } finally {
      setEmitiendo(false);
    }
  }

  return (
    <Tarjeta className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-titulo">Permiso digital</h2>
          <p className="mt-1 text-sm text-texto">
            Emite el permiso con número consecutivo y código QR único para que
            el comerciante tenga su carné verificable.
          </p>
        </div>
      </div>

      {emitido ? (
        <div className="mt-4 flex flex-col gap-3">
          <Alerta tono="exito">
            <p className="font-semibold">
              Permiso {emitido.numero} emitido y carné disponible.
            </p>
            <p className="mt-1 text-sm">
              Vigencia del{" "}
              {formatearRangoFechas(emitido.fechaInicio, emitido.fechaFin)} ·
              Titular: {emitido.titular.nombre}
              {emitido.cobro
                ? ` · Cobro pendiente de $ ${emitido.cobro.valor}`
                : ""}
            </p>
          </Alerta>
          <Link
            href={`/gestor/permisos/${emitido.id}`}
            className="text-sm font-semibold text-accent-texto hover:underline"
          >
            Ver el permiso y su trazabilidad →
          </Link>
        </div>
      ) : (
        <div className="mt-4">
          {error ? (
            <Alerta tono="error">
              <p className="font-semibold">No se pudo emitir el permiso.</p>
              <p className="mt-1 text-sm">{error}</p>
            </Alerta>
          ) : null}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Boton onClick={() => setAbierto(true)} anchoCompleto>
              Emitir permiso
            </Boton>
          </div>
          {solicitud.asignacion ? (
            <p className="mt-2 text-xs text-tenue">
              Se usará el espacio «{solicitud.asignacion.espacioNombre}» con la
              vigencia aprobada del{" "}
              {formatearRangoFechas(
                solicitud.asignacion.fechaInicio,
                solicitud.asignacion.fechaFin,
              )}
              .
            </p>
          ) : null}
        </div>
      )}

      {abierto ? (
        <Modal
          abierto
          titulo="Emitir el permiso digital"
          descripcion="Se generará un número PER-AAAA-##### y un código QR único e impredecible. El comerciante recibirá la notificación de su carné disponible."
          onCerrar={() => setAbierto(false)}
        >
          <div className="mt-2">
            <AccionesModal
              textoConfirmar="Emitir permiso"
              cargando={emitiendo}
              onCancelar={() => setAbierto(false)}
              onConfirmar={() => void confirmar()}
            />
          </div>
        </Modal>
      ) : null}
    </Tarjeta>
  );
}
