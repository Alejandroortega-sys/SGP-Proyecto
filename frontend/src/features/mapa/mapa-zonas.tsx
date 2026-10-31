"use client";

import dynamic from "next/dynamic";
import { Cargando } from "@/components/ui/estado-vacio";

/**
 * Leaflet usa `window` al importarse, por eso el mapa se carga solo en el
 * cliente. El componente que usa `next/dynamic` con `ssr: false` debe ser a su
 * vez un Client Component (regla de Next.js 16).
 */
const MapaLeaflet = dynamic(
  () => import("./mapa-leaflet").then((modulo) => modulo.MapaLeaflet),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[520px] w-full items-center justify-center bg-slate-200">
        <div className="rounded-xl border border-borde bg-superficie px-6 py-4 shadow-sm">
          <Cargando texto="Preparando el mapa de Tuluá…" />
        </div>
      </div>
    ),
  },
);

export function MapaZonas() {
  return <MapaLeaflet />;
}
