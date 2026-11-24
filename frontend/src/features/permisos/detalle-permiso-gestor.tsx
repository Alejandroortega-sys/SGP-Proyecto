"use client";

import Link from "next/link";
import { useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Cargando } from "@/components/ui/estado-vacio";
import { Modal, AccionesModal } from "@/components/ui/modal";
import { Campo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import {
  cambiarEstadoPermiso,
  comoApiError,
  obtenerPermisoGestor,
  obtenerTrazabilidadPermiso,
} from "@/lib/api-client";
import { formatearFechaHora } from "@/lib/formato";
import { formatearRangoFechas } from "@/features/espacios/estilos-espacio";
import type { PermisoEvento } from "@/types/api";
import {
  DESTINOS_PERMITIDOS,
  destinoExigeMotivo,
  formatearValorCobro,
} from "./estados-permiso";
import { EtiquetaEstadoCobro, EtiquetaEstadoPermiso } from "./etiqueta-estado-permiso";

/** Textos de las acciones de cambio de estado (HU-35). */
const TEXTOS_ACCION: Record<
  "suspendido" | "vigente" | "revocado",
  { titulo: string; descripcion: string; confirmar: string }
> = {
  suspendido: {
    titulo: "Suspender permiso",
    descripcion:
      "El QR pasará a mostrar «Permiso no vigente» de inmediato y el comerciante será notificado.",
    confirmar: "Suspender permiso",
  },
  vigente: {
    titulo: "Levantar la suspensión",
    descripcion:
      "El permiso vuelve a estar vigente conservando el mismo código QR y el comerciante será notificado.",
    confirmar: "Reactivar permiso",
  },
  revocado: {
    titulo: "Revocar permiso",
    descripcion:
      "La revocación es definitiva: el QR mostrará «Permiso no vigente» para siempre y el comerciante será notificado.",
    confirmar: "Revocar permiso",
  },
};

/**
 * Detalle de un permiso para el gestor (HU-35 y HU-37): datos, cobro,
 * renovaciones, línea de tiempo del ciclo de vida (escrita por el trigger
 * de la BD), verificaciones ciudadanas y acciones de estado con motivo.
 */
export function DetallePermisoGestor({ id }: { id: string }) {
  const detalle = useConsultaApi(() => obtenerPermisoGestor(id), [id]);
  const trazabilidad = useConsultaApi(
    () => obtenerTrazabilidadPermiso(id),
    [id],
  );

  const [destino, setDestino] = useState<
    "suspendido" | "vigente" | "revocado" | null
  >(null);
  const [motivo, setMotivo] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  if (detalle.cargando && !detalle.datos) {
    return <Cargando texto="Cargando el permiso…" />;
  }
  if (detalle.error && !detalle.datos) {
    return (
      <BloqueError error={detalle.error} onReintentar={detalle.recargar} />
    );
  }
  if (!detalle.datos) return null;

  const datos = detalle.datos;
  const acciones = DESTINOS_PERMITIDOS[datos.estado];

  async function confirmarCambio(): Promise<void> {
    if (!destino) return;
    setProcesando(true);
    setErrorAccion(null);
    const motivoLimpio = motivo.trim();
    try {
      const respuesta = await cambiarEstadoPermiso(id, {
        estado: destino,
        motivo: motivoLimpio === "" ? undefined : motivoLimpio,
      });
      setDestino(null);
      setMotivo("");
      setMensaje(respuesta.mensaje);
      detalle.recargar();
      trazabilidad.recargar();
    } catch (capturado) {
      setErrorAccion(comoApiError(capturado).mensaje);
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/gestor/permisos"
        className="text-sm font-semibold text-accent-texto hover:underline"
      >
        ← Volver a los permisos
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-texto">
            Permiso digital
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-titulo sm:text-3xl">
            {datos.numero}
          </h1>
          <p className="mt-1 text-sm text-texto">
            Titular: {datos.titular.nombre} · Solicitud{" "}
            <Link
              href={`/gestor/solicitudes/${datos.solicitudId}`}
              className="font-semibold text-accent-texto hover:underline"
            >
              {datos.solicitudNumero}
            </Link>
          </p>
        </div>
        <EtiquetaEstadoPermiso estado={datos.estado} />
      </header>

      {mensaje ? <Alerta tono="exito">{mensaje}</Alerta> : null}
      {errorAccion ? <Alerta tono="error">{errorAccion}</Alerta> : null}

      <div className="grid gap-4 xl:grid-cols-12">
        <section className="flex flex-col gap-4 xl:col-span-5">
          <Tarjeta className="p-4 sm:p-5">
            <h2 className="text-lg font-bold text-titulo">Datos del permiso</h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="font-semibold text-titulo">Espacio</dt>
              <dd>{datos.espacio?.nombre ?? "No asignado"}</dd>
              <dt className="font-semibold text-titulo">Categoría autorizada</dt>
              <dd>{datos.categoria}</dd>
              <dt className="font-semibold text-titulo">Vigencia</dt>
              <dd>
                {formatearRangoFechas(datos.fechaInicio, datos.fechaFin)}{" "}
                <span className="text-tenue">(inclusive)</span>
              </dd>
              <dt className="font-semibold text-titulo">Emitido por</dt>
              <dd>
                {datos.emitidoPor.nombre} ·{" "}
                {formatearFechaHora(datos.emitidoEn)}
              </dd>
              {datos.renovadoDesde ? (
                <>
                  <dt className="font-semibold text-titulo">Renueva a</dt>
                  <dd>{datos.renovadoDesde.numero}</dd>
                </>
              ) : null}
            </dl>

            <div className="mt-4 rounded-lg border border-borde bg-fondo p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-tenue">
                Token QR (48 caracteres, generado por la BD)
              </p>
              <p className="mt-1 break-all font-mono text-xs text-texto">
                {datos.qrToken}
              </p>
            </div>
          </Tarjeta>

          <Tarjeta className="p-4 sm:p-5">
            <h2 className="text-lg font-bold text-titulo">
              Cobro del uso de suelo
            </h2>
            {datos.cobro ? (
              <div className="mt-3 space-y-2 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-titulo">
                    {formatearValorCobro(datos.cobro.valor)}
                  </span>
                  <EtiquetaEstadoCobro estado={datos.cobro.estado} />
                </p>
                {datos.cobro.pagadoEn ? (
                  <p className="text-texto">
                    Pagado (simulado) el {formatearFechaHora(datos.cobro.pagadoEn)}.
                  </p>
                ) : (
                  <p className="text-texto">
                    Pago simulado pendiente por parte del comerciante.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-tenue">
                Sin tarifa aplicable en la emisión: no se creó cobro.
              </p>
            )}
          </Tarjeta>

          <Tarjeta className="p-4 sm:p-5">
            <h2 className="text-lg font-bold text-titulo">Acciones</h2>
            {acciones.length === 0 ? (
              <p className="mt-2 text-sm text-tenue">
                El permiso está en un estado final y no admite cambios.
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {acciones.includes("suspendido") ? (
                  <Boton
                    variante="contorno"
                    onClick={() => setDestino("suspendido")}
                    anchoCompleto
                  >
                    Suspender
                  </Boton>
                ) : null}
                {acciones.includes("vigente") ? (
                  <Boton onClick={() => setDestino("vigente")} anchoCompleto>
                    Levantar suspensión
                  </Boton>
                ) : null}
                {acciones.includes("revocado") ? (
                  <Boton
                    variante="peligro"
                    onClick={() => setDestino("revocado")}
                    anchoCompleto
                  >
                    Revocar
                  </Boton>
                ) : null}
              </div>
            )}
            <p className="mt-2 text-xs text-tenue">
              El historial de cada cambio lo registra la base de datos con el
              motivo indicado; el comerciante recibe una notificación.
            </p>
          </Tarjeta>

          {datos.renovaciones.length > 0 ? (
            <Tarjeta className="p-4 sm:p-5">
              <h2 className="text-lg font-bold text-titulo">
                Renovaciones emitidas
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                {datos.renovaciones.map((renovacion) => (
                  <li
                    key={renovacion.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-borde bg-fondo px-3 py-2"
                  >
                    <Link
                      href={`/gestor/permisos/${renovacion.id}`}
                      className="font-semibold text-accent-texto hover:underline"
                    >
                      {renovacion.numero}
                    </Link>
                    <span className="text-tenue">
                      {formatearRangoFechas(
                        renovacion.fechaInicio,
                        renovacion.fechaFin,
                      )}
                    </span>
                    <EtiquetaEstadoPermiso estado={renovacion.estado} />
                  </li>
                ))}
              </ul>
            </Tarjeta>
          ) : null}
        </section>

        <section className="xl:col-span-7">
          <Tarjeta className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-titulo">
                  Trazabilidad del permiso
                </h2>
                <p className="text-sm text-texto">
                  Ciclo de vida en orden cronológico, escrito por la base de
                  datos con cada cambio.
                </p>
              </div>
              {trazabilidad.datos ? (
                <p className="rounded-full bg-fondo px-3 py-1 text-xs font-semibold text-texto">
                  {trazabilidad.datos.verificaciones.total} verificación
                  {trazabilidad.datos.verificaciones.total === 1 ? "" : "es"}{" "}
                  por QR
                </p>
              ) : null}
            </div>

            {trazabilidad.datos ? (
              <>
                {trazabilidad.datos.verificaciones.ultima ? (
                  <p className="mt-2 text-xs text-tenue">
                    Última consulta ciudadana:{" "}
                    {formatearFechaHora(
                      trazabilidad.datos.verificaciones.ultima,
                    )}
                  </p>
                ) : null}
                <ol className="mt-4 flex flex-col gap-4">
                  {trazabilidad.datos.eventos.map((evento) => (
                    <EventoTimeline key={evento.id} evento={evento} />
                  ))}
                </ol>
              </>
            ) : (
              <p className="mt-4 text-sm text-tenue">
                Cargando la línea de tiempo…
              </p>
            )}
          </Tarjeta>
        </section>
      </div>

      {destino ? (
        <Modal
          abierto
          titulo={TEXTOS_ACCION[destino].titulo}
          descripcion={TEXTOS_ACCION[destino].descripcion}
          onCerrar={() => {
            setDestino(null);
            setMotivo("");
            setErrorAccion(null);
          }}
        >
          {destinoExigeMotivo(destino) ? (
            <Campo
              etiqueta="Motivo"
              requerido
              ayuda="Visible para el comerciante y queda registrado en la trazabilidad."
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
            />
          ) : (
            <Campo
              etiqueta="Motivo (opcional)"
              ayuda="El levantamiento de la suspensión no exige motivo."
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
            />
          )}
          {errorAccion ? (
            <p className="mt-3 text-sm text-peligro-texto">{errorAccion}</p>
          ) : null}
          <div className="mt-4">
            <AccionesModal
              textoConfirmar={TEXTOS_ACCION[destino].confirmar}
              variante={destino === "revocado" ? "peligro" : "solido"}
              cargando={procesando}
              onCancelar={() => {
                setDestino(null);
                setMotivo("");
                setErrorAccion(null);
              }}
              onConfirmar={() => void confirmarCambio()}
              deshabilitado={
                destinoExigeMotivo(destino) && motivo.trim().length === 0
              }
            />
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function EventoTimeline({ evento }: { evento: PermisoEvento }) {
  const esRevocacion = evento.evento === "revocado";
  const esSuspension = evento.evento === "suspendido";
  const esEmision = evento.evento === "emitido";
  return (
    <li
      className={`relative border-l-2 pl-4 ${
        esRevocacion
          ? "border-peligro/40"
          : esSuspension
            ? "border-advertencia/40"
            : "border-primario/30"
      }`}
    >
      <span
        className={`absolute -left-[5px] top-2 size-2 rounded-full ${
          esRevocacion
            ? "bg-peligro"
            : esSuspension
              ? "bg-advertencia"
              : "bg-primario"
        }`}
        aria-hidden="true"
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold capitalize text-titulo">
          {evento.evento === "emitido"
            ? "Emisión del permiso"
            : evento.evento === "vigente"
              ? "Reactivado a vigente"
              : `Permiso ${evento.evento}`}
        </span>
        <time
          dateTime={evento.creadoEn}
          className="text-xs text-tenue"
        >
          {formatearFechaHora(evento.creadoEn)}
        </time>
      </div>
      {evento.actorNombre ? (
        <p className="mt-1 text-xs text-tenue">Por {evento.actorNombre}</p>
      ) : null}
      {evento.motivo ? (
        <p
          className={`mt-1 text-sm ${
            esRevocacion ? "text-peligro-texto" : "text-texto"
          }`}
        >
          {esEmision ? null : "Motivo: "}
          {evento.motivo}
        </p>
      ) : null}
    </li>
  );
}
