"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { Boton } from "@/components/ui/boton";
import {
  CENTRO_TULUA,
  ETIQUETAS_TIPO,
  estiloZona,
} from "@/features/mapa/estilos-zona";
import type { TipoZona } from "@/types/api";
import type {
  ConflictoSolape,
  Punto,
  PoligonoZona,
} from "./geometria-zona";

const ZOOM_INICIAL = 15;
const ZOOM_MINIMO = 11;
const ZOOM_MAXIMO = 19;

export interface MapaEditorZonaProps {
  puntos: readonly Punto[];
  cerrado: boolean;
  tipo: TipoZona;
  zonas: readonly PoligonoZona[];
  zonaOriginal: readonly Punto[] | null;
  conflicto: ConflictoSolape | null;
  esEdicion: boolean;
  soloLectura: boolean;
  onAgregarPunto: (punto: Punto) => void;
  onMoverPunto: (indice: number, punto: Punto) => void;
  onQuitarPunto: (indice: number) => void;
  onDeshacer: () => void;
  onBorrar: () => void;
  onCerrar: () => void;
  onReabrir: () => void;
}

interface AccionesEditor {
  cerrado: boolean;
  soloLectura: boolean;
  onAgregarPunto: (punto: Punto) => void;
  onMoverPunto: (indice: number, punto: Punto) => void;
  onQuitarPunto: (indice: number) => void;
}

function aLeaflet(puntos: readonly Punto[]): L.LatLngTuple[] {
  return puntos.map(([lng, lat]) => [lat, lng] as L.LatLngTuple);
}

export function MapaEditorZona({
  puntos,
  cerrado,
  tipo,
  zonas,
  zonaOriginal,
  conflicto,
  esEdicion,
  soloLectura,
  onAgregarPunto,
  onMoverPunto,
  onQuitarPunto,
  onDeshacer,
  onBorrar,
  onCerrar,
  onReabrir,
}: MapaEditorZonaProps) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const capaZonasRef = useRef<L.LayerGroup | null>(null);
  const capaOriginalRef = useRef<L.LayerGroup | null>(null);
  const capaDibujoRef = useRef<L.LayerGroup | null>(null);
  const vistaAjustadaRef = useRef(false);

  const accionesRef = useRef<AccionesEditor>({
    cerrado,
    soloLectura,
    onAgregarPunto,
    onMoverPunto,
    onQuitarPunto,
  });

  useEffect(() => {
    accionesRef.current = {
      cerrado,
      soloLectura,
      onAgregarPunto,
      onMoverPunto,
      onQuitarPunto,
    };
  }, [
    cerrado,
    soloLectura,
    onAgregarPunto,
    onMoverPunto,
    onQuitarPunto,
  ]);

  // Inicializa el mapa una sola vez.
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

    const capaZonas = L.layerGroup().addTo(mapa);
    const capaOriginal = L.layerGroup().addTo(mapa);
    const capaDibujo = L.layerGroup().addTo(mapa);

    mapaRef.current = mapa;
    capaZonasRef.current = capaZonas;
    capaOriginalRef.current = capaOriginal;
    capaDibujoRef.current = capaDibujo;

    const alHacerClic = (evento: L.LeafletMouseEvent) => {
      const acciones = accionesRef.current;
      if (acciones.cerrado || acciones.soloLectura) return;
      acciones.onAgregarPunto([evento.latlng.lng, evento.latlng.lat]);
    };
    mapa.on("click", alHacerClic);

    // El contenedor puede terminar de dimensionarse después del montaje.
    const temporizador = setTimeout(() => mapa.invalidateSize(), 0);

    return () => {
      clearTimeout(temporizador);
      mapa.off("click", alHacerClic);
      mapa.remove();
      mapaRef.current = null;
      capaZonasRef.current = null;
      capaOriginalRef.current = null;
      capaDibujoRef.current = null;
    };
  }, []);

  // Zonas activas de contexto y resaltado de la zona en conflicto.
  useEffect(() => {
    const capa = capaZonasRef.current;
    if (!capa) return;
    capa.clearLayers();

    for (const zona of zonas) {
      const esConflicto = conflicto?.zonaId === zona.id;
      const estiloBase = estiloZona(zona.tipo);
      const poligono = L.polygon(
        zona.anillos.map((anillo) => aLeaflet(anillo)),
        {
          ...estiloBase,
          color: esConflicto ? "#b91c1c" : estiloBase.color,
          fillColor: esConflicto ? "#b91c1c" : estiloBase.fillColor,
          weight: esConflicto ? 3 : 1,
          fillOpacity: esConflicto ? 0.24 : 0.06,
          opacity: esConflicto ? 1 : 0.55,
          dashArray: esConflicto ? "4 4" : estiloBase.dashArray,
          interactive: false,
        },
      );

      if (esConflicto) {
        poligono.bindTooltip(`Conflicto: ${zona.nombre}`, {
          permanent: true,
          direction: "center",
          className: "sgp-tooltip-conflicto",
        });
      }

      poligono.addTo(capa);
    }
  }, [zonas, conflicto?.zonaId]);

  // Forma original de la zona durante la edición (vista previa del cambio).
  useEffect(() => {
    const capa = capaOriginalRef.current;
    if (!capa) return;
    capa.clearLayers();
    if (!zonaOriginal || zonaOriginal.length < 3) return;

    L.polygon(aLeaflet(zonaOriginal), {
      color: "#475569",
      weight: 2,
      dashArray: "6 6",
      fill: false,
      interactive: false,
    }).addTo(capa);
  }, [zonaOriginal]);

  // Dibujo actual y vértices editables.
  useEffect(() => {
    const capa = capaDibujoRef.current;
    if (!capa) return;
    capa.clearLayers();

    if (puntos.length === 0) return;

    const coordenadas = aLeaflet(puntos);
    if (cerrado && puntos.length >= 3) {
      const estilo = estiloZona(tipo);
      L.polygon(coordenadas, {
        ...estilo,
        weight: 3,
        fillOpacity: 0.24,
        interactive: false,
      }).addTo(capa);
    } else if (puntos.length >= 2) {
      L.polyline(coordenadas, {
        color: estiloZona(tipo).color,
        weight: 3,
        dashArray: "6 4",
        interactive: false,
      }).addTo(capa);
    }

    const iconoVertice = L.divIcon({
      className: "sgp-vertice-zona",
      html: "",
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    puntos.forEach((punto, indice) => {
      const marcador = L.marker([punto[1], punto[0]], {
        icon: iconoVertice,
        draggable: !soloLectura,
        keyboard: false,
        alt: `Vértice ${indice + 1}`,
        bubblingMouseEvents: false,
      });

      if (!soloLectura) {
        marcador.on("click", (evento) => {
          L.DomEvent.stopPropagation(evento.originalEvent);
          accionesRef.current.onQuitarPunto(indice);
        });
        marcador.on("dragend", () => {
          const posicion = marcador.getLatLng();
          accionesRef.current.onMoverPunto(indice, [
            posicion.lng,
            posicion.lat,
          ]);
        });
      }

      marcador.addTo(capa);
    });
  }, [puntos, cerrado, tipo, soloLectura]);

  // En edición, encuadra la zona una sola vez.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || vistaAjustadaRef.current || !esEdicion) return;
    if (puntos.length < 3) return;

    const limites = L.latLngBounds(aLeaflet(puntos));
    if (!limites.isValid()) return;

    mapa.fitBounds(limites.pad(0.35), { maxZoom: 18 });
    vistaAjustadaRef.current = true;
  }, [esEdicion, puntos]);

  return (
    <div className="sgp-mapa relative overflow-hidden rounded-xl border border-borde bg-slate-200">
      <div
        ref={contenedorRef}
        className="h-[420px] w-full sm:h-[520px]"
        role="application"
        aria-label="Mapa para dibujar el polígono de la zona"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-3">
        <div className="pointer-events-auto max-w-sm rounded-lg border border-borde bg-superficie/95 px-3 py-2 shadow-sm backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-wide text-primario">
            Dibujo del polígono
          </p>
          <p className="mt-1 text-xs leading-relaxed text-texto">
            Haz clic en el mapa para agregar vértices. Arrastra un vértice para
            moverlo o tócalo para eliminarlo.
          </p>
          <p
            className="mt-1 text-[11px] font-medium text-tenue"
            aria-live="polite"
          >
            {puntos.length} vértice{puntos.length === 1 ? "" : "s"} ·{" "}
            {cerrado ? "polígono cerrado" : "polígono abierto"} ·{" "}
            {ETIQUETAS_TIPO[tipo]}
          </p>
        </div>
      </div>

      <div className="absolute bottom-3 left-3 z-[500] flex max-w-[calc(100%-5rem)] flex-wrap gap-2">
        <Boton
          variante="contorno"
          tamano="sm"
          onClick={onDeshacer}
          disabled={soloLectura || puntos.length === 0}
          className="bg-superficie/95 shadow-sm backdrop-blur"
        >
          Deshacer
        </Boton>
        <Boton
          variante="contorno"
          tamano="sm"
          onClick={onBorrar}
          disabled={soloLectura || puntos.length === 0}
          className="bg-superficie/95 shadow-sm backdrop-blur"
        >
          Borrar
        </Boton>
        {cerrado ? (
          <Boton
            variante="contorno"
            tamano="sm"
            onClick={onReabrir}
            disabled={soloLectura}
            className="bg-superficie/95 shadow-sm backdrop-blur"
          >
            Reabrir forma
          </Boton>
        ) : (
          <Boton
            tamano="sm"
            onClick={onCerrar}
            disabled={soloLectura || puntos.length < 3}
            className="shadow-sm"
          >
            Cerrar polígono
          </Boton>
        )}
      </div>
    </div>
  );
}
