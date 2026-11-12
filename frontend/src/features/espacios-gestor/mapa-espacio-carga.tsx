"use client";

import dynamic from "next/dynamic";
import { Cargando } from "@/components/ui/estado-vacio";
import type { MapaCensoModuloProps } from "@/features/modulos/mapa-censo-modulo";

const MapaEspacio = dynamic(
  () =>
    import("@/features/modulos/mapa-censo-modulo").then(
      (modulo) => modulo.MapaCensoModulo,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] w-full items-center justify-center rounded-xl bg-slate-200 sm:h-[480px]">
        <div className="rounded-xl border border-borde bg-superficie px-6 py-4 shadow-sm">
          <Cargando texto="Preparando el mapa del espacio…" />
        </div>
      </div>
    ),
  },
);

/** Mapa de selección de la ubicación de un espacio temporal. */
export function MapaEspacioCarga(props: MapaCensoModuloProps) {
  return (
    <MapaEspacio
      etiquetaMapa="Mapa para seleccionar la ubicación del espacio"
      tituloMarcador="Ubicación del espacio"
      ayuda="Haz clic en el mapa o arrastra el marcador para ubicar el espacio. La zona se detecta automáticamente."
      {...props}
    />
  );
}
