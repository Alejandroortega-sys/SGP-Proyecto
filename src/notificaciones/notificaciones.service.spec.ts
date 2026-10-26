import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from './notificaciones.service';

const FECHA = new Date('2026-09-20T10:00:00.000Z');

interface NotificacionesPrismaMock {
  notificaciones: {
    findMany: jest.Mock;
    count: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
}

function crearPrisma(): {
  prisma: PrismaService;
  notificaciones: NotificacionesPrismaMock['notificaciones'];
} {
  const notificaciones = {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  return {
    prisma: { notificaciones } as unknown as PrismaService,
    notificaciones,
  };
}

describe('NotificacionesService', () => {
  it('lista solo las notificaciones del usuario y cuenta las no leídas', async () => {
    const { prisma, notificaciones } = crearPrisma();
    notificaciones.findMany.mockResolvedValue([
      {
        id: 12n,
        tipo: 'cambio_password',
        asunto: 'Contraseña actualizada',
        cuerpo: 'Tu contraseña cambió',
        canal: 'app',
        leida: false,
        creada_en: FECHA,
      },
    ]);
    notificaciones.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3);

    const service = new NotificacionesService(prisma);
    const resultado = await service.listar('5', { pagina: 1, limite: 20 });

    expect(notificaciones.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { usuario_id: 5n },
        skip: 0,
        take: 20,
      }),
    );
    expect(notificaciones.count).toHaveBeenNthCalledWith(1, {
      where: { usuario_id: 5n },
    });
    expect(notificaciones.count).toHaveBeenNthCalledWith(2, {
      where: { usuario_id: 5n, leida: false },
    });
    expect(resultado).toEqual({
      datos: [
        {
          id: '12',
          tipo: 'cambio_password',
          asunto: 'Contraseña actualizada',
          cuerpo: 'Tu contraseña cambió',
          canal: 'app',
          leida: false,
          creadaEn: FECHA,
        },
      ],
      paginacion: {
        pagina: 1,
        limite: 20,
        total: 1,
        totalPaginas: 1,
      },
      noLeidas: 3,
    });
  });

  it('marca una notificación propia como leída', async () => {
    const { prisma, notificaciones } = crearPrisma();
    notificaciones.findFirst.mockResolvedValue({ id: 12n });
    notificaciones.update.mockResolvedValue({
      id: 12n,
      tipo: 'estado_cuenta',
      asunto: 'Cuenta suspendida',
      cuerpo: 'Motivo',
      canal: 'app',
      leida: true,
      creada_en: FECHA,
    });

    const service = new NotificacionesService(prisma);
    const resultado = await service.marcarLeida('12', '5', true);

    expect(notificaciones.findFirst).toHaveBeenCalledWith({
      where: { id: 12n, usuario_id: 5n },
      select: { id: true },
    });
    expect(notificaciones.update).toHaveBeenCalledWith({
      where: { id: 12n },
      data: { leida: true },
      select: expect.any(Object),
    });
    expect(resultado.leida).toBe(true);
  });

  it('responde 404 si la notificación pertenece a otro usuario', async () => {
    const { prisma, notificaciones } = crearPrisma();
    notificaciones.findFirst.mockResolvedValue(null);

    await expect(
      new NotificacionesService(prisma).marcarLeida('12', '5', true),
    ).rejects.toThrow(NotFoundException);
    expect(notificaciones.update).not.toHaveBeenCalled();
  });

  it('marca todas las no leídas y devuelve cuántas actualizó', async () => {
    const { prisma, notificaciones } = crearPrisma();
    notificaciones.updateMany.mockResolvedValue({ count: 4 });

    const resultado = await new NotificacionesService(prisma).marcarTodasLeidas(
      '5',
    );

    expect(notificaciones.updateMany).toHaveBeenCalledWith({
      where: { usuario_id: 5n, leida: false },
      data: { leida: true },
    });
    expect(resultado.actualizadas).toBe(4);
  });
});
