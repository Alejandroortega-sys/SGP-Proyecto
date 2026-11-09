import type { CambioModuloDto } from './dto/modulos.dto';

/** Acciones que la tabla `auditoria` registra para `modulos`. */
export type AccionAuditoriaModulo = 'insert' | 'update' | 'delete';

/** Convierte el JSON de auditoría en un objeto seguro. */
export function parsearRegistroAuditoria(
  valor: unknown,
): Record<string, unknown> | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'string') {
    try {
      const parseado = JSON.parse(valor) as unknown;
      return typeof parseado === 'object' && parseado !== null
        ? (parseado as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return typeof valor === 'object'
    ? (valor as Record<string, unknown>)
    : null;
}

/** Normaliza la acción de auditoría a los valores que expone la API. */
export function normalizarAccionAuditoria(
  valor: string,
): AccionAuditoriaModulo {
  const accion = valor.toLowerCase().trim();
  if (accion === 'insert' || accion === 'update' || accion === 'delete') {
    return accion;
  }
  return 'update';
}

function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'bigint') {
    return valor.toString();
  }
  return JSON.stringify(valor);
}

function titularDe(registro: Record<string, unknown> | null): string | null {
  if (!registro) return null;
  return texto(registro.titular_nombre) ?? texto(registro.titular_id);
}

function ubicacionDe(registro: Record<string, unknown> | null): unknown {
  if (!registro) return null;
  return registro.ubicacion ?? null;
}

function iguales(izquierda: unknown, derecha: unknown): boolean {
  return JSON.stringify(izquierda ?? null) === JSON.stringify(derecha ?? null);
}

/**
 * Calcula los cambios legibles entre dos snapshots de auditoría.
 *
 * La auditoría guarda la fila completa antes y después de cada cambio. El
 * historial expone solo los campos relevantes para el gestor y omite los
 * valores internos que no aportan a la ficha.
 */
export function calcularCambiosModulo(
  anterior: Record<string, unknown> | null,
  nuevo: Record<string, unknown> | null,
): CambioModuloDto[] {
  if (!anterior || !nuevo) return [];

  const cambios: CambioModuloDto[] = [];
  const campos: Array<{
    campo: string;
    etiqueta: string;
    valorAnterior: unknown;
    valorNuevo: unknown;
  }> = [
    {
      campo: 'categoria',
      etiqueta: 'Categoría',
      valorAnterior: anterior.categoria,
      valorNuevo: nuevo.categoria,
    },
    {
      campo: 'titular',
      etiqueta: 'Titular',
      valorAnterior: titularDe(anterior),
      valorNuevo: titularDe(nuevo),
    },
    {
      campo: 'actividad',
      etiqueta: 'Actividad',
      valorAnterior: anterior.actividad,
      valorNuevo: nuevo.actividad,
    },
    {
      campo: 'foto_url',
      etiqueta: 'Foto',
      valorAnterior: anterior.foto_url,
      valorNuevo: nuevo.foto_url,
    },
    {
      campo: 'ubicacion',
      etiqueta: 'Ubicación',
      valorAnterior: ubicacionDe(anterior),
      valorNuevo: ubicacionDe(nuevo),
    },
    {
      campo: 'estado',
      etiqueta: 'Estado',
      valorAnterior: anterior.estado,
      valorNuevo: nuevo.estado,
    },
  ];

  for (const campo of campos) {
    if (!iguales(campo.valorAnterior, campo.valorNuevo)) {
      cambios.push({
        campo: campo.campo,
        etiqueta: campo.etiqueta,
        anterior: campo.valorAnterior,
        nuevo: campo.valorNuevo,
      });
    }
  }

  return cambios;
}
