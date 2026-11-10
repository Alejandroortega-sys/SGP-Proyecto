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
  FilaPreviewImportacion,
  GeometriaPoligono,
  GeometriaPunto,
  TipoImportacion,
  ZonaFeatureCollection,
} from "@/types/api";
import { CENTRO_TULUA } from "../mapa/estilos-zona";
import { COLORES_ESTADO_IMPORTACION } from "./estilos-importacion";
import {
  ETIQUETAS_ESTADO_FILA,
  formatearDato,
  resumenFilaImportacion,
} from "./validaciones-importacion";

const ZOOM_INICIAL = 14;
const ZOOM_MAXIMO = 19;

export interface MapaPrevisualizacionProps {
  tipo: TipoImportacion;
  filas: readonly FilaPreviewImportacion[];
}

function esPoligono(valor: unknown): valor is GeometriaPoligono {
  if (typeof valor !== "object" || valor === null) return false;
  const candidato = valor as { type?: unknown; coordinates?: unknown };
  return candidato.type === "Polygon" && Array.isArray(candidato.coordinates);
}

function esPunto(valor: unknown): valor is GeometriaPunto {
  if (typeof valor !== "object" || valor === null) return false;
  const candidato = valor as { type?: unknown; coordinates?: unknown };
  return candidato.type === "Point" && Array.isArray(candidato.coordinates);
}

function crearPopup(
  fila: FilaPreviewImportacion,
  tipo: TipoImportacion,
): HTMLElement {
  const contenedor = document.createElement("div");
  contenedor.className = "space-y-1 text-sm";

  const titulo = document.createElement("p");
  titulo.className = "font-bold text-slate-900";
  titulo.textContent = `Fila ${fila.fila}: ${resumenFilaImportacion(fila, tipo).titulo}`;
  contenedor.append(titulo);

  const estado = document.createElement("p");
  estado.textContent = `Estado: ${ETIQUETAS_ESTADO_FILA[fila.estado]}`;
  contenedor.append(estado);

  if (fila.zonaContenedora) {
    const zona = document.createElement("p");
    zona.textContent = `Zona: ${fila.zonaContenedora.nombre}`;
    contenedor.append(zona);
  }

  if (fila.errores.length > 0) {
    const errores = document.createElement("ul");
    errores.className = "mt-1 list-disc pl-4 text-rose-700";
    for (const error of fila.errores) {
      const item = document.createElement("li");
      item.textContent = error;
      errores.append(item);
    }
    contenedor.append(errores);
  }

  return contenedor;
}

function hacerAccesible(capa: L.Layer, etiqueta: string): void {
  capa.on("add", () => {
    const elemento = (capa as L.Path).getElement?.();
    if (!elemento) return;
    elemento.setAttribute("role", "button");
    elemento.setAttribute("tabindex", "0");
    elemento.setAttribute("aria-label", etiqueta);
  });
}

/**
 * Mapa de previsualización.
 *
 * Dibuja las zonas activas como contexto gris y las filas importadas con el
 * color de su estado: verde válida, ámbar con advertencia y rojo rechazada.
 */
export function MapaPrevisualizacion({
  tipo,
  filas,
}: MapaPrevisualizacionProps) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const grupoContextoRef = useRef<L.LayerGroup | null>(null);
  const grupoFilasRef = useRef<L.LayerGroup | null>(null);

  const [zonas, setZonas] = useState<ZonaFeatureCollection | null>(null);
  const [cargandoZonas, setCargandoZonas] = useState(true);
  const [errorZonas, setErrorZonas] = useState<ApiError | null>(null);

  const cargarZonas = useCallback(async (): Promise<void> => {
    setCargandoZonas(true);
    try {
      setZonas(await obtenerZonasGeoJson());
      setErrorZonas(null);
    } catch (fallo) {
      setErrorZonas(comoApiError(fallo));
    } finally {
      setCargandoZonas(false);
    }
  }, []);

  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor || mapaRef.current) return;

    const mapa = L.map(contenedor, {
      center: [CENTRO_TULUA.lat, CENTRO_TULUA.lng],
      zoom: ZOOM_INICIAL,
      maxZoom: ZOOM_MAXIMO,
      zoomControl: false,
      zoomSnap: 1,
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

    const grupoContexto = L.layerGroup().addTo(mapa);
    const grupoFilas = L.layerGroup().addTo(mapa);

    mapaRef.current = mapa;
    grupoContextoRef.current = grupoContexto;
    grupoFilasRef.current = grupoFilas;

    const observador =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => mapa.invalidateSize());
    observador?.observe(contenedor);
    const temporizador = setTimeout(() => mapa.invalidateSize(), 0);

    return () => {
      clearTimeout(temporizador);
      observador?.disconnect();
      mapa.remove();
      mapaRef.current = null;
      grupoContextoRef.current = null;
      grupoFilasRef.current = null;
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la carga inicial sincroniza el mapa con la API
    void cargarZonas();
  }, [cargarZonas]);

  // Zonas activas como contexto.
  useEffect(() => {
    const grupo = grupoContextoRef.current;
    if (!grupo) return;
    grupo.clearLayers();
    if (!zonas) return;

    for (const feature of zonas.features) {
      const anillos = feature.geometry.coordinates.map((anillo) =>
        anillo.map(
          ([longitud, latitud]) =>
            [latitud, longitud] as L.LatLngTuple,
        ),
      );
      if (anillos.length === 0) continue;

      const poligono = L.polygon(anillos, {
        color: "#64748b",
        fillColor: "#94a3b8",
        weight: 1,
        fillOpacity: 0.08,
        dashArray: "4 4",
        interactive: false,
      });
      poligono.bindTooltip(feature.properties.nombre, {
        sticky: true,
        direction: "top",
        opacity: 0.9,
      });
      poligono.addTo(grupo);
    }
  }, [zonas]);

  // Filas importadas.
  useEffect(() => {
    const mapa = mapaRef.current;
    const grupo = grupoFilasRef.current;
    if (!mapa || !grupo) return;

    grupo.clearLayers();
    const puntos: L.LatLngTuple[] = [];

    for (const fila of filas) {
      const color = COLORES_ESTADO_IMPORTACION[fila.estado];
      const etiqueta = `Fila ${fila.fila}, ${ETIQUETAS_ESTADO_FILA[fila.estado]}`;

      if (esPoligono(fila.geometria)) {
        const anillos = fila.geometria.coordinates.map((anillo) =>
          anillo.map(
            ([longitud, latitud]) =>
              [latitud, longitud] as L.LatLngTuple,
          ),
        );
        if (anillos.length === 0) continue;

        const poligono = L.polygon(anillos, {
          color,
          fillColor: color,
          weight: 3,
          fillOpacity: 0.25,
        });
        poligono.bindPopup(() => crearPopup(fila, tipo), {
          maxWidth: 340,
          minWidth: 240,
          className: "sgp-popup-contenedor",
        });
        poligono.bindTooltip(
          `Fila ${fila.fila}: ${formatearDato(fila.datos.nombre)}`,
          { sticky: true, direction: "top", opacity: 0.95 },
        );
        hacerAccesible(poligono, `${etiqueta}. Abrir detalle.`);
        poligono.addTo(grupo);
        for (const anillo of anillos) puntos.push(...anillo);
        continue;
      }

      if (esPunto(fila.geometria)) {
        const [longitud, latitud] = fila.geometria.coordinates;
        const marcador = L.circleMarker([latitud, longitud], {
          radius: 8,
          color: "#ffffff",
          weight: 2,
          fillColor: color,
          fillOpacity: 1,
        });
        marcador.bindPopup(() => crearPopup(fila, tipo), {
          maxWidth: 340,
          minWidth: 240,
          className: "sgp-popup-contenedor",
        });
        marcador.bindTooltip(
          `Fila ${fila.fila}: ${formatearDato(fila.datos.actividad)}`,
          { sticky: true, direction: "top", opacity: 0.95 },
        );
        hacerAccesible(marcador, `${etiqueta}. Abrir detalle.`);
        marcador.addTo(grupo);
        puntos.push([latitud, longitud]);
      }
    }

    if (puntos.length > 0) {
      const limites = L.latLngBounds(puntos);
      if (limites.isValid()) {
        mapa.fitBounds(limites, { padding: [30, 30], maxZoom: 16 });
      }
    }
  }, [filas, tipo]);

  return (
    <div className="sgp-mapa relative h-[360px] overflow-hidden rounded-xl border border-borde bg-slate-200 sm:h-[460px]">
      <div
        ref={contenedorRef}
        className="h-full w-full"
        role="application"
        aria-label="Mapa de previsualización de la importación"
      />

      <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-lg border border-borde bg-superficie/95 px-3 py-2 text-xs shadow-sm">
        <p className="font-semibold text-titulo">Previsualización</p>
        <ul className="mt-1 space-y-0.5">
          {(["valida", "advertencia", "rechazada"] as const).map((estado) => (
            <li key={estado} className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: COLORES_ESTADO_IMPORTACION[estado] }}
                aria-hidden="true"
              />
              {ETIQUETAS_ESTADO_FILA[estado]}
            </li>
          ))}
        </ul>
      </div>

      {cargandoZonas ? (
        <p
          role="status"
          className="pointer-events-none absolute right-3 top-3 z-[500] inline-flex items-center gap-2 rounded-full border border-borde bg-superficie/95 px-3 py-1 text-xs text-texto shadow-sm"
        >
          <Spinner className="size-3.5 text-primario" />
          Cargando zonas de contexto…
        </p>
      ) : null}

      {errorZonas ? (
        <div className="absolute inset-x-3 bottom-3 z-[500] max-w-md">
          <Alerta tono="error">
            <span className="flex items-start gap-2">
              <span className="flex-1">
                No se pudieron cargar las zonas de contexto. La previsualización
                sigue disponible.
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
