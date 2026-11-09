"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Cargando } from "@/components/ui/estado-vacio";
import {
  comoApiError,
  obtenerZonasGeoJson,
  type ApiError,
} from "@/lib/api-client";
import {
  CENTRO_TULUA,
  estiloZona,
  esTipoZona,
} from "@/features/mapa/estilos-zona";
import type {
  GeometriaPunto,
  ZonaFeatureCollection,
} from "@/types/api";

const ZOOM_INICIAL = 16;
const ZOOM_MINIMO = 11;
const ZOOM_MAXIMO = 19;

export interface MapaCensoModuloProps {
  punto: GeometriaPunto | null;
  onCambiarPunto?: (punto: GeometriaPunto) => void;
  soloLectura?: boolean;
}

/** Icono del punto del censo. */
function iconoPunto(): L.DivIcon {
  return L.divIcon({
    className: "sgp-marcador-modulo",
    html: "<span></span>",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

/**
 * Mapa de selección del punto del censo.
 *
 * Dibuja las zonas activas como contexto y permite mover el punto con clic o
 * arrastre. En modo lectura solo muestra la ubicación guardada.
 */
export function MapaCensoModulo({
  punto,
  onCambiarPunto,
  soloLectura = false,
}: MapaCensoModuloProps) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const capaZonasRef = useRef<L.LayerGroup | null>(null);
  const marcadorRef = useRef<L.Marker | null>(null);
  const cambiarPuntoRef = useRef(onCambiarPunto);
  const soloLecturaRef = useRef(soloLectura);
  const puntoRef = useRef(punto);

  const [zonas, setZonas] = useState<ZonaFeatureCollection | null>(null);
  const [cargandoZonas, setCargandoZonas] = useState(true);
  const [errorZonas, setErrorZonas] = useState<ApiError | null>(null);

  useEffect(() => {
    cambiarPuntoRef.current = onCambiarPunto;
    soloLecturaRef.current = soloLectura;
    puntoRef.current = punto;
  }, [onCambiarPunto, soloLectura, punto]);

  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor || mapaRef.current) return;

    const centro = puntoRef.current
      ? [
          puntoRef.current.coordinates[1],
          puntoRef.current.coordinates[0],
        ]
      : [CENTRO_TULUA.lat, CENTRO_TULUA.lng];

    const mapa = L.map(contenedor, {
      center: centro as L.LatLngTuple,
      zoom: ZOOM_INICIAL,
      minZoom: ZOOM_MINIMO,
      maxZoom: ZOOM_MAXIMO,
      zoomControl: false,
      zoomSnap: 1,
      zoomDelta: 1,
      doubleClickZoom: false,
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
    mapaRef.current = mapa;
    capaZonasRef.current = capaZonas;

    const alHacerClic = (evento: L.LeafletMouseEvent) => {
      if (soloLecturaRef.current || !cambiarPuntoRef.current) return;
      cambiarPuntoRef.current({
        type: "Point",
        coordinates: [evento.latlng.lng, evento.latlng.lat],
      });
    };
    mapa.on("click", alHacerClic);

    const observador =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => mapa.invalidateSize());
    observador?.observe(contenedor);
    const temporizador = setTimeout(() => mapa.invalidateSize(), 0);

    return () => {
      clearTimeout(temporizador);
      observador?.disconnect();
      mapa.off("click", alHacerClic);
      mapa.remove();
      mapaRef.current = null;
      capaZonasRef.current = null;
      marcadorRef.current = null;
    };
  }, []);

  // Carga las zonas activas como contexto visual.
  useEffect(() => {
    let activo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la consulta de zonas arranca al montar el mapa
    setCargandoZonas(true);

    obtenerZonasGeoJson()
      .then((respuesta) => {
        if (activo) {
          setZonas(respuesta);
          setErrorZonas(null);
        }
      })
      .catch((error) => {
        if (activo) setErrorZonas(comoApiError(error));
      })
      .finally(() => {
        if (activo) setCargandoZonas(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  // Pinta las zonas en el mapa.
  useEffect(() => {
    const capa = capaZonasRef.current;
    if (!capa || !zonas) return;
    capa.clearLayers();

    for (const feature of zonas.features) {
      const tipo = feature.properties.tipo;
      if (!esTipoZona(tipo)) continue;
      L.geoJSON(feature, {
        style: {
          ...estiloZona(tipo),
          fillOpacity: 0.08,
          weight: 1,
          interactive: false,
        },
      }).addTo(capa);
    }
  }, [zonas]);

  // Sincroniza el marcador con el punto seleccionado.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;

    if (!punto) {
      marcadorRef.current?.remove();
      marcadorRef.current = null;
      return;
    }

    const coordenadas: L.LatLngTuple = [
      punto.coordinates[1],
      punto.coordinates[0],
    ];

    if (!marcadorRef.current) {
      const marcador = L.marker(coordenadas, {
        icon: iconoPunto(),
        draggable: !soloLectura,
        keyboard: false,
        title: "Punto del módulo",
      }).addTo(mapa);

      marcador.on("dragend", () => {
        if (soloLecturaRef.current || !cambiarPuntoRef.current) return;
        const posicion = marcador.getLatLng();
        cambiarPuntoRef.current({
          type: "Point",
          coordinates: [posicion.lng, posicion.lat],
        });
      });

      marcadorRef.current = marcador;
    } else {
      marcadorRef.current.setLatLng(coordenadas);
      marcadorRef.current.dragging?.enable();
      if (soloLectura) marcadorRef.current.dragging?.disable();
    }
  }, [punto, soloLectura]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-xl border border-borde bg-slate-200">
        <div
          ref={contenedorRef}
          role="application"
          aria-label="Mapa para seleccionar el punto del módulo"
          className="h-[360px] w-full sm:h-[480px]"
        />
        {cargandoZonas ? (
          <div className="pointer-events-none absolute inset-x-2 top-2 rounded-lg border border-borde bg-superficie/95 px-3 py-2 shadow-sm">
            <Cargando texto="Cargando zonas activas…" />
          </div>
        ) : null}
      </div>

      {!soloLectura ? (
        <p className="text-xs text-tenue">
          Haz clic en el mapa o arrastra el marcador para ubicar el punto del
          módulo.
        </p>
      ) : null}

      {errorZonas ? (
        <Alerta tono="informacion">
          No se pudieron cargar las zonas activas como contexto. Puedes
          seleccionar el punto igualmente.
        </Alerta>
      ) : null}
    </div>
  );
}
