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
import { listarOrganizaciones } from "@/lib/api-client";
import { formatearFecha, nombreCompleto } from "@/lib/formato";
import type {
  EstadoOrganizacion,
  FiltrosOrganizaciones,
} from "@/types/api";

export function ListaOrganizaciones() {
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<EstadoOrganizacion | "">("");
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState<FiltrosOrganizaciones>({});

  const { datos, cargando, error, recargar } = useConsultaApi(
    () => listarOrganizaciones({ ...filtros, pagina, limite: 20 }),
    [filtros, pagina],
  );

  function aplicar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setPagina(1);
    setFiltros({
      busqueda: busqueda.trim() || undefined,
      estado: estado || undefined,
    });
  }

  function limpiar() {
    setBusqueda("");
    setEstado("");
    setPagina(1);
    setFiltros({});
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
          Organizaciones
        </h1>
        <p className="mt-2 text-base text-texto">
          Revisa las organizaciones registradas por los organizadores y su estado
          de validación.
        </p>
      </div>

      <Tarjeta className="p-4 sm:p-5">
        <form onSubmit={aplicar} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Campo
            etiqueta="Buscar"
            placeholder="Organización, NIT, representante o correo…"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
          />
          <Selector
            etiqueta="Estado"
            value={estado}
            onChange={(evento) =>
              setEstado(evento.target.value as EstadoOrganizacion | "")
            }
          >
            <option value="">Todos</option>
            <option value="pendiente_validacion">Pendiente de validación</option>
            <option value="activa">Activa</option>
            <option value="suspendida">Suspendida</option>
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
            titulo="No hay organizaciones que coincidan"
            descripcion="Solo aparecen los organizadores que ya registraron su organización."
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
                  <Th>Organización</Th>
                  <Th>NIT</Th>
                  <Th>Representante</Th>
                  <Th>Organizador</Th>
                  <Th>Estado</Th>
                  <Th>Registro</Th>
                  <Th>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {datos.datos.map((organizacion) => (
                  <tr key={organizacion.usuarioId} className="hover:bg-fondo">
                    <Td>
                      <p className="font-semibold text-titulo">
                        {organizacion.nombreOrganizacion}
                      </p>
                      <p className="text-xs text-tenue">{organizacion.tipoFeria}</p>
                    </Td>
                    <Td>{organizacion.nit}</Td>
                    <Td>{organizacion.representante}</Td>
                    <Td>
                      <p className="font-medium text-titulo">
                        {nombreCompleto(organizacion.nombre, organizacion.apellido)}
                      </p>
                      <p className="text-xs text-tenue">{organizacion.correo}</p>
                      <p className="text-xs text-tenue">{organizacion.telefono}</p>
                    </Td>
                    <Td>
                      <EtiquetaEstado estado={organizacion.estado} />
                    </Td>
                    <Td>{formatearFecha(organizacion.creadoEn)}</Td>
                    <Td>
                      <Link
                        href={`/gestor/organizaciones/${organizacion.usuarioId}`}
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
