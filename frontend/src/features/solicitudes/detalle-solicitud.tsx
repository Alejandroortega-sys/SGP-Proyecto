"use client";

import Link from "next/link";
import { useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Cargando } from "@/components/ui/estado-vacio";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import {
  comoApiError,
  descargarDocumentoSolicitud,
  obtenerMiSolicitud,
} from "@/lib/api-client";
import { formatearFecha, formatearFechaHora, nombreCompleto } from "@/lib/formato";
import { formatearRangoFechas } from "@/features/espacios/estilos-espacio";
import type { DocumentoSolicitud } from "@/types/api";
import {
  ETIQUETAS_ESTADO_SOLICITUD,
  DESCRIPCIONES_ESTADO_SOLICITUD,
} from "./estado-solicitud";
import { EtiquetaEstadoSolicitud } from "./etiqueta-estado-solicitud";

interface DetalleSolicitudProps {
  id: string;
}

function formatearDocumento(documento: DocumentoSolicitud): string {
  if (documento.nombreOriginal) return documento.nombreOriginal;
  return documento.tipoDocumento;
}

/** Detalle de una solicitud radicada, con documentos e historial. */
export function DetalleSolicitud({ id }: DetalleSolicitudProps) {
  const { datos: solicitud, cargando, error, recargar } = useConsultaApi(
    () => obtenerMiSolicitud(id),
    [id],
  );
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);
  const [descargando, setDescargando] = useState<string | null>(null);

  async function descargar(documento: DocumentoSolicitud): Promise<void> {
    setErrorDescarga(null);
    setDescargando(documento.id);
    try {
      const { blob, nombreArchivo } = await descargarDocumentoSolicitud(
        id,
        documento.id,
      );
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = nombreArchivo || formatearDocumento(documento);
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
    } catch (fallo) {
      setErrorDescarga(comoApiError(fallo).mensaje);
    } finally {
      setDescargando(null);
    }
  }

  if (cargando) return <Cargando texto="Cargando el detalle de la solicitud…" />;
  if (error) return <BloqueError error={error} onReintentar={recargar} />;
  if (!solicitud) return null;

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <Link
          href="/comerciante/solicitudes"
          className="text-sm font-semibold text-primario hover:underline"
        >
          ← Volver a Mis solicitudes
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primario">
              Solicitud de uso temporal
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-titulo sm:text-3xl">
              {solicitud.numeroRadicado}
            </h1>
            <p className="mt-1 text-sm text-texto">
              Radicada el{" "}
              {formatearFecha(solicitud.radicadaEn ?? solicitud.creadoEn)}
            </p>
          </div>
          <EtiquetaEstadoSolicitud estado={solicitud.estado} />
        </div>
        <Alerta tono="informacion" conIcono={false}>
          {DESCRIPCIONES_ESTADO_SOLICITUD[solicitud.estado]}
        </Alerta>
      </header>

      {solicitud.estado === "rechazada" && solicitud.motivoRechazo ? (
        <Alerta tono="error">
          <p className="font-semibold">Motivo del rechazo</p>
          <p className="mt-1">{solicitud.motivoRechazo}</p>
        </Alerta>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-borde bg-superficie p-4">
          <h2 className="text-sm font-bold text-titulo">Espacio solicitado</h2>
          <p className="mt-2 font-semibold text-titulo">
            {solicitud.espacio?.nombre ?? "Espacio no disponible"}
          </p>
          <p className="text-sm text-texto">
            {solicitud.espacio?.sector ?? "Sin sector registrado"}
          </p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="font-semibold text-titulo">Actividad</dt>
            <dd>{solicitud.actividad}</dd>
            <dt className="font-semibold text-titulo">Productos</dt>
            <dd>
              {solicitud.productos.length > 0
                ? solicitud.productos.map((producto) => producto.nombre).join(", ")
                : "Sin productos registrados"}
            </dd>
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
        </section>

        <section className="rounded-xl border border-borde bg-superficie p-4">
          <h2 className="text-sm font-bold text-titulo">Documentos</h2>
          {solicitud.documentos.length === 0 ? (
            <p className="mt-2 text-sm text-tenue">
              No hay documentos asociados a esta solicitud.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {solicitud.documentos.map((documento) => (
                <li
                  key={documento.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-borde bg-fondo px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-titulo">
                      {documento.tipoDocumento}
                    </p>
                    <p className="truncate text-xs text-tenue">
                      {formatearDocumento(documento)}
                    </p>
                  </div>
                  <Boton
                    variante="contorno"
                    tamano="sm"
                    onClick={() => void descargar(documento)}
                    cargando={descargando === documento.id}
                  >
                    Descargar
                  </Boton>
                </li>
              ))}
            </ul>
          )}
          {errorDescarga ? (
            <p className="mt-2 text-sm text-rose-700">{errorDescarga}</p>
          ) : null}
        </section>
      </div>

      <section className="rounded-xl border border-borde bg-superficie p-4">
        <h2 className="text-sm font-bold text-titulo">Historial de estados</h2>
        {solicitud.historial.length === 0 ? (
          <p className="mt-2 text-sm text-tenue">
            Todavía no hay cambios de estado registrados.
          </p>
        ) : (
          <ol className="mt-3 flex flex-col gap-3">
            {solicitud.historial.map((registro) => (
              <li
                key={registro.id}
                className="border-l-2 border-primario/30 pl-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-titulo">
                    {registro.estadoAnterior
                      ? `${ETIQUETAS_ESTADO_SOLICITUD[registro.estadoAnterior]} → `
                      : ""}
                    {ETIQUETAS_ESTADO_SOLICITUD[registro.estadoNuevo]}
                  </span>
                  <span className="text-xs text-tenue">
                    {formatearFechaHora(registro.creadoEn)}
                  </span>
                </div>
                {registro.actor ? (
                  <p className="text-xs text-tenue">
                    {nombreCompleto(
                      registro.actor.nombre,
                      registro.actor.apellido,
                    )}
                  </p>
                ) : null}
                {registro.observacion ? (
                  <p className="mt-1 text-sm text-texto">
                    {registro.observacion}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
