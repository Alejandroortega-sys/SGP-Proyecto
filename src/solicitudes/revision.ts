import { enteroPositivo } from '../common/entero-positivo';
import type {
  estado_documento,
  estado_solicitud,
} from '../generated/prisma/client';

/** Estados que forman la cola activa de revisión por defecto. */
export const ESTADOS_COLA_REVISION = ['radicada', 'en_revision'] as const;

/** Estados que se pueden consultar desde los filtros de la bandeja. */
export const ESTADOS_BANDEJA_REVISION: readonly estado_solicitud[] = [
  'radicada',
  'en_revision',
  'devuelta',
  'aprobada',
  'rechazada',
  'cancelada',
];

/** Órdenes admitidos por la bandeja de revisión. */
export const ORDENES_REVISION = ['antiguedad', 'reciente'] as const;

export type OrdenRevision = (typeof ORDENES_REVISION)[number];

/** Minutos de bloqueo de revisión por defecto (HU-19). */
export const MINUTOS_BLOQUEO_REVISION_POR_DEFECTO = 15;

/** Resultado visible de la verificación de un requisito. */
export type VerificacionRequisito = 'cumple' | 'no_cumple';

/** Estado visible de un requisito en la bandeja y el visor del gestor. */
export type EstadoRequisitoRevision =
  'faltante' | 'cargado' | 'cumple' | 'no_cumple';

/** Progreso de la lista de verificación de una solicitud. */
export interface ProgresoRevision {
  total: number;
  pendientes: number;
  verificados: number;
  cumple: number;
  noCumple: number;
}

/**
 * Minutos que dura el bloqueo de revisión sin actividad.
 *
 * Se configura con `REVISION_LOCK_MINUTES`; si el valor falta o es inválido se
 * usan 15 minutos.
 */
export function minutosBloqueoRevision(): number {
  return enteroPositivo(
    process.env.REVISION_LOCK_MINUTES,
    MINUTOS_BLOQUEO_REVISION_POR_DEFECTO,
  );
}

/** Indica si la solicitud admite tomar el bloqueo de revisión. */
export function puedeTomarRevision(estado: estado_solicitud): boolean {
  return estado === 'radicada' || estado === 'en_revision';
}

/** Indica si la solicitud admite verificar requisitos. */
export function puedeVerificarRevision(estado: estado_solicitud): boolean {
  return estado === 'en_revision';
}

/** Indica si un bloqueo sigue vigente. */
export function estaBloqueoVigente(
  expiraEn: Date | string,
  ahora: Date = new Date(),
): boolean {
  const fecha =
    expiraEn instanceof Date ? expiraEn : new Date(`${expiraEn}`);
  return !Number.isNaN(fecha.getTime()) && fecha.getTime() > ahora.getTime();
}

/** Traduce la verificación visible al estado almacenado del documento. */
export function estadoDocumentoPorVerificacion(
  verificacion: VerificacionRequisito,
): estado_documento {
  return verificacion === 'cumple' ? 'validado' : 'observado';
}

/** Estado visible de un requisito a partir de su documento vigente. */
export function estadoRequisitoRevision(
  estadoDocumento: estado_documento | null | undefined,
  tieneDocumento: boolean,
): EstadoRequisitoRevision {
  if (!tieneDocumento) return 'faltante';
  if (estadoDocumento === 'validado') return 'cumple';
  if (estadoDocumento === 'observado') return 'no_cumple';
  return 'cargado';
}

/** Calcula el avance de una lista de requisitos. */
export function calcularProgresoRevision(
  requisitos: readonly { estado: EstadoRequisitoRevision }[],
): ProgresoRevision {
  const cumple = requisitos.filter(
    (requisito) => requisito.estado === 'cumple',
  ).length;
  const noCumple = requisitos.filter(
    (requisito) => requisito.estado === 'no_cumple',
  ).length;
  const verificados = cumple + noCumple;

  return {
    total: requisitos.length,
    pendientes: requisitos.length - verificados,
    verificados,
    cumple,
    noCumple,
  };
}

/** Documentos que no fueron reemplazados por una versión posterior. */
export function documentosVigentesRevision<
  T extends { id: bigint | string; reemplaza_a: bigint | string | null },
>(filas: readonly T[]): T[] {
  const reemplazados = new Set(
    filas
      .map((fila) => fila.reemplaza_a?.toString())
      .filter((id): id is string => Boolean(id)),
  );
  return filas.filter((fila) => !reemplazados.has(fila.id.toString()));
}

/** Validación de la observación de un requisito según su verificación. */
export function validarObservacionVerificacion(
  verificacion: VerificacionRequisito,
  observacion: string | null | undefined,
): string | null {
  const texto = observacion?.trim() ?? '';
  if (verificacion === 'no_cumple' && texto.length === 0) {
    return 'Para marcar un requisito como «No cumple» debes escribir una observación.';
  }
  if (texto.length > 2_000) {
    return 'La observación no puede superar 2000 caracteres.';
  }
  return null;
}

/** Resumen legible del tiempo restante de un bloqueo (para la interfaz). */
export function minutosRestantesBloqueo(
  expiraEn: Date | string,
  ahora: Date = new Date(),
): number {
  const fecha =
    expiraEn instanceof Date ? expiraEn : new Date(`${expiraEn}`);
  if (Number.isNaN(fecha.getTime())) return 0;
  return Math.max(0, Math.ceil((fecha.getTime() - ahora.getTime()) / 60_000));
}
