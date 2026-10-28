"use client";

import { useCallback, useEffect, useState } from "react";
import { cerrarSesion, obtenerSesion } from "@/lib/api-client";
import { haySesion, limpiarSesion } from "@/lib/sesion";
import type { UsuarioSesion } from "@/types/api";

export function useSesion() {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    const pendiente = haySesion() ? obtenerSesion() : Promise.resolve(null);

    pendiente.then(
      (usuarioRemoto) => {
        if (activo) setUsuario(usuarioRemoto);
      },
      () => {
        if (activo) {
          limpiarSesion();
          setUsuario(null);
        }
      },
    ).finally(() => {
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
