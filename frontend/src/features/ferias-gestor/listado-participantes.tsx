"use client";

import Link from "next/link";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import { Etiqueta } from "@/components/ui/etiqueta";
import {
  Tarjeta,
  TarjetaCuerpo,
  TarjetaEncabezado,
} from "@/components/ui/tarjeta";
import { EtiquetaEstadoFeria } from "@/features/ferias/etiqueta-estado-feria";
import { formatearRangoFechas } from "@/features/espacios/estilos-espacio";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import { obtenerParticipantesFeriaGestor } from "@/lib/api-client";
import { formatearFechaHora } from "@/lib/formato";

/** Listado final de participantes visible para el gestor (HU-23). */
export function ListadoParticipantesGestor({ feriaId }: { feriaId: string }) {
  const { datos, cargando, error, recargar } = useConsultaApi(
    () => obtenerParticipantesFeriaGestor(feriaId),
    [feriaId],
  );

  if (cargando && datos === null) {
    return <Cargando texto="Consultando el listado final…" />;
  }

  if (error?.status === 409) {
    return (
      <section className="flex flex-col gap-4">
        <div>
          <Link
            href={`/gestor/ferias`}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-primario hover:underline"
          >
            ← Volver al calendario de ferias
          </Link>
        </div>
        <Alerta tono="informacion">
          <p className="font-semibold">
            El organizador aún no ha enviado el listado final.
          </p>
          <p className="mt-1">{error.message}</p>
        </Alerta>
        <div>
          <button
            type="button"
            onClick={recargar}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-primario bg-white px-4 py-2.5 text-sm font-semibold text-primario hover:bg-primario-suave"
          >
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  if (error) {
    return <BloqueError error={error} onReintentar={recargar} />;
  }

  if (!datos) return null;

  return (
    <section className="flex flex-col gap-5">
      <div>
        <Link
          href={`/gestor/ferias`}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-primario hover:underline"
        >
          ← Volver al calendario de ferias
        </Link>
      </div>

      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-primario">
          Panel del gestor
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
            Listado final de participantes
          </h1>
          <EtiquetaEstadoFeria estado={datos.feria.estado} />
          <Etiqueta tono="exitoso">Enviado</Etiqueta>
        </div>
        <p className="text-sm font-semibold text-primario">
          {datos.feria.numeroRadicado} · {datos.feria.nombre}
        </p>
        <p className="text-sm text-texto">
          {datos.feria.zona.nombre} ·{" "}
          {formatearRangoFechas(
            datos.feria.fechaInicio,
            datos.feria.fechaFin,
          )}
        </p>
        <p className="text-sm text-texto">
          Listado enviado el {formatearFechaHora(datos.listadoFinal.enviadoEn)}
        </p>
      </header>

      <Tarjeta>
        <TarjetaEncabezado>
          <h2 className="text-base font-bold text-titulo">
            Datos del organizador
          </h2>
        </TarjetaEncabezado>
        <TarjetaCuerpo className="grid gap-3 text-sm text-texto sm:grid-cols-2">
          <p>
            <span className="font-semibold text-titulo">Organización:</span>{" "}
            {datos.organizador.organizacion}
          </p>
          <p>
            <span className="font-semibold text-titulo">NIT:</span>{" "}
            {datos.organizador.nit}
          </p>
          <p>
            <span className="font-semibold text-titulo">Representante:</span>{" "}
            {datos.organizador.nombre}
            {datos.organizador.apellido
              ? ` ${datos.organizador.apellido}`
              : ""}
          </p>
          <p className="break-all">
            <span className="font-semibold text-titulo">Correo:</span>{" "}
            {datos.organizador.correo}
          </p>
        </TarjetaCuerpo>
      </Tarjeta>

      <Tarjeta>
        <TarjetaEncabezado>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-titulo">Cupo aprobado</h2>
            <span className="text-sm text-tenue">
              {datos.cupo.ocupados} de {datos.cupo.aprobado}
            </span>
          </div>
        </TarjetaEncabezado>
        <TarjetaCuerpo>
          <div
            role="progressbar"
            aria-label="Cupo de participantes utilizado"
            aria-valuemin={0}
            aria-valuemax={datos.cupo.aprobado}
            aria-valuenow={datos.cupo.ocupados}
            className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
          >
            <div
              className="h-full rounded-full bg-primario"
              style={{
                width: `${Math.min(
                  100,
                  (datos.cupo.ocupados / Math.max(1, datos.cupo.aprobado)) * 100,
                )}%`,
              }}
            />
          </div>
        </TarjetaCuerpo>
      </Tarjeta>

      <Tarjeta>
        <TarjetaEncabezado>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-titulo">Participantes</h2>
            <span className="text-sm text-tenue">
              {datos.participantes.length} registrado(s)
            </span>
          </div>
        </TarjetaEncabezado>
        <TarjetaCuerpo>
          {datos.participantes.length === 0 ? (
            <EstadoVacio
              titulo="El listado no tiene participantes"
              descripcion="El organizador envió el listado final sin vendedores activos."
            />
          ) : (
            <ul className="grid gap-3">
              {datos.participantes.map((participante) => (
                <li
                  key={participante.id}
                  className="rounded-lg border border-borde bg-fondo p-3"
                >
                  <h3 className="text-sm font-bold text-titulo">
                    {participante.nombre}
                  </h3>
                  <p className="mt-1 text-sm text-texto">
                    {participante.documento
                      ? `Documento: ${participante.documento}`
                      : "Sin documento registrado"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {participante.productos.map((producto) => (
                      <span
                        key={producto.id}
                        className="rounded-full border border-borde bg-white px-2.5 py-0.5 text-xs font-medium text-texto"
                      >
                        {producto.nombre}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TarjetaCuerpo>
      </Tarjeta>
    </section>
  );
}
