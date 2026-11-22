import { NotFoundException } from '@nestjs/common';
import type { CorreoService } from '../correo/correo.service';
import type { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from './notificaciones.service';

const FECHA = new Date('2026-09-20T10:00:00.000Z');

interface NotificacionesPrismaMock {
  notificaciones: {
    create: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
}

interface CorreoMock {
  enviarCambioEstadoSolicitud: jest.Mock;
}

function crearPrisma(): {
  prisma: PrismaService;
  notificaciones: NotificacionesPrismaMock['notificaciones'];
} {
  const notificaciones = {
    create: jest.fn(),
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

function crearCorreo(): { correo: CorreoService; mock: CorreoMock } {
  const mock: CorreoMock = {
    enviarCambioEstadoSolicitud: jest.fn().mockResolvedValue(undefined),
  };
  return { correo: mock as unknown as CorreoService, mock };
}

describe('NotificacionesService', () => {
  it('lista solo las notificaciones del usuario y cuenta las no leídas', async () => {
    const { prisma, notificaciones } = crearPrisma();
    const { correo } = crearCorreo();
    notificaciones.findMany.mockResolvedValue([
      {
        id: 12n,
        solicitud_id: null,
        tipo: 'cambio_password',
        asunto: 'Contraseña actualizada',
        cuerpo: 'Tu contraseña cambió',
        canal: 'app',
        leida: false,
        creada_en: FECHA,
      },
    ]);
    notificaciones.count.mockResolvedValueOnce(1).mockResolvedValueOnce(3);

    const service = new NotificacionesService(prisma, correo);
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
          solicitudId: null,
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

  it('crea la notificación de cambio de estado dentro de la transacción', async () => {
    const { prisma, notificaciones } = crearPrisma();
    const { correo } = crearCorreo();
    notificaciones.create.mockResolvedValue({ id: 21n });

    const service = new NotificacionesService(prisma, correo);
    const id = await service.crearCambioEstadoSolicitud(
      { notificaciones } as never,
      {
        solicitudId: 12n,
        numeroRadicado: 'SOL-2026-00012',
        usuarioId: 3n,
        estadoAnterior: 'radicada',
        estadoNuevo: 'en_revision',
        espacio: 'Kiosco Parque La Guadalupe',
      },
    );

    expect(id).toBe('21');
    expect(notificaciones.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuario_id: 3n,
        solicitud_id: 12n,
        tipo: 'solicitud_en_revision',
        canal: 'app',
        leida: false,
      }),
      select: { id: true },
    });
    expect(notificaciones.create.mock.calls[0][0].data.asunto).toContain(
      'En revisión',
    );
    expect(notificaciones.create.mock.calls[0][0].data.cuerpo).toContain(
      'Kiosco Parque La Guadalupe',
    );
  });

  it('envía el correo de cambio de estado y reporta éxito', async () => {
    const { prisma } = crearPrisma();
    const { correo, mock } = crearCorreo();

    const resultado = await new NotificacionesService(
      prisma,
      correo,
    ).enviarCorreoCambioEstadoSolicitud(
      { correo: 'maria@example.com', nombre: 'María' },
      {
        solicitudId: 12n,
        numeroRadicado: 'SOL-2026-00012',
        usuarioId: 3n,
        estadoAnterior: 'en_revision',
        estadoNuevo: 'aprobada',
      },
    );

    expect(mock.enviarCambioEstadoSolicitud).toHaveBeenCalledWith(
      'maria@example.com',
      'María',
      expect.objectContaining({
        solicitudId: '12',
        estadoNuevo: 'aprobada',
      }),
    );
    expect(resultado).toEqual({ correoEnviado: true, mensajeCorreo: null });
  });

  it('no revierte ni lanza si falla el correo de cambio de estado', async () => {
    const { prisma } = crearPrisma();
    const { correo, mock } = crearCorreo();
    mock.enviarCambioEstadoSolicitud.mockRejectedValue(new Error('SMTP caído'));

    const resultado = await new NotificacionesService(
      prisma,
      correo,
    ).enviarCorreoCambioEstadoSolicitud(
      { correo: 'maria@example.com', nombre: 'María' },
      {
        solicitudId: 12n,
        numeroRadicado: 'SOL-2026-00012',
        usuarioId: 3n,
        estadoAnterior: 'en_revision',
        estadoNuevo: 'rechazada',
        motivoRechazo: 'Documento inválido',
      },
    );

    expect(resultado.correoEnviado).toBe(false);
    expect(resultado.mensajeCorreo).toContain('no pudimos enviar');
  });

  it('marca una notificación propia como leída', async () => {
    const { prisma, notificaciones } = crearPrisma();
    const { correo } = crearCorreo();
    notificaciones.findFirst.mockResolvedValue({ id: 12n });
    notificaciones.update.mockResolvedValue({
      id: 12n,
      solicitud_id: 12n,
      tipo: 'estado_cuenta',
      asunto: 'Cuenta suspendida',
      cuerpo: 'Motivo',
      canal: 'app',
      leida: true,
      creada_en: FECHA,
    });

    const service = new NotificacionesService(prisma, correo);
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
    expect(resultado).toEqual(
      expect.objectContaining({ leida: true, solicitudId: '12' }),
    );
  });

  it('responde 404 si la notificación pertenece a otro usuario', async () => {
    const { prisma, notificaciones } = crearPrisma();
    const { correo } = crearCorreo();
    notificaciones.findFirst.mockResolvedValue(null);

    await expect(
      new NotificacionesService(prisma, correo).marcarLeida('12', '5', true),
    ).rejects.toThrow(NotFoundException);
    expect(notificaciones.update).not.toHaveBeenCalled();
  });

  it('marca todas las no leídas y devuelve cuántas actualizó', async () => {
    const { prisma, notificaciones } = crearPrisma();
    const { correo } = crearCorreo();
    notificaciones.updateMany.mockResolvedValue({ count: 4 });

    const resultado = await new NotificacionesService(
      prisma,
      correo,
    ).marcarTodasLeidas('5');

    expect(notificaciones.updateMany).toHaveBeenCalledWith({
      where: { usuario_id: 5n, leida: false },
      data: { leida: true },
    });
    expect(resultado.actualizadas).toBe(4);
  });
});
