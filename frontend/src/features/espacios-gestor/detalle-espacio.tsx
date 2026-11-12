"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import { Etiqueta } from "@/components/ui/etiqueta";
import { AccionesModal, Modal } from "@/components/ui/modal";
import { Tarjeta, TarjetaCuerpo } from "@/components/ui/tarjeta";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import {
  ApiError,
  asignarEspacioGestor,
  cambiarEstadoEspacioGestor,
  comoApiError,
  eliminarEspacioGestor,
  liberarEspacioGestor,
  obtenerEspacioGestor,
  obtenerHistorialEspacio,
} from "@/lib/api-client";
import { formatearFechaHora, resumirValor } from "@/lib/formato";
import type {
  EspacioGestorDetalle,
  EstadoEspacio,
  HistorialEspacio,
} from "@/types/api";
import {
  ETIQUETAS_ESTADO_ESPACIO,
  ETIQUETAS_TIPO_ESPACIO,
  TONOS_ESTADO_ESPACIO,
} from "@/features/espacios/estilos-espacio";
import { GestionBloqueos } from "./gestion-bloqueos";
import { MapaEspacioCarga } from "./mapa-espacio-carga";

interface DetalleEspacioProps {
  id: string;
  mensajeInicial?: string;
}

interface DatosFicha {
  espacio: EspacioGestorDetalle;
  historial: HistorialEspacio;
}

type Accion =
  | "asignar"
  | "liberar"
  | "mantenimiento"
  | "disponible"
  | "eliminar";

function textoEstado(estado: EstadoEspacio): string {
  return ETIQUETAS_ESTADO_ESPACIO[estado];
}

/** Ficha administrativa de un espacio con bloqueos, estado e historial. */
export function DetalleEspacio({ id, mensajeInicial }: DetalleEspacioProps) {
  const router = useRouter();
  const { datos, cargando, error, recargar } = useConsultaApi<DatosFicha>(
    async () => {
      const [espacio, historial] = await Promise.all([
        obtenerEspacioGestor(id),
        obtenerHistorialEspacio(id, { pagina: 1, limite: 30 }),
      ]);
      return { espacio, historial };
    },
    [id],
  );

  const [accion, setAccion] = useState<Accion | null>(null);
  const [ejecutando, setEjecutando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<ApiError | null>(null);
  const [exito, setExito] = useState<string | null>(mensajeInicial ?? null);

  async function confirmarAccion(): Promise<void> {
    if (!datos || !accion || ejecutando) return;
    setEjecutando(true);
    setErrorAccion(null);
    try {
      if (accion === "eliminar") {
        await eliminarEspacioGestor(datos.espacio.id);
        router.replace("/gestor/espacios");
        return;
      }
      const respuesta =
        accion === "asignar"
          ? await asignarEspacioGestor(datos.espacio.id)
          : accion === "liberar"
            ? await liberarEspacioGestor(datos.espacio.id)
            : await cambiarEstadoEspacioGestor(
                datos.espacio.id,
                accion === "mantenimiento" ? "mantenimiento" : "disponible",
              );
      setExito(respuesta.mensaje);
      setAccion(null);
      recargar();
    } catch (capturado) {
      setErrorAccion(comoApiError(capturado));
    } finally {
      setEjecutando(false);
    }
  }

  if (cargando && !datos) {
    return <Cargando texto="Cargando la ficha del espacio…" />;
  }

  if (error) {
    if (error.status === 404) {
      return (
        <EstadoVacio
          titulo="El espacio solicitado no existe"
          descripcion="Puede que el identificador no sea válido."
          accion={
            <Link
              href="/gestor/espacios"
              className="font-semibold text-primario hover:underline"
            >
              Volver al catálogo de espacios
            </Link>
          }
        />
      );
    }
    return <BloqueError error={error} onReintentar={recargar} />;
  }

  if (!datos) return null;

  const { espacio, historial } = datos;
  const puedeAsignar =
    !espacio.asignacionManual &&
    espacio.estado !== "mantenimiento" &&
    !espacio.bloqueoVigente &&
    !espacio.permisoVigente &&
    !espacio.solicitudVigente;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/gestor/espacios"
          className="text-sm font-semibold text-primario hover:underline"
        >
          ← Volver al catálogo de espacios
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primario">
              Espacio público · Administración
            </p>
            <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
              {espacio.nombre}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Etiqueta tono="neutro">
                {ETIQUETAS_TIPO_ESPACIO[espacio.tipo]}
              </Etiqueta>
              <Etiqueta tono={TONOS_ESTADO_ESPACIO[espacio.estadoEfectivo]}>
                {textoEstado(espacio.estadoEfectivo)}
              </Etiqueta>
              {espacio.asignacionManual ? (
                <Etiqueta tono="info">Asignación manual</Etiqueta>
              ) : null}
              {espacio.zona ? (
                <span className="text-sm text-tenue">{espacio.zona.nombre}</span>
              ) : (
                <span className="text-sm text-tenue">Fuera de zona</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/gestor/espacios/${espacio.id}/editar`}
              className="inline-flex min-h-11 items-center rounded-lg border border-primario px-4 py-2.5 text-sm font-semibold text-primario hover:bg-primario-suave"
            >
              Editar
            </Link>
            {espacio.asignacionManual ? (
              <Boton
                variante="solido"
                onClick={() => {
                  setErrorAccion(null);
                  setAccion("liberar");
                }}
              >
                Liberar asignación
              </Boton>
            ) : (
              <Boton
                variante="solido"
                disabled={!puedeAsignar}
                onClick={() => {
                  setErrorAccion(null);
                  setAccion("asignar");
                }}
              >
                Asignar espacio
              </Boton>
            )}
            {espacio.estado === "mantenimiento" ? (
              <Boton
                variante="contorno"
                onClick={() => {
                  setErrorAccion(null);
                  setAccion("disponible");
                }}
              >
                Volver a disponible
              </Boton>
            ) : (
              <Boton
                variante="contorno"
                disabled={espacio.asignacionManual}
                onClick={() => {
                  setErrorAccion(null);
                  setAccion("mantenimiento");
                }}
              >
                Poner en mantenimiento
              </Boton>
            )}
            <Boton
              variante="peligro"
              disabled={!espacio.puedeEliminar}
              onClick={() => {
                setErrorAccion(null);
                setAccion("eliminar");
              }}
            >
              Eliminar
            </Boton>
          </div>
        </div>
      </div>

      {exito ? <Alerta tono="exito">{exito}</Alerta> : null}
      {errorAccion && !accion ? (
        <Alerta tono="error">{errorAccion.mensaje}</Alerta>
      ) : null}
      {espacio.motivoEstado ? (
        <Alerta tono="informacion">{espacio.motivoEstado}</Alerta>
      ) : null}
      {!espacio.puedeEliminar ? (
        <Alerta tono="informacion">
          Este espacio tiene permisos o solicitudes asociadas. Se conserva para
          no romper el historial.
        </Alerta>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="flex flex-col gap-4">
          <MapaEspacioCarga punto={espacio.ubicacion} soloLectura />

          <Tarjeta>
            <TarjetaCuerpo>
              <h2 className="text-base font-bold text-titulo">
                Datos del espacio
              </h2>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase text-tenue">
                    Estado registrado
                  </dt>
                  <dd className="mt-0.5">
                    <Etiqueta tono={TONOS_ESTADO_ESPACIO[espacio.estado]}>
                      {textoEstado(espacio.estado)}
                    </Etiqueta>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-tenue">
                    Estado efectivo
                  </dt>
                  <dd className="mt-0.5">
                    <Etiqueta
                      tono={TONOS_ESTADO_ESPACIO[espacio.estadoEfectivo]}
                    >
                      {textoEstado(espacio.estadoEfectivo)}
                    </Etiqueta>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-tenue">
                    Sector
                  </dt>
                  <dd className="mt-0.5 text-texto">
                    {espacio.sector ?? "Sin sector"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-tenue">
                    Dimensiones
                  </dt>
                  <dd className="mt-0.5 text-texto">
                    {espacio.dimensiones ?? "Sin dimensiones"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-tenue">
                    Actividad permitida
                  </dt>
                  <dd className="mt-0.5 text-texto">
                    {espacio.actividadPermitida ?? "Sin actividad registrada"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-tenue">
                    Horario
                  </dt>
                  <dd className="mt-0.5 text-texto">
                    {espacio.horario.inicio && espacio.horario.fin
                      ? `${espacio.horario.inicio} a ${espacio.horario.fin}`
                      : "Sin horario definido"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-tenue">
                    Creado por
                  </dt>
                  <dd className="mt-0.5 text-texto">{espacio.creadoPor}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-tenue">
                    Fecha de creación
                  </dt>
                  <dd className="mt-0.5 text-texto">
                    {formatearFechaHora(espacio.creadoEn)}
                  </dd>
                </div>
              </dl>
            </TarjetaCuerpo>
          </Tarjeta>

          {espacio.zona ? (
            <Tarjeta>
              <TarjetaCuerpo>
                <h2 className="text-base font-bold text-titulo">
                  Zona y restricciones
                </h2>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase text-tenue">
                      Zona
                    </dt>
                    <dd className="mt-0.5 text-texto">
                      {espacio.zona.nombre}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-tenue">
                      Tipo
                    </dt>
                    <dd className="mt-0.5 text-texto">
                      {espacio.zona.tipo.replace("_", " ")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-tenue">
                      Horario de la zona
                    </dt>
                    <dd className="mt-0.5 text-texto">
                      {espacio.zona.horarioInicio && espacio.zona.horarioFin
                        ? `${espacio.zona.horarioInicio} a ${espacio.zona.horarioFin}`
                        : "Sin horario"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-tenue">
                      Aforo máximo
                    </dt>
                    <dd className="mt-0.5 text-texto">
                      {espacio.zona.aforoMaximo ?? "Sin aforo"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase text-tenue">
                      Productos permitidos
                    </dt>
                    <dd className="mt-0.5 text-texto">
                      {espacio.zona.productos.length > 0
                        ? espacio.zona.productos.join(", ")
                        : "Sin productos restringidos"}
                    </dd>
                  </div>
                </dl>
              </TarjetaCuerpo>
            </Tarjeta>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <GestionBloqueos
            espacioId={espacio.id}
            bloqueos={espacio.bloqueos}
            asignacionManual={espacio.asignacionManual}
            onRecargar={recargar}
          />

          <Tarjeta>
            <TarjetaCuerpo>
              <h2 className="text-base font-bold text-titulo">Historial</h2>
              {historial.datos.length === 0 ? (
                <p className="mt-2 text-sm text-texto">
                  No hay eventos de auditoría registrados.
                </p>
              ) : (
                <ol className="mt-4 flex flex-col gap-3">
                  {historial.datos.map((item) => (
                    <li
                      key={item.id}
                      className="border-l-2 border-primario/30 pl-3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-titulo">
                          {item.tabla === "espacio_bloqueos"
                            ? "Bloqueo"
                            : "Espacio"}{" "}
                          · {item.accion}
                        </p>
                        <p className="text-xs text-tenue">
                          {formatearFechaHora(item.creadoEn)}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-tenue">
                        {item.actorNombre
                          ? `${item.actorNombre} ${item.actorApellido ?? ""} · ${item.actorCorreo ?? ""}`
                          : "Actor no disponible"}
                      </p>
                      {item.valorNuevo ? (
                        <p className="mt-1 line-clamp-2 text-xs text-texto">
                          {resumirValor(item.valorNuevo, 140)}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </TarjetaCuerpo>
          </Tarjeta>
        </div>
      </div>

      <Modal
        abierto={accion !== null}
        titulo={tituloAccion(accion)}
        descripcion={descripcionAccion(accion)}
        onCerrar={() => setAccion(null)}
      >
        <div className="flex flex-col gap-4">
          {errorAccion ? (
            <Alerta tono="error">{errorAccion.mensaje}</Alerta>
          ) : null}
          <p className="text-sm text-texto">
            Espacio:{" "}
            <span className="font-semibold text-titulo">{espacio.nombre}</span>
          </p>
          {accion === "eliminar" ? (
            <p className="text-sm text-texto">
              También se eliminarán sus {espacio.totalBloqueos} bloqueo(s).
            </p>
          ) : null}
          {accion === "asignar" ? (
            <p className="text-sm text-texto">
              La asignación se conservará hasta que pulses «Liberar asignación».
              No se crea un permiso ni una solicitud.
            </p>
          ) : null}
          <AccionesModal
            onCancelar={() => setAccion(null)}
            onConfirmar={() => void confirmarAccion()}
            textoConfirmar={textoConfirmarAccion(accion)}
            variante={accion === "eliminar" ? "peligro" : "solido"}
            cargando={ejecutando}
          />
        </div>
      </Modal>
    </div>
  );
}

function tituloAccion(accion: Accion | null): string {
  switch (accion) {
    case "asignar":
      return "Asignar espacio";
    case "liberar":
      return "Liberar asignación";
    case "mantenimiento":
      return "Poner en mantenimiento";
    case "disponible":
      return "Volver a disponible";
    case "eliminar":
      return "Eliminar espacio";
    default:
      return "Confirmar acción";
  }
}

function descripcionAccion(accion: Accion | null): string {
  switch (accion) {
    case "asignar":
      return "El espacio quedará ocupado por una asignación manual.";
    case "liberar":
      return "El estado se recalculará según los bloqueos, permisos y solicitudes vigentes.";
    case "mantenimiento":
      return "El espacio dejará de estar disponible mientras esté en mantenimiento.";
    case "disponible":
      return "Se retirará el mantenimiento y se recalculará el estado.";
    case "eliminar":
      return "La operación no se puede deshacer.";
    default:
      return "";
  }
}

function textoConfirmarAccion(accion: Accion | null): string {
  switch (accion) {
    case "asignar":
      return "Asignar";
    case "liberar":
      return "Liberar";
    case "mantenimiento":
      return "Poner en mantenimiento";
    case "disponible":
      return "Volver a disponible";
    case "eliminar":
      return "Eliminar espacio";
    default:
      return "Confirmar";
  }
}
