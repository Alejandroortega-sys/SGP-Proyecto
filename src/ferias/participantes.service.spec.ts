import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { ParticipantesService } from './participantes.service';

const FERIA = {
  id: 1n,
  numero_radicado: 'FER-2026-00001',
  nombre: 'Feria Agroecológica de Diciembre',
  estado: 'aprobada' as const,
  fecha_inicio: new Date('2026-12-10T00:00:00.000Z'),
  fecha_fin: new Date('2026-12-12T00:00:00.000Z'),
  numero_puestos: 2,
  organizador_id: 7n,
  participantes_enviados_en: null as Date | null,
  zonas: { id: 4n, nombre: 'Parque La Guadua' },
  organizadores: {
    nombre_organizacion: 'Fundación Agroecológica del Valle',
    nit: '900123456-7',
    usuarios_organizadores_usuario_idTousuarios: {
      id: 7n,
      nombre: 'Luis',
      apellido: 'Álvarez',
      correo: 'luis.alvarez@agrovalle.org',
    },
  },
};

const PARTICIPANTE = {
  id: 5n,
  nombre_vendedor: 'Doralice Lozano',
  documento: 'CC 43789123',
  creado_en: new Date('2026-11-23T10:00:00.000Z'),
  actualizado_en: new Date('2026-11-23T10:00:00.000Z'),
  feria_vendedor_productos: [
    { productos: { id: 1n, nombre: 'Frutas frescas' } },
  ],
};

const DTO = {
  nombre: 'Doralice Lozano',
  documento: 'CC 43789123',
  productoIds: ['1'],
};

function crearServicio() {
  const prisma = {
    ferias: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    feria_vendedores: {
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    feria_vendedor_productos: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    productos: { findMany: jest.fn() },
    zona_productos: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  };

  prisma.$transaction.mockImplementation(
    (callback: (tx: typeof prisma) => unknown) => callback(prisma),
  );

  const service = new ParticipantesService(
    prisma as unknown as PrismaService,
  );

  return { service, prisma };
}

function prepararConsulta(prisma: ReturnType<typeof crearServicio>['prisma']) {
  prisma.ferias.findFirst.mockResolvedValue(FERIA);
  prisma.$queryRaw.mockResolvedValue([{ id: 1n }]);
  prisma.productos.findMany.mockResolvedValue([
    { id: 1n, nombre: 'Frutas frescas' },
  ]);
  prisma.zona_productos.findMany.mockImplementation(
    ({ select }: { select?: { producto_id?: boolean } }) =>
      Promise.resolve(
        select?.producto_id
          ? [{ producto_id: 1n }]
          : [{ productos: { id: 1n, nombre: 'Frutas frescas' } }],
      ),
  );
}

describe('ParticipantesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listar', () => {
    it('devuelve cupo, productos y participantes activos', async () => {
      const { service, prisma } = crearServicio();
      prepararConsulta(prisma);
      prisma.feria_vendedores.findMany.mockResolvedValue([PARTICIPANTE]);

      const respuesta = await service.listar('7', '1');

      expect(respuesta.cupo).toEqual({
        aprobado: 2,
        ocupados: 1,
        disponibles: 1,
        completo: false,
      });
      expect(respuesta.productosPermitidos).toEqual([
        { id: '1', nombre: 'Frutas frescas' },
      ]);
      expect(respuesta.participantes[0]?.nombre).toBe('Doralice Lozano');
      expect(respuesta.listadoFinal.enviado).toBe(false);
    });

    it('rechaza una feria de otro organizador', async () => {
      const { service, prisma } = crearServicio();
      prisma.ferias.findFirst.mockResolvedValue({
        ...FERIA,
        organizador_id: 99n,
      });

      await expect(service.listar('7', '1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('crear', () => {
    it('crea el participante con sus productos', async () => {
      const { service, prisma } = crearServicio();
      prepararConsulta(prisma);
      prisma.feria_vendedores.count.mockResolvedValue(0);
      prisma.feria_vendedores.findUnique.mockResolvedValue(null);
      prisma.feria_vendedores.create.mockResolvedValue({ id: 5n });
      prisma.feria_vendedores.findUniqueOrThrow.mockResolvedValue(PARTICIPANTE);

      const respuesta = await service.crear('7', '1', DTO);

      expect(respuesta).toMatchObject({
        id: '5',
        nombre: 'Doralice Lozano',
        documento: 'CC 43789123',
      });
      expect(prisma.feria_vendedor_productos.createMany).toHaveBeenCalledWith({
        data: [{ vendedor_id: 5n, producto_id: 1n }],
      });
    });

    it('rechaza una feria no aprobada', async () => {
      const { service, prisma } = crearServicio();
      prepararConsulta(prisma);
      prisma.ferias.findFirst.mockResolvedValue({
        ...FERIA,
        estado: 'radicada',
      });

      await expect(service.crear('7', '1', DTO)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rechaza una feria con el listado final enviado', async () => {
      const { service, prisma } = crearServicio();
      prepararConsulta(prisma);
      prisma.ferias.findFirst.mockResolvedValue({
        ...FERIA,
        participantes_enviados_en: new Date(),
      });

      await expect(service.crear('7', '1', DTO)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rechaza cuando el cupo aprobado está lleno', async () => {
      const { service, prisma } = crearServicio();
      prepararConsulta(prisma);
      prisma.feria_vendedores.count.mockResolvedValue(2);

      await expect(service.crear('7', '1', DTO)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rechaza un producto no permitido en la zona', async () => {
      const { service, prisma } = crearServicio();
      prepararConsulta(prisma);
      prisma.productos.findMany.mockResolvedValue([
        { id: 2n, nombre: 'Verduras' },
      ]);
      prisma.zona_productos.findMany.mockResolvedValue([
        { producto_id: 1n },
      ]);

      await expect(
        service.crear('7', '1', { ...DTO, productoIds: ['2'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza un documento de un participante activo', async () => {
      const { service, prisma } = crearServicio();
      prepararConsulta(prisma);
      prisma.feria_vendedores.count.mockResolvedValue(0);
      prisma.feria_vendedores.findUnique.mockResolvedValue({
        id: 5n,
        activo: true,
      });

      await expect(service.crear('7', '1', DTO)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('reactiva un participante retirado con el mismo documento', async () => {
      const { service, prisma } = crearServicio();
      prepararConsulta(prisma);
      prisma.feria_vendedores.count.mockResolvedValue(0);
      prisma.feria_vendedores.findUnique.mockResolvedValue({
        id: 5n,
        activo: false,
      });
      prisma.feria_vendedores.findUniqueOrThrow.mockResolvedValue(PARTICIPANTE);

      await service.crear('7', '1', DTO);

      expect(prisma.feria_vendedores.update).toHaveBeenCalledWith({
        where: { id: 5n },
        data: expect.objectContaining({
          activo: true,
          eliminado_en: null,
        }),
      });
      expect(prisma.feria_vendedores.create).not.toHaveBeenCalled();
    });
  });

  describe('actualizar', () => {
    it('reemplaza los productos del participante', async () => {
      const { service, prisma } = crearServicio();
      prepararConsulta(prisma);
      prisma.feria_vendedores.findFirst.mockResolvedValue({
        id: 5n,
        documento: 'CC 43789123',
      });
      prisma.feria_vendedores.findUniqueOrThrow.mockResolvedValue(PARTICIPANTE);

      await service.actualizar('7', '1', '5', { productoIds: ['1'] });

      expect(prisma.feria_vendedor_productos.deleteMany).toHaveBeenCalledWith({
        where: { vendedor_id: 5n },
      });
      expect(prisma.feria_vendedor_productos.createMany).toHaveBeenCalled();
    });

    it('rechaza una actualización vacía', async () => {
      const { service } = crearServicio();

      await expect(
        service.actualizar('7', '1', '5', {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('eliminar', () => {
    it('aplica una baja lógica', async () => {
      const { service, prisma } = crearServicio();
      prepararConsulta(prisma);
      prisma.feria_vendedores.findFirst.mockResolvedValue({ id: 5n });

      await service.eliminar('7', '1', '5');

      expect(prisma.feria_vendedores.update).toHaveBeenCalledWith({
        where: { id: 5n },
        data: { activo: false, eliminado_en: expect.any(Date) },
      });
    });
  });

  describe('enviar', () => {
    it('exige al menos un participante activo', async () => {
      const { service, prisma } = crearServicio();
      prepararConsulta(prisma);
      prisma.feria_vendedores.count.mockResolvedValue(0);

      await expect(service.enviar('7', '1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('marca el listado final como enviado', async () => {
      const { service, prisma } = crearServicio();
      prepararConsulta(prisma);
      prisma.feria_vendedores.count.mockResolvedValue(2);

      const respuesta = await service.enviar('7', '1');

      expect(respuesta.totalParticipantes).toBe(2);
      expect(prisma.ferias.update).toHaveBeenCalledWith({
        where: { id: 1n },
        data: { participantes_enviados_en: expect.any(Date) },
      });
    });
  });

  describe('listarGestor', () => {
    it('responde 409 mientras el listado no se ha enviado', async () => {
      const { service, prisma } = crearServicio();
      prisma.ferias.findFirst.mockResolvedValue(FERIA);

      await expect(service.listarGestor('1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('devuelve el listado final con los datos del organizador', async () => {
      const { service, prisma } = crearServicio();
      prepararConsulta(prisma);
      prisma.ferias.findFirst.mockResolvedValue({
        ...FERIA,
        participantes_enviados_en: new Date('2026-11-24T10:00:00.000Z'),
      });
      prisma.feria_vendedores.findMany.mockResolvedValue([PARTICIPANTE]);

      const respuesta = await service.listarGestor('1');

      expect(respuesta.organizador).toEqual({
        id: '7',
        nombre: 'Luis',
        apellido: 'Álvarez',
        correo: 'luis.alvarez@agrovalle.org',
        organizacion: 'Fundación Agroecológica del Valle',
        nit: '900123456-7',
      });
      expect(respuesta.listadoFinal.enviado).toBe(true);
    });
  });
});
