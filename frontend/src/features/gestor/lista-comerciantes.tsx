"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Campo, Selector } from "@/components/ui/campo";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import { EtiquetaEstado } from "@/components/ui/etiqueta";
import { Paginacion } from "@/components/ui/paginacion";
import { Tabla, Td, Th } from "@/components/ui/tabla";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import { listarComerciantes } from "@/lib/api-client";
import {
  formatearFecha,
  nombreCompleto,
  textoCategoria,
} from "@/lib/formato";
import type {
  CategoriaComercio,
  EstadoUsuario,
  FiltrosComerciantes,
} from "@/types/api";

export function ListaComerciantes() {
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<EstadoUsuario | "">("");
  const [categoria, setCategoria] = useState<CategoriaComercio | "">("");
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState<FiltrosComerciantes>({});

  const { datos, cargando, error, recargar } = useConsultaApi(
    () => listarComerciantes({ ...filtros, pagina, limite: 20 }),
    [filtros, pagina],
  );

  function aplicar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setPagina(1);
    setFiltros({
      busqueda: busqueda.trim() || undefined,
      estado: estado || undefined,
      categoria: categoria || undefined,
    });
  }

  function limpiar() {
    setBusqueda("");
    setEstado("");
    setCategoria("");
    setPagina(1);
    setFiltros({});
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
          Comerciantes
        </h1>
        <p className="mt-2 text-base text-texto">
          Consulta los comerciantes registrados, su actividad y el número de
          solicitudes y permisos.
        </p>
      </div>

      <Tarjeta className="p-4 sm:p-5">
        <form onSubmit={aplicar} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Campo
            etiqueta="Buscar"
            placeholder="Nombre, correo, documento o actividad…"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
          />
          <Selector
            etiqueta="Estado"
            value={estado}
            onChange={(evento) =>
              setEstado(evento.target.value as EstadoUsuario | "")
            }
          >
            <option value="">Todos</option>
            <option value="pendiente_activacion">Pendiente de activación</option>
            <option value="activa">Activa</option>
            <option value="suspendida">Suspendida</option>
            <option value="inactiva">Inactiva</option>
          </Selector>
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
          <div className="flex items-end gap-2 xl:col-span-2">
            <Boton type="submit" className="flex-1">
              Filtrar
            </Boton>
            <Boton variante="fantasma" onClick={limpiar}>
              Limpiar
            </Boton>
          </div>
        </form>
      </Tarjeta>

      <Tarjeta>
        {cargando ? (
          <Cargando />
        ) : error ? (
          <div className="p-4">
            <BloqueError error={error} onReintentar={recargar} />
          </div>
        ) : !datos || datos.datos.length === 0 ? (
          <EstadoVacio
            titulo="No hay comerciantes que coincidan"
            descripcion="Prueba con otro término de búsqueda o limpia los filtros."
            accion={
              <Boton variante="contorno" onClick={limpiar}>
                Limpiar filtros
              </Boton>
            }
          />
        ) : (
          <>
            <Tabla>
              <thead>
                <tr>
                  <Th>Comerciante</Th>
                  <Th>Documento</Th>
                  <Th>Estado</Th>
                  <Th>Categoría</Th>
                  <Th>Actividad</Th>
                  <Th>Solicitudes</Th>
                  <Th>Permisos</Th>
                  <Th>Registro</Th>
                  <Th>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {datos.datos.map((comerciante) => (
                  <tr key={comerciante.id} className="hover:bg-fondo">
                    <Td>
                      <p className="font-semibold text-titulo">
                        {nombreCompleto(comerciante.nombre, comerciante.apellido)}
                      </p>
                      <p className="text-xs text-tenue">{comerciante.correo}</p>
                      <p className="text-xs text-tenue">{comerciante.telefono}</p>
                    </Td>
                    <Td>
                      {comerciante.tipoDocumento ?? "—"}{" "}
                      {comerciante.documento ?? ""}
                    </Td>
                    <Td>
                      <EtiquetaEstado estado={comerciante.estado} />
                    </Td>
                    <Td>{textoCategoria(comerciante.categoria)}</Td>
                    <Td className="max-w-56">{comerciante.actividadComercial ?? "—"}</Td>
                    <Td>{comerciante.totalSolicitudes}</Td>
                    <Td>{comerciante.totalPermisos}</Td>
                    <Td>{formatearFecha(comerciante.creadoEn)}</Td>
                    <Td>
                      <Link
                        href={`/gestor/usuarios/${comerciante.id}`}
                        className="font-semibold text-primario hover:underline"
                      >
                        Ver detalle
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
            <Paginacion
              pagina={datos.paginacion.pagina}
              totalPaginas={datos.paginacion.totalPaginas}
              onCambiar={setPagina}
            />
          </>
        )}
      </Tarjeta>
    </div>
  );
}
