/* eslint-disable react-hooks/set-state-in-effect -- sincroniza estado local con props y respuestas externas */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Cargando } from "@/components/ui/estado-vacio";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import {
  comoApiError,
  devolverSolicitudRevision,
  obtenerSolicitudRevision,
  resolverSolicitudRevision,
  verificarRequisitoSolicitud,
} from "@/lib/api-client";
import {
  formatearFecha,
  formatearFechaHora,
  nombreCompleto,
  textoCategoria,
} from "@/lib/formato";
import type {
  CategoriaComercio,
  RequisitoRevision,
  RespuestaVerificarRequisito,
  SolicitudRevisionDetalle,
} from "@/types/api";
import { formatearRangoFechas } from "@/features/espacios/estilos-espacio";
import { EtiquetaEstadoSolicitud } from "@/features/solicitudes/etiqueta-estado-solicitud";
import { AprobarSolicitudModal } from "./aprobar-solicitud";
import { AvisoBloqueoRevision } from "./bloqueo-revision";
import { ChecklistRequisitos } from "./checklist-requisitos";
import { DevolverSolicitudModal } from "./devolver-solicitud";
import { RechazarSolicitudModal } from "./rechazar-solicitud";
import { ResolucionSolicitud } from "./resolucion-solicitud";
import { useBloqueoRevision } from "./use-bloqueo-revision";
import { VisorDocumentosRevision } from "./visor-documentos-revision";
import {
  puedeEditarRevision,
  requisitosNoCumple,
} from "./validaciones-revision";

export function DetalleRevisionSolicitud({ id }: { id: string }) {
  const { datos, cargando, error, recargar } = useConsultaApi(
    () => obtenerSolicitudRevision(id),
    [id],
  );

  if (cargando && !datos) {
    return <Cargando texto="Cargando la solicitud para revisiónâ€¦" />;
  }
  if (error && !datos) {
    return <BloqueError error={error} onReintentar={recargar} />;
  }
  if (!datos) return null;

  return (
    <RevisionCargada
      key={datos.id}
      inicial={datos}
      onRecargar={recargar}
    />
  );
}

function RevisionCargada({
  inicial,
  onRecargar,
}: {
  inicial: SolicitudRevisionDetalle;
  onRecargar: () => void;
}) {
  const [solicitud, setSolicitud] = useState(inicial);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(
    inicial.requisitos.find((requisito) => requisito.documentoActual)?.id ??
      inicial.requisitos[0]?.id ??
      null,
  );
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [modalDevolver, setModalDevolver] = useState(false);
  const [devolviendo, setDevolviendo] = useState(false);
  const [modalAprobar, setModalAprobar] = useState(false);
  const [modalRechazar, setModalRechazar] = useState(false);
  const [resolviendo, setResolviendo] = useState(false);

  useEffect(() => {
    setSolicitud(inicial);
    setSeleccionadoId((actual) => {
      if (actual && inicial.requisitos.some((requisito) => requisito.id === actual)) {
        return actual;
      }
      return (
        inicial.requisitos.find((requisito) => requisito.documentoActual)?.id ??
        inicial.requisitos[0]?.id ??
        null
      );
    });
  }, [inicial]);

  const { bloqueo, tomando, error, liberar, reintentar } = useBloqueoRevision({
    solicitudId: solicitud.id,
    estadoInicial: inicial.estado,
    onDetalle: (detalle) => {
      setSolicitud(detalle);
      setErrorAccion(null);
    },
    onMensaje: setMensaje,
    onError: (fallo) => {
      setErrorAccion(fallo.mensaje);
      onRecargar();
    },
  });

  useEffect(() => {
    if (!bloqueo) return;
    setSolicitud((actual) => ({
      ...actual,
      bloqueo,
      puedeVerificar:
        actual.estado === "en_revision" && bloqueo.esPropio,
    }));
  }, [bloqueo]);

  const seleccionado = useMemo(
    () =>
      solicitud.requisitos.find(
        (requisito) => requisito.id === seleccionadoId,
      ) ?? null,
    [solicitud.requisitos, seleccionadoId],
  );

  const noCumplen = requisitosNoCumple(solicitud.requisitos);
  const puedeEditar = puedeEditarRevision(solicitud);
  const bloqueoPropio = solicitud.bloqueo?.esPropio === true;

  async function verificar(
    requisitoId: string,
    datos: { estado: "cumple" | "no_cumple"; observacion?: string },
  ): Promise<void> {
    try {
      const respuesta = await verificarRequisitoSolicitud(
        solicitud.id,
        requisitoId,
        datos,
      );
      aplicarVerificacion(respuesta);
      setMensaje(respuesta.mensaje);
      setErrorAccion(null);
    } catch (capturado) {
      throw new Error(comoApiError(capturado).mensaje);
    }
  }

  function aplicarVerificacion(respuesta: RespuestaVerificarRequisito): void {
    setSolicitud((actual) => ({
      ...actual,
      requisitos: actual.requisitos.map((requisito) =>
        requisito.id === respuesta.requisito.id
          ? respuesta.requisito
          : requisito,
      ),
      progreso: respuesta.progreso,
      bloqueo: actual.bloqueo
        ? { ...actual.bloqueo, expiraEn: respuesta.expiraEn }
        : actual.bloqueo,
    }));
  }

  async function devolver(observacion: string): Promise<void> {
    setDevolviendo(true);
    setErrorAccion(null);
    try {
      const respuesta = await devolverSolicitudRevision(
        solicitud.id,
        observacion,
      );
      liberar();
      setSolicitud((actual) => ({
        ...actual,
        estado: respuesta.estado,
        motivoRechazo: respuesta.motivoRechazo,
        decididaEn: respuesta.decididaEn,
        actualizadoEn: respuesta.actualizadoEn,
        bloqueo: null,
        puedeVerificar: false,
        puedeResolver: false,
        motivoBloqueo:
          "La solicitud fue devuelta para corrección y no admite verificación.",
        motivoNoResolucion:
          "La solicitud fue devuelta para corrección y no admite resolución.",
      }));
      setModalDevolver(false);
      setMensaje(
        respuesta.correoEnviado
          ? `${respuesta.mensaje} El comerciante recibió la notificación y el correo.`
          : `${respuesta.mensaje} ${respuesta.mensajeCorreo ?? "No se pudo enviar el correo, pero la devolución quedó guardada."}`,
      );
      onRecargar();
    } catch (capturado) {
      throw new Error(comoApiError(capturado).mensaje);
    } finally {
      setDevolviendo(false);
    }
  }

  async function aprobar(dictamen: string | undefined): Promise<void> {
    setResolviendo(true);
    setErrorAccion(null);
    try {
      const respuesta = await resolverSolicitudRevision(solicitud.id, {
        decision: "aprobar",
        dictamen,
      });
      liberar();
      setSolicitud((actual) => ({
        ...actual,
        estado: respuesta.estado,
        decididaEn: respuesta.decididaEn,
        motivoRechazo: respuesta.motivoRechazo,
        dictamen: respuesta.dictamen,
        asignacion: respuesta.asignacion,
        actualizadoEn: respuesta.actualizadoEn,
        bloqueo: null,
        puedeVerificar: false,
        puedeResolver: false,
        motivoBloqueo:
          "La solicitud fue aprobada y no admite más verificaciones.",
        motivoNoResolucion: "La solicitud ya fue aprobada.",
      }));
      setModalAprobar(false);
      setMensaje(
        respuesta.correoEnviado
          ? `${respuesta.mensaje} El comerciante recibió la notificación y el correo.`
          : `${respuesta.mensaje} ${respuesta.mensajeCorreo ?? "No se pudo enviar el correo, pero la aprobación quedó guardada."}`,
      );
      onRecargar();
    } catch (capturado) {
      throw new Error(comoApiError(capturado).mensaje);
    } finally {
      setResolviendo(false);
    }
  }

  async function rechazar(motivo: string): Promise<void> {
    setResolviendo(true);
    setErrorAccion(null);
    try {
      const respuesta = await resolverSolicitudRevision(solicitud.id, {
        decision: "rechazar",
        motivoRechazo: motivo,
      });
      liberar();
      setSolicitud((actual) => ({
        ...actual,
        estado: respuesta.estado,
        decididaEn: respuesta.decididaEn,
        motivoRechazo: respuesta.motivoRechazo,
        dictamen: respuesta.dictamen,
        asignacion: null,
        actualizadoEn: respuesta.actualizadoEn,
        bloqueo: null,
        puedeVerificar: false,
        puedeResolver: false,
        motivoBloqueo:
          "La solicitud fue rechazada y no admite más verificaciones.",
        motivoNoResolucion: "La solicitud ya fue rechazada.",
      }));
      setModalRechazar(false);
      setMensaje(
        respuesta.correoEnviado
          ? `${respuesta.mensaje} El comerciante recibió la notificación y el correo.`
          : `${respuesta.mensaje} ${respuesta.mensajeCorreo ?? "No se pudo enviar el correo, pero el rechazo quedó guardado."}`,
      );
      onRecargar();
    } catch (capturado) {
      throw new Error(comoApiError(capturado).mensaje);
    } finally {
      setResolviendo(false);
    }
  }

  function liberarBloqueo(): void {
    liberar();
    setSolicitud((actual) => ({
      ...actual,
      bloqueo: null,
      puedeVerificar: false,
      motivoBloqueo:
        "Liberaste el bloqueo. Vuelve a tomar la revisión para verificar los requisitos.",
    }));
    setMensaje("Bloqueo de revisión liberado.");
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/gestor/solicitudes"
        className="text-sm font-semibold text-primario hover:underline"
      >
        â† Volver a la bandeja de revisión
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primario">
            Revisión de solicitud
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-titulo sm:text-3xl">
            {solicitud.numeroRadicado}
          </h1>
          <p className="mt-1 text-sm text-texto">
            Radicada el {formatearFecha(solicitud.radicadaEn ?? solicitud.creadoEn)} ·{" "}
            {solicitud.actividad}
          </p>
        </div>
        <EtiquetaEstadoSolicitud estado={solicitud.estado} />
      </header>

      {mensaje ? <Alerta tono="exito">{mensaje}</Alerta> : null}
      {errorAccion ? <Alerta tono="error">{errorAccion}</Alerta> : null}
      {error && !errorAccion ? <Alerta tono="error">{error.mensaje}</Alerta> : null}

      <AvisoBloqueoRevision
        solicitud={solicitud}
        onReintentar={() => void reintentar()}
        reintentando={tomando}
      />

      <Tarjeta className="p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide text-tenue">
              Comerciante
            </h2>
            <p className="mt-2 text-base font-bold text-titulo">
              {nombreCompleto(
                solicitud.comerciante.nombre,
                solicitud.comerciante.apellido,
              )}
            </p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="font-medium text-titulo">Correo</dt>
              <dd className="break-all">{solicitud.comerciante.correo}</dd>
              <dt className="font-medium text-titulo">Documento</dt>
              <dd>{solicitud.comerciante.documento ?? "â€”"}</dd>
              <dt className="font-medium text-titulo">Teléfono</dt>
              <dd>{solicitud.comerciante.telefono ?? "â€”"}</dd>
              <dt className="font-medium text-titulo">Actividad</dt>
              <dd>{solicitud.comerciante.actividadComercial ?? "â€”"}</dd>
              <dt className="font-medium text-titulo">Categoría</dt>
              <dd>{textoCategoria(solicitud.comerciante.categoria as CategoriaComercio | null)}</dd>
            </dl>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide text-tenue">
              Espacio y horario
            </h2>
            <p className="mt-2 text-base font-bold text-titulo">
              {solicitud.espacio?.nombre ?? "Espacio no disponible"}
            </p>
            <p className="text-sm text-texto">
              {solicitud.espacio?.sector ?? "Sin sector"} ·{" "}
              {solicitud.espacio?.actividadPermitida ?? "Sin actividad"}
            </p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="font-medium text-titulo">Fechas</dt>
              <dd>
                {formatearRangoFechas(
                  solicitud.fechaInicio,
                  solicitud.fechaFin,
                )}
              </dd>
              <dt className="font-medium text-titulo">Horario</dt>
              <dd>
                {solicitud.horaInicio} a {solicitud.horaFin}
              </dd>
              <dt className="font-medium text-titulo">Productos</dt>
              <dd>
                {solicitud.productos.length > 0
                  ? solicitud.productos
                      .map((producto) => producto.nombre)
                      .join(", ")
                  : "Sin productos registrados"}
              </dd>
            </dl>
          </section>
        </div>
      </Tarjeta>

      <div className="grid gap-4 xl:grid-cols-12">
        <section className="flex flex-col gap-3 xl:col-span-5">
          <Tarjeta className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-titulo">
                  Lista de verificación
                </h2>
                <p className="text-sm text-texto">
                  {solicitud.progreso.verificados} de{" "}
                  {solicitud.progreso.total} requisitos verificados
                </p>
              </div>
              <span className="rounded-full bg-fondo px-3 py-1 text-xs font-semibold text-texto">
                {solicitud.progreso.noCumple} no cumple
              </span>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={solicitud.progreso.total}
              aria-valuenow={solicitud.progreso.verificados}
              aria-label="Avance de la verificación"
            >
              <div
                className="h-full rounded-full bg-primario transition-[width]"
                style={{
                  width:
                    solicitud.progreso.total === 0
                      ? "0%"
                      : `${Math.round(
                          (solicitud.progreso.verificados /
                            solicitud.progreso.total) *
                            100,
                        )}%`,
                }}
              />
            </div>
          </Tarjeta>

          <ChecklistRequisitos
            requisitos={solicitud.requisitos}
            puedeVerificar={puedeEditar}
            seleccionadoId={seleccionadoId}
            onSeleccionar={(requisito: RequisitoRevision) =>
              setSeleccionadoId(requisito.id)
            }
            onVerificar={verificar}
          />

          <ResolucionSolicitud
            solicitud={solicitud}
            onAprobar={() => setModalAprobar(true)}
            onRechazar={() => setModalRechazar(true)}
          />

          <div className="flex flex-col gap-2 sm:flex-row">
            <Boton
              variante="peligro"
              onClick={() => setModalDevolver(true)}
              disabled={!puedeEditar}
              anchoCompleto
            >
              Devolver para corrección
            </Boton>
            {bloqueoPropio ? (
              <Boton variante="fantasma" onClick={liberarBloqueo} anchoCompleto>
                Liberar bloqueo
              </Boton>
            ) : null}
          </div>
          {!puedeEditar && noCumplen.length > 0 ? (
            <Alerta tono="informacion">
              La solicitud tiene {noCumplen.length} requisito
              {noCumplen.length === 1 ? "" : "s"} marcado
              {noCumplen.length === 1 ? "" : "s"} como «No cumple». Debes tener
              el bloqueo y la solicitud en revisión para devolverla.
            </Alerta>
          ) : null}
        </section>

        <section className="xl:col-span-7">
          <div className="sticky top-20 flex flex-col gap-4">
            <VisorDocumentosRevision
              solicitudId={solicitud.id}
              requisito={seleccionado}
            />

            <Tarjeta className="p-4">
              <h2 className="text-sm font-bold text-titulo">
                Historial de estados
              </h2>
              {solicitud.historial.length === 0 ? (
                <p className="mt-2 text-sm text-tenue">
                  No hay cambios de estado registrados.
                </p>
              ) : (
                <ol className="mt-3 flex flex-col gap-4">
                  {solicitud.historial.map((registro) => (
                    <li
                      key={registro.id}
                      className="relative border-l-2 border-primario/30 pl-4"
                    >
                      <span
                        className="absolute -left-[5px] top-2 size-2 rounded-full bg-primario"
                        aria-hidden="true"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <EtiquetaEstadoSolicitud estado={registro.estadoNuevo} />
                        <time
                          dateTime={registro.creadoEn}
                          className="text-xs text-tenue"
                        >
                          {formatearFechaHora(registro.creadoEn)}
                        </time>
                      </div>
                      {registro.actor ? (
                        <p className="mt-1 text-xs text-tenue">
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
            </Tarjeta>
          </div>
        </section>
      </div>

      <DevolverSolicitudModal
        abierto={modalDevolver}
        requisitos={solicitud.requisitos}
        onCerrar={() => setModalDevolver(false)}
        onConfirmar={devolver}
        cargando={devolviendo}
      />

      <AprobarSolicitudModal
        abierto={modalAprobar}
        solicitud={solicitud}
        onCerrar={() => setModalAprobar(false)}
        onConfirmar={aprobar}
        cargando={resolviendo}
      />

      <RechazarSolicitudModal
        abierto={modalRechazar}
        solicitud={solicitud}
        onCerrar={() => setModalRechazar(false)}
        onConfirmar={rechazar}
        cargando={resolviendo}
      />
    </div>
  );
}

