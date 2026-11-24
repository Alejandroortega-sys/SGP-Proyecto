"use client";

import Link from "next/link";
import { useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import { AccionesModal, Modal } from "@/components/ui/modal";
import { Paginacion } from "@/components/ui/paginacion";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import { formatearFechaHora } from "@/lib/formato";
import {
  comoApiError,
  descargarReciboCobro,
  listarMisCobros,
  pagarCobro,
} from "@/lib/api-client";
import type { CobroListado } from "@/types/api";
import { formatearValorCobro } from "@/features/permisos/estados-permiso";
import { EtiquetaEstadoCobro } from "@/features/permisos/etiqueta-estado-permiso";

const LIMITE = 20;

/**
 * Pagos del uso de suelo (HU-36, tareas 1246 y 1247): valor, estado y pago
 * SIEMPRE simulado — sin pasarela ni datos de tarjeta — con recibo PDF.
 */
export function MisCobros() {
  const [pagina, setPagina] = useState(1);
  const { datos, cargando, error, recargar } = useConsultaApi(
    () => listarMisCobros({ pagina, limite: LIMITE }),
    [pagina],
  );
  const [porPagar, setPorPagar] = useState<CobroListado | null>(null);
  const [pagando, setPagando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [descargandoId, setDescargandoId] = useState<string | null>(null);

  async function confirmarPago(): Promise<void> {
    if (!porPagar) return;
    setPagando(true);
    setErrorAccion(null);
    try {
      const respuesta = await pagarCobro(porPagar.id);
      setMensaje(respuesta.mensaje);
      setPorPagar(null);
      recargar();
    } catch (capturado) {
      setErrorAccion(comoApiError(capturado).mensaje);
      setPorPagar(null);
    } finally {
      setPagando(false);
    }
  }

  async function descargarRecibo(cobro: CobroListado): Promise<void> {
    setDescargandoId(cobro.id);
    setErrorAccion(null);
    try {
      const { blob, nombreArchivo } = await descargarReciboCobro(cobro.id);
      const enlace = document.createElement("a");
      enlace.href = URL.createObjectURL(blob);
      enlace.download = nombreArchivo;
      document.body.append(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(enlace.href);
    } catch (capturado) {
      setErrorAccion(comoApiError(capturado).mensaje);
    } finally {
      setDescargandoId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-texto">
          Pagos de uso de suelo
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-titulo sm:text-3xl">
          Mis pagos
        </h1>
        <p className="mt-1 text-sm text-texto">
          Valor del cobro de cada permiso emitido y registro del pago.
        </p>
      </header>

      {/* Aviso permanente y visible: el pago es simulado (AGENTS §9.12). */}
      <Alerta tono="advertencia">
        <p className="font-semibold">
          Pago simulado: no se realiza ninguna transacción real.
        </p>
        <p className="mt-1 text-sm">
          Esta plataforma no integra pasarelas de pago ni solicita datos de
          tarjeta. Confirmar el pago solo registra el estado «Pagado» y
          habilita tu recibo descargable.
        </p>
      </Alerta>

      {mensaje ? <Alerta tono="exito">{mensaje}</Alerta> : null}
      {errorAccion ? <Alerta tono="error">{errorAccion}</Alerta> : null}

      {cargando && !datos ? <Cargando texto="Cargando tus pagos…" /> : null}
      {error && !datos ? <BloqueError error={error} onReintentar={recargar} /> : null}

      {datos ? (
        datos.datos.length === 0 ? (
          <Tarjeta>
            <EstadoVacio
              titulo="No tienes cobros registrados"
              descripcion="Cuando se emita un permiso con tarifa aplicable, su cobro aparecerá aquí."
              accion={
                <Link
                  href="/comerciante/permisos"
                  className="text-sm font-semibold text-accent-texto hover:underline"
                >
                  Ir a mis permisos →
                </Link>
              }
            />
          </Tarjeta>
        ) : (
          <Tarjeta className="overflow-hidden">
            <ul className="divide-y divide-borde">
              {datos.datos.map((cobro) => (
                <li
                  key={cobro.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-extrabold text-titulo">
                        {formatearValorCobro(cobro.valor)}
                      </span>
                      <EtiquetaEstadoCobro estado={cobro.estado} />
                    </p>
                    <p className="mt-1 text-sm text-texto">
                      Permiso{" "}
                      <Link
                        href={`/comerciante/permisos/${cobro.permisoId}`}
                        className="font-semibold text-accent-texto hover:underline"
                      >
                        {cobro.permisoNumero}
                      </Link>
                    </p>
                    <p className="text-sm text-tenue">
                      {cobro.pagadoEn
                        ? `Pagado (simulado) el ${formatearFechaHora(cobro.pagadoEn)}`
                        : `Generado el ${formatearFechaHora(cobro.creadoEn)}`}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {cobro.estado === "pendiente" ? (
                      <Boton onClick={() => setPorPagar(cobro)} anchoCompleto>
                        Pagar (simulado)
                      </Boton>
                    ) : null}
                    {cobro.estado === "pagado" ? (
                      <Boton
                        variante="contorno"
                        onClick={() => void descargarRecibo(cobro)}
                        cargando={descargandoId === cobro.id}
                        anchoCompleto
                      >
                        Descargar recibo
                      </Boton>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            <Paginacion
              pagina={datos.paginacion.pagina}
              totalPaginas={datos.paginacion.totalPaginas}
              onCambiar={setPagina}
            />
          </Tarjeta>
        )
      ) : null}

      {porPagar ? (
        <Modal
          abierto
          titulo="Confirmar el pago simulado"
          descripcion={`Vas a registrar el pago de ${formatearValorCobro(porPagar.valor)} del permiso ${porPagar.permisoNumero}. No se realizará ninguna transacción real ni se pedirán datos de tarjeta.`}
          onCerrar={() => setPorPagar(null)}
        >
          <div className="mt-2">
            <AccionesModal
              textoConfirmar="Confirmar pago simulado"
              cargando={pagando}
              onCancelar={() => setPorPagar(null)}
              onConfirmar={() => void confirmarPago()}
            />
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
