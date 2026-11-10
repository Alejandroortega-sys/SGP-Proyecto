"use client";

import dynamic from "next/dynamic";
import { Cargando } from "@/components/ui/estado-vacio";
import type { MapaPrevisualizacionProps } from "./mapa-previsualizacion";

const MapaPrevisualizacion = dynamic(
  () =>
    import("./mapa-previsualizacion").then(
      (modulo) => modulo.MapaPrevisualizacion,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] w-full items-center justify-center rounded-xl bg-slate-200 sm:h-[460px]">
        <div className="rounded-xl border border-borde bg-superficie px-6 py-4 shadow-sm">
          <Cargando texto="Preparando el mapa de previsualización…" />
        </div>
      </div>
    ),
  },
);

export function MapaPrevisualizacionCarga(props: MapaPrevisualizacionProps) {
  return <MapaPrevisualizacion {...props} />;
}
