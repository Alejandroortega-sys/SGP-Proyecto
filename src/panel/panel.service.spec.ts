import { PrismaService } from '../prisma/prisma.service';
import type { estado_usuario } from '../generated/prisma/client';
import { PanelService } from './panel.service';

/** Prisma simulado: cada groupBy se programa por llamada. */
function crearPrismaMock(
  usuariosPorEstado: Array<{ estado: estado_usuario; _count: number }>,
  usuariosPorRol: Array<{ rol: string; _count: number }>,
  solicitudes: Array<{ estado: string; _count: number }>,
  permisos: Array<{ estado: string; _count: number }>,
  ferias: Array<{ estado: string; _count: number }>,
): PrismaService {
  return {
    usuarios: {
      groupBy: jest
        .fn()
        .mockResolvedValueOnce(usuariosPorEstado)
        .mockResolvedValueOnce(usuariosPorRol),
    },
    solicitudes: { groupBy: jest.fn().mockResolvedValue(solicitudes) },
    permisos: { groupBy: jest.fn().mockResolvedValue(permisos) },
    ferias: { groupBy: jest.fn().mockResolvedValue(ferias) },
  } as unknown as PrismaService;
}

describe('PanelService', () => {
  it('agrupa los conteos por estado y rol y calcula los totales', async () => {
    const service = new PanelService(
      crearPrismaMock(
        [
          { estado: 'pendiente_activacion', _count: 1 },
          { estado: 'activa', _count: 6 },
        ],
        [
          { rol: 'comerciante', _count: 4 },
          { rol: 'organizador', _count: 2 },
          { rol: 'gestor', _count: 2 },
        ],
        [
          { estado: 'borrador', _count: 1 },
          { estado: 'radicada', _count: 1 },
          { estado: 'aprobada', _count: 1 },
          { estado: 'rechazada', _count: 1 },
        ],
        [{ estado: 'vigente', _count: 1 }],
        [
          { estado: 'radicada', _count: 1 },
          { estado: 'aprobada', _count: 1 },
        ],
      ),
    );

    const resumen = await service.resumen();

    expect(resumen.usuarios.estados).toEqual({
      total: 7,
      pendientesActivacion: 1,
      activas: 6,
      suspendidas: 0,
      inactivas: 0,
    });
    expect(resumen.usuarios.roles).toEqual({
      comerciante: 4,
      organizador: 2,
      gestor: 2,
    });

    expect(resumen.solicitudes.total).toBe(4);
    expect(resumen.solicitudes.porEstado).toEqual({
      borrador: 1,
      radicada: 1,
      en_revision: 0,
      devuelta: 0,
      aprobada: 1,
      rechazada: 1,
      cancelada: 0,
    });

    expect(resumen.permisos.total).toBe(1);
    expect(resumen.permisos.porEstado).toEqual({
      vigente: 1,
      suspendido: 0,
      revocado: 0,
      vencido: 0,
    });

    expect(resumen.ferias.total).toBe(2);
    expect(resumen.ferias.porEstado).toEqual({
      radicada: 1,
      aprobada: 1,
      rechazada: 0,
      cancelada: 0,
      realizada: 0,
    });
  });

  it('llena con 0 los estados sin registros (base de datos vacía)', async () => {
    const service = new PanelService(
      crearPrismaMock([], [], [], [], []),
    );

    const resumen = await service.resumen();

    expect(resumen.usuarios.estados).toEqual({
      total: 0,
      pendientesActivacion: 0,
      activas: 0,
      suspendidas: 0,
      inactivas: 0,
    });
    expect(resumen.usuarios.roles).toEqual({
      comerciante: 0,
      organizador: 0,
      gestor: 0,
    });
    expect(resumen.solicitudes.total).toBe(0);
    expect(resumen.solicitudes.porEstado.radicada).toBe(0);
    expect(resumen.permisos.total).toBe(0);
    expect(resumen.ferias.total).toBe(0);
  });
});
