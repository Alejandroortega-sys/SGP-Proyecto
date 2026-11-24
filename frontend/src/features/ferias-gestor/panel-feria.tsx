"use client";

import Link from "next/link";
import { Boton } from "@/components/ui/boton";
import { Cargando } from "@/components/ui/estado-vacio";
import { BloqueError } from "@/components/ui/bloque-error";
import { Modal } from "@/components/ui/modal";
import { EtiquetaEstadoFeria } from "@/features/ferias/etiqueta-estado-feria";
import { formatearRangoFechas } from "@/features/espacios/estilos-espacio";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import { obtenerFeriaGestor } from "@/lib/api-client";
import { formatearFechaHora } from "@/lib/formato";
import type { EventoAgendaFeria } from "@/types/api";
import { rangoEvento } from "./calendario-ferias-utilidades";

interface PanelFeriaProps {
  evento: EventoAgendaFeria | null;
  onCerrar: () => void;
  onAprobar: (evento: EventoAgendaFeria) => void;
  onMover: (evento: EventoAgendaFeria) => void;
  onCancelar: (evento: EventoAgendaFeria) => void;
}

/** Detalle administrativo de una feria con sus acciones disponibles. */
export function PanelFeria({
  evento,
  onCerrar,
  onAprobar,
  onMover,
  onCancelar,
}: PanelFeriaProps) {
  const { datos, cargando, error, recargar } = useConsultaApi(
    () => (evento ? obtenerFeriaGestor(evento.id) : Promise.resolve(null)),
    [evento?.id],
  );

  if (!evento) return null;

  const puedeAprobar = evento.estado === "radicada";
  const puedeMover =
    evento.estado === "radicada" || evento.estado === "aprobada";
  const puedeCancelar = puedeMover;

  return (
    <Modal
      abierto
      titulo={evento.nombre}
      descripcion={`${evento.numeroRadicado} · ${evento.zona.nombre}`}
      onCerrar={onCerrar}
    >
      {cargando && !datos ? (
        <Cargando texto="Consultando la feria…" />
      ) : error ? (
        <BloqueError error={error} onReintentar={recargar} />
      ) : datos ? (
        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
          <div className="flex flex-wrap items-center gap-2">
            <EtiquetaEstadoFeria estado={datos.estado} />
            <span className="text-sm font-semibold text-primario">
              {datos.numeroRadicado}
            </span>
            {evento.tieneCruces ? (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                Requiere revisión de cruces
              </span>
            ) : null}
          </div>

          <dl className="grid gap-3 rounded-lg border border-borde bg-fondo p-3 text-sm text-texto sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-titulo">Tipo</dt>
              <dd>{datos.tipoFeria}</dd>
            </div>
            <div>
              <dt className="font-semibold text-titulo">Zona</dt>
              <dd>{datos.zona.nombre}</dd>
            </div>
            <div>
              <dt className="font-semibold text-titulo">Fechas</dt>
              <dd>{formatearRangoFechas(datos.fechaInicio, datos.fechaFin)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-titulo">Puestos</dt>
              <dd>
                {datos.numeroPuestos} de {datos.zona.aforoMaximo ?? "sin aforo"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-titulo">Organización</dt>
              <dd>
                {datos.organizador.organizacion} · NIT {datos.organizador.nit}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-titulo">Contacto</dt>
              <dd className="break-all">{datos.organizador.correo}</dd>
            </div>
            <div>
              <dt className="font-semibold text-titulo">Radicada</dt>
              <dd>{formatearFechaHora(datos.radicadaEn)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-titulo">Actualizada</dt>
              <dd>{formatearFechaHora(datos.actualizadoEn)}</dd>
            </div>
            {datos.aprobadaEn ? (
              <div>
                <dt className="font-semibold text-titulo">Aprobada</dt>
                <dd>
                  {formatearFechaHora(datos.aprobadaEn)}
                  {datos.aprobadaPor ? ` · ${datos.aprobadaPor}` : ""}
                </dd>
              </div>
            ) : null}
            {datos.canceladaEn ? (
              <div>
                <dt className="font-semibold text-titulo">Cancelada</dt>
                <dd>{formatearFechaHora(datos.canceladaEn)}</dd>
              </div>
            ) : null}
          </dl>

          {datos.motivoCancelacion ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              <p className="font-semibold">Motivo de cancelación</p>
              <p className="mt-1 whitespace-pre-line">
                {datos.motivoCancelacion}
              </p>
            </div>
          ) : null}

          <section>
            <h3 className="text-sm font-bold text-titulo">Productos</h3>
            {datos.productos.length === 0 ? (
              <p className="mt-1 text-sm text-tenue">Sin productos.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
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
          </section>

          <section>
            <h3 className="text-sm font-bold text-titulo">
              Espacios bloqueados
            </h3>
            {datos.espaciosBloqueados.length === 0 ? (
              <p className="mt-1 text-sm text-tenue">
                La feria no tiene bloqueos de espacios. Se crearán al aprobarla.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1 text-sm text-texto">
                {datos.espaciosBloqueados.map((espacio) => (
                  <li key={espacio.id}>• {espacio.nombre}</li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-sm font-bold text-titulo">Documentos</h3>
            {datos.documentos.length === 0 ? (
              <p className="mt-1 text-sm text-tenue">
                Sin documentos adjuntos.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1 text-sm text-texto">
                {datos.documentos.map((documento) => (
                  <li key={documento.id} className="truncate">
                    • {documento.nombreOriginal ?? documento.tipoDocumento}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-xs text-tenue">
            Vigencia mostrada: {rangoEvento(evento)}.
          </p>

          <div className="flex flex-col-reverse gap-2 border-t border-borde pt-4 sm:flex-row sm:justify-end">
            <Link
              href={`/gestor/ferias/${evento.id}/participantes`}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-primario bg-white px-4 py-2.5 text-sm font-semibold text-primario hover:bg-primario-suave"
            >
              Ver participantes
            </Link>
            <Boton variante="fantasma" onClick={onCerrar}>
              Cerrar
            </Boton>
            {puedeAprobar ? (
              <Boton onClick={() => onAprobar(evento)}>Aprobar</Boton>
            ) : null}
            {puedeMover ? (
              <Boton
                variante="contorno"
                onClick={() => onMover(evento)}
              >
                Mover
              </Boton>
            ) : null}
            {puedeCancelar ? (
              <Boton
                variante="peligro"
                onClick={() => onCancelar(evento)}
              >
                Cancelar
              </Boton>
            ) : null}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
