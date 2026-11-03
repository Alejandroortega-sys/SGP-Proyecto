"use client";

import dynamic from "next/dynamic";
import { Cargando } from "@/components/ui/estado-vacio";
import type { MapaHistorialZonaProps } from "./mapa-historial-zona";

/**
 * Leaflet usa `window` al importarse, por eso el mapa de historial se carga
 * solo en el cliente mediante `next/dynamic` con `ssr: false`.
 */
const MapaHistorialZona = dynamic(
  () =>
    import("./mapa-historial-zona").then(
      (modulo) => modulo.MapaHistorialZona,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[320px] w-full items-center justify-center rounded-xl bg-slate-200 sm:h-[380px]">
        <div className="rounded-xl border border-borde bg-superficie px-6 py-4 shadow-sm">
          <Cargando texto="Preparando el mapa del historial…" />
        </div>
      </div>
    ),
  },
);

export function MapaHistorialZonaCarga(props: MapaHistorialZonaProps) {
  return <MapaHistorialZona {...props} />;
}
