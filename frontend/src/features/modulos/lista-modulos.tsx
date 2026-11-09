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
import {
  ApiError,
  cambiarEstadoModulo,
  comoApiError,
  listarModulos,
  obtenerOpcionesModulos,
  urlArchivo,
} from "@/lib/api-client";
import type {
  CategoriaComercio,
  EstadoModulo,
  FiltrosModulos,
  ModuloListado,
} from "@/types/api";
import {
  ETIQUETAS_CATEGORIA,
  ETIQUETAS_ESTADO_MODULO,
  TONO_CATEGORIA,
  TONO_ESTADO_MODULO,
  formatearSector,
  nombreTitular,
} from "./estilos-modulo";

type EstadoFiltro = "" | EstadoModulo | "todos";

export function ListaModulos() {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<CategoriaComercio | "">("");
  const [sector, setSector] = useState("");
  const [estado, setEstado] = useState<EstadoFiltro>("");
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState<FiltrosModulos>({});

  const opciones = useConsultaApi(obtenerOpcionesModulos, []);
  const lista = useConsultaApi(
    () => listarModulos({ ...filtros, pagina, limite: 20 }),
    [filtros, pagina],
  );

  const [moduloCambio, setModuloCambio] = useState<ModuloListado | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [errorAccion, setErrorAccion] = useState<ApiError | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  function aplicar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    setPagina(1);
    setFiltros({
      busqueda: busqueda.trim() || undefined,
      categoria: categoria || undefined,
      sector: sector || undefined,
      estado: estado === "" ? undefined : estado,
    });
  }

  function limpiar(): void {
    setBusqueda("");
    setCategoria("");
    setSector("");
    setEstado("");
    setPagina(1);
    setFiltros({});
  }

  async function confirmarCambioEstado(): Promise<void> {
    if (!moduloCambio || cambiandoEstado) return;
    setCambiandoEstado(true);
    setErrorAccion(null);
    try {
      const respuesta = await cambiarEstadoModulo(
        moduloCambio.id,
        moduloCambio.estado === "activo" ? "baja" : "activo",
      );
      setExito(respuesta.mensaje);
      setModuloCambio(null);
      lista.recargar();
    } catch (capturado) {
      setErrorAccion(comoApiError(capturado));
    } finally {
      setCambiandoEstado(false);
    }
  }

  const datos = lista.datos;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primario">
            Censo del espacio público
          </p>
          <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
            Módulos y puestos
          </h1>
          <p className="mt-2 max-w-3xl text-base text-texto">
            Consulta el censo de comercio formal e informal, filtra por sector
            y categoría, y administra la baja lógica conservando el historial.
          </p>
        </div>
        <Link
          href="/gestor/modulos/nuevo"
          className="inline-flex min-h-11 items-center rounded-lg bg-primario px-4 py-2.5 text-sm font-semibold text-white hover:bg-primario-hover"
        >
          Censar módulo
        </Link>
      </div>

      {exito ? <Alerta tono="exito">{exito}</Alerta> : null}
      {errorAccion && !moduloCambio ? (
        <Alerta tono="error">{errorAccion.mensaje}</Alerta>
      ) : null}

      <Tarjeta className="p-4 sm:p-5">
        <form
          onSubmit={aplicar}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"
        >
          <Campo
            etiqueta="Buscar"
            placeholder="Código, titular o actividad…"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            maxLength={150}
          />
          <Selector
            etiqueta="Categoría"
            value={categoria}
            onChange={(evento) =>
              setCategoria(evento.target.value as CategoriaComercio | "")
            }
          >
            <option value="">Todas</option>
            <option value="formal">Formal</option>
            <option value="informal">Informal</option>
          </Selector>
          <Selector
            etiqueta="Sector"
            value={sector}
            onChange={(evento) => setSector(evento.target.value)}
          >
            <option value="">Todos</option>
            {opciones.datos?.sectores.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
            <option value="sin_zona">Sin zona</option>
          </Selector>
          <Selector
            etiqueta="Estado"
            value={estado}
            onChange={(evento) =>
              setEstado(evento.target.value as EstadoFiltro)
            }
          >
            <option value="">Todos</option>
            <option value="activo">Activos</option>
            <option value="baja">Dados de baja</option>
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
        {opciones.error ? (
          <p className="mt-2 text-xs text-tenue">
            No se pudieron cargar las zonas para el filtro de sector. Puedes
            filtrar por categoría y estado.
          </p>
        ) : null}
      </Tarjeta>

      {lista.cargando && !datos ? (
        <Cargando texto="Cargando el censo de módulos…" />
      ) : lista.error ? (
        <BloqueError error={lista.error} onReintentar={lista.recargar} />
      ) : !datos || datos.datos.length === 0 ? (
        <Tarjeta>
          <EstadoVacio
            titulo="No hay módulos con esos criterios"
            descripcion="Ajusta los filtros o censa un módulo nuevo."
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
                  <Th>Módulo</Th>
                  <Th>Foto</Th>
                  <Th>Categoría</Th>
                  <Th>Titular</Th>
                  <Th>Actividad</Th>
                  <Th>Sector</Th>
                  <Th>Estado</Th>
                  <Th>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {datos.datos.map((modulo) => (
                  <FilaModulo
                    key={modulo.id}
                    modulo={modulo}
                    onCambiarEstado={() => {
                      setErrorAccion(null);
                      setExito(null);
                      setModuloCambio(modulo);
                    }}
                  />
                ))}
              </tbody>
            </Tabla>
          </div>

          <div className="flex flex-col gap-3 p-4 sm:hidden">
            {datos.datos.map((modulo) => (
              <TarjetaModulo
                key={modulo.id}
                modulo={modulo}
                onCambiarEstado={() => {
                  setErrorAccion(null);
                  setExito(null);
                  setModuloCambio(modulo);
                }}
              />
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
        abierto={moduloCambio !== null}
        titulo={
          moduloCambio?.estado === "activo"
            ? "Dar de baja el módulo"
            : "Reactivar módulo"
        }
        descripcion={
          moduloCambio?.estado === "activo"
            ? "El módulo dejará de contar en la ocupación activa, pero su registro y todo su historial se conservarán."
            : "El módulo volverá a contar en el censo activo."
        }
        onCerrar={() => setModuloCambio(null)}
      >
        <div className="flex flex-col gap-4">
          {errorAccion ? (
            <Alerta tono="error">{errorAccion.mensaje}</Alerta>
          ) : null}
          <p className="text-sm text-texto">
            Módulo:{" "}
            <span className="font-semibold text-titulo">
              {moduloCambio?.codigo}
            </span>
          </p>
          <AccionesModal
            onCancelar={() => setModuloCambio(null)}
            onConfirmar={() => void confirmarCambioEstado()}
            textoConfirmar={
              moduloCambio?.estado === "activo" ? "Dar de baja" : "Reactivar"
            }
            variante={
              moduloCambio?.estado === "activo" ? "peligro" : "solido"
            }
            cargando={cambiandoEstado}
          />
        </div>
      </Modal>
    </div>
  );
}

function FilaModulo({
  modulo,
  onCambiarEstado,
}: {
  modulo: ModuloListado;
  onCambiarEstado: () => void;
}) {
  const foto = urlArchivo(modulo.fotoUrl);

  return (
    <tr>
      <Td>
        <span className="font-semibold text-titulo">{modulo.codigo}</span>
        <span className="block text-xs text-tenue">ID {modulo.id}</span>
      </Td>
      <Td>
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura de una foto local del backend
          <img
            src={foto}
            alt={`Foto de ${modulo.codigo}`}
            className="size-12 rounded-lg border border-borde object-cover"
          />
        ) : (
          <span className="flex size-12 items-center justify-center rounded-lg border border-dashed border-borde text-[10px] text-tenue">
            Sin foto
          </span>
        )}
      </Td>
      <Td>
        <Etiqueta tono={TONO_CATEGORIA[modulo.categoria]}>
          {ETIQUETAS_CATEGORIA[modulo.categoria]}
        </Etiqueta>
      </Td>
      <Td>{nombreTitular(modulo)}</Td>
      <Td className="max-w-56">{modulo.actividad}</Td>
      <Td>{formatearSector(modulo.sector)}</Td>
      <Td>
        <Etiqueta tono={TONO_ESTADO_MODULO[modulo.estado]}>
          {ETIQUETAS_ESTADO_MODULO[modulo.estado]}
        </Etiqueta>
      </Td>
      <Td>
        <AccionesModulo
          modulo={modulo}
          onCambiarEstado={onCambiarEstado}
        />
      </Td>
    </tr>
  );
}

function TarjetaModulo({
  modulo,
  onCambiarEstado,
}: {
  modulo: ModuloListado;
  onCambiarEstado: () => void;
}) {
  const foto = urlArchivo(modulo.fotoUrl);

  return (
    <article className="rounded-lg border border-borde bg-superficie p-4">
      <div className="flex items-start gap-3">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura de una foto local del backend
          <img
            src={foto}
            alt={`Foto de ${modulo.codigo}`}
            className="size-16 shrink-0 rounded-lg border border-borde object-cover"
          />
        ) : (
          <span className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-borde text-[10px] text-tenue">
            Sin foto
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-titulo">
                {modulo.codigo}
              </h2>
              <p className="text-xs text-tenue">ID {modulo.id}</p>
            </div>
            <Etiqueta tono={TONO_ESTADO_MODULO[modulo.estado]}>
              {ETIQUETAS_ESTADO_MODULO[modulo.estado]}
            </Etiqueta>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Etiqueta tono={TONO_CATEGORIA[modulo.categoria]}>
              {ETIQUETAS_CATEGORIA[modulo.categoria]}
            </Etiqueta>
            <Etiqueta tono="neutro">{formatearSector(modulo.sector)}</Etiqueta>
          </div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase text-tenue">
            Titular
          </dt>
          <dd className="mt-1 text-texto">{nombreTitular(modulo)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-tenue">
            Actividad
          </dt>
          <dd className="mt-1 text-texto">{modulo.actividad}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <AccionesModulo modulo={modulo} onCambiarEstado={onCambiarEstado} />
      </div>
    </article>
  );
}

function AccionesModulo({
  modulo,
  onCambiarEstado,
}: {
  modulo: ModuloListado;
  onCambiarEstado: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/gestor/modulos/${modulo.id}`}
        className="inline-flex min-h-9 items-center rounded-lg border border-primario px-3 py-1.5 text-sm font-semibold text-primario hover:bg-primario-suave"
      >
        Ver ficha
      </Link>
      <Link
        href={`/gestor/modulos/${modulo.id}/editar`}
        className="inline-flex min-h-9 items-center rounded-lg border border-borde px-3 py-1.5 text-sm font-semibold text-texto hover:bg-slate-100"
      >
        Editar
      </Link>
      <Boton
        variante={modulo.estado === "activo" ? "peligro" : "contorno"}
        tamano="sm"
        onClick={onCambiarEstado}
      >
        {modulo.estado === "activo" ? "Dar de baja" : "Reactivar"}
      </Boton>
    </div>
  );
}
