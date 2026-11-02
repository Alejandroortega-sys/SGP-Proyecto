"use client";

import dynamic from "next/dynamic";
import { Cargando } from "@/components/ui/estado-vacio";
import type { MapaEditorZonaProps } from "./mapa-editor-zona";

/**
 * Leaflet usa `window` al importarse, por eso el editor se carga solo en el
 * cliente. El componente que usa `next/dynamic` con `ssr: false` debe ser a su
 * vez un Client Component (regla de Next.js 16).
 */
const MapaEditorZona = dynamic(
  () =>
    import("./mapa-editor-zona").then((modulo) => modulo.MapaEditorZona),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] w-full items-center justify-center rounded-xl bg-slate-200 sm:h-[520px]">
        <div className="rounded-xl border border-borde bg-superficie px-6 py-4 shadow-sm">
          <Cargando texto="Preparando el editor del mapa…" />
        </div>
      </div>
    ),
  },
);

export function MapaEditorZonaCarga(props: MapaEditorZonaProps) {
  return <MapaEditorZona {...props} />;
}
