'use client';

import Link from 'next/link';
import { Alerta } from '@/components/ui/alerta';
import { BloqueError } from '@/components/ui/bloque-error';
import { Cargando } from '@/components/ui/estado-vacio';
import { useConsultaApi } from '@/hooks/use-consulta-api';
import { obtenerMiSolicitud } from '@/lib/api-client';
import {
  formatearFecha,
  formatearFechaHora,
  nombreCompleto,
} from '@/lib/formato';
import { formatearRangoFechas } from '@/features/espacios/estilos-espacio';
import { DocumentosSolicitud } from './documentos-solicitud';
import {
  DESCRIPCIONES_ESTADO_SOLICITUD,
  describirTransicion,
} from './estado-solicitud';
import { EtiquetaEstadoSolicitud } from './etiqueta-estado-solicitud';

interface DetalleSolicitudProps {
  id: string;
}

/** Detalle de una solicitud radicada, con documentos e historial. */
export function DetalleSolicitud({ id }: DetalleSolicitudProps) {
  const {
    datos: solicitud,
    cargando,
    error,
    recargar,
  } = useConsultaApi(() => obtenerMiSolicitud(id), [id]);

  if (cargando && !solicitud) {
    return <Cargando texto="Cargando el detalle de la solicitud…" />;
  }
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
              Radicada el{' '}
              {formatearFecha(solicitud.radicadaEn ?? solicitud.creadoEn)}
            </p>
          </div>
          <EtiquetaEstadoSolicitud estado={solicitud.estado} />
        </div>
        <Alerta tono="informacion" conIcono={false}>
          {DESCRIPCIONES_ESTADO_SOLICITUD[solicitud.estado]}
        </Alerta>
      </header>

      {solicitud.estado === 'rechazada' && solicitud.motivoRechazo ? (
        <Alerta tono="error">
          <p className="font-semibold">Motivo del rechazo</p>
          <p className="mt-1">{solicitud.motivoRechazo}</p>
        </Alerta>
      ) : null}

      <section className="rounded-xl border border-borde bg-superficie p-4">
        <h2 className="text-sm font-bold text-titulo">Espacio solicitado</h2>
        <p className="mt-2 font-semibold text-titulo">
          {solicitud.espacio?.nombre ?? 'Espacio no disponible'}
        </p>
        <p className="text-sm text-texto">
          {solicitud.espacio?.sector ?? 'Sin sector registrado'}
        </p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="font-semibold text-titulo">Actividad</dt>
          <dd>{solicitud.actividad}</dd>
          <dt className="font-semibold text-titulo">Productos</dt>
          <dd>
            {solicitud.productos.length > 0
              ? solicitud.productos
                  .map((producto) => producto.nombre)
                  .join(', ')
              : 'Sin productos registrados'}
          </dd>
          <dt className="font-semibold text-titulo">Fechas</dt>
          <dd>
            {formatearRangoFechas(solicitud.fechaInicio, solicitud.fechaFin)}
          </dd>
          <dt className="font-semibold text-titulo">Horario</dt>
          <dd>
            {solicitud.horaInicio} a {solicitud.horaFin}
          </dd>
        </dl>
      </section>

      <DocumentosSolicitud solicitudId={id} onActualizar={recargar} />

      <section className="rounded-xl border border-borde bg-superficie p-4">
        <h2 className="text-sm font-bold text-titulo">Historial de estados</h2>
        {solicitud.historial.length === 0 ? (
          <p className="mt-2 text-sm text-tenue">
            Todavía no hay cambios de estado registrados.
          </p>
        ) : (
          <ol
            className="mt-3 flex flex-col gap-4"
            aria-label="Línea de tiempo de estados"
          >
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
                  <span className="text-sm font-semibold text-titulo">
                    {describirTransicion(
                      registro.estadoAnterior,
                      registro.estadoNuevo,
                    )}
                  </span>
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
                    <span className="font-semibold text-titulo">
                      Observación del gestor:{' '}
                    </span>
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
