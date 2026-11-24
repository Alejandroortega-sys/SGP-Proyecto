"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { EnlaceBoton } from "@/components/ui/enlace-boton";
import { Selector } from "@/components/ui/campo";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import { Modal, AccionesModal } from "@/components/ui/modal";
import { Paginacion } from "@/components/ui/paginacion";
import { Tabla, Td, Th } from "@/components/ui/tabla";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import { useSesion } from "@/hooks/use-sesion";
import { listarMisSolicitudes } from "@/lib/api-client";
import {
  leerArchivosBorrador,
  leerBorradorCampos,
  limpiarBorrador,
  type BorradorSolicitudCampos,
} from "@/lib/borrador-solicitud";
import { formatearFecha } from "@/lib/formato";
import { formatearRangoFechas } from "@/features/espacios/estilos-espacio";
import type { EstadoSolicitud, SolicitudTemporalListado } from "@/types/api";
import {
  ETIQUETAS_ESTADO_SOLICITUD,
  ESTADOS_SOLICITUD,
} from "./estado-solicitud";
import { EtiquetaEstadoSolicitud } from "./etiqueta-estado-solicitud";

const ESTADOS_FILTRO = ESTADOS_SOLICITUD.filter(
  (estado) => estado !== "borrador",
);

function EspacioSolicitud({
  solicitud,
}: {
  solicitud: SolicitudTemporalListado;
}) {
  return (
    <div>
      <p className="font-semibold text-titulo">
        {solicitud.espacio?.nombre ?? "Espacio no disponible"}
      </p>
      <p className="text-xs text-tenue">
        {solicitud.espacio?.sector ?? "Sin sector registrado"}
      </p>
    </div>
  );
}

/** Listado de solicitudes radicadas y acceso al borrador local. */
export function ListaSolicitudes() {
  const { usuario } = useSesion();
  const [estado, setEstado] = useState<EstadoSolicitud | "todos">("todos");
  const [pagina, setPagina] = useState(1);
  const [borrador, setBorrador] = useState<BorradorSolicitudCampos | null>(null);
  const [archivosBorrador, setArchivosBorrador] = useState(0);
  const [modalDescartar, setModalDescartar] = useState(false);

  const { datos, cargando, error, recargar } = useConsultaApi(
    () =>
      listarMisSolicitudes({
        estado: estado === "todos" ? undefined : estado,
        pagina,
        limite: 10,
      }),
    [estado, pagina],
  );

  useEffect(() => {
    if (!usuario?.id) return;
    let activo = true;

    const cargar = async () => {
      const campos = leerBorradorCampos(usuario.id);
      const archivos = await leerArchivosBorrador(usuario.id);
      if (!activo) return;

      if (!campos && archivos.length > 0) {
        await limpiarBorrador(usuario.id);
        setBorrador(null);
        setArchivosBorrador(0);
        return;
      }

      setBorrador(campos);
      setArchivosBorrador(archivos.length);
    };

    void cargar();
    return () => {
      activo = false;
    };
  }, [usuario?.id]);

  async function descartarBorrador(): Promise<void> {
    if (!usuario?.id) return;
    await limpiarBorrador(usuario.id);
    setBorrador(null);
    setArchivosBorrador(0);
    setModalDescartar(false);
  }

  const sinResultados = datos !== null && datos.datos.length === 0;
  const mostrarCargaInicial = cargando && datos === null;

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-texto">
          Portal del comerciante
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
              Mis solicitudes
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-texto sm:text-base">
              Consulta el estado de tus solicitudes radicadas y retoma el
              borrador que hayas dejado en este navegador.
            </p>
          </div>
          <EnlaceBoton href="/comerciante/solicitudes/nueva">
            Nueva solicitud
          </EnlaceBoton>
        </div>
      </header>

      {borrador ? (
        <section className="rounded-xl border border-advertencia-borde bg-advertencia-suave p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-advertencia-texto">
                Borrador sin radicar
              </p>
              <p className="mt-1 text-sm text-advertencia-texto">
                {borrador.actividad || "Solicitud en preparación"}
                {borrador.fechaInicio && borrador.fechaFin
                  ? ` · ${formatearRangoFechas(
                      borrador.fechaInicio,
                      borrador.fechaFin,
                    )}`
                  : ""}
                {archivosBorrador > 0
                  ? ` · ${archivosBorrador} documento(s) adjunto(s)`
                  : ""}
              </p>
              <p className="mt-1 text-xs text-advertencia-texto">
                Guardado en este navegador. Se elimina al cerrar sesión.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/comerciante/solicitudes/nueva"
                className="inline-flex min-h-9 items-center justify-center rounded-lg border border-advertencia bg-superficie px-3 py-1.5 text-sm font-semibold text-advertencia-texto hover:bg-advertencia-suave"
              >
                Continuar
              </Link>
              <Boton
                variante="fantasma"
                tamano="sm"
                onClick={() => setModalDescartar(true)}
              >
                Descartar
              </Boton>
            </div>
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-borde bg-superficie p-4 sm:flex-row sm:items-end sm:justify-between">
        <Selector
          etiqueta="Filtrar por estado"
          value={estado}
          onChange={(evento) => {
            setEstado(evento.target.value as EstadoSolicitud | "todos");
            setPagina(1);
          }}
          className="sm:max-w-xs"
        >
          <option value="todos">Todos los estados</option>
          {ESTADOS_FILTRO.map((valor) => (
            <option key={valor} value={valor}>
              {ETIQUETAS_ESTADO_SOLICITUD[valor]}
            </option>
          ))}
        </Selector>

        {datos ? (
          <p className="text-sm text-texto" aria-live="polite">
            {datos.paginacion.total} solicitud(es)
          </p>
        ) : null}
      </div>

      {mostrarCargaInicial ? (
        <div className="rounded-xl border border-borde bg-superficie">
          <Cargando texto="Cargando tus solicitudes…" />
        </div>
      ) : error && datos === null ? (
        <div className="rounded-xl border border-borde bg-superficie p-4">
          <BloqueError error={error} onReintentar={recargar} />
        </div>
      ) : sinResultados ? (
        <div className="rounded-xl border border-borde bg-superficie">
          <EstadoVacio
            titulo={
              estado === "todos"
                ? "Aún no tienes solicitudes radicadas"
                : "No hay solicitudes con ese estado"
            }
            descripcion={
              estado === "todos"
                ? "Cuando radiques una solicitud podrás seguir su estado desde aquí."
                : "Cambia el filtro para consultar otros estados."
            }
            accion={
              estado === "todos" ? (
                <EnlaceBoton href="/comerciante/solicitudes/nueva">
                  Crear mi primera solicitud
                </EnlaceBoton>
              ) : (
                <Boton
                  variante="contorno"
                  tamano="sm"
                  onClick={() => setEstado("todos")}
                >
                  Ver todas
                </Boton>
              )
            }
          />
        </div>
      ) : datos ? (
        <div className="rounded-xl border border-borde bg-superficie">
          {error ? (
            <div className="p-4">
              <Alerta tono="error">
                <span className="flex flex-wrap items-start gap-2">
                  <span className="flex-1">{error.mensaje}</span>
                  <button
                    type="button"
                    onClick={recargar}
                    className="rounded border border-current px-2 py-1 text-xs font-semibold"
                  >
                    Reintentar
                  </button>
                </span>
              </Alerta>
            </div>
          ) : null}

          <div className="hidden lg:block">
            <Tabla>
              <thead>
                <tr>
                  <Th>Radicado</Th>
                  <Th>Espacio</Th>
                  <Th>Actividad</Th>
                  <Th>Fechas</Th>
                  <Th>Horario</Th>
                  <Th>Estado</Th>
                  <Th>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {datos.datos.map((solicitud) => (
                  <tr key={solicitud.id}>
                    <Td>
                      <span className="font-semibold text-titulo">
                        {solicitud.numeroRadicado}
                      </span>
                      <span className="mt-1 block text-xs text-tenue">
                        {formatearFecha(solicitud.radicadaEn ?? solicitud.creadoEn)}
                      </span>
                    </Td>
                    <Td>
                      <EspacioSolicitud solicitud={solicitud} />
                    </Td>
                    <Td>{solicitud.actividad}</Td>
                    <Td>
                      {formatearRangoFechas(
                        solicitud.fechaInicio,
                        solicitud.fechaFin,
                      )}
                    </Td>
                    <Td>
                      {solicitud.horaInicio} a {solicitud.horaFin}
                    </Td>
                    <Td>
                      <EtiquetaEstadoSolicitud estado={solicitud.estado} />
                    </Td>
                    <Td>
                      <EnlaceBoton
                        href={`/comerciante/solicitudes/${solicitud.id}`}
                        tamano="sm"
                        variante="contorno"
                      >
                        Ver detalle
                      </EnlaceBoton>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          </div>

          <div className="flex flex-col divide-y divide-borde lg:hidden">
            {datos.datos.map((solicitud) => (
              <article key={solicitud.id} className="flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-titulo">
                      {solicitud.numeroRadicado}
                    </p>
                    <p className="text-xs text-tenue">
                      {formatearFecha(solicitud.radicadaEn ?? solicitud.creadoEn)}
                    </p>
                  </div>
                  <EtiquetaEstadoSolicitud estado={solicitud.estado} />
                </div>
                <EspacioSolicitud solicitud={solicitud} />
                <p className="text-sm text-texto">{solicitud.actividad}</p>
                <p className="text-sm text-texto">
                  {formatearRangoFechas(
                    solicitud.fechaInicio,
                    solicitud.fechaFin,
                  )}{" "}
                  · {solicitud.horaInicio} a {solicitud.horaFin}
                </p>
                <Link
                  href={`/comerciante/solicitudes/${solicitud.id}`}
                  className="mt-1 inline-flex min-h-11 items-center justify-center rounded-lg border border-primario px-3 py-2 text-sm font-semibold text-accent-texto hover:bg-primario-suave"
                >
                  Ver detalle
                </Link>
              </article>
            ))}
          </div>

          <Paginacion
            pagina={datos.paginacion.pagina}
            totalPaginas={datos.paginacion.totalPaginas}
            onCambiar={setPagina}
          />
        </div>
      ) : null}

      <Modal
        abierto={modalDescartar}
        titulo="Descartar borrador local"
        descripcion="Se eliminarán los datos y archivos guardados en este navegador. Esta acción no se puede deshacer."
        onCerrar={() => setModalDescartar(false)}
      >
        <AccionesModal
          onCancelar={() => setModalDescartar(false)}
          onConfirmar={() => void descartarBorrador()}
          textoConfirmar="Descartar"
          variante="peligro"
        />
      </Modal>
    </section>
  );
}
