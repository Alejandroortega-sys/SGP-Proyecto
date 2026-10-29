"use client";

import { useCallback, useEffect, useState } from "react";
import { cerrarSesion, comoApiError, obtenerSesion } from "@/lib/api-client";
import {
  haySesion,
  limpiarSesion,
  obtenerUsuario,
} from "@/lib/sesion";
import type { UsuarioSesion } from "@/types/api";

export function useSesion() {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    const pendiente = haySesion() ? obtenerSesion() : Promise.resolve(null);

    pendiente
      .then(
        (usuarioRemoto) => {
          if (activo) setUsuario(usuarioRemoto);
        },
        (error) => {
          if (!activo) return;
          const apiError = comoApiError(error);
          if (apiError.status === 401 || apiError.status === 403) {
            limpiarSesion();
            setUsuario(null);
            return;
          }
          // Error de red o petición abortada: conservamos la sesión local y
          // el usuario guardado; el backend seguirá validando cada petición.
          setUsuario(obtenerUsuario());
        },
      )
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  const salir = useCallback(async () => {
    await cerrarSesion();
    setUsuario(null);
  }, []);

  return { usuario, cargando, salir };
}
