import { Injectable } from '@nestjs/common';
import type {
  estado_feria,
  estado_permiso,
  estado_solicitud,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConteoEstadosUsuarioDto,
  ConteoRolesDto,
  IndicadorFeriasDto,
  IndicadorPermisosDto,
  IndicadorSolicitudesDto,
  IndicadorUsuariosDto,
  PanelIndicadoresDto,
} from './dto/panel-response.dto';

/**
 * Estados completos de cada catálogo: la respuesta siempre incluye todas las
 * claves (con 0 cuando no hay registros), de modo que el panel no tiene que
 * manejar valores ausentes.
 */
const ESTADOS_SOLICITUD: readonly estado_solicitud[] = [
  'borrador',
  'radicada',
  'en_revision',
  'devuelta',
  'aprobada',
  'rechazada',
  'cancelada',
];

const ESTADOS_PERMISO: readonly estado_permiso[] = [
  'vigente',
  'suspendido',
  'revocado',
  'vencido',
];

const ESTADOS_FERIA: readonly estado_feria[] = [
  'radicada',
  'aprobada',
  'rechazada',
  'cancelada',
  'realizada',
];

/**
 * Indicadores del panel administrativo (base de la Épica 6, HU-38+).
 *
 * Todos los conteos se hacen con `groupBy` del cliente Prisma sobre columnas
 * escalares (estados y roles), por lo que no se necesitan queries crudos ni
 * geometrías (ver docs/uso_db.md §3). Las consultas son independientes entre
 * sí y se lanzan en paralelo con `Promise.all`.
 */
@Injectable()
export class PanelService {
  constructor(private readonly prisma: PrismaService) {}

  /** Devuelve el resumen de indicadores de la plataforma. */
  async resumen(): Promise<PanelIndicadoresDto> {
    const [usuariosPorEstado, usuariosPorRol, solicitudes, permisos, ferias] =
      await Promise.all([
        this.prisma.usuarios.groupBy({ by: ['estado'], _count: true }),
        this.prisma.usuarios.groupBy({ by: ['rol'], _count: true }),
        this.prisma.solicitudes.groupBy({ by: ['estado'], _count: true }),
        this.prisma.permisos.groupBy({ by: ['estado'], _count: true }),
        this.prisma.ferias.groupBy({ by: ['estado'], _count: true }),
      ]);

    const estados = new Map(usuariosPorEstado.map((f) => [f.estado, f._count]));
    const roles = new Map(usuariosPorRol.map((f) => [f.rol, f._count]));

    const conteoEstados: ConteoEstadosUsuarioDto = {
      total: this.sumar(estados.values()),
      pendientesActivacion: estados.get('pendiente_activacion') ?? 0,
      activas: estados.get('activa') ?? 0,
      suspendidas: estados.get('suspendida') ?? 0,
      inactivas: estados.get('inactiva') ?? 0,
    };

    const conteoRoles: ConteoRolesDto = {
      comerciante: roles.get('comerciante') ?? 0,
      organizador: roles.get('organizador') ?? 0,
      gestor: roles.get('gestor') ?? 0,
    };

    const usuarios: IndicadorUsuariosDto = {
      estados: conteoEstados,
      roles: conteoRoles,
    };

    const indicadorSolicitudes: IndicadorSolicitudesDto = {
      total: solicitudes.reduce((suma, f) => suma + f._count, 0),
      porEstado: this.conteoCompleto(
        ESTADOS_SOLICITUD,
        new Map(solicitudes.map((f) => [f.estado, f._count])),
      ),
    };

    const indicadorPermisos: IndicadorPermisosDto = {
      total: permisos.reduce((suma, f) => suma + f._count, 0),
      porEstado: this.conteoCompleto(
        ESTADOS_PERMISO,
        new Map(permisos.map((f) => [f.estado, f._count])),
      ),
    };

    const indicadorFerias: IndicadorFeriasDto = {
      total: ferias.reduce((suma, f) => suma + f._count, 0),
      porEstado: this.conteoCompleto(
        ESTADOS_FERIA,
        new Map(ferias.map((f) => [f.estado, f._count])),
      ),
    };

    return {
      usuarios,
      solicitudes: indicadorSolicitudes,
      permisos: indicadorPermisos,
      ferias: indicadorFerias,
    };
  }

  /**
   * Construye el registro completo estado → cantidad, llenando con 0 los
   * estados sin registros.
   */
  private conteoCompleto<E extends string>(
    estados: readonly E[],
    conteos: ReadonlyMap<E, number>,
  ): Record<E, number> {
    const resultado = {} as Record<E, number>;
    for (const estado of estados) {
      resultado[estado] = conteos.get(estado) ?? 0;
    }
    return resultado;
  }

  /** Suma los valores de un iterador de conteos. */
  private sumar(valores: Iterable<number>): number {
    let total = 0;
    for (const valor of valores) {
      total += valor;
    }
    return total;
  }
}
