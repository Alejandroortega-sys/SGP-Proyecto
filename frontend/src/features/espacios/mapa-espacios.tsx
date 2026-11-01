"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { Cargando } from "@/components/ui/estado-vacio";

/**
 * Leaflet usa `window` al importarse, por eso el mapa se carga solo en el
 * cliente. El componente que usa `next/dynamic` con `ssr: false` debe ser a su
 * vez un Client Component.
 */
const MapaEspaciosLeaflet = dynamic(
  () =>
    import("./mapa-espacios-leaflet").then(
      (modulo) => modulo.MapaEspaciosLeaflet,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] w-full items-center justify-center rounded-xl border border-borde bg-slate-200">
        <div className="rounded-xl border border-borde bg-superficie px-6 py-4 shadow-sm">
          <Cargando texto="Preparando el mapa de espacios…" />
        </div>
      </div>
    ),
  },
);

export function MapaEspacios(
  props: ComponentProps<typeof MapaEspaciosLeaflet>,
) {
  return <MapaEspaciosLeaflet {...props} />;
}
