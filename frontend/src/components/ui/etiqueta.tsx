import type { ReactNode } from "react";
import { combinarClases } from "@/lib/clases";
import type { EstadoOrganizacion, EstadoUsuario } from "@/types/api";

type Tono = "exitoso" | "pendiente" | "peligro" | "neutro";

const CLASES_TONO: Record<Tono, string> = {
  exitoso: "border-emerald-200 bg-emerald-50 text-emerald-700",
  pendiente: "border-amber-200 bg-amber-50 text-amber-700",
  peligro: "border-rose-200 bg-rose-50 text-rose-700",
  neutro: "border-slate-200 bg-slate-100 text-slate-700",
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
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
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
