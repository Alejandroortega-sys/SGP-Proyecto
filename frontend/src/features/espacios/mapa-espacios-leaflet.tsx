"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Spinner } from "@/components/ui/spinner";
import {
  comoApiError,
  obtenerZonasGeoJson,
  type ApiError,
} from "@/lib/api-client";
import type {
  EspacioListado,
  EstadoEspacio,
  ZonaFeatureCollection,
} from "@/types/api";
import {
  CENTRO_TULUA,
  estiloZona,
  esTipoZona,
  ETIQUETAS_TIPO,
} from "../mapa/estilos-zona";
import { crearContenidoPopup } from "../mapa/popup-zona";
import {
  agruparEspacios,
  type GrupoEspacios,
  type PuntoEspacio,
} from "./agrupar-espacios";
import {
  COLORES_ESTADO_ESPACIO,
  ETIQUETAS_ESTADO_ESPACIO,
  SIMBOLOS_ESTADO_ESPACIO,
} from "./estilos-espacio";

const ZOOM_INICIAL = 16;
const ZOOM_MINIMO = 11;
const ZOOM_MAXIMO = 19;

interface MapaEspaciosLeafletProps {
  espacios: EspacioListado[];
  seleccionadoId: string | null;
  onSeleccionar: (id: string) => void;
}

/** Crea el icono de un espacio individual. */
function crearIconoEspacio(
  estado: EstadoEspacio,
  seleccionado: boolean,
): L.DivIcon {
  const contenedor = document.createElement("span");
  contenedor.className = [
    "sgp-marcador-espacio",
    `sgp-marcador-espacio--${estado}`,
    seleccionado ? "sgp-marcador-espacio--seleccionado" : "",
  ]
    .filter(Boolean)
    .join(" ");
  contenedor.style.setProperty(
    "--color-marcador",
    COLORES_ESTADO_ESPACIO[estado],
  );

  const simbolo = document.createElement("span");
  simbolo.className = "sgp-marcador-espacio__simbolo";
  simbolo.textContent = SIMBOLOS_ESTADO_ESPACIO[estado];
  simbolo.setAttribute("aria-hidden", "true");
  contenedor.append(simbolo);

  return L.divIcon({
    className: "sgp-marcador-espacio__contenedor",
    html: contenedor.outerHTML,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

/** Crea el icono de un grupo de espacios cercanos. */
function crearIconoCluster(grupo: GrupoEspacios): L.DivIcon {
  const contenedor = document.createElement("div");
  contenedor.className = "sgp-cluster-espacios";

  const conteo = document.createElement("span");
  conteo.className = "sgp-cluster-espacios__conteo";
  conteo.textContent = String(grupo.espacios.length);
  contenedor.append(conteo);

  const estados = document.createElement("span");
  estados.className = "sgp-cluster-espacios__estados";
  for (const [estado, cantidad] of Object.entries(grupo.estados) as [
    EstadoEspacio,
    number,
  ][]) {
    if (cantidad === 0) continue;
    const punto = document.createElement("span");
    punto.className = "sgp-cluster-espacios__punto";
    punto.style.backgroundColor = COLORES_ESTADO_ESPACIO[estado];
    punto.title = `${cantidad} ${ETIQUETAS_ESTADO_ESPACIO[estado].toLowerCase()}`;
    estados.append(punto);
  }
  contenedor.append(estados);

  return L.divIcon({
    className: "sgp-cluster-espacios__contenedor",
    html: contenedor.outerHTML,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

/** Añade etiqueta y rol accesible al marcador cuando se agrega al mapa. */
function hacerAccesible(marcador: L.Marker, etiqueta: string): void {
  marcador.on("add", () => {
    const elemento = marcador.getElement();
    if (!elemento) return;
    elemento.setAttribute("role", "button");
    elemento.setAttribute("tabindex", "0");
    elemento.setAttribute("aria-label", etiqueta);
  });
}

/**
 * Mapa de espacios disponibles.
 *
 * - Dibuja las zonas activas como contexto.
 * - Agrupa los marcadores en celdas de 64 px según el zoom.
 * - Colorea y simboliza cada marcador según su estado efectivo.
 */
export function MapaEspaciosLeaflet({
  espacios,
  seleccionadoId,
  onSeleccionar,
}: MapaEspaciosLeafletProps) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const grupoZonasRef = useRef<L.LayerGroup | null>(null);
  const grupoMarcadoresRef = useRef<L.LayerGroup | null>(null);

  const [zoom, setZoom] = useState(ZOOM_INICIAL);
  const [zonas, setZonas] = useState<ZonaFeatureCollection | null>(null);
  const [cargandoZonas, setCargandoZonas] = useState(true);
  const [errorZonas, setErrorZonas] = useState<ApiError | null>(null);

  const cargarZonas = useCallback(async (): Promise<void> => {
    setCargandoZonas(true);
    try {
      const respuesta = await obtenerZonasGeoJson();
      setZonas(respuesta);
      setErrorZonas(null);
    } catch (fallo) {
      setErrorZonas(comoApiError(fallo));
    } finally {
      setCargandoZonas(false);
    }
  }, []);

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

    const grupoZonas = L.layerGroup().addTo(mapa);
    const grupoMarcadores = L.layerGroup().addTo(mapa);

    mapaRef.current = mapa;
    grupoZonasRef.current = grupoZonas;
    grupoMarcadoresRef.current = grupoMarcadores;
    contenedor.dataset.zoom = String(ZOOM_INICIAL);

    const alCambiarZoom = () => {
      const nuevoZoom = Math.round(mapa.getZoom());
      contenedor.dataset.zoom = String(nuevoZoom);
      setZoom(nuevoZoom);
    };
    mapa.on("zoomend", alCambiarZoom);

    const observador =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => mapa.invalidateSize());
    observador?.observe(contenedor);

    const temporizadorTamano = setTimeout(() => mapa.invalidateSize(), 0);

    return () => {
      clearTimeout(temporizadorTamano);
      observador?.disconnect();
      mapa.off("zoomend", alCambiarZoom);
      mapa.remove();
      mapaRef.current = null;
      grupoZonasRef.current = null;
      grupoMarcadoresRef.current = null;
    };
  }, []);

  // Carga las zonas una sola vez (la capa de contexto no necesita zoom).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la carga inicial sincroniza el mapa con la API
    void cargarZonas();
  }, [cargarZonas]);

  // Dibuja las zonas activas.
  useEffect(() => {
    const grupo = grupoZonasRef.current;
    if (!grupo) return;
    grupo.clearLayers();
    if (!zonas) return;

    for (const feature of zonas.features) {
      const tipo = esTipoZona(feature.properties.tipo)
        ? feature.properties.tipo
        : "restringida";
      const anillos: L.LatLngTuple[][] = feature.geometry.coordinates.map(
        (anillo) =>
          anillo.map(
            ([longitud, latitud]) =>
              [latitud, longitud] as L.LatLngTuple,
          ),
      );
      if (anillos.length === 0) continue;

      const poligono = L.polygon(anillos, {
        ...estiloZona(tipo),
        interactive: true,
        bubblingMouseEvents: false,
      });
      poligono.bindPopup(() => crearContenidoPopup(feature.properties), {
        maxWidth: 320,
        minWidth: 240,
        className: "sgp-popup-contenedor",
      });
      poligono.bindTooltip(
        () => {
          const texto = document.createElement("span");
          texto.textContent = feature.properties.nombre;
          return texto;
        },
        {
          sticky: true,
          direction: "top",
          opacity: 0.95,
        },
      );
      poligono.on("add", () => {
        const elemento = poligono.getElement();
        if (!elemento) return;
        elemento.setAttribute(
          "aria-label",
          `Zona ${feature.properties.nombre}, tipo ${ETIQUETAS_TIPO[tipo]}`,
        );
        elemento.setAttribute("role", "button");
      });
      poligono.addTo(grupo);
    }
  }, [zonas]);

  // Agrupa y dibuja los marcadores según el zoom.
  useEffect(() => {
    const mapa = mapaRef.current;
    const grupo = grupoMarcadoresRef.current;
    if (!mapa || !grupo) return;

    grupo.clearLayers();

    const puntos: PuntoEspacio[] = espacios.map((espacio) => ({
      id: espacio.id,
      lat: espacio.ubicacion.coordinates[1],
      lng: espacio.ubicacion.coordinates[0],
      estado: espacio.estadoEfectivo,
      disponible: espacio.disponible,
    }));

    for (const agrupacion of agruparEspacios(puntos, zoom)) {
      if (agrupacion.espacios.length === 1) {
        const espacio = espacios.find(
          (candidato) => candidato.id === agrupacion.espacios[0].id,
        );
        if (!espacio) continue;

        const seleccionado = espacio.id === seleccionadoId;
        const marcador = L.marker([agrupacion.lat, agrupacion.lng], {
          icon: crearIconoEspacio(espacio.estadoEfectivo, seleccionado),
          title: espacio.nombre,
          alt: `Espacio ${espacio.nombre}, ${ETIQUETAS_ESTADO_ESPACIO[espacio.estadoEfectivo]}`,
          keyboard: true,
          riseOnHover: true,
        });
        hacerAccesible(
          marcador,
          `Espacio ${espacio.nombre}, ${ETIQUETAS_ESTADO_ESPACIO[espacio.estadoEfectivo]}. Abrir ficha.`,
        );
        marcador.on("click", () => onSeleccionar(espacio.id));
        marcador.addTo(grupo);
        continue;
      }

      const marcador = L.marker([agrupacion.lat, agrupacion.lng], {
        icon: crearIconoCluster(agrupacion),
        title: `${agrupacion.espacios.length} espacios`,
        alt: `${agrupacion.espacios.length} espacios cercanos. Acercar para verlos.`,
        keyboard: true,
        riseOnHover: true,
      });
      hacerAccesible(
        marcador,
        `${agrupacion.espacios.length} espacios cercanos. Acercar para verlos.`,
      );
      marcador.on("click", () => {
        const limites = L.latLngBounds(
          agrupacion.espacios.map(
            (punto) => [punto.lat, punto.lng] as L.LatLngTuple,
          ),
        );
        if (limites.isValid()) {
          const destino = Math.min(
            ZOOM_MAXIMO,
            Math.max(zoom + 2, mapa.getBoundsZoom(limites)),
          );
          mapa.fitBounds(limites, {
            padding: [40, 40],
            maxZoom: destino,
          });
        } else {
          mapa.setView(
            [agrupacion.lat, agrupacion.lng],
            Math.min(ZOOM_MAXIMO, zoom + 2),
          );
        }
      });
      marcador.addTo(grupo);
    }
  }, [espacios, zoom, seleccionadoId, onSeleccionar]);

  // Centra el mapa al seleccionar un espacio desde la tabla.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !seleccionadoId) return;
    const espacio = espacios.find((candidato) => candidato.id === seleccionadoId);
    if (!espacio) return;
    mapa.panTo(
      [espacio.ubicacion.coordinates[1], espacio.ubicacion.coordinates[0]],
      { animate: true },
    );
  }, [seleccionadoId, espacios]);

  return (
    <div className="sgp-mapa relative h-full min-h-[420px] overflow-hidden rounded-xl border border-borde bg-slate-200">
      <div
        ref={contenedorRef}
        className="h-full min-h-[420px] w-full"
        role="application"
        aria-label="Mapa de espacios disponibles del espacio público de Tuluá"
      />

      {cargandoZonas ? (
        <p
          role="status"
          className="pointer-events-none absolute left-3 top-3 z-[500] inline-flex items-center gap-2 rounded-full border border-borde bg-superficie/95 px-3 py-1 text-xs text-texto shadow-sm"
        >
          <Spinner className="size-3.5 text-primario" />
          Cargando zonas de contexto…
        </p>
      ) : null}

      {errorZonas ? (
        <div className="absolute inset-x-3 top-3 z-[500] max-w-md">
          <Alerta tono="error">
            <span className="flex items-start gap-2">
              <span className="flex-1">
                No se pudieron cargar las zonas de contexto. Los espacios siguen
                disponibles en el mapa.
              </span>
              <button
                type="button"
                onClick={() => void cargarZonas()}
                className="rounded border border-current px-2 py-1 text-xs font-semibold"
              >
                Reintentar
              </button>
            </span>
          </Alerta>
        </div>
      ) : null}
    </div>
  );
}
