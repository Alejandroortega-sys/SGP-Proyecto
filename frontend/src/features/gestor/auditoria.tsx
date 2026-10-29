"use client";

import { useState, type FormEvent } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Campo, Selector } from "@/components/ui/campo";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Paginacion } from "@/components/ui/paginacion";
import { Tabla, Td, Th } from "@/components/ui/tabla";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import { useSesion } from "@/hooks/use-sesion";
import { listarAuditoria } from "@/lib/api-client";
import {
  formatearFechaHora,
  nombreCompleto,
  resumirValor,
  textoAccion,
} from "@/lib/formato";
import type { AccionAuditoria, FiltrosAuditoria } from "@/types/api";

export function Auditoria() {
  const { usuario } = useSesion();
  const esAdministrador = usuario?.perfil === "administrador";

  const [tabla, setTabla] = useState("");
  const [registroId, setRegistroId] = useState("");
  const [accion, setAccion] = useState<AccionAuditoria | "">("");
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState<FiltrosAuditoria>({});

  const { datos, cargando, error, recargar } = useConsultaApi(
    () => listarAuditoria({ ...filtros, pagina, limite: 20 }),
    [filtros, pagina],
  );

  if (!esAdministrador) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-extrabold text-titulo">Auditoría</h1>
        <Alerta tono="error">
          Solo un gestor con perfil administrador puede consultar la auditoría del
          sistema.
        </Alerta>
      </div>
    );
  }

  function aplicar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setPagina(1);
    setFiltros({
      tabla: tabla.trim() || undefined,
      registroId: registroId.trim() || undefined,
      accion: accion || undefined,
    });
  }

  function limpiar() {
    setTabla("");
    setRegistroId("");
    setAccion("");
    setPagina(1);
    setFiltros({});
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">Auditoría</h1>
        <p className="mt-2 text-base text-texto">
          Consulta los cambios registrados. Los campos sensibles se eliminan antes
          de mostrarse.
        </p>
      </div>

      <Tarjeta className="p-4 sm:p-5">
        <form onSubmit={aplicar} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Campo
            etiqueta="Tabla"
            placeholder="usuarios, comerciantes…"
            value={tabla}
            onChange={(evento) => setTabla(evento.target.value)}
          />
          <Campo
            etiqueta="ID del registro"
            inputMode="numeric"
            placeholder="5"
            value={registroId}
            onChange={(evento) => setRegistroId(evento.target.value)}
          />
          <Selector
            etiqueta="Acción"
            value={accion}
            onChange={(evento) =>
              setAccion(evento.target.value as AccionAuditoria | "")
            }
          >
            <option value="">Todas</option>
            <option value="insert">Creación</option>
            <option value="update">Actualización</option>
            <option value="delete">Eliminación</option>
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
            titulo="Sin registros de auditoría"
            descripcion="No hay cambios que coincidan con los filtros aplicados."
          />
        ) : (
          <>
            <Tabla>
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Tabla</Th>
                  <Th>Registro</Th>
                  <Th>Acción</Th>
                  <Th>Actor</Th>
                  <Th>Cambio</Th>
                </tr>
              </thead>
              <tbody>
                {datos.datos.map((item) => (
                  <tr key={item.id} className="hover:bg-fondo">
                    <Td className="whitespace-nowrap">
                      {formatearFechaHora(item.creadoEn)}
                    </Td>
                    <Td className="font-medium text-titulo">{item.tabla}</Td>
                    <Td>{item.registroId}</Td>
                    <Td>
                      <Etiqueta
                        tono={
                          item.accion === "insert"
                            ? "exitoso"
                            : item.accion === "delete"
                              ? "peligro"
                              : "pendiente"
                        }
                      >
                        {textoAccion(item.accion)}
                      </Etiqueta>
                    </Td>
                    <Td>
                      {item.actor ? (
                        <>
                          <p className="font-medium text-titulo">
                            {nombreCompleto(item.actor.nombre, item.actor.apellido)}
                          </p>
                          <p className="text-xs text-tenue">{item.actor.correo}</p>
                        </>
                      ) : (
                        "Sistema"
                      )}
                    </Td>
                    <Td className="max-w-md">
                      <details>
                        <summary className="cursor-pointer text-xs font-semibold text-primario">
                          Ver valores
                        </summary>
                        <div className="mt-2 grid gap-2 text-xs">
                          <p className="font-semibold text-titulo">Anterior</p>
                          <pre className="overflow-x-auto rounded bg-fondo p-2 whitespace-pre-wrap">
                            {resumirValor(item.valorAnterior, 400)}
                          </pre>
                          <p className="font-semibold text-titulo">Nuevo</p>
                          <pre className="overflow-x-auto rounded bg-fondo p-2 whitespace-pre-wrap">
                            {resumirValor(item.valorNuevo, 400)}
                          </pre>
                        </div>
                      </details>
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
