import type { ZonaGeoJsonProperties } from "@/types/api";
import {
  construirDetalleZona,
  esTipoZona,
  ETIQUETAS_TIPO,
} from "./estilos-zona";

/** Agrega una fila «término / definición» al popup. */
function agregarDato(
  lista: HTMLDListElement,
  termino: string,
  valor: string,
): void {
  const dt = document.createElement("dt");
  dt.textContent = termino;

  const dd = document.createElement("dd");
  dd.textContent = valor;

  lista.append(dt, dd);
}

/**
 * Construye el contenido del popup con nodos DOM y `textContent`, de modo que
 * los nombres o productos provenientes de la base no se interpreten como HTML.
 */
export function crearContenidoPopup(
  zona: ZonaGeoJsonProperties,
): HTMLElement {
  const detalle = construirDetalleZona(zona);
  const tipo = esTipoZona(zona.tipo) ? zona.tipo : "restringida";

  const contenedor = document.createElement("div");
  contenedor.className = "sgp-popup";

  const titulo = document.createElement("h3");
  titulo.className = "sgp-popup__titulo";
  titulo.textContent = zona.nombre;

  const etiqueta = document.createElement("span");
  etiqueta.className = `sgp-popup__tipo sgp-popup__tipo--${tipo}`;
  etiqueta.textContent = ETIQUETAS_TIPO[tipo];

  const lista = document.createElement("dl");
  lista.className = "sgp-popup__datos";
  agregarDato(lista, "Horario", detalle.horario);
  agregarDato(lista, "Aforo", detalle.aforo);
  agregarDato(lista, "Productos", detalle.productos);

  contenedor.append(titulo, etiqueta, lista);
  return contenedor;
}
