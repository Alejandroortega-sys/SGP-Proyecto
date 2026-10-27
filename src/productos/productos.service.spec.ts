import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductosService } from './productos.service';

const PRODUCTO_ACTIVO = {
  id: 1n,
  nombre: 'Frutas frescas',
  activo: true,
};

const PRODUCTO_INACTIVO = {
  id: 6n,
  nombre: 'Plantas ornamentales',
  activo: false,
};

interface ProductosPrismaMock {
  productos: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
}

function crearPrisma(): {
  prisma: PrismaService;
  productos: ProductosPrismaMock['productos'];
} {
  const productos = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  return {
    prisma: { productos } as unknown as PrismaService,
    productos,
  };
}

describe('ProductosService', () => {
  describe('listar', () => {
    it('devuelve todos los productos al gestor, incluidos los inactivos', async () => {
      const { prisma, productos } = crearPrisma();
      productos.findMany.mockResolvedValue([
        PRODUCTO_ACTIVO,
        PRODUCTO_INACTIVO,
      ]);

      const service = new ProductosService(prisma);
      const resultado = await service.listar('gestor');

      expect(productos.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { nombre: 'asc' },
        select: { id: true, nombre: true, activo: true },
      });
      expect(resultado).toEqual({
        datos: [
          { id: '1', nombre: 'Frutas frescas', activo: true },
          { id: '6', nombre: 'Plantas ornamentales', activo: false },
        ],
      });
    });

    it.each(['comerciante', 'organizador'] as const)(
      'solo devuelve productos activos al rol %s',
      async (rol) => {
        const { prisma, productos } = crearPrisma();
        productos.findMany.mockResolvedValue([PRODUCTO_ACTIVO]);

        const service = new ProductosService(prisma);
        await service.listar(rol);

        expect(productos.findMany).toHaveBeenCalledWith({
          where: { activo: true },
          orderBy: { nombre: 'asc' },
          select: { id: true, nombre: true, activo: true },
        });
      },
    );
  });

  describe('crear', () => {
    it('crea el producto activo con el nombre recortado', async () => {
      const { prisma, productos } = crearPrisma();
      productos.findUnique.mockResolvedValue(null);
      productos.create.mockResolvedValue(PRODUCTO_ACTIVO);

      const service = new ProductosService(prisma);
      const resultado = await service.crear({
        nombre: '  Frutas frescas  ',
      });

      expect(productos.findUnique).toHaveBeenCalledWith({
        where: { nombre: 'Frutas frescas' },
        select: { id: true },
      });
      expect(productos.create).toHaveBeenCalledWith({
        data: { nombre: 'Frutas frescas' },
        select: { id: true, nombre: true, activo: true },
      });
      expect(resultado).toEqual({
        id: '1',
        nombre: 'Frutas frescas',
        activo: true,
      });
    });

    it('rechaza con 409 un nombre ya registrado sin llegar a crear', async () => {
      const { prisma, productos } = crearPrisma();
      productos.findUnique.mockResolvedValue({ id: 1n });

      const service = new ProductosService(prisma);

      await expect(
        service.crear({ nombre: 'Frutas frescas' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(productos.create).not.toHaveBeenCalled();
    });
  });

  describe('cambiarEstado', () => {
    it('actualiza el estado del producto existente', async () => {
      const { prisma, productos } = crearPrisma();
      productos.findUnique.mockResolvedValue({ id: 6n });
      productos.update.mockResolvedValue(PRODUCTO_INACTIVO);

      const service = new ProductosService(prisma);
      const resultado = await service.cambiarEstado('6', { activo: false });

      expect(productos.findUnique).toHaveBeenCalledWith({
        where: { id: 6n },
        select: { id: true },
      });
      expect(productos.update).toHaveBeenCalledWith({
        where: { id: 6n },
        data: { activo: false },
        select: { id: true, nombre: true, activo: true },
      });
      expect(resultado).toEqual({
        id: '6',
        nombre: 'Plantas ornamentales',
        activo: false,
      });
    });

    it('rechaza con 400 un identificador no numérico', async () => {
      const { prisma, productos } = crearPrisma();
      const service = new ProductosService(prisma);

      await expect(
        service.cambiarEstado('abc', { activo: false }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(productos.findUnique).not.toHaveBeenCalled();
    });

    it('rechaza con 404 un producto inexistente', async () => {
      const { prisma, productos } = crearPrisma();
      productos.findUnique.mockResolvedValue(null);

      const service = new ProductosService(prisma);

      await expect(
        service.cambiarEstado('99', { activo: true }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(productos.update).not.toHaveBeenCalled();
    });
  });
});
