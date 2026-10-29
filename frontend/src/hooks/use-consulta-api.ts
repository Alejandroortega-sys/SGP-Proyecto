"use client";

/* eslint-disable react-hooks/set-state-in-effect -- sincroniza el estado de la consulta con el ciclo de vida del efecto */
import { useEffect, useState, type DependencyList } from "react";
import { comoApiError, type ApiError } from "@/lib/api-client";

interface EstadoConsulta<T> {
  datos: T | null;
  cargando: boolean;
  error: ApiError | null;
}

/**
 * Ejecuta una consulta a la API y expone los estados de carga, error y éxito.
 * `recargar` vuelve a lanzar la consulta (por ejemplo, tras una mutación).
 */
export function useConsultaApi<T>(
  consultar: () => Promise<T>,
  dependencias: DependencyList,
) {
  const [estado, setEstado] = useState<EstadoConsulta<T>>({
    datos: null,
    cargando: true,
    error: null,
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let activo = true;
    setEstado((actual) => ({ ...actual, cargando: true, error: null }));

    consultar()
      .then((datos) => {
        if (activo) setEstado({ datos, cargando: false, error: null });
      })
      .catch((capturado) => {
        if (activo) {
          setEstado({ datos: null, cargando: false, error: comoApiError(capturado) });
        }
      });

    return () => {
      activo = false;
    };
    // Las dependencias las define quien llama; `consultar` se recrea en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencias, version]);

  return {
    ...estado,
    recargar: () => setVersion((valor) => valor + 1),
  };
}
