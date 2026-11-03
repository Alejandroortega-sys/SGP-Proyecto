"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Campo, Selector } from "@/components/ui/campo";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import { Etiqueta } from "@/components/ui/etiqueta";
import { AccionesModal, Modal } from "@/components/ui/modal";
import { Paginacion } from "@/components/ui/paginacion";
import { Tabla, Td, Th } from "@/components/ui/tabla";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import { useSesion } from "@/hooks/use-sesion";
import {
  ApiError,
  cambiarEstadoZona,
  comoApiError,
  listarZonas,
} from "@/lib/api-client";
import {
  ETIQUETAS_TIPO,
  formatearAforo,
  formatearHorario,
  TIPOS_ZONA,
} from "@/features/mapa/estilos-zona";
import type {
  FiltrosZonas,
  TipoZona,
  ZonaListado,
} from "@/types/api";

type EstadoFiltro = "" | "true" | "false";

const TONO_TIPO: Record<
  TipoZona,
  "exitoso" | "pendiente" | "peligro"
> = {
  permitida: "exitoso",
  restringida: "pendiente",
  alta_congestion: "peligro",
};

export function ListaZonas() {
  const { usuario } = useSesion();
  const esAdministrador = usuario?.perfil === "administrador";

  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState<TipoZona | "">("");
  const [estado, setEstado] = useState<EstadoFiltro>("");
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState<FiltrosZonas>({});

  const [zonaCambio, setZonaCambio] = useState<ZonaListado | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [errorAccion, setErrorAccion] = useState<ApiError | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const { datos, cargando, error, recargar } = useConsultaApi(
    () => listarZonas({ ...filtros, pagina, limite: 20 }),
    [filtros, pagina],
  );

  function aplicar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    setPagina(1);
    setFiltros({
      busqueda: busqueda.trim() || undefined,
      tipo: tipo || undefined,
      activo:
        estado === "" ? undefined : estado === "true",
    });
  }

  function limpiar(): void {
    setBusqueda("");
    setTipo("");
    setEstado("");
    setPagina(1);
    setFiltros({});
  }

  async function confirmarCambioEstado(): Promise<void> {
    if (!zonaCambio || cambiandoEstado) return;
    setCambiandoEstado(true);
    setErrorAccion(null);
    try {
      const respuesta = await cambiarEstadoZona(
        zonaCambio.id,
        !zonaCambio.activa,
      );
      setExito(respuesta.mensaje);
      setZonaCambio(null);
      recargar();
    } catch (capturado) {
      setErrorAccion(comoApiError(capturado));
    } finally {
      setCambiandoEstado(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primario">
            Gestión del espacio público
          </p>
          <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
            Zonas del espacio público
          </h1>
          <p className="mt-2 max-w-3xl text-base text-texto">
            {esAdministrador
              ? "Delimita, clasifica y administra las zonas normativas del municipio. Los cambios se reflejan en el mapa ciudadano."
              : "Como revisor puedes consultar las zonas y sus restricciones; las acciones de escritura están reservadas al administrador."}
          </p>
        </div>
        {esAdministrador ? (
          <Link
            href="/gestor/zonas/nueva"
            className="inline-flex min-h-11 items-center rounded-lg bg-primario px-4 py-2.5 text-sm font-semibold text-white hover:bg-primario-hover"
          >
            Crear zona
          </Link>
        ) : null}
      </div>

      {exito ? <Alerta tono="exito">{exito}</Alerta> : null}
      {errorAccion && !zonaCambio ? (
        <Alerta tono="error">{errorAccion.mensaje}</Alerta>
      ) : null}

      <Tarjeta className="p-4 sm:p-5">
        <form
          onSubmit={aplicar}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"
        >
          <Campo
            etiqueta="Buscar"
            placeholder="Nombre de la zona…"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            maxLength={150}
          />
          <Selector
            etiqueta="Tipo"
            value={tipo}
            onChange={(evento) =>
              setTipo(evento.target.value as TipoZona | "")
            }
          >
            <option value="">Todos</option>
            {TIPOS_ZONA.map((valor) => (
              <option key={valor} value={valor}>
                {ETIQUETAS_TIPO[valor]}
              </option>
            ))}
          </Selector>
          <Selector
            etiqueta="Estado"
            value={estado}
            onChange={(evento) =>
              setEstado(evento.target.value as EstadoFiltro)
            }
          >
            <option value="">Todos</option>
            <option value="true">Activas</option>
            <option value="false">Inactivas</option>
          </Selector>
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-2">
            <Boton type="submit" variante="contorno">
              Aplicar filtros
            </Boton>
            <Boton type="button" variante="fantasma" onClick={limpiar}>
              Limpiar
            </Boton>
          </div>
        </form>
      </Tarjeta>

      {cargando && !datos ? (
        <Cargando texto="Cargando zonas…" />
      ) : error ? (
        <BloqueError error={error} onReintentar={recargar} />
      ) : !datos || datos.datos.length === 0 ? (
        <Tarjeta>
          <EstadoVacio
            titulo="No hay zonas con esos criterios"
            descripcion="Ajusta los filtros o crea una zona nueva."
            accion={
              <Boton variante="contorno" tamano="sm" onClick={limpiar}>
                Limpiar filtros
              </Boton>
            }
          />
        </Tarjeta>
      ) : (
        <Tarjeta>
          <div className="hidden sm:block">
            <Tabla>
              <thead>
                <tr>
                  <Th>Zona</Th>
                  <Th>Tipo</Th>
                  <Th>Horario</Th>
                  <Th>Aforo</Th>
                  <Th>Espacios</Th>
                  <Th>Módulos</Th>
                  <Th>Estado</Th>
                  <Th>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {datos.datos.map((zona) => (
                  <tr key={zona.id}>
                    <Td>
                      <span className="font-semibold text-titulo">
                        {zona.nombre}
                      </span>
                      <span className="block text-xs text-tenue">
                        ID {zona.id}
                      </span>
                    </Td>
                    <Td>
                      <Etiqueta tono={TONO_TIPO[zona.tipo]}>
                        {ETIQUETAS_TIPO[zona.tipo]}
                      </Etiqueta>
                    </Td>
                    <Td>
                      {formatearHorario({
                        inicio: zona.horarioInicio,
                        fin: zona.horarioFin,
                      })}
                    </Td>
                    <Td>{formatearAforo(zona.aforoMaximo)}</Td>
                    <Td>{zona.totalEspacios}</Td>
                    <Td>{zona.totalModulos}</Td>
                    <Td>
                      <Etiqueta tono={zona.activa ? "exitoso" : "neutro"}>
                        {zona.activa ? "Activa" : "Inactiva"}
                      </Etiqueta>
                    </Td>
                    <Td>
                      <AccionesZona
                        zona={zona}
                        esAdministrador={esAdministrador}
                        onCambiarEstado={() => {
                          setErrorAccion(null);
                          setExito(null);
                          setZonaCambio(zona);
                        }}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          </div>

          <div className="flex flex-col gap-3 p-4 sm:hidden">
            {datos.datos.map((zona) => (
              <article
                key={zona.id}
                className="rounded-lg border border-borde bg-superficie p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-titulo">
                      {zona.nombre}
                    </h2>
                    <p className="text-xs text-tenue">ID {zona.id}</p>
                  </div>
                  <Etiqueta tono={zona.activa ? "exitoso" : "neutro"}>
                    {zona.activa ? "Activa" : "Inactiva"}
                  </Etiqueta>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs font-semibold uppercase text-tenue">
                      Tipo
                    </dt>
                    <dd className="mt-1">
                      <Etiqueta tono={TONO_TIPO[zona.tipo]}>
                        {ETIQUETAS_TIPO[zona.tipo]}
                      </Etiqueta>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-tenue">
                      Aforo
                    </dt>
                    <dd className="mt-1">{formatearAforo(zona.aforoMaximo)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-tenue">
                      Horario
                    </dt>
                    <dd className="mt-1">
                      {formatearHorario({
                        inicio: zona.horarioInicio,
                        fin: zona.horarioFin,
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-tenue">
                      Espacios / módulos
                    </dt>
                    <dd className="mt-1">
                      {zona.totalEspacios} / {zona.totalModulos}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <AccionesZona
                    zona={zona}
                    esAdministrador={esAdministrador}
                    onCambiarEstado={() => {
                      setErrorAccion(null);
                      setExito(null);
                      setZonaCambio(zona);
                    }}
                  />
                </div>
              </article>
            ))}
          </div>

          <Paginacion
            pagina={datos.paginacion.pagina}
            totalPaginas={datos.paginacion.totalPaginas}
            onCambiar={setPagina}
          />
        </Tarjeta>
      )}

      <Modal
        abierto={zonaCambio !== null}
        titulo={
          zonaCambio?.activa ? "Desactivar zona" : "Activar zona"
        }
        descripcion={
          zonaCambio?.activa
            ? "La zona dejará de publicarse en el mapa ciudadano y no se podrá usar para nuevas solicitudes. Los datos históricos se conservan."
            : "La zona volverá a publicarse en el mapa ciudadano y podrá usarse para nuevas solicitudes."
        }
        onCerrar={() => setZonaCambio(null)}
      >
        <div className="flex flex-col gap-4">
          {errorAccion ? (
            <Alerta tono="error">{errorAccion.mensaje}</Alerta>
          ) : null}
          <p className="text-sm text-texto">
            Zona:{" "}
            <span className="font-semibold text-titulo">
              {zonaCambio?.nombre}
            </span>
          </p>
          <AccionesModal
            onCancelar={() => setZonaCambio(null)}
            onConfirmar={() => void confirmarCambioEstado()}
            textoConfirmar={
              zonaCambio?.activa ? "Desactivar" : "Activar"
            }
            variante={zonaCambio?.activa ? "peligro" : "solido"}
            cargando={cambiandoEstado}
          />
        </div>
      </Modal>
    </div>
  );
}

function AccionesZona({
  zona,
  esAdministrador,
  onCambiarEstado,
}: {
  zona: ZonaListado;
  esAdministrador: boolean;
  onCambiarEstado: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/gestor/zonas/${zona.id}/editar`}
        className="inline-flex min-h-9 items-center rounded-lg border border-primario px-3 py-1.5 text-sm font-semibold text-primario hover:bg-primario-suave"
      >
        {esAdministrador ? "Editar" : "Ver"}
      </Link>
      <Link
        href={`/gestor/zonas/${zona.id}/historial`}
        className="inline-flex min-h-9 items-center rounded-lg border border-borde px-3 py-1.5 text-sm font-semibold text-texto hover:bg-slate-100"
      >
        Historial
      </Link>
      {esAdministrador ? (
        <Boton
          variante={zona.activa ? "peligro" : "contorno"}
          tamano="sm"
          onClick={onCambiarEstado}
        >
          {zona.activa ? "Desactivar" : "Activar"}
        </Boton>
      ) : null}
    </div>
  );
}
