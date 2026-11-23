import { Etiqueta } from "@/components/ui/etiqueta";
import type { EstadoFeria } from "@/types/api";
import { textoEstadoFeria } from "./validaciones-feria";

const TONOS: Record<EstadoFeria, "exitoso" | "pendiente" | "peligro" | "info" | "neutro"> = {
  radicada: "info",
  aprobada: "exitoso",
  rechazada: "peligro",
  cancelada: "neutro",
  realizada: "exitoso",
};

/** Etiqueta visual del estado de una feria. */
export function EtiquetaEstadoFeria({ estado }: { estado: EstadoFeria }) {
  return (
    <Etiqueta tono={TONOS[estado] ?? "neutro"}>
      {textoEstadoFeria(estado)}
    </Etiqueta>
  );
}
