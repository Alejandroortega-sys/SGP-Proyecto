import { Etiqueta } from "@/components/ui/etiqueta";
import type { EstadoCobro, EstadoPermiso } from "@/types/api";
import {
  ETIQUETAS_ESTADO_COBRO,
  ETIQUETAS_ESTADO_PERMISO,
  TONOS_ESTADO_COBRO,
  TONOS_ESTADO_PERMISO,
} from "./estados-permiso";

export function EtiquetaEstadoPermiso({
  estado,
  className,
}: {
  estado: EstadoPermiso;
  className?: string;
}) {
  return (
    <Etiqueta tono={TONOS_ESTADO_PERMISO[estado]} className={className}>
      {ETIQUETAS_ESTADO_PERMISO[estado]}
    </Etiqueta>
  );
}

export function EtiquetaEstadoCobro({
  estado,
  className,
}: {
  estado: EstadoCobro;
  className?: string;
}) {
  return (
    <Etiqueta tono={TONOS_ESTADO_COBRO[estado]} className={className}>
      {ETIQUETAS_ESTADO_COBRO[estado]}
    </Etiqueta>
  );
}
