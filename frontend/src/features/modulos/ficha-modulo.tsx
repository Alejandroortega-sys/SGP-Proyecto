"use client";

import Link from "next/link";
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
  cambiarEstadoModulo,
  comoApiError,
  obtenerHistorialModulo,
  obtenerModulo,
  urlArchivo,
} from "@/lib/api-client";
import { formatearFechaHora, resumirValor } from "@/lib/formato";
import type {
  CambioModulo,
  ModuloDetalle,
  ModuloHistorial,
} from "@/types/api";
import { AdvertenciasModulo } from "./advertencias-modulo";
import { MapaCensoModuloCarga } from "./mapa-censo-modulo-carga";
import {
  ETIQUETAS_CATEGORIA,
  ETIQUETAS_ESTADO_MODULO,
  TONO_CATEGORIA,
  TONO_ESTADO_MODULO,
  nombreTitular,
} from "./estilos-modulo";

interface FichaModuloProps {
  id: string;
  mensajeInicial?: string;
}

interface DatosFicha {
  modulo: ModuloDetalle;
  historial: ModuloHistorial;
}

function tituloAccion(item: ModuloHistorial["datos"][number]): string {
  if (item.accion === "insert") return "Módulo censado";
  if (item.accion === "delete") return "Módulo eliminado";

  const cambioEstado = item.cambios.find((cambio) => cambio.campo === "estado");
  if (cambioEstado?.nuevo === "baja") return "Módulo dado de baja";
  if (cambioEstado?.nuevo === "activo") return "Módulo reactivado";
  return "Módulo editado";
}

function textoCambio(cambio: CambioModulo): string {
  if (cambio.campo === "foto_url") {
    return cambio.nuevo ? "Foto actualizada" : "Foto retirada";
  }
  if (cambio.campo === "ubicacion") {
    return "Ubicación actualizada";
  }
  const anterior = resumirValor(cambio.anterior, 80);
  const nuevo = resumirValor(cambio.nuevo, 80);
  return `${anterior} → ${nuevo}`;
}

/** Ficha completa de un módulo del censo, con foto, zona e historial. */
export function FichaModulo({ id, mensajeInicial }: FichaModuloProps) {
  const { datos, cargando, error, recargar } = useConsultaApi<DatosFicha>(
    async () => {
      const [modulo, historial] = await Promise.all([
        obtenerModulo(id),
        obtenerHistorialModulo(id, { pagina: 1, limite: 20 }),
      ]);
      return { modulo, historial };
    },
    [id],
  );

  const [confirmandoEstado, setConfirmandoEstado] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [errorAccion, setErrorAccion] = useState<ApiError | null>(null);
  const [exito, setExito] = useState<string | null>(mensajeInicial ?? null);

  async function cambiarEstado(): Promise<void> {
    if (!datos || cambiandoEstado) return;
    setCambiandoEstado(true);
    setErrorAccion(null);
    try {
      const respuesta = await cambiarEstadoModulo(
        datos.modulo.id,
        datos.modulo.estado === "activo" ? "baja" : "activo",
      );
      setExito(respuesta.mensaje);
      setConfirmandoEstado(false);
      recargar();
    } catch (capturado) {
      setErrorAccion(comoApiError(capturado));
    } finally {
      setCambiandoEstado(false);
    }
  }

  if (cargando && !datos) {
    return <Cargando texto="Cargando la ficha del módulo…" />;
  }

  if (error) {
    if (error.status === 404) {
      return (
        <EstadoVacio
          titulo="El módulo solicitado no existe"
          descripcion="Puede que el identificador no sea válido."
          accion={
            <Link
              href="/gestor/modulos"
              className="font-semibold text-primario hover:underline"
            >
              Volver al listado de módulos
            </Link>
          }
        />
      );
    }
    return <BloqueError error={error} onReintentar={recargar} />;
  }

  if (!datos) return null;

  const { modulo, historial } = datos;
  const foto = urlArchivo(modulo.fotoUrl);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/gestor/modulos"
          className="text-sm font-semibold text-primario hover:underline"
        >
          ← Volver al listado de módulos
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primario">
              Censo del espacio público
            </p>
            <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
              {modulo.codigo}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Etiqueta tono={TONO_CATEGORIA[modulo.categoria]}>
                {ETIQUETAS_CATEGORIA[modulo.categoria]}
              </Etiqueta>
              <Etiqueta tono={TONO_ESTADO_MODULO[modulo.estado]}>
                {ETIQUETAS_ESTADO_MODULO[modulo.estado]}
              </Etiqueta>
              <span className="text-sm text-tenue">
                {nombreTitular(modulo)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/gestor/modulos/${modulo.id}/editar`}
              className="inline-flex min-h-11 items-center rounded-lg border border-primario px-4 py-2.5 text-sm font-semibold text-primario hover:bg-primario-suave"
            >
              Editar
            </Link>
            <Boton
              variante={modulo.estado === "activo" ? "peligro" : "contorno"}
              onClick={() => {
                setErrorAccion(null);
                setExito(null);
                setConfirmandoEstado(true);
              }}
            >
              {modulo.estado === "activo" ? "Dar de baja" : "Reactivar"}
            </Boton>
          </div>
        </div>
      </div>

      {exito ? <Alerta tono="exito">{exito}</Alerta> : null}
      {errorAccion && !confirmandoEstado ? (
        <Alerta tono="error">{errorAccion.mensaje}</Alerta>
      ) : null}

      {modulo.estado === "baja" ? (
        <Alerta tono="informacion">
          Este módulo está dado de baja. No cuenta en la ocupación activa, pero
          su registro e historial se conservan.
        </Alerta>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-4">
          <Tarjeta>
            <TarjetaCuerpo>
              {foto ? (
                <div className="overflow-hidden rounded-lg border border-borde bg-fondo">
                  {/* eslint-disable-next-line @next/next/no-img-element -- foto local servida por el backend */}
                  <img
                    src={foto}
                    alt={`Foto del módulo ${modulo.codigo}`}
                    className="h-64 w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-borde bg-fondo text-sm text-tenue">
                  Este módulo no tiene foto registrada.
                </div>
              )}
            </TarjetaCuerpo>
          </Tarjeta>

          <MapaCensoModuloCarga punto={modulo.ubicacion} soloLectura />
        </div>

        <div className="flex flex-col gap-4">
          <Tarjeta>
            <TarjetaCuerpo>
              <h2 className="text-base font-bold text-titulo">
                Datos del censo
              </h2>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase text-tenue">
                    Código
                  </dt>
                  <dd className="mt-0.5 font-semibold text-titulo">
                    {modulo.codigo}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-tenue">
                    Categoría
                  </dt>
                  <dd className="mt-0.5">
                    <Etiqueta tono={TONO_CATEGORIA[modulo.categoria]}>
                      {ETIQUETAS_CATEGORIA[modulo.categoria]}
                    </Etiqueta>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-tenue">
                    Titular
                  </dt>
                  <dd className="mt-0.5 text-texto">
                    {nombreTitular(modulo)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-tenue">
                    Actividad
                  </dt>
                  <dd className="mt-0.5 text-texto">{modulo.actividad}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-tenue">
                    Sector
                  </dt>
                  <dd className="mt-0.5 text-texto">
                    {modulo.sector ?? "Sin zona"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-tenue">
                    Registrado por
                  </dt>
                  <dd className="mt-0.5 text-texto">
                    {modulo.registradoPor
                      ? `${modulo.registradoPor.nombre} ${modulo.registradoPor.apellido ?? ""}`
                      : "No disponible"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase text-tenue">
                    Fecha de censo
                  </dt>
                  <dd className="mt-0.5 text-texto">
                    {formatearFechaHora(modulo.creadoEn)}
                  </dd>
                </div>
              </dl>
            </TarjetaCuerpo>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCuerpo>
              <h2 className="mb-3 text-base font-bold text-titulo">
                Zona y advertencias
              </h2>
              <AdvertenciasModulo
                zona={modulo.zonaContenedora}
                advertencias={modulo.advertencias}
                requiereConfirmacion={modulo.advertencias.some(
                  (advertencia) => advertencia.requiereConfirmacion,
                )}
              />
            </TarjetaCuerpo>
          </Tarjeta>
        </div>
      </div>

      <Tarjeta>
        <TarjetaCuerpo>
          <h2 className="text-base font-bold text-titulo">Historial</h2>
          {historial.datos.length === 0 ? (
            <p className="mt-2 text-sm text-texto">
              No hay eventos de auditoría registrados para este módulo.
            </p>
          ) : (
            <ol className="mt-4 flex flex-col gap-4">
              {historial.datos.map((item) => (
                <li
                  key={item.id}
                  className="border-l-2 border-primario/30 pl-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-titulo">
                      {tituloAccion(item)}
                    </p>
                    <p className="text-xs text-tenue">
                      {formatearFechaHora(item.creadoEn)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-tenue">
                    {item.actor
                      ? `${item.actor.nombre} ${item.actor.apellido ?? ""} · ${item.actor.correo}`
                      : "Actor no disponible"}
                  </p>
                  {item.cambios.length > 0 ? (
                    <ul className="mt-2 flex flex-col gap-1 text-sm text-texto">
                      {item.cambios.map((cambio) => (
                        <li key={`${item.id}-${cambio.campo}`}>
                          <span className="font-medium text-titulo">
                            {cambio.etiqueta}:
                          </span>{" "}
                          {textoCambio(cambio)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </TarjetaCuerpo>
      </Tarjeta>

      <Modal
        abierto={confirmandoEstado}
        titulo={
          modulo.estado === "activo" ? "Dar de baja el módulo" : "Reactivar módulo"
        }
        descripcion={
          modulo.estado === "activo"
            ? "El módulo dejará de contar en la ocupación activa, pero su registro y todo su historial se conservarán."
            : "El módulo volverá a contar en el censo activo."
        }
        onCerrar={() => setConfirmandoEstado(false)}
      >
        <div className="flex flex-col gap-4">
          {errorAccion ? (
            <Alerta tono="error">{errorAccion.mensaje}</Alerta>
          ) : null}
          <p className="text-sm text-texto">
            Módulo:{" "}
            <span className="font-semibold text-titulo">{modulo.codigo}</span>
          </p>
          <AccionesModal
            onCancelar={() => setConfirmandoEstado(false)}
            onConfirmar={() => void cambiarEstado()}
            textoConfirmar={
              modulo.estado === "activo" ? "Dar de baja" : "Reactivar"
            }
            variante={modulo.estado === "activo" ? "peligro" : "solido"}
            cargando={cambiandoEstado}
          />
        </div>
      </Modal>
    </div>
  );
}
