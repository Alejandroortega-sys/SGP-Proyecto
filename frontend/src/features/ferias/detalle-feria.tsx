"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Cargando } from "@/components/ui/estado-vacio";
import { Tarjeta, TarjetaCuerpo, TarjetaEncabezado } from "@/components/ui/tarjeta";
import { formatearRangoFechas } from "@/features/espacios/estilos-espacio";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import {
  comoApiError,
  descargarDocumentoFeria,
  obtenerMiFeria,
} from "@/lib/api-client";
import { formatearFechaHora } from "@/lib/formato";
import type { DocumentoFeria } from "@/types/api";
import { EtiquetaEstadoFeria } from "./etiqueta-estado-feria";

/** Detalle de una feria propia. */
export function DetalleFeria({ id }: { id: string }) {
  const { datos, cargando, error, recargar } = useConsultaApi(
    () => obtenerMiFeria(id),
    [id],
  );
  const parametros = useSearchParams();
  const radicada = parametros.get("radicada") === "1";
  const [descargando, setDescargando] = useState<string | null>(null);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);

  async function descargar(documento: DocumentoFeria): Promise<void> {
    setDescargando(documento.id);
    setErrorDescarga(null);
    try {
      const { blob, nombreArchivo } = await descargarDocumentoFeria(
        id,
        documento.id,
      );
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = documento.nombreOriginal ?? nombreArchivo;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
    } catch (capturado) {
      setErrorDescarga(comoApiError(capturado).message);
    } finally {
      setDescargando(null);
    }
  }

  if (cargando && datos === null) {
    return <Cargando texto="Consultando la feria…" />;
  }

  if (error) {
    return <BloqueError error={error} onReintentar={recargar} />;
  }

  if (!datos) return null;

  return (
    <section className="flex flex-col gap-5">
      <div>
        <Link
          href="/organizador/ferias"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-primario hover:underline"
        >
          ← Volver a mis ferias
        </Link>
      </div>

      {radicada ? (
        <Alerta tono="exito">
          <p className="font-semibold">Feria radicada correctamente.</p>
          <p className="mt-1">
            Guarda el número de radicado {datos.numeroRadicado}. La Alcaldía
            revisará la solicitud y te avisará cuando cambie de estado.
          </p>
        </Alerta>
      ) : null}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primario">
            Feria
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
              {datos.nombre}
            </h1>
            <EtiquetaEstadoFeria estado={datos.estado} />
          </div>
          <p className="mt-2 text-base font-semibold text-primario">
            {datos.numeroRadicado}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/organizador/ferias/${datos.id}/participantes`}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-primario bg-white px-4 py-2.5 text-sm font-semibold text-primario hover:bg-primario-suave"
          >
            Gestionar participantes
          </Link>
          <Link
            href="/organizador/ferias/nueva"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primario px-4 py-2.5 text-sm font-semibold text-white hover:bg-primario-hover"
          >
            Nueva feria
          </Link>
        </div>
      </header>

      <Tarjeta>
        <TarjetaEncabezado>
          <h2 className="text-base font-bold text-titulo">Datos de la feria</h2>
        </TarjetaEncabezado>
        <TarjetaCuerpo className="grid gap-3 text-sm text-texto sm:grid-cols-2">
          <p>
            <span className="font-semibold text-titulo">Tipo:</span>{" "}
            {datos.tipoFeria}
          </p>
          <p>
            <span className="font-semibold text-titulo">Zona:</span>{" "}
            {datos.zona.nombre}
          </p>
          <p>
            <span className="font-semibold text-titulo">Fechas:</span>{" "}
            {formatearRangoFechas(datos.fechaInicio, datos.fechaFin)}
          </p>
          <p>
            <span className="font-semibold text-titulo">Puestos:</span>{" "}
            {datos.numeroPuestos}
          </p>
          <p>
            <span className="font-semibold text-titulo">Aforo de la zona:</span>{" "}
            {datos.zona.aforoMaximo ?? "Sin definir"}
          </p>
          <p>
            <span className="font-semibold text-titulo">Radicada:</span>{" "}
            {formatearFechaHora(datos.radicadaEn)}
          </p>
          {datos.aprobadaEn ? (
            <p>
              <span className="font-semibold text-titulo">Aprobada:</span>{" "}
              {formatearFechaHora(datos.aprobadaEn)}
            </p>
          ) : null}
          {datos.canceladaEn ? (
            <p>
              <span className="font-semibold text-titulo">Cancelada:</span>{" "}
              {formatearFechaHora(datos.canceladaEn)}
            </p>
          ) : null}
        </TarjetaCuerpo>
      </Tarjeta>

      {datos.motivoCancelacion ? (
        <Alerta tono="error">
          <p className="font-semibold">Motivo de la cancelación</p>
          <p className="mt-1 whitespace-pre-line">{datos.motivoCancelacion}</p>
        </Alerta>
      ) : null}

      <Tarjeta>
        <TarjetaEncabezado>
          <h2 className="text-base font-bold text-titulo">Productos</h2>
        </TarjetaEncabezado>
        <TarjetaCuerpo>
          {datos.productos.length === 0 ? (
            <p className="text-sm text-tenue">Sin productos registrados.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {datos.productos.map((producto) => (
                <li
                  key={producto.id}
                  className="rounded-full border border-borde bg-fondo px-3 py-1 text-sm text-texto"
                >
                  {producto.nombre}
                </li>
              ))}
            </ul>
          )}
        </TarjetaCuerpo>
      </Tarjeta>

      <Tarjeta>
        <TarjetaEncabezado>
          <h2 className="text-base font-bold text-titulo">
            Documentos adjuntos
          </h2>
        </TarjetaEncabezado>
        <TarjetaCuerpo className="flex flex-col gap-3">
          {errorDescarga ? (
            <Alerta tono="error">{errorDescarga}</Alerta>
          ) : null}
          {datos.documentos.length === 0 ? (
            <p className="text-sm text-tenue">
              No se adjuntaron documentos a esta feria.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {datos.documentos.map((documento) => (
                <li
                  key={documento.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-borde bg-fondo px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-titulo">
                      {documento.nombreOriginal ?? documento.tipoDocumento}
                    </p>
                    <p className="text-xs text-tenue">
                      {formatearFechaHora(documento.cargadoEn)}
                    </p>
                  </div>
                  <Boton
                    variante="contorno"
                    tamano="sm"
                    cargando={descargando === documento.id}
                    onClick={() => descargar(documento)}
                  >
                    Descargar
                  </Boton>
                </li>
              ))}
            </ul>
          )}
        </TarjetaCuerpo>
      </Tarjeta>
    </section>
  );
}
