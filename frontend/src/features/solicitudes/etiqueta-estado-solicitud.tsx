import { Etiqueta } from "@/components/ui/etiqueta";
import type { EstadoSolicitud } from "@/types/api";
import {
  ETIQUETAS_ESTADO_SOLICITUD,
  TONOS_ESTADO_SOLICITUD,
} from "./estado-solicitud";

export function EtiquetaEstadoSolicitud({
  estado,
  className,
}: {
  estado: EstadoSolicitud;
  className?: string;
}) {
  return (
    <Etiqueta tono={TONOS_ESTADO_SOLICITUD[estado]} className={className}>
      {ETIQUETAS_ESTADO_SOLICITUD[estado]}
    </Etiqueta>
  );
}
