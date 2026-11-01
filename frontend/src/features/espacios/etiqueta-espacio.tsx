import { Etiqueta } from "@/components/ui/etiqueta";
import type { EstadoEspacio } from "@/types/api";
import {
  COLORES_ESTADO_ESPACIO,
  formatearEstadoEspacio,
  TONOS_ESTADO_ESPACIO,
} from "./estilos-espacio";

/** Etiqueta visual del estado de un espacio. */
export function EtiquetaEstadoEspacio({
  estado,
  className,
}: {
  estado: EstadoEspacio;
  className?: string;
}) {
  return (
    <Etiqueta tono={TONOS_ESTADO_ESPACIO[estado]} className={className}>
      {formatearEstadoEspacio(estado)}
    </Etiqueta>
  );
}

/** Punto de color con símbolo para leyendas y marcadores. */
export function PuntoEstadoEspacio({
  estado,
  className,
}: {
  estado: EstadoEspacio;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{ backgroundColor: COLORES_ESTADO_ESPACIO[estado] }}
      aria-hidden="true"
    />
  );
}
