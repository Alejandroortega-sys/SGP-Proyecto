import type { EstadoCobro, EstadoPermiso } from "@/types/api";

export const ESTADOS_PERMISO: readonly EstadoPermiso[] = [
  "vigente",
  "suspendido",
  "revocado",
  "vencido",
];

export const ETIQUETAS_ESTADO_PERMISO: Record<EstadoPermiso, string> = {
  vigente: "Vigente",
  suspendido: "Suspendido",
  revocado: "Revocado",
  vencido: "Vencido",
};

export type TonoEstadoPermiso =
  | "exitoso"
  | "pendiente"
  | "peligro"
  | "neutro"
  | "info";

export const TONOS_ESTADO_PERMISO: Record<EstadoPermiso, TonoEstadoPermiso> = {
  vigente: "exitoso",
  suspendido: "pendiente",
  revocado: "peligro",
  vencido: "peligro",
};

/** Indica si el valor es un estado de permiso válido. */
export function esEstadoPermiso(valor: unknown): valor is EstadoPermiso {
  return (
    typeof valor === "string" &&
    (ESTADOS_PERMISO as readonly string[]).includes(valor)
  );
}

/**
 * Estados a los que un gestor puede llevar un permiso desde su estado
 * actual (HU-35). La BD no restringe las transiciones: solo exige motivo
 * para suspender o revocar; el frontend replica la regla del backend para
 * no ofrecer acciones imposibles.
 */
export const DESTINOS_PERMITIDOS: Record<EstadoPermiso, readonly EstadoPermiso[]> = {
  vigente: ["suspendido", "revocado"],
  suspendido: ["vigente", "revocado"],
  revocado: [],
  vencido: [],
};

/** Indica si el estado destino exige motivo obligatorio (HU-35). */
export function destinoExigeMotivo(destino: EstadoPermiso): boolean {
  return destino === "suspendido" || destino === "revocado";
}

/** Días que faltan para la fecha de vencimiento (negativos si ya venció). */
export function diasParaVencer(fechaFin: string, hoy = new Date()): number {
  const fin = new Date(`${fechaFin}T00:00:00`);
  if (Number.isNaN(fin.getTime())) return Number.NaN;
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const milisegundos = fin.getTime() - base.getTime();
  return Math.round(milisegundos / 86_400_000);
}

/**
 * Indica si el permiso se puede renovar (HU-34): estado vigente y fecha de
 * vencimiento aún no pasada.
 */
export function puedeRenovar(
  estado: EstadoPermiso,
  fechaFin: string,
  hoy = new Date(),
): boolean {
  return estado === "vigente" && diasParaVencer(fechaFin, hoy) >= 0;
}

/** Días antes del vencimiento en los que se muestra el aviso (HU-34-CA1). */
export const DIAS_AVISO_RENOVACION = 15;

/** Indica si corresponde mostrar el aviso de vencimiento próximo. */
export function vencePronto(
  estado: EstadoPermiso,
  fechaFin: string,
  hoy = new Date(),
): boolean {
  const dias = diasParaVencer(fechaFin, hoy);
  return (
    estado === "vigente" &&
    Number.isFinite(dias) &&
    dias >= 0 &&
    dias <= DIAS_AVISO_RENOVACION
  );
}

export const ETIQUETAS_ESTADO_COBRO: Record<EstadoCobro, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  anulado: "Anulado",
};

export const TONOS_ESTADO_COBRO: Record<
  EstadoCobro,
  TonoEstadoPermiso
> = {
  pendiente: "pendiente",
  pagado: "exitoso",
  anulado: "neutro",
};

/** Formatea un valor NUMERIC (string) como pesos colombianos. */
export function formatearValorCobro(valor: string): string {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return `$ ${valor}`;
  return `$ ${numero.toLocaleString("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
