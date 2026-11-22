/* eslint-disable react-hooks/set-state-in-effect -- sincroniza estado local con props y respuestas externas */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  comoApiError,
  liberarRevisionSolicitud,
  renovarRevisionSolicitud,
  tomarRevisionSolicitud,
  type ApiError,
} from "@/lib/api-client";
import { obtenerAccessToken } from "@/lib/sesion";
import type { BloqueoRevision, SolicitudRevisionDetalle } from "@/types/api";

const INTERVALO_LATIDO_MS = 60_000;

interface UseBloqueoRevisionOpciones {
  solicitudId: string;
  estadoInicial: SolicitudRevisionDetalle["estado"];
  onDetalle: (detalle: SolicitudRevisionDetalle) => void;
  onMensaje?: (mensaje: string | null) => void;
  onError?: (error: ApiError) => void;
}

/**
 * Toma el bloqueo de revisión al abrir el detalle, lo renueva mientras la
 * pantalla siga abierta y lo libera al salir.
 *
 * Cada toma genera un token de sesión. La liberación usa ese token para no
 * borrar el bloqueo que otra pestaña del mismo gestor acaba de tomar, por
 * ejemplo durante una recarga.
 */
export function useBloqueoRevision({
  solicitudId,
  estadoInicial,
  onDetalle,
  onMensaje,
  onError,
}: UseBloqueoRevisionOpciones) {
  const [bloqueo, setBloqueo] = useState<BloqueoRevision | null>(null);
  const [tomando, setTomando] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const obtuvoBloqueoRef = useRef(false);
  const bloqueoRef = useRef<BloqueoRevision | null>(null);
  const tokenRef = useRef<string | null>(null);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activoRef = useRef(true);
  const onDetalleRef = useRef(onDetalle);
  const onMensajeRef = useRef(onMensaje);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onDetalleRef.current = onDetalle;
    onMensajeRef.current = onMensaje;
    onErrorRef.current = onError;
  }, [onDetalle, onMensaje, onError]);

  const detenerLatido = useCallback(() => {
    if (!intervaloRef.current) return;
    clearInterval(intervaloRef.current);
    intervaloRef.current = null;
  }, []);

  const liberar = useCallback(
    (mantenerVivo = false) => {
      detenerLatido();
      if (!obtuvoBloqueoRef.current) return;
      obtuvoBloqueoRef.current = false;
      bloqueoRef.current = null;
      const token = tokenRef.current;
      tokenRef.current = null;
      if (mantenerVivo) {
        liberarConKeepalive(solicitudId, token);
        return;
      }
      void liberarRevisionSolicitud(solicitudId, token ?? undefined).catch(
        () => {
          // Si la petición falla, el bloqueo expirará por inactividad.
        },
      );
    },
    [detenerLatido, solicitudId],
  );

  const tomarYLatir = useCallback(async () => {
    if (!activoRef.current) return;
    detenerLatido();
    setTomando(true);
    setError(null);

    try {
      const respuesta = await tomarRevisionSolicitud(solicitudId);
      if (!activoRef.current) return;
      obtuvoBloqueoRef.current = true;
      bloqueoRef.current = respuesta.bloqueo;
      tokenRef.current = respuesta.tokenBloqueo;
      setBloqueo(respuesta.bloqueo);
      onMensajeRef.current?.(respuesta.mensaje);
      onDetalleRef.current(respuesta.detalle);

      intervaloRef.current = setInterval(() => {
        renovarRevisionSolicitud(solicitudId)
          .then((renovado) => {
            const actual = bloqueoRef.current;
            if (!actual || !activoRef.current) return;
            const siguiente = { ...actual, expiraEn: renovado.expiraEn };
            bloqueoRef.current = siguiente;
            setBloqueo(siguiente);
          })
          .catch((capturado) => {
            const fallo = comoApiError(capturado);
            setError(fallo);
            detenerLatido();
            obtuvoBloqueoRef.current = false;
            bloqueoRef.current = null;
            tokenRef.current = null;
            setBloqueo(null);
          });
      }, INTERVALO_LATIDO_MS);
    } catch (capturado) {
      if (!activoRef.current) return;
      const fallo = comoApiError(capturado);
      setError(fallo);
      onErrorRef.current?.(fallo);
    } finally {
      if (activoRef.current) setTomando(false);
    }
  }, [detenerLatido, solicitudId]);

  useEffect(() => {
    if (estadoInicial !== "radicada" && estadoInicial !== "en_revision") {
      return;
    }
    activoRef.current = true;
    void tomarYLatir();

    const alCerrar = () => {
      if (obtuvoBloqueoRef.current) {
        liberarConKeepalive(solicitudId, tokenRef.current);
      }
      obtuvoBloqueoRef.current = false;
    };
    window.addEventListener("pagehide", alCerrar);

    return () => {
      activoRef.current = false;
      detenerLatido();
      window.removeEventListener("pagehide", alCerrar);
      if (obtuvoBloqueoRef.current) {
        obtuvoBloqueoRef.current = false;
        bloqueoRef.current = null;
        const token = tokenRef.current;
        tokenRef.current = null;
        void liberarRevisionSolicitud(solicitudId, token ?? undefined).catch(
          () => {
            // El bloqueo expirará por inactividad.
          },
        );
      }
    };
    // El componente que usa el hook se monta cuando el detalle ya está
    // cargado; por eso el estado inicial no vuelve a disparar la toma del
    // bloqueo después de la transición a «En revisión».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitudId]);

  return {
    bloqueo,
    tomando,
    error,
    liberar,
    reintentar: tomarYLatir,
    limpiarError: () => setError(null),
  };
}

/** Libera el bloqueo con una petición que sobrevive al cierre de la pestaña. */
function liberarConKeepalive(
  solicitudId: string,
  token: string | null,
): void {
  const accessToken = obtenerAccessToken();
  if (!accessToken) return;
  const base = (
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
  ).replace(/\/+$/, "");
  const consulta = token ? `?token=${encodeURIComponent(token)}` : "";
  void fetch(`${base}/gestor/solicitudes/${solicitudId}/revision${consulta}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    keepalive: true,
  }).catch(() => {
    // Sin conexión no se puede liberar; el bloqueo expira por inactividad.
  });
}
