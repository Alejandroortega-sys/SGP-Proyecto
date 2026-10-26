import { Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SesionesService } from './sesiones.service';

interface SesionesPrismaMock {
  sesiones: {
    deleteMany: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
}

function crearPrisma(): {
  prisma: PrismaService;
  sesiones: SesionesPrismaMock['sesiones'];
} {
  const sesiones = {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  return {
    prisma: { sesiones } as unknown as PrismaService,
    sesiones,
  };
}

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('SesionesService', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('crea una sesión y guarda solo el hash del refresh token', async () => {
    const { prisma, sesiones } = crearPrisma();
    sesiones.create.mockResolvedValue({ id: 15n });
    const service = new SesionesService(prisma);

    const creada = await service.crear(5n, 604_800);

    expect(creada.id).toBe(15n);
    expect(creada.refreshToken).toMatch(/^[a-f0-9]{64}$/);
    expect(creada.refreshExpiraEn.getTime()).toBeGreaterThan(Date.now());
    expect(sesiones.deleteMany).toHaveBeenCalledWith({
      where: {
        usuario_id: 5n,
        refresh_expira_en: { lt: expect.any(Date) },
      },
    });
    expect(sesiones.create).toHaveBeenCalledWith({
      data: {
        usuario_id: 5n,
        refresh_token_hash: hash(creada.refreshToken),
        refresh_expira_en: creada.refreshExpiraEn,
      },
      select: { id: true },
    });
    expect(sesiones.create.mock.calls[0][0].data.refresh_token_hash).not.toBe(
      creada.refreshToken,
    );
  });

  it('valida un refresh token activo', async () => {
    const { prisma, sesiones } = crearPrisma();
    sesiones.findFirst.mockResolvedValueOnce({
      id: 15n,
      usuario_id: 5n,
    });
    const service = new SesionesService(prisma);

    const resultado = await service.validarRefresh('refresh-actual');

    expect(resultado).toEqual({
      id: 15n,
      usuarioId: 5n,
      reutilizado: false,
    });
    expect(sesiones.findFirst).toHaveBeenCalledWith({
      where: {
        refresh_token_hash: hash('refresh-actual'),
        revocada_en: null,
        refresh_expira_en: { gt: expect.any(Date) },
      },
      select: { id: true, usuario_id: true },
    });
  });

  it('detecta reutilización del refresh anterior y revoca la sesión', async () => {
    const { prisma, sesiones } = crearPrisma();
    sesiones.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 15n, usuario_id: 5n });
    const service = new SesionesService(prisma);

    const resultado = await service.validarRefresh('refresh-anterior');

    expect(resultado).toEqual({
      id: 15n,
      usuarioId: 5n,
      reutilizado: true,
    });
    expect(sesiones.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        refresh_token_anterior_hash: hash('refresh-anterior'),
        revocada_en: null,
        refresh_expira_en: { gt: expect.any(Date) },
      },
      select: { id: true, usuario_id: true },
    });
    expect(sesiones.updateMany).toHaveBeenCalledWith({
      where: { id: 15n, usuario_id: 5n, revocada_en: null },
      data: { revocada_en: expect.any(Date) },
    });
  });

  it('rota el refresh y conserva el hash anterior', async () => {
    const { prisma, sesiones } = crearPrisma();
    const service = new SesionesService(prisma);

    const rotado = await service.rotar(15n, 'refresh-viejo', 604_800);

    expect(rotado.refreshToken).toMatch(/^[a-f0-9]{64}$/);
    expect(sesiones.update).toHaveBeenCalledWith({
      where: { id: 15n },
      data: {
        refresh_token_anterior_hash: hash('refresh-viejo'),
        refresh_token_hash: hash(rotado.refreshToken),
        refresh_expira_en: rotado.refreshExpiraEn,
      },
    });
  });

  it('indica si una sesión está activa', async () => {
    const { prisma, sesiones } = crearPrisma();
    const service = new SesionesService(prisma);

    sesiones.findFirst.mockResolvedValueOnce({ id: 15n });
    await expect(service.estaActiva(15n, 5n)).resolves.toBe(true);

    sesiones.findFirst.mockResolvedValueOnce(null);
    await expect(service.estaActiva(15n, 5n)).resolves.toBe(false);
  });

  it('revoca una sesión y todas las de un usuario', async () => {
    const { prisma, sesiones } = crearPrisma();
    const service = new SesionesService(prisma);

    await expect(service.revocar(15n, 5n)).resolves.toBe(1);
    expect(sesiones.updateMany).toHaveBeenCalledWith({
      where: { id: 15n, usuario_id: 5n, revocada_en: null },
      data: { revocada_en: expect.any(Date) },
    });

    sesiones.updateMany.mockResolvedValueOnce({ count: 3 });
    await expect(service.revocarTodas(5n)).resolves.toBe(3);
    expect(sesiones.updateMany).toHaveBeenLastCalledWith({
      where: { usuario_id: 5n, revocada_en: null },
      data: { revocada_en: expect.any(Date) },
    });
  });

  it('devuelve null si el refresh no existe', async () => {
    const { prisma, sesiones } = crearPrisma();
    sesiones.findFirst.mockResolvedValue(null);
    const service = new SesionesService(prisma);

    await expect(service.validarRefresh('no-existe')).resolves.toBeNull();
  });
});
