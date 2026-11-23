import type {
  EstadoSolicitud,
  FiltrosRevisionSolicitudes,
  OrdenRevisionSolicitudes,
  RequisitoRevision,
  SolicitudRevisionDetalle,
} from "@/types/api";

export const ETIQUETAS_ORDEN_REVISION: Record<
  OrdenRevisionSolicitudes,
  string
> = {
  antiguedad: "Más antiguas primero",
  reciente: "Más recientes primero",
};

export const ESTADOS_BANDEJA_REVISION: Array<{
  valor: EstadoSolicitud | "";
  etiqueta: string;
}> = [
  { valor: "", etiqueta: "Radicadas y en revisión" },
  { valor: "radicada", etiqueta: "Radicadas" },
  { valor: "en_revision", etiqueta: "En revisión" },
  { valor: "devuelta", etiqueta: "Requiere corrección" },
  { valor: "aprobada", etiqueta: "Aprobadas" },
  { valor: "rechazada", etiqueta: "Rechazadas" },
  { valor: "cancelada", etiqueta: "Canceladas" },
];

/** Indica si el gestor puede modificar la revisión. */
export function puedeEditarRevision(
  solicitud: Pick<SolicitudRevisionDetalle, "estado" | "puedeVerificar">,
): boolean {
  return solicitud.estado === "en_revision" && solicitud.puedeVerificar;
}

/** Indica si el gestor puede aprobar o rechazar la solicitud. */
export function puedeResolverRevision(
  solicitud: Pick<SolicitudRevisionDetalle, "estado" | "puedeResolver">,
): boolean {
  return solicitud.estado === "en_revision" && solicitud.puedeResolver;
}

/** Valida el dictamen opcional de una aprobación. */
export function validarDictamenAprobacion(valor: string): string | null {
  if (valor.trim().length > 2_000) {
    return "El dictamen no puede superar 2000 caracteres.";
  }
  return null;
}

/** Valida el motivo obligatorio de un rechazo. */
export function validarMotivoRechazo(valor: string): string | null {
  const texto = valor.trim();
  if (texto.length === 0) {
    return "Escribe el motivo del rechazo. Será visible para el solicitante.";
  }
  if (texto.length > 2_000) {
    return "El motivo del rechazo no puede superar 2000 caracteres.";
  }
  return null;
}

/** Valida la observación general de una devolución. */
export function validarObservacionDevolucion(valor: string): string | null {
  const texto = valor.trim();
  if (texto.length === 0) {
    return "Escribe una observación para explicar qué debe corregir el comerciante.";
  }
  if (texto.length > 2_000) {
    return "La observación no puede superar 2000 caracteres.";
  }
  return null;
}

/** Valida la observación de un requisito marcado como No cumple. */
export function validarObservacionNoCumple(valor: string): string | null {
  if (valor.trim().length === 0) {
    return "Para marcar «No cumple» debes escribir una observación.";
  }
  if (valor.trim().length > 2_000) {
    return "La observación no puede superar 2000 caracteres.";
  }
  return null;
}

/** Requisitos que el gestor marcó como No cumple. */
export function requisitosNoCumple(
  requisitos: readonly RequisitoRevision[],
): RequisitoRevision[] {
  return requisitos.filter((requisito) => requisito.estado === "no_cumple");
}

/** Texto resumido para el aviso de bloqueo. */
export function describirBloqueo(
  solicitud: Pick<SolicitudRevisionDetalle, "estado" | "bloqueo" | "motivoBloqueo">,
  ahora: Date = new Date(),
): { tono: "info" | "advertencia" | "error"; texto: string } {
  const bloqueo = solicitud.bloqueo;
  if (bloqueo) {
    const nombre = `${bloqueo.gestor.nombre}${
      bloqueo.gestor.apellido ? ` ${bloqueo.gestor.apellido}` : ""
    }`;
    if (bloqueo.esPropio) {
      return {
        tono: "info",
        texto: `Tienes el bloqueo de revisión. Se renovará automáticamente mientras la pantalla esté abierta y expira a las ${formatearHora(bloqueo.expiraEn, ahora)}.`,
      };
    }
    return {
      tono: "advertencia",
      texto: `${nombre} está revisando esta solicitud. Puedes consultarla en solo lectura; el bloqueo expira a las ${formatearHora(bloqueo.expiraEn, ahora)}.`,
    };
  }

  if (solicitud.estado === "en_revision") {
    return {
      tono: "advertencia",
      texto:
        solicitud.motivoBloqueo ??
        "La solicitud está en revisión, pero no tiene un bloqueo activo. Vuelve a tomar la revisión para verificar los requisitos.",
    };
  }

  return {
    tono: "info",
    texto:
      solicitud.motivoBloqueo ??
      `La solicitud está en estado «${solicitud.estado.replaceAll("_", " ")}» y no admite verificación.`,
  };
}

/** Construye los parámetros de la bandeja a partir de los filtros. */
export function parametrosRevision(
  filtros: FiltrosRevisionSolicitudes,
): Record<string, string | number | undefined> {
  return {
    estado: filtros.estado,
    sector: filtros.sector?.trim() || undefined,
    actividad: filtros.actividad?.trim() || undefined,
    orden: filtros.orden,
    pagina: filtros.pagina,
    limite: filtros.limite,
  };
}

/** Texto de antigüedad relativa en días para la bandeja. */
export function textoAntiguedad(
  radicadaEn: string | null,
  ahora: Date = new Date(),
): string {
  if (!radicadaEn) return "Sin fecha de radicación";
  const fecha = new Date(radicadaEn);
  if (Number.isNaN(fecha.getTime())) return "Sin fecha válida";
  const dias = Math.max(
    0,
    Math.floor((ahora.getTime() - fecha.getTime()) / 86_400_000),
  );
  if (dias === 0) return "Radicada hoy";
  if (dias === 1) return "Radicada hace 1 día";
  return `Radicada hace ${dias} días`;
}

function formatearHora(valor: string, ahora: Date): string {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "—";
  const restante = Math.max(0, Math.ceil((fecha.getTime() - ahora.getTime()) / 60_000));
  const hora = fecha.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${hora} (${restante} min)`;
}
