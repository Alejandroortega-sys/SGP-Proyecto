"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoCerrar, IconoUbicacion } from "@/components/ui/iconos";
import { Spinner } from "@/components/ui/spinner";
import { comoApiError, obtenerZonasGeoJson, type ApiError } from "@/lib/api-client";
import type { TipoZona, ZonaFeatureCollection } from "@/types/api";
import {
  CENTRO_TULUA,
  DESCRIPCIONES_TIPO,
  esTipoZona,
  ETIQUETAS_TIPO,
  estiloZona,
  estaEnTulua,
  TIPOS_ZONA,
} from "./estilos-zona";
import { crearContenidoPopup } from "./popup-zona";

const ZOOM_INICIAL = 16;
const ZOOM_MINIMO = 11;
const ZOOM_MAXIMO = 19;
const RETARDO_ZOOM_MS = 300;

type VisibilidadCapas = Record<TipoZona, boolean>;

const CAPAS_INICIALES: VisibilidadCapas = {
  permitida: true,
  restringida: true,
  alta_congestion: true,
};

type AvisoUbicacion = {
  tono: "informacion" | "advertencia" | "error";
  texto: string;
};

function mensajeGeolocalizacion(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "No diste permiso para usar tu ubicación. Actívalo en la configuración del navegador e inténtalo de nuevo.";
    case error.POSITION_UNAVAILABLE:
      return "No pudimos obtener tu ubicación. Revisa la conexión o el GPS del dispositivo.";
    case error.TIMEOUT:
      return "La ubicación tardó demasiado en responder. Inténtalo de nuevo.";
    default:
      return "No pudimos obtener tu ubicación. Inténtalo de nuevo.";
  }
}

export function MapaLeaflet() {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const gruposRef = useRef<Record<TipoZona, L.LayerGroup> | null>(null);
  const ubicacionRef = useRef<L.LayerGroup | null>(null);
  const temporizadorZoomRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const solicitudRef = useRef(0);
  const zoomConsultadoRef = useRef(ZOOM_INICIAL);
  const cacheRef = useRef(new Map<number, ZonaFeatureCollection>());

  const [datos, setDatos] = useState<ZonaFeatureCollection | null>(null);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [visibles, setVisibles] = useState<VisibilidadCapas>(CAPAS_INICIALES);
  const [avisoUbicacion, setAvisoUbicacion] = useState<AvisoUbicacion | null>(
    null,
  );
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);

  const cargarZonas = useCallback(
    async (
      zoom: number,
      opciones: { silencioso: boolean; forzar?: boolean },
    ): Promise<void> => {
      const solicitud = solicitudRef.current + 1;
      solicitudRef.current = solicitud;

      const guardada = cacheRef.current.get(zoom);
      if (guardada && !opciones.forzar) {
        setDatos(guardada);
        setError(null);
        setCargando(false);
        setActualizando(false);
        return;
      }

      if (opciones.silencioso) {
        setActualizando(true);
      } else {
        setCargando(true);
      }

      try {
        const respuesta = await obtenerZonasGeoJson(zoom);
        if (solicitud !== solicitudRef.current) return;

        cacheRef.current.set(zoom, respuesta);
        setDatos(respuesta);
        setError(null);
      } catch (fallo) {
        if (solicitud !== solicitudRef.current) return;
        setError(comoApiError(fallo));
      } finally {
        if (solicitud === solicitudRef.current) {
          setCargando(false);
          setActualizando(false);
        }
      }
    },
    [],
  );

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

    const grupos: Record<TipoZona, L.LayerGroup> = {
      permitida: L.layerGroup(),
      restringida: L.layerGroup(),
      alta_congestion: L.layerGroup(),
    };
    for (const tipo of TIPOS_ZONA) {
      grupos[tipo].addTo(mapa);
    }

    mapaRef.current = mapa;
    gruposRef.current = grupos;

    const alCambiarZoom = () => {
      const nuevoZoom = Math.round(mapa.getZoom());
      if (nuevoZoom === zoomConsultadoRef.current) return;
      zoomConsultadoRef.current = nuevoZoom;

      if (temporizadorZoomRef.current) {
        clearTimeout(temporizadorZoomRef.current);
      }
      temporizadorZoomRef.current = setTimeout(() => {
        void cargarZonas(nuevoZoom, { silencioso: true });
      }, RETARDO_ZOOM_MS);
    };

    mapa.on("zoomend", alCambiarZoom);

    // El contenedor puede terminar de dimensionarse después del montaje.
    const temporizadorTamano = setTimeout(() => mapa.invalidateSize(), 0);

    return () => {
      clearTimeout(temporizadorTamano);
      if (temporizadorZoomRef.current) {
        clearTimeout(temporizadorZoomRef.current);
        temporizadorZoomRef.current = null;
      }
      mapa.off("zoomend", alCambiarZoom);
      mapa.remove();
      mapaRef.current = null;
      gruposRef.current = null;
      ubicacionRef.current = null;
    };
  }, [cargarZonas]);

  // Carga inicial del GeoJSON.
  useEffect(() => {
    void cargarZonas(ZOOM_INICIAL, { silencioso: false });
  }, [cargarZonas]);

  // Dibuja los polígonos de la respuesta actual.
  useEffect(() => {
    const mapa = mapaRef.current;
    const grupos = gruposRef.current;
    if (!mapa || !grupos) return;

    for (const tipo of TIPOS_ZONA) {
      grupos[tipo].clearLayers();
    }
    if (!datos) return;

    for (const feature of datos.features) {
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

      poligono.addTo(grupos[tipo]);
    }
  }, [datos]);

  // Aplica la visibilidad de cada capa.
  useEffect(() => {
    const mapa = mapaRef.current;
    const grupos = gruposRef.current;
    if (!mapa || !grupos) return;

    for (const tipo of TIPOS_ZONA) {
      const visible = visibles[tipo];
      const tieneCapa = mapa.hasLayer(grupos[tipo]);
      if (visible && !tieneCapa) mapa.addLayer(grupos[tipo]);
      if (!visible && tieneCapa) mapa.removeLayer(grupos[tipo]);
    }
  }, [visibles]);

  const conteos = useMemo<Record<TipoZona, number>>(() => {
    const resultado: Record<TipoZona, number> = {
      permitida: 0,
      restringida: 0,
      alta_congestion: 0,
    };
    for (const feature of datos?.features ?? []) {
      if (esTipoZona(feature.properties.tipo)) {
        resultado[feature.properties.tipo] += 1;
      }
    }
    return resultado;
  }, [datos]);

  const alternarCapa = (tipo: TipoZona): void => {
    setVisibles((actual) => ({ ...actual, [tipo]: !actual[tipo] }));
  };

  const reintentar = (): void => {
    setError(null);
    void cargarZonas(zoomConsultadoRef.current, {
      silencioso: false,
      forzar: true,
    });
  };

  const ubicar = (): void => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setAvisoUbicacion({
        tono: "error",
        texto:
          "Tu navegador no permite la geolocalización. Puedes ubicar Tuluá manualmente en el mapa.",
      });
      return;
    }

    setBuscandoUbicacion(true);
    setAvisoUbicacion(null);

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        setBuscandoUbicacion(false);
        const mapa = mapaRef.current;
        if (!mapa) return;

        const { latitude, longitude, accuracy } = posicion.coords;

        ubicacionRef.current?.remove();
        const grupo = L.layerGroup();

        L.circleMarker([latitude, longitude], {
          radius: 8,
          color: "#0d5f3a",
          weight: 3,
          fillColor: "#ffffff",
          fillOpacity: 1,
        })
          .bindPopup("Tu ubicación")
          .addTo(grupo);

        if (Number.isFinite(accuracy) && accuracy > 0) {
          L.circle([latitude, longitude], {
            radius: accuracy,
            color: "#0d5f3a",
            weight: 1,
            fillColor: "#0d5f3a",
            fillOpacity: 0.08,
          }).addTo(grupo);
        }

        grupo.addTo(mapa);
        ubicacionRef.current = grupo;
        mapa.flyTo([latitude, longitude], ZOOM_INICIAL);

        if (!estaEnTulua(latitude, longitude)) {
          setAvisoUbicacion({
            tono: "advertencia",
            texto:
              "Tu ubicación está fuera de Tuluá. El mapa te muestra dónde estás, pero las zonas normativas corresponden al municipio.",
          });
        } else {
          setAvisoUbicacion({
            tono: "informacion",
            texto: "Mapa centrado en tu ubicación.",
          });
        }
      },
      (fallo) => {
        setBuscandoUbicacion(false);
        setAvisoUbicacion({
          tono: "error",
          texto: mensajeGeolocalizacion(fallo),
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const sinZonas = datos !== null && datos.features.length === 0;

  return (
    <div className="sgp-mapa relative overflow-hidden border-t border-borde bg-slate-200">
      <div
        ref={contenedorRef}
        className="sgp-mapa__lienzo h-[calc(100dvh-4rem)] min-h-[520px] w-full"
        role="application"
        aria-label="Mapa interactivo de zonas del espacio público de Tuluá"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex flex-col gap-2 p-3 sm:p-4">
        <div className="pointer-events-auto max-w-md rounded-xl border border-borde bg-superficie/95 p-4 shadow-sm backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-wide text-primario">
            Geo-Portal
          </p>
          <h1 className="mt-1 text-lg font-extrabold text-titulo sm:text-xl">
            Zonas del espacio público de Tuluá
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-texto sm:text-sm">
            Consulta las zonas permitidas, restringidas y de alta congestión.
            Toca un polígono para ver su horario, aforo y productos permitidos.
          </p>
        </div>

        {avisoUbicacion ? (
          <div className="pointer-events-auto max-w-md">
            <Alerta tono={avisoUbicacion.tono}>
              <span className="flex items-start gap-2">
                <span className="flex-1">{avisoUbicacion.texto}</span>
                <button
                  type="button"
                  onClick={() => setAvisoUbicacion(null)}
                  className="rounded p-1 text-current hover:bg-black/5"
                  aria-label="Cerrar aviso de ubicación"
                >
                  <IconoCerrar className="size-4" />
                </button>
              </span>
            </Alerta>
          </div>
        ) : null}

        {actualizando ? (
          <p
            role="status"
            className="pointer-events-auto inline-flex w-fit items-center gap-2 rounded-full border border-borde bg-superficie/95 px-3 py-1 text-xs text-texto shadow-sm"
          >
            <Spinner className="size-3.5 text-primario" />
            Actualizando zonas…
          </p>
        ) : null}

        {error && datos ? (
          <div className="pointer-events-auto max-w-md">
            <Alerta tono="error">
              <span className="flex items-start gap-2">
                <span className="flex-1">{error.mensaje}</span>
                <button
                  type="button"
                  onClick={reintentar}
                  className="rounded border border-current px-2 py-1 text-xs font-semibold"
                >
                  Reintentar
                </button>
              </span>
            </Alerta>
          </div>
        ) : null}
      </div>

      <div className="absolute bottom-3 left-3 z-[500] flex w-[min(22rem,calc(100%-4.5rem))] flex-col gap-2 sm:bottom-4 sm:left-4">
        <Boton
          type="button"
          variante="contorno"
          tamano="sm"
          onClick={ubicar}
          disabled={buscandoUbicacion}
          className="w-full bg-superficie/95 shadow-sm backdrop-blur"
          aria-label="Centrar el mapa en mi ubicación"
        >
          {buscandoUbicacion ? (
            <Spinner className="size-4" />
          ) : (
            <IconoUbicacion className="size-4" />
          )}
          Mi ubicación
        </Boton>

        <fieldset className="rounded-xl border border-borde bg-superficie/95 p-3 shadow-sm backdrop-blur">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-titulo">
            Capas del mapa
          </legend>
          <div className="mt-1 flex flex-col gap-1.5">
            {TIPOS_ZONA.map((tipo) => (
              <label
                key={tipo}
                className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-sm text-texto hover:bg-slate-50"
                title={DESCRIPCIONES_TIPO[tipo]}
              >
                <input
                  type="checkbox"
                  checked={visibles[tipo]}
                  onChange={() => alternarCapa(tipo)}
                  className="size-4 accent-primario"
                />
                <span
                  className={`sgp-leyenda__muestra sgp-leyenda__muestra--${tipo}`}
                  aria-hidden="true"
                />
                <span className="flex-1">{ETIQUETAS_TIPO[tipo]}</span>
                <span className="rounded-full bg-fondo px-2 py-0.5 text-xs font-semibold text-tenue">
                  {conteos[tipo]}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 border-t border-borde pt-2 text-[11px] leading-relaxed text-tenue">
            El color y el patrón de la línea identifican el tipo de zona.
          </p>
        </fieldset>
      </div>

      {(cargando && !datos) || (error && !datos) || sinZonas ? (
        <div
          aria-live="polite"
          className="absolute inset-0 z-[600] flex items-center justify-center bg-superficie/70 p-4 backdrop-blur-[1px]"
        >
          {cargando && !datos ? (
            <div className="rounded-xl border border-borde bg-superficie px-6 py-4 shadow-sm">
              <Cargando texto="Cargando zonas de Tuluá…" />
            </div>
          ) : error && !datos ? (
            <div className="w-full max-w-md rounded-xl border border-borde bg-superficie p-4 shadow-sm">
              <BloqueError error={error} onReintentar={reintentar} />
            </div>
          ) : sinZonas ? (
            <div className="rounded-xl border border-borde bg-superficie px-6 py-4 shadow-sm">
              <EstadoVacio
                titulo="No hay zonas publicadas"
                descripcion="Todavía no se han registrado zonas activas. Intenta de nuevo más tarde."
                accion={
                  <Boton variante="contorno" tamano="sm" onClick={reintentar}>
                    Reintentar
                  </Boton>
                }
              />
            </div>
          ) : null}
        </div>
      ) : null}

    </div>
  );
}
