"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { CENTRO_TULUA, estiloZona } from "@/features/mapa/estilos-zona";
import type { GeometriaPoligono, TipoZona } from "@/types/api";

const ZOOM_INICIAL = 15;
const ZOOM_MINIMO = 11;
const ZOOM_MAXIMO = 19;

export interface MapaHistorialZonaProps {
  geometria: GeometriaPoligono;
  geometriaAnterior: GeometriaPoligono | null;
  tipo: TipoZona;
}

function aLeaflet(geometria: GeometriaPoligono): L.LatLngTuple[][] {
  return geometria.coordinates.map((anillo) =>
    anillo.map(([lng, lat]) => [lat, lng] as L.LatLngTuple),
  );
}

/** Mapa de solo lectura para comparar la versión seleccionada con la anterior. */
export function MapaHistorialZona({
  geometria,
  geometriaAnterior,
  tipo,
}: MapaHistorialZonaProps) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const capaAnteriorRef = useRef<L.LayerGroup | null>(null);
  const capaActualRef = useRef<L.LayerGroup | null>(null);
  const vistaAjustadaRef = useRef<string | null>(null);

  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor || mapaRef.current) return;

    const mapa = L.map(contenedor, {
      center: [CENTRO_TULUA.lat, CENTRO_TULUA.lng],
      zoom: ZOOM_INICIAL,
      minZoom: ZOOM_MINIMO,
      maxZoom: ZOOM_MAXIMO,
      zoomControl: false,
      zoomSnap: 1,
      zoomDelta: 1,
      doubleClickZoom: false,
      boxZoom: false,
      dragging: true,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: ZOOM_MAXIMO,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(mapa);

    L.control
      .zoom({
        position: "bottomright",
        zoomInTitle: "Acercar",
        zoomOutTitle: "Alejar",
      })
      .addTo(mapa);
    mapa.attributionControl.setPrefix(false);

    const capaAnterior = L.layerGroup().addTo(mapa);
    const capaActual = L.layerGroup().addTo(mapa);
    mapaRef.current = mapa;
    capaAnteriorRef.current = capaAnterior;
    capaActualRef.current = capaActual;

    const temporizador = setTimeout(() => mapa.invalidateSize(), 0);

    return () => {
      clearTimeout(temporizador);
      mapa.remove();
      mapaRef.current = null;
      capaAnteriorRef.current = null;
      capaActualRef.current = null;
    };
  }, []);

  useEffect(() => {
    const capaAnterior = capaAnteriorRef.current;
    const capaActual = capaActualRef.current;
    const mapa = mapaRef.current;
    if (!capaAnterior || !capaActual || !mapa) return;

    capaAnterior.clearLayers();
    capaActual.clearLayers();

    if (geometriaAnterior) {
      L.polygon(aLeaflet(geometriaAnterior), {
        color: "#64748b",
        weight: 2,
        dashArray: "6 6",
        fill: false,
        interactive: false,
      }).addTo(capaAnterior);
    }

    const estilo = estiloZona(tipo);
    const poligono = L.polygon(aLeaflet(geometria), {
      ...estilo,
      weight: 3,
      fillOpacity: 0.24,
      interactive: false,
    }).addTo(capaActual);

    const clave = JSON.stringify(geometria.coordinates);
    if (vistaAjustadaRef.current !== clave) {
      const limites = poligono.getBounds();
      if (limites.isValid()) {
        mapa.fitBounds(limites.pad(0.35), { maxZoom: 18 });
      }
      vistaAjustadaRef.current = clave;
    }
  }, [geometria, geometriaAnterior, tipo]);

  return (
    <div className="sgp-mapa relative overflow-hidden rounded-xl border border-borde bg-slate-200">
      <div
        ref={contenedorRef}
        className="h-[320px] w-full sm:h-[380px]"
        role="application"
        aria-label="Mapa de comparación de versiones de la zona"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-3">
        <div className="pointer-events-auto max-w-xs rounded-lg border border-borde bg-superficie/95 px-3 py-2 shadow-sm backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-wide text-primario">
            Comparación de geometría
          </p>
          <p className="mt-1 text-xs leading-relaxed text-texto">
            Línea sólida: versión seleccionada.
            {geometriaAnterior
              ? " Línea discontinua: versión anterior."
              : " No hay una versión anterior en esta página."}
          </p>
        </div>
      </div>
    </div>
  );
}
