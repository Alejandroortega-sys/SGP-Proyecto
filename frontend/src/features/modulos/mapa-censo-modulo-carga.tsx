"use client";

import dynamic from "next/dynamic";
import { Cargando } from "@/components/ui/estado-vacio";
import type { MapaCensoModuloProps } from "./mapa-censo-modulo";

/**
 * Leaflet usa `window` al importarse; este componente carga el mapa solo en el
 * cliente. El contenedor debe ser Client Component por la regla de Next.js 16.
 */
const MapaCensoModulo = dynamic(
  () => import("./mapa-censo-modulo").then((modulo) => modulo.MapaCensoModulo),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] w-full items-center justify-center rounded-xl bg-slate-200 sm:h-[480px]">
        <div className="rounded-xl border border-borde bg-superficie px-6 py-4 shadow-sm">
          <Cargando texto="Preparando el mapa del censo…" />
        </div>
      </div>
    ),
  },
);

export function MapaCensoModuloCarga(props: MapaCensoModuloProps) {
  return <MapaCensoModulo {...props} />;
}
