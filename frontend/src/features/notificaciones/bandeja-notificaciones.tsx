"use client";

import { useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Selector } from "@/components/ui/campo";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Paginacion } from "@/components/ui/paginacion";
import { Tarjeta, TarjetaCuerpo } from "@/components/ui/tarjeta";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import {
  comoApiError,
  listarNotificaciones,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
  type ApiError,
} from "@/lib/api-client";
import { formatearFechaHora } from "@/lib/formato";

export function BandejaNotificaciones() {
  const [filtroLeida, setFiltroLeida] = useState<"" | "true" | "false">("");
  const [pagina, setPagina] = useState(1);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<ApiError | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const { datos, cargando, error, recargar } = useConsultaApi(
    () =>
      listarNotificaciones({
        ...(filtroLeida === "" ? {} : { leida: filtroLeida === "true" }),
        pagina,
        limite: 20,
      }),
    [filtroLeida, pagina],
  );

  async function marcarUna(id: string) {
    if (procesando) return;
    setProcesando(id);
    setErrorAccion(null);
    setExito(null);
    try {
      await marcarNotificacionLeida(id);
      recargar();
    } catch (capturado) {
      setErrorAccion(comoApiError(capturado));
    } finally {
      setProcesando(null);
    }
  }

  async function marcarTodas() {
    if (procesando) return;
    setProcesando("todas");
    setErrorAccion(null);
    setExito(null);
    try {
      const respuesta = await marcarTodasNotificacionesLeidas();
      setExito(respuesta.mensaje);
      recargar();
    } catch (capturado) {
      setErrorAccion(comoApiError(capturado));
    } finally {
      setProcesando(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
            Notificaciones
          </h1>
          <p className="mt-2 text-base text-texto">
            {datos ? `${datos.noLeidas} sin leer` : "Bandeja de notificaciones"}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Selector
            etiqueta="Mostrar"
            value={filtroLeida}
            onChange={(evento) => {
              setFiltroLeida(evento.target.value as "" | "true" | "false");
              setPagina(1);
            }}
          >
            <option value="">Todas</option>
            <option value="false">No leídas</option>
            <option value="true">Leídas</option>
          </Selector>
          <Boton
            variante="contorno"
            onClick={marcarTodas}
            cargando={procesando === "todas"}
            disabled={!datos || datos.noLeidas === 0}
          >
            Marcar todas como leídas
          </Boton>
        </div>
      </div>

      {exito ? <Alerta tono="exito">{exito}</Alerta> : null}
      {errorAccion ? <Alerta tono="error">{errorAccion.mensaje}</Alerta> : null}

      {cargando ? (
        <Cargando />
      ) : error ? (
        <BloqueError error={error} onReintentar={recargar} />
      ) : !datos || datos.datos.length === 0 ? (
        <Tarjeta>
          <EstadoVacio
            titulo="No tienes notificaciones"
            descripcion="Cuando ocurra un cambio importante en tu cuenta, aparecerá aquí."
          />
        </Tarjeta>
      ) : (
        <div className="flex flex-col gap-3">
          {datos.datos.map((notificacion) => (
            <Tarjeta
              key={notificacion.id}
              className={notificacion.leida ? "opacity-80" : "border-l-4 border-l-primario"}
            >
              <TarjetaCuerpo className="flex flex-col gap-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-titulo">
                      {notificacion.asunto}
                    </h2>
                    <p className="mt-1 text-xs text-tenue">
                      {formatearFechaHora(notificacion.creadaEn)} ·{" "}
                      {notificacion.canal === "app" ? "Aplicación" : notificacion.canal}
                    </p>
                  </div>
                  <Etiqueta tono={notificacion.leida ? "neutro" : "pendiente"}>
                    {notificacion.leida ? "Leída" : "No leída"}
                  </Etiqueta>
                </div>
                {notificacion.cuerpo ? (
                  <p className="text-sm leading-relaxed text-texto">
                    {notificacion.cuerpo}
                  </p>
                ) : null}
                {!notificacion.leida ? (
                  <div>
                    <Boton
                      variante="fantasma"
                      tamano="sm"
                      onClick={() => marcarUna(notificacion.id)}
                      cargando={procesando === notificacion.id}
                    >
                      Marcar como leída
                    </Boton>
                  </div>
                ) : null}
              </TarjetaCuerpo>
            </Tarjeta>
          ))}
          <Paginacion
            pagina={datos.paginacion.pagina}
            totalPaginas={datos.paginacion.totalPaginas}
            onCambiar={setPagina}
          />
        </div>
      )}
    </div>
  );
}
