import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { GeoJsonPolygon } from '../common/geo';
import { PrismaService } from '../prisma/prisma.service';
import { ActualizarZonaDto, CrearZonaDto } from './dto/zonas.dto';
import { ZonasService } from './zonas.service';

const FECHA = new Date('2026-09-15T14:30:00.000Z');

const POLIGONO: GeoJsonPolygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-76.196, 4.088],
      [-76.192, 4.088],
      [-76.192, 4.09],
      [-76.196, 4.09],
      [-76.196, 4.088],
    ],
  ],
};

const FILA_DETALLE = {
  id: 1n,
  nombre: 'Centro - Calle 30',
  tipo: 'permitida' as const,
  horario_inicio: '06:00',
  horario_fin: '18:00',
  aforo_maximo: 40,
  activa: true,
  creado_por: 2n,
  creado_en: FECHA,
  actualizado_en: FECHA,
  geometria: POLIGONO,
};

const FILA_LISTADO = {
  id: 1n,
  nombre: 'Centro - Calle 30',
  tipo: 'permitida' as const,
  horario_inicio: '06:00',
  horario_fin: '18:00',
  aforo_maximo: 40,
  activa: true,
  total_espacios: 2,
  total_modulos: 3,
  creado_en: FECHA,
  actualizado_en: FECHA,
};

const FILA_GEOJSON = {
  id: 1n,
  nombre: 'Centro - Calle 30',
  tipo: 'permitida' as const,
  horario_inicio: '06:00',
  horario_fin: '18:00',
  aforo_maximo: 40,
  geometria: POLIGONO,
  productos: ['Frutas frescas', 'Verduras'],
};

interface PrismaMock {
  productos: { findMany: jest.Mock };
  zona_productos: {
    findMany: jest.Mock;
    deleteMany: jest.Mock;
    createMany: jest.Mock;
  };
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
}

interface TxMock {
  $executeRaw: jest.Mock;
  $queryRaw: jest.Mock;
  zona_productos: PrismaMock['zona_productos'];
}

function crearPrisma(): {
  prisma: PrismaService;
  mock: PrismaMock;
  tx: TxMock;
} {
  const zonaProductos = {
    findMany: jest.fn(),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
  };
  const tx: TxMock = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn(),
    zona_productos: zonaProductos,
  };
  const mock: PrismaMock = {
    productos: { findMany: jest.fn() },
    zona_productos: zonaProductos,
    $queryRaw: jest.fn(),
    $transaction: jest
      .fn()
      .mockImplementation((callback: (cliente: TxMock) => Promise<unknown>) =>
        callback(tx),
      ),
  };
  return { prisma: mock as unknown as PrismaService, mock, tx };
}

const DTO_CREAR = {
  nombre: 'Centro - Calle 30',
  tipo: 'permitida',
  geometria: POLIGONO,
  horarioInicio: '06:00',
  horarioFin: '18:00',
  aforoMaximo: 40,
  productosPermitidos: ['1', '2'],
} satisfies CrearZonaDto;

describe('ZonasService', () => {
  describe('crear', () => {
    it('crea la zona, fija el actor y asocia los productos permitidos', async () => {
      const { prisma, mock, tx } = crearPrisma();
      mock.productos.findMany.mockResolvedValue([
        { id: 1n, nombre: 'Frutas frescas', activo: true },
        { id: 2n, nombre: 'Verduras', activo: true },
      ]);
      tx.$queryRaw.mockResolvedValue([FILA_DETALLE]);

      const service = new ZonasService(prisma);
      const resultado = await service.crear('2', DTO_CREAR);

      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(tx.$executeRaw.mock.calls[0][1]).toBe('2');
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(tx.zona_productos.createMany).toHaveBeenCalledWith({
        data: [
          { zona_id: 1n, producto_id: 1n },
          { zona_id: 1n, producto_id: 2n },
        ],
      });
      expect(resultado).toMatchObject({
        id: '1',
        nombre: 'Centro - Calle 30',
        tipo: 'permitida',
        geometria: POLIGONO,
        productosPermitidos: [
          { id: '1', nombre: 'Frutas frescas', activo: true },
          { id: '2', nombre: 'Verduras', activo: true },
        ],
      });
    });

    it('rechaza productos inexistentes sin abrir transacción', async () => {
      const { prisma, mock } = crearPrisma();
      mock.productos.findMany.mockResolvedValue([
        { id: 1n, nombre: 'Frutas frescas', activo: true },
      ]);

      const service = new ZonasService(prisma);

      await expect(service.crear('2', DTO_CREAR)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mock.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza productos inactivos', async () => {
      const { prisma, mock } = crearPrisma();
      mock.productos.findMany.mockResolvedValue([
        { id: 1n, nombre: 'Frutas frescas', activo: false },
        { id: 2n, nombre: 'Verduras', activo: true },
      ]);

      const service = new ZonasService(prisma);

      await expect(service.crear('2', DTO_CREAR)).rejects.toThrow(
        /está inactivo/,
      );
    });

    it('valida la geometría antes de escribir', async () => {
      const { prisma, mock } = crearPrisma();
      const service = new ZonasService(prisma);

      await expect(
        service.crear('2', {
          ...DTO_CREAR,
          productosPermitidos: undefined,
          geometria: { type: 'Polygon', coordinates: [] },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mock.$transaction).not.toHaveBeenCalled();
    });

    it('exige que los horarios se envíen juntos', async () => {
      const { prisma, mock } = crearPrisma();
      const service = new ZonasService(prisma);

      await expect(
        service.crear('2', { ...DTO_CREAR, horarioFin: undefined }),
      ).rejects.toThrow(/deben enviarse juntos/);
      expect(mock.$transaction).not.toHaveBeenCalled();
    });

    it('exige que el horario de fin sea posterior al inicio', async () => {
      const { prisma } = crearPrisma();
      const service = new ZonasService(prisma);

      await expect(
        service.crear('2', {
          ...DTO_CREAR,
          horarioInicio: '18:00',
          horarioFin: '06:00',
        }),
      ).rejects.toThrow(/posterior/);
    });
  });

  describe('listar', () => {
    it('aplica filtros, pagina y mapea los conteos', async () => {
      const { prisma, mock } = crearPrisma();
      mock.$queryRaw
        .mockResolvedValueOnce([FILA_LISTADO])
        .mockResolvedValueOnce([{ total: 1 }]);

      const service = new ZonasService(prisma);
      const resultado = await service.listar({
        tipo: 'permitida',
        activo: true,
        busqueda: 'Centro',
        pagina: 2,
        limite: 10,
      });

      const [strings, ...valores] = mock.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      const sql = strings.join('?');
      expect(sql).toContain('FROM zonas z');
      const where = valores[0] as { sql: string; values: unknown[] };
      expect(where.sql).toContain('z.tipo = ?::tipo_zona');
      expect(where.sql).toContain('z.activa = ?');
      expect(where.sql).toContain('z.nombre ILIKE ?');
      expect(where.values).toEqual(['permitida', true, '%Centro%']);
      expect(valores.slice(1)).toEqual([10, 10]);
      expect(resultado).toEqual({
        datos: [
          {
            id: '1',
            nombre: 'Centro - Calle 30',
            tipo: 'permitida',
            horarioInicio: '06:00',
            horarioFin: '18:00',
            aforoMaximo: 40,
            activa: true,
            totalEspacios: 2,
            totalModulos: 3,
            creadoEn: FECHA,
            actualizadoEn: FECHA,
          },
        ],
        paginacion: {
          pagina: 2,
          limite: 10,
          total: 1,
          totalPaginas: 1,
        },
      });
    });

    it('no agrega filtros si no se envían', async () => {
      const { prisma, mock } = crearPrisma();
      mock.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: 0 }]);

      const service = new ZonasService(prisma);
      const resultado = await service.listar({});

      expect(resultado.paginacion).toEqual({
        pagina: 1,
        limite: 20,
        total: 0,
        totalPaginas: 0,
      });
      const sql = (
        mock.$queryRaw.mock.calls[0][0] as TemplateStringsArray
      ).join('?');
      const [, where] = mock.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        { sql: string },
      ];
      expect(sql).toContain('FROM zonas z');
      expect(where.sql).toBe('');
    });
  });

  describe('detalle', () => {
    it('devuelve atributos, GeoJSON y productos permitidos', async () => {
      const { prisma, mock } = crearPrisma();
      mock.$queryRaw.mockResolvedValue([FILA_DETALLE]);
      mock.zona_productos.findMany.mockResolvedValue([
        {
          productos: { id: 2n, nombre: 'Verduras', activo: true },
        },
        {
          productos: { id: 1n, nombre: 'Frutas frescas', activo: true },
        },
      ]);

      const service = new ZonasService(prisma);
      const resultado = await service.detalle('1');

      expect(resultado).toMatchObject({
        id: '1',
        creadoPor: '2',
        geometria: POLIGONO,
        productosPermitidos: [
          { id: '1', nombre: 'Frutas frescas', activo: true },
          { id: '2', nombre: 'Verduras', activo: true },
        ],
      });
    });

    it('responde 404 si la zona no existe', async () => {
      const { prisma, mock } = crearPrisma();
      mock.$queryRaw.mockResolvedValue([]);

      const service = new ZonasService(prisma);

      await expect(service.detalle('99')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rechaza identificadores no numéricos', async () => {
      const { prisma } = crearPrisma();
      const service = new ZonasService(prisma);

      await expect(service.detalle('abc')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('actualizar', () => {
    it('actualiza solo los campos enviados y conserva la lista de productos', async () => {
      const { prisma, tx } = crearPrisma();
      tx.$queryRaw.mockResolvedValue([
        { ...FILA_DETALLE, nombre: 'Centro renovado' },
      ]);
      tx.zona_productos.findMany.mockResolvedValue([
        {
          productos: { id: 1n, nombre: 'Frutas frescas', activo: true },
        },
      ]);

      const service = new ZonasService(prisma);
      const dto: ActualizarZonaDto = { nombre: 'Centro renovado' };
      const resultado = await service.actualizar('1', '2', dto);

      expect(resultado.nombre).toBe('Centro renovado');
      expect(tx.zona_productos.deleteMany).not.toHaveBeenCalled();
    });

    it('reemplaza la lista de productos cuando se envía', async () => {
      const { prisma, mock, tx } = crearPrisma();
      mock.productos.findMany.mockResolvedValue([
        { id: 1n, nombre: 'Frutas frescas', activo: true },
      ]);
      tx.$queryRaw.mockResolvedValue([FILA_DETALLE]);

      const service = new ZonasService(prisma);
      const resultado = await service.actualizar('1', '2', {
        productosPermitidos: ['1'],
      });

      expect(tx.zona_productos.deleteMany).toHaveBeenCalledWith({
        where: { zona_id: 1n },
      });
      expect(tx.zona_productos.createMany).toHaveBeenCalledWith({
        data: [{ zona_id: 1n, producto_id: 1n }],
      });
      expect(resultado.productosPermitidos).toEqual([
        { id: '1', nombre: 'Frutas frescas', activo: true },
      ]);
    });

    it('rechaza un cuerpo vacío', async () => {
      const { prisma, mock } = crearPrisma();
      const service = new ZonasService(prisma);

      await expect(service.actualizar('1', '2', {})).rejects.toThrow(
        /al menos un campo/,
      );
      expect(mock.$transaction).not.toHaveBeenCalled();
    });

    it('responde 404 si la zona no existe', async () => {
      const { prisma, tx } = crearPrisma();
      tx.$queryRaw.mockResolvedValue([]);

      const service = new ZonasService(prisma);

      await expect(
        service.actualizar('99', '2', { nombre: 'Nueva' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('cambiarEstado', () => {
    it('actualiza el estado y devuelve el mensaje', async () => {
      const { prisma, tx } = crearPrisma();
      tx.$queryRaw.mockResolvedValue([
        {
          id: 1n,
          nombre: 'Centro - Calle 30',
          activa: false,
          actualizado_en: FECHA,
        },
      ]);

      const service = new ZonasService(prisma);
      const resultado = await service.cambiarEstado('1', '2', {
        activa: false,
      });

      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(resultado).toEqual({
        id: '1',
        nombre: 'Centro - Calle 30',
        activa: false,
        actualizadoEn: FECHA,
        mensaje: 'Zona desactivada.',
      });
    });

    it('responde 404 si la zona no existe', async () => {
      const { prisma, tx } = crearPrisma();
      tx.$queryRaw.mockResolvedValue([]);

      const service = new ZonasService(prisma);

      await expect(
        service.cambiarEstado('99', '2', { activa: true }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('geojson', () => {
    it('genera un FeatureCollection con las propiedades del mapa', async () => {
      const { prisma, mock } = crearPrisma();
      mock.$queryRaw.mockResolvedValue([FILA_GEOJSON]);

      const service = new ZonasService(prisma);
      const resultado = await service.geojson();

      expect(resultado).toEqual({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: POLIGONO,
            properties: {
              id: '1',
              nombre: 'Centro - Calle 30',
              tipo: 'permitida',
              horarios: { inicio: '06:00', fin: '18:00' },
              aforo: 40,
              productos: ['Frutas frescas', 'Verduras'],
            },
          },
        ],
      });

      const sql = (
        mock.$queryRaw.mock.calls[0][0] as TemplateStringsArray
      ).join('?');
      const [, geometria] = mock.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        { sql: string },
      ];
      expect(sql).toContain('WHERE z.activa = true');
      expect(geometria.sql).toContain('ST_AsGeoJSON(geometria');
      expect(geometria.sql).not.toContain('ST_SimplifyPreserveTopology');
    });

    it('simplifica la geometría cuando se recibe un zoom alejado', async () => {
      const { prisma, mock } = crearPrisma();
      mock.$queryRaw.mockResolvedValue([FILA_GEOJSON]);

      const service = new ZonasService(prisma);
      await service.geojson({ zoom: 11 });

      const [, geometria] = mock.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        { sql: string },
      ];
      expect(geometria.sql).toContain('ST_SimplifyPreserveTopology');
      expect(geometria.sql).toContain('ST_IsEmpty');
    });

    it('no simplifica la geometría con zoom cercano pero reduce decimales', async () => {
      const { prisma, mock } = crearPrisma();
      mock.$queryRaw.mockResolvedValue([FILA_GEOJSON]);

      const service = new ZonasService(prisma);
      await service.geojson({ zoom: 18 });

      const [, geometria] = mock.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        { sql: string },
      ];
      expect(geometria.sql).not.toContain('ST_SimplifyPreserveTopology');
      expect(geometria.sql).toContain('ST_AsGeoJSON(geometria');
    });
  });
});
