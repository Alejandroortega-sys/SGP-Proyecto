"use client";

import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { EnlaceBoton } from "@/components/ui/enlace-boton";
import { Cargando } from "@/components/ui/estado-vacio";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import { obtenerMiSolicitud } from "@/lib/api-client";
import { formatearFecha } from "@/lib/formato";
import { formatearRangoFechas } from "@/features/espacios/estilos-espacio";
import { EtiquetaEstadoSolicitud } from "./etiqueta-estado-solicitud";

interface ConfirmacionSolicitudProps {
  id: string;
  correoEnviado: boolean | null;
}

/** Pantalla de confirmación posterior a la radicación. */
export function ConfirmacionSolicitud({
  id,
  correoEnviado,
}: ConfirmacionSolicitudProps) {
  const { datos: solicitud, cargando, error, recargar } = useConsultaApi(
    () => obtenerMiSolicitud(id),
    [id],
  );

  if (cargando) {
    return <Cargando texto="Confirmando la radicación de tu solicitud…" />;
  }
  if (error) return <BloqueError error={error} onReintentar={recargar} />;
  if (!solicitud) return null;

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="rounded-xl border border-exito-borde bg-exito-suave p-5 text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-exito-texto">
          Solicitud radicada
        </p>
        <h1 className="mt-2 text-2xl font-extrabold text-exito-texto sm:text-3xl">
          ¡Tu solicitud quedó registrada!
        </h1>
        <p className="mt-2 text-sm text-exito-texto">
          Guarda este número para consultar el estado de tu trámite.
        </p>
        <p className="mt-4 inline-block rounded-lg border border-exito-borde bg-superficie px-4 py-2 text-xl font-extrabold tracking-wide text-exito-texto">
          {solicitud.numeroRadicado}
        </p>
      </div>

      {correoEnviado === false ? (
        <Alerta tono="advertencia">
          La solicitud quedó radicada, pero no pudimos enviar el correo de
          confirmación. Puedes consultar el detalle en «Mis solicitudes».
        </Alerta>
      ) : correoEnviado === true ? (
        <Alerta tono="exito">
          Enviamos el correo de confirmación a tu cuenta registrada.
        </Alerta>
      ) : null}

      <section className="rounded-xl border border-borde bg-superficie p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-base font-bold text-titulo">Resumen</h2>
          <EtiquetaEstadoSolicitud estado={solicitud.estado} />
        </div>
        <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold text-titulo">Espacio</dt>
          <dd>{solicitud.espacio?.nombre ?? "Espacio no disponible"}</dd>
          <dt className="font-semibold text-titulo">Sector</dt>
          <dd>{solicitud.espacio?.sector ?? "Sin sector registrado"}</dd>
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
            {formatearRangoFechas(solicitud.fechaInicio, solicitud.fechaFin)}
          </dd>
          <dt className="font-semibold text-titulo">Horario</dt>
          <dd>
            {solicitud.horaInicio} a {solicitud.horaFin}
          </dd>
          <dt className="font-semibold text-titulo">Documentos</dt>
          <dd>
            {solicitud.documentos.length > 0
              ? solicitud.documentos
                  .map((documento) => documento.tipoDocumento)
                  .join(", ")
              : "Sin documentos adjuntos"}
          </dd>
          <dt className="font-semibold text-titulo">Radicada</dt>
          <dd>{formatearFecha(solicitud.radicadaEn ?? solicitud.creadoEn)}</dd>
        </dl>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <EnlaceBoton
          href={`/comerciante/solicitudes/${solicitud.id}`}
          variante="contorno"
        >
          Ver detalle
        </EnlaceBoton>
        <EnlaceBoton href="/comerciante/solicitudes">
          Ir a Mis solicitudes
        </EnlaceBoton>
      </div>
    </section>
  );
}
