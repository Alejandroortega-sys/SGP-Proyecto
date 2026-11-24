"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Cargando } from "@/components/ui/estado-vacio";
import { AccionesModal, Modal } from "@/components/ui/modal";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import { comoApiError, descargarCarnePermiso, obtenerMiPermiso, renovarPermiso } from "@/lib/api-client";
import { formatearFecha } from "@/lib/formato";
import { formatearRangoFechas } from "@/features/espacios/estilos-espacio";
import {
  diasParaVencer,
  puedeRenovar,
  vencePronto,
} from "./estados-permiso";
import { EtiquetaEstadoPermiso } from "./etiqueta-estado-permiso";

/**
 * Carné digital a pantalla completa (HU-32, tareas 1220 y 1221): QR
 * legible, estado visible con texto y color, descarga en PDF y renovación
 * con datos precargados cuando el permiso aún se puede renovar (HU-34).
 */
export function CarnePermiso({ id }: { id: string }) {
  const { datos, cargando, error, recargar } = useConsultaApi(
    () => obtenerMiPermiso(id),
    [id],
  );
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);
  const [modalRenovar, setModalRenovar] = useState(false);
  const [renovando, setRenovando] = useState(false);
  const [renovada, setRenovada] = useState<string | null>(null);
  const [errorRenovacion, setErrorRenovacion] = useState<string | null>(null);

  useEffect(() => {
    if (!datos) return;
    let activo = true;
    QRCode.toDataURL(datos.urlVerificacion, {
      margin: 2,
      width: 320,
      errorCorrectionLevel: "M",
      color: { dark: "#111827ff", light: "#ffffffff" },
    })
      .then((url) => {
        if (activo) setQrUrl(url);
      })
      .catch(() => {
        if (activo) setQrUrl(null);
      });
    return () => {
      activo = false;
    };
  }, [datos]);

  if (cargando && !datos) {
    return <Cargando texto="Cargando tu carné…" />;
  }
  if (error && !datos) {
    return <BloqueError error={error} onReintentar={recargar} />;
  }
  if (!datos) return null;

  const renovable = puedeRenovar(datos.estado, datos.fechaFin);
  const pronto = vencePronto(datos.estado, datos.fechaFin);

  async function descargar(): Promise<void> {
    setDescargando(true);
    setErrorDescarga(null);
    try {
      const { blob, nombreArchivo } = await descargarCarnePermiso(id);
      const enlace = document.createElement("a");
      enlace.href = URL.createObjectURL(blob);
      enlace.download = nombreArchivo;
      document.body.append(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(enlace.href);
    } catch (capturado) {
      setErrorDescarga(comoApiError(capturado).mensaje);
    } finally {
      setDescargando(false);
    }
  }

  async function confirmarRenovacion(): Promise<void> {
    setRenovando(true);
    setErrorRenovacion(null);
    try {
      const respuesta = await renovarPermiso(id);
      setRenovada(respuesta.numeroRadicado);
      setModalRenovar(false);
    } catch (capturado) {
      setErrorRenovacion(comoApiError(capturado).mensaje);
      setModalRenovar(false);
    } finally {
      setRenovando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/comerciante/permisos"
        className="text-sm font-semibold text-accent-texto hover:underline"
      >
        ← Volver a mis permisos
      </Link>

      {renovada ? (
        <Alerta tono="exito">
          <p className="font-semibold">
            Solicitud de renovación {renovada} radicada.
          </p>
          <p className="mt-1 text-sm">
            Un gestor la revisará y, al aprobarla, se emitirá tu permiso nuevo.
            Puedes seguir su avance en «Mis solicitudes».
          </p>
        </Alerta>
      ) : null}
      {errorRenovacion ? (
        <Alerta tono="error">
          <p className="font-semibold">No se pudo radicar la renovación.</p>
          <p className="mt-1 text-sm">{errorRenovacion}</p>
        </Alerta>
      ) : null}
      {errorDescarga ? (
        <Alerta tono="error">
          <p className="font-semibold">No se pudo descargar el carné.</p>
          <p className="mt-1 text-sm">{errorDescarga}</p>
        </Alerta>
      ) : null}

      <div className="mx-auto w-full max-w-md">
        <Tarjeta className="overflow-hidden">
          <div className="bg-primario px-5 py-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-90">
              Alcaldía de Tuluá · Permiso de uso del espacio público
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-xl font-extrabold">{datos.numero}</h1>
              <EtiquetaEstadoPermiso estado={datos.estado} />
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 p-5">
            <div className="flex w-full flex-col items-center gap-2">
              <div className="rounded-xl border border-borde bg-white p-3">
                {qrUrl ? (
                  // Imagen con alto contraste y texto alternativo (WCAG).
                  // eslint-disable-next-line @next/next/no-img-element -- data URL generada en el cliente
                  <img
                    src={qrUrl}
                    alt={`Código QR de verificación del permiso ${datos.numero}`}
                    width={256}
                    height={256}
                    className="size-64 sm:size-72"
                  />
                ) : (
                  <div
                    className="flex size-64 items-center justify-center text-sm text-tenue sm:size-72"
                    aria-live="polite"
                  >
                    Generando el código QR…
                  </div>
                )}
              </div>
              <p className="text-center text-xs text-tenue">
                Cualquier ciudadano puede escanearlo para verificar tu permiso
                en línea.
              </p>
            </div>

            <dl className="w-full space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="font-semibold text-titulo">Titular</dt>
                <dd className="text-right">{datos.titularNombre}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-semibold text-titulo">Categoría</dt>
                <dd className="text-right">{datos.categoria}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-semibold text-titulo">Espacio</dt>
                <dd className="text-right">
                  {datos.espacioNombre ?? "No asignado"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-semibold text-titulo">Vigencia</dt>
                <dd className="text-right">
                  {formatearRangoFechas(datos.fechaInicio, datos.fechaFin)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-semibold text-titulo">Emitido</dt>
                <dd className="text-right">
                  {formatearFecha(datos.emitidoEn)}
                </dd>
              </div>
            </dl>

            {datos.estado !== "vigente" ? (
              <Alerta
                tono={datos.estado === "suspendido" ? "advertencia" : "error"}
                className="w-full"
              >
                <p className="font-semibold">
                  {datos.estado === "suspendido"
                    ? "Permiso suspendido"
                    : datos.estado === "revocado"
                      ? "Permiso revocado"
                      : "Permiso vencido"}
                </p>
                <p className="mt-1 text-sm">
                  Presenta este carné solo cuando vuelva a estar vigente.
                </p>
              </Alerta>
            ) : pronto ? (
              <Alerta tono="advertencia" className="w-full">
                <p className="font-semibold">
                  Tu permiso vence en {diasParaVencer(datos.fechaFin)} día(s).
                </p>
                <p className="mt-1 text-sm">
                  Renueva a tiempo para conservar tu puesto con una solicitud
                  simplificada.
                </p>
              </Alerta>
            ) : null}

            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Boton
                onClick={() => void descargar()}
                cargando={descargando}
                anchoCompleto
              >
                Descargar carné (PDF)
              </Boton>
              {renovable ? (
                <Boton
                  variante="contorno"
                  onClick={() => setModalRenovar(true)}
                  anchoCompleto
                >
                  Renovar
                </Boton>
              ) : null}
            </div>
            {datos.estado === "vencido" || !renovable ? (
              <p className="w-full text-center text-xs text-tenue">
                Si el permiso ya venció, radica una nueva solicitud desde «Mis
                solicitudes».
              </p>
            ) : null}
          </div>
        </Tarjeta>
      </div>

      {modalRenovar ? (
        <Modal
          abierto
          titulo="Renovar tu permiso"
          descripcion="Se creará una solicitud nueva con tus datos precargados (mismo espacio, actividad y horario) cuya vigencia empieza al terminar este permiso. Un gestor la revisará."
          onCerrar={() => setModalRenovar(false)}
        >
          <div className="mt-2">
            <AccionesModal
              textoConfirmar="Radicar renovación"
              cargando={renovando}
              onCancelar={() => setModalRenovar(false)}
              onConfirmar={() => void confirmarRenovacion()}
            />
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
