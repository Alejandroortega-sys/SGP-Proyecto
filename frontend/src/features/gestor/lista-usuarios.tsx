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
import { useSesion } from "@/hooks/use-sesion";
import { listarUsuarios } from "@/lib/api-client";
import { formatearFecha, nombreCompleto, textoPerfil, textoRol } from "@/lib/formato";
import type {
  EstadoUsuario,
  FiltrosUsuarios,
  PerfilGestor,
  RolUsuario,
} from "@/types/api";

export function ListaUsuarios() {
  const { usuario } = useSesion();
  const esAdministrador = usuario?.perfil === "administrador";

  const [busqueda, setBusqueda] = useState("");
  const [rol, setRol] = useState<RolUsuario | "">("");
  const [estado, setEstado] = useState<EstadoUsuario | "">("");
  const [perfil, setPerfil] = useState<PerfilGestor | "">("");
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState<FiltrosUsuarios>({});

  const { datos, cargando, error, recargar } = useConsultaApi(
    () => listarUsuarios({ ...filtros, pagina, limite: 20 }),
    [filtros, pagina],
  );

  function aplicar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setPagina(1);
    setFiltros({
      busqueda: busqueda.trim() || undefined,
      rol: rol || undefined,
      estado: estado || undefined,
      perfil: perfil || undefined,
    });
  }

  function limpiar() {
    setBusqueda("");
    setRol("");
    setEstado("");
    setPerfil("");
    setPagina(1);
    setFiltros({});
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
            Cuentas de usuario
          </h1>
          <p className="mt-2 text-base text-texto">
            {esAdministrador
              ? "Consulta y filtra todas las cuentas de la plataforma."
              : "Como revisor puedes consultar comerciantes y organizadores."}
          </p>
        </div>
        {esAdministrador ? (
          <Link
            href="/gestor/gestores/nuevo"
            className="inline-flex min-h-11 items-center rounded-lg bg-primario px-4 py-2.5 text-sm font-semibold text-white hover:bg-primario-hover"
          >
            Crear gestor
          </Link>
        ) : null}
      </div>

      <Tarjeta className="p-4 sm:p-5">
        <form onSubmit={aplicar} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Campo
            etiqueta="Buscar"
            placeholder="Nombre, correo, documento…"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
          />
          <Selector
            etiqueta="Rol"
            value={rol}
            onChange={(evento) => setRol(evento.target.value as RolUsuario | "")}
          >
            <option value="">Todos</option>
            <option value="comerciante">Comerciante</option>
            <option value="organizador">Organizador</option>
            {esAdministrador ? <option value="gestor">Gestor</option> : null}
          </Selector>
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
          {esAdministrador ? (
            <Selector
              etiqueta="Perfil de gestor"
              value={perfil}
              onChange={(evento) =>
                setPerfil(evento.target.value as PerfilGestor | "")
              }
            >
              <option value="">Todos</option>
              <option value="revisor">Revisor</option>
              <option value="administrador">Administrador</option>
            </Selector>
          ) : null}
          <div className="flex items-end gap-2">
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
            titulo="No hay cuentas que coincidan"
            descripcion="Ajusta los filtros o limpia la búsqueda para ver más resultados."
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
                  <Th>Cuenta</Th>
                  <Th>Rol</Th>
                  <Th>Estado</Th>
                  <Th>Perfil</Th>
                  <Th>Detalle</Th>
                  <Th>Registro</Th>
                  <Th>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {datos.datos.map((cuenta) => (
                  <tr key={cuenta.id} className="hover:bg-fondo">
                    <Td>
                      <p className="font-semibold text-titulo">
                        {nombreCompleto(cuenta.nombre, cuenta.apellido)}
                      </p>
                      <p className="text-xs text-tenue">{cuenta.correo}</p>
                    </Td>
                    <Td>{textoRol(cuenta.rol)}</Td>
                    <Td>
                      <EtiquetaEstado estado={cuenta.estado} />
                    </Td>
                    <Td>{textoPerfil(cuenta.perfil)}</Td>
                    <Td className="max-w-56">
                      {cuenta.nombreOrganizacion ??
                        cuenta.actividadComercial ??
                        cuenta.documento ??
                        "—"}
                    </Td>
                    <Td>{formatearFecha(cuenta.creadoEn)}</Td>
                    <Td>
                      <Link
                        href={`/gestor/usuarios/${cuenta.id}`}
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
