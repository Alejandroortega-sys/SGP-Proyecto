import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { GeoJsonPoint, GeoJsonPolygon } from '../common/geo';
import type { tipo_zona } from '../generated/prisma/client';

/** Vigencia de una previsualización en memoria. */
export const TTL_PREVISUALIZACION_MS = 30 * 60 * 1000;

/** Número máximo de previsualizaciones pendientes por proceso. */
export const MAX_PREVISUALIZACIONES = 20;

export type TipoImportacion = 'zonas' | 'modulos';

export type EstadoFilaImportacion = 'valida' | 'rechazada' | 'advertencia';

/** Zona activa que contiene un punto de módulo. */
export interface ZonaContenedoraPreview {
  id: string;
  nombre: string;
  tipo: tipo_zona;
}

/** Resultado de importar una fila. */
export type ConfirmacionFila =
  | { ok: true; id: string; codigo?: string; nombre: string }
  | { ok: false; motivo: string };

/** Fila normalizada durante la previsualización. */
export interface FilaPrevisualizacion {
  fila: number;
  estado: EstadoFilaImportacion;
  datos: Record<string, unknown>;
  geometria?: GeoJsonPolygon | GeoJsonPoint;
  zonaContenedora?: ZonaContenedoraPreview | null;
  errores: string[];
  advertencias: string[];
  /** La fila requiere confirmación global por estar en zona restringida. */
  requiereConfirmacion?: boolean;
  /** IDs de productos resueltos por nombre (solo zonas). */
  productosIds?: string[];
  confirmacion?: ConfirmacionFila;
}

export interface ResumenPrevisualizacion {
  total: number;
  validas: number;
  rechazadas: number;
  advertencias: number;
}

export interface ImportadoConfirmado {
  fila: number;
  id: string;
  codigo?: string;
  nombre: string;
}

export interface RechazadoConfirmado {
  fila: number;
  motivo: string;
}

export interface ResultadoConfirmacion {
  resumen: {
    total: number;
    importados: number;
    rechazados: number;
    conAdvertencia: number;
  };
  importados: ImportadoConfirmado[];
  rechazados: RechazadoConfirmado[];
}

/** Entrada guardada entre la previsualización y la confirmación. */
export interface EntradaPrevisualizacion {
  token: string;
  tipo: TipoImportacion;
  actorId: bigint;
  creadoEn: Date;
  expiraEn: Date;
  archivo: { nombre: string; bytes: number };
  sridOrigen: number | null;
  sridDetectado: boolean;
  filas: FilaPrevisualizacion[];
  resumen: ResumenPrevisualizacion;
  resultado?: ResultadoConfirmacion;
  promesa?: Promise<ResultadoConfirmacion>;
}

/** Datos que el servicio entrega al crear una entrada. */
export type NuevaPrevisualizacion = Omit<
  EntradaPrevisualizacion,
  'token' | 'creadoEn' | 'expiraEn'
>;

/**
 * Almacén en memoria de previsualizaciones.
 *
 * No hay tabla nueva: la previsualización vive 30 minutos en el proceso. En un
 * despliegue con varias instancias esto obligaría a compartir el almacén, pero
 * el proyecto corre con una sola API.
 */
@Injectable()
export class AlmacenPrevisualizaciones {
  private readonly entradas = new Map<string, EntradaPrevisualizacion>();
  private ttlMs = TTL_PREVISUALIZACION_MS;
  private maxEntradas = MAX_PREVISUALIZACIONES;

  /**
   * Ajusta la vigencia y el máximo de entradas. Existe para las pruebas; en
   * producción se usan las constantes del módulo.
   */
  configurar(ttlMs: number, maxEntradas = MAX_PREVISUALIZACIONES): void {
    this.ttlMs = ttlMs;
    this.maxEntradas = maxEntradas;
  }

  /** Crea una entrada con token UUID y fecha de expiración. */
  crear(datos: NuevaPrevisualizacion): EntradaPrevisualizacion {
    this.limpiarExpiradas();

    while (this.entradas.size >= this.maxEntradas) {
      const masAntigua = [...this.entradas.values()].sort(
        (a, b) => a.creadoEn.getTime() - b.creadoEn.getTime(),
      )[0];
      if (!masAntigua) break;
      this.entradas.delete(masAntigua.token);
    }

    const creadoEn = new Date();
    const entrada: EntradaPrevisualizacion = {
      ...datos,
      token: randomUUID(),
      creadoEn,
      expiraEn: new Date(creadoEn.getTime() + this.ttlMs),
    };

    this.entradas.set(entrada.token, entrada);
    return entrada;
  }

  /** Devuelve una entrada vigente o `null` si no existe o expiró. */
  obtener(token: string): EntradaPrevisualizacion | null {
    const entrada = this.entradas.get(token);
    if (!entrada) return null;

    if (entrada.expiraEn.getTime() <= Date.now()) {
      this.entradas.delete(token);
      return null;
    }

    return entrada;
  }

  /** Elimina una entrada (útil en pruebas o al cancelar el flujo). */
  eliminar(token: string): void {
    this.entradas.delete(token);
  }

  private limpiarExpiradas(): void {
    const ahora = Date.now();
    for (const [token, entrada] of this.entradas) {
      if (entrada.expiraEn.getTime() <= ahora) {
        this.entradas.delete(token);
      }
    }
  }
}
