import type { ReactNode } from "react";
import { combinarClases } from "@/lib/clases";
import type { EstadoOrganizacion, EstadoUsuario } from "@/types/api";

type Tono = "exitoso" | "pendiente" | "peligro" | "neutro" | "info";

const CLASES_TONO: Record<Tono, string> = {
  exitoso: "border-exito-borde bg-exito-suave text-exito-texto",
  pendiente: "border-advertencia-borde bg-advertencia-suave text-advertencia-texto",
  peligro: "border-peligro-borde bg-peligro-suave text-peligro-texto",
  neutro: "border-borde bg-interaccion text-texto",
  info: "border-info-borde bg-info-suave text-info-texto",
};

const TEXTOS_ESTADO: Record<string, string> = {
  pendiente_activacion: "Pendiente de activación",
  activa: "Activa",
  suspendida: "Suspendida",
  inactiva: "Inactiva",
  pendiente_validacion: "Pendiente de validación",
};

const TONOS_ESTADO: Record<string, Tono> = {
  pendiente_activacion: "pendiente",
  activa: "exitoso",
  suspendida: "peligro",
  inactiva: "neutro",
  pendiente_validacion: "pendiente",
};

export function textoDeEstado(estado: EstadoUsuario | EstadoOrganizacion): string {
  return TEXTOS_ESTADO[estado] ?? estado;
}

export function Etiqueta({
  tono,
  children,
  className,
}: {
  tono: Tono;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={combinarClases(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-2xs font-semibold leading-relaxed",
        CLASES_TONO[tono],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EtiquetaEstado({
  estado,
  className,
}: {
  estado: EstadoUsuario | EstadoOrganizacion;
  className?: string;
}) {
  return (
    <Etiqueta tono={TONOS_ESTADO[estado] ?? "neutro"} className={className}>
      {textoDeEstado(estado)}
    </Etiqueta>
  );
}
