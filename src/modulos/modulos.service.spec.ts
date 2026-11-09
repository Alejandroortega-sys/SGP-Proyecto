import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { ModulosService } from './modulos.service';
import type {
  ActualizarModuloDto,
  CrearModuloDto,
} from './dto/modulos.dto';

const FECHA = new Date('2026-10-01T12:00:00.000Z');
const PUNTO = { type: 'Point' as const, coordinates: [-76.1955, 4.0885] as [number, number] };

const ZONA = {
  id: 1n,
  nombre: 'Centro - Calle 30',
  tipo: 'permitida' as const,
  horario_inicio: '06:00',
  horario_fin: '18:00',
  aforo_maximo: 40,
  productos: ['Frutas frescas'],
};

const ZONA_RESTRINGIDA = {
  ...ZONA,
  id: 3n,
  nombre: 'Entorno Hospital',
  tipo: 'restringida' as const,
};

const FILA_RESTRINGIDA = {
  id: 7n,
  codigo: 'MOD-0007',
  categoria: 'informal' as const,
  titular_id: 4n,
  titular_nombre: null,
  actividad: 'Venta de empanadas',
  foto_url: null,
  estado: 'activo' as const,
  registrado_por_id: 1n,
  creado_en: FECHA,
  ubicacion: PUNTO,
  titular_usuario_nombre: 'José',
  titular_usuario_apellido: 'Pérez',
  titular_usuario_correo: 'jose.perez@hotmail.com',
  registrado_por_nombre: 'Laura',
  registrado_por_apellido: 'Martínez',
  registrado_por_correo: 'admin@tulua.gov.co',
  zona_id: 3n,
  zona_nombre: 'Entorno Hospital',
  zona_tipo: 'restringida' as const,
  zona_horario_inicio: '06:00',
  zona_horario_fin: '18:00',
  zona_aforo_maximo: 5,
  zona_productos: ['Frutas frescas'],
};

const FILA = {
  id: 7n,
  codigo: 'MOD-0007',
  categoria: 'informal' as const,
  titular_id: 4n,
  titular_nombre: null,
  actividad: 'Venta de empanadas',
  foto_url: null,
  estado: 'activo' as const,
  registrado_por_id: 1n,
  creado_en: FECHA,
  ubicacion: PUNTO,
  titular_usuario_nombre: 'José',
  titular_usuario_apellido: 'Pérez',
  titular_usuario_correo: 'jose.perez@hotmail.com',
  registrado_por_nombre: 'Laura',
  registrado_por_apellido: 'Martínez',
  registrado_por_correo: 'admin@tulua.gov.co',
  zona_id: 1n,
  zona_nombre: 'Centro - Calle 30',
  zona_tipo: 'permitida' as const,
  zona_horario_inicio: '06:00',
  zona_horario_fin: '18:00',
  zona_aforo_maximo: 40,
  zona_productos: ['Frutas frescas'],
};

const CREAR = {
  categoria: 'informal',
  actividad: 'Venta de empanadas',
  ubicacion: PUNTO,
  titularNombre: 'Nelson Mina',
} satisfies CrearModuloDto;

interface PrismaMock {
  comerciantes: { findUnique: jest.Mock };
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
}

interface TxMock {
  $executeRaw: jest.Mock;
  $queryRaw: jest.Mock;
}

function crearPrisma(): {
  prisma: PrismaService;
  mock: PrismaMock;
  tx: TxMock;
} {
  const tx: TxMock = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn().mockResolvedValue([{ id: 7n }]),
  };
  const mock: PrismaMock = {
    comerciantes: {
      findUnique: jest.fn().mockResolvedValue({ usuario_id: 4n }),
    },
    $queryRaw: jest.fn(),
    $transaction: jest
      .fn()
      .mockImplementation((callback: (cliente: TxMock) => Promise<unknown>) =>
        callback(tx),
      ),
  };
  return { prisma: mock as unknown as PrismaService, mock, tx };
}

interface SqlLike {
  strings: string[];
  values: unknown[];
}

function esSql(valor: unknown): valor is SqlLike {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    'strings' in valor &&
    'values' in valor
  );
}

function sqlDe(llamada: unknown[]): string {
  const textos: string[] = [];
  const recorrer = (valor: unknown): void => {
    if (esSql(valor)) {
      textos.push(valor.strings.join('?'));
      for (const item of valor.values) recorrer(item);
      return;
    }
    if (Array.isArray(valor)) {
      if (valor.every((item) => typeof item === 'string')) {
        textos.push(valor.join('?'));
      } else {
        for (const item of valor) recorrer(item);
      }
      return;
    }
    if (typeof valor === 'string') textos.push(valor);
  };
  for (const valor of llamada) recorrer(valor);
  return textos.join('\n');
}

function valoresPlanos(llamada: unknown[]): unknown[] {
  const valores: unknown[] = [];
  const recorrer = (valor: unknown): void => {
    if (esSql(valor)) {
      for (const item of valor.values) recorrer(item);
      return;
    }
    if (Array.isArray(valor)) {
      for (const item of valor) recorrer(item);
      return;
    }
    valores.push(valor);
  };
  for (const valor of llamada.slice(1)) recorrer(valor);
  return valores;
}

describe('ModulosService', () => {
  describe('crear', () => {
    it('genera el código, fija el actor y devuelve la ficha', async () => {
      const { prisma, mock, tx } = crearPrisma();
      mock.$queryRaw.mockImplementation((...args: unknown[]) => {
        const sql = sqlDe(args);
        if (sql.includes('FROM modulos m')) return Promise.resolve([FILA]);
        if (sql.includes('FROM zonas z')) return Promise.resolve([ZONA]);
        return Promise.resolve([]);
      });

      const service = new ModulosService(prisma);
      const resultado = await service.crear('1', CREAR);

      expect(tx.$executeRaw).toHaveBeenCalled();
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      const sqlInsert = sqlDe(tx.$queryRaw.mock.calls[0] as unknown[]);
      expect(sqlInsert).toContain('nextval');
      expect(sqlInsert).toContain('modulos_codigo_seq');
      expect(resultado).toMatchObject({
        id: '7',
        codigo: 'MOD-0007',
        categoria: 'informal',
        actividad: 'Venta de empanadas',
        titular: {
          id: '4',
          nombre: 'José',
          correo: 'jose.perez@hotmail.com',
        },
        sector: 'Centro - Calle 30',
      });
    });

    it('rechaza una zona restringida sin aceptación explícita', async () => {
      const { prisma, mock, tx } = crearPrisma();
      mock.$queryRaw.mockResolvedValue([ZONA_RESTRINGIDA]);

      const service = new ModulosService(prisma);

      await expect(service.crear('1', CREAR)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(tx.$queryRaw).not.toHaveBeenCalled();
    });

    it('permite continuar en zona restringida con aceptación', async () => {
      const { prisma, mock } = crearPrisma();
      mock.$queryRaw.mockImplementation((...args: unknown[]) => {
        const sql = sqlDe(args);
        if (sql.includes('FROM modulos m')) {
          return Promise.resolve([FILA_RESTRINGIDA]);
        }
        if (sql.includes('FROM zonas z')) {
          return Promise.resolve([ZONA_RESTRINGIDA]);
        }
        return Promise.resolve([]);
      });

      const service = new ModulosService(prisma);
      const resultado = await service.crear('1', {
        ...CREAR,
        aceptaAdvertencia: true,
      });

      expect(resultado.advertencias[0]).toMatchObject({
        tipo: 'zona_restringida',
        requiereConfirmacion: true,
      });
    });

    it('exige exactamente un titular', async () => {
      const { prisma, mock } = crearPrisma();
      const service = new ModulosService(prisma);

      await expect(
        service.crear('1', {
          ...CREAR,
          titularId: '4',
          titularNombre: 'Nelson Mina',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.crear('1', {
          ...CREAR,
          titularNombre: undefined,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mock.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('listar y zona contenedora', () => {
    it('aplica filtros de categoría, sector, estado y búsqueda', async () => {
      const { prisma, mock } = crearPrisma();
      mock.$queryRaw.mockImplementation((...args: unknown[]) => {
        const sql = sqlDe(args);
        if (sql.includes('COUNT(')) {
          return Promise.resolve([{ total: 1 }]);
        }
        return Promise.resolve([FILA]);
      });

      const service = new ModulosService(prisma);
      const resultado = await service.listar({
        categoria: 'informal',
        sector: 'Centro - Calle 30',
        estado: 'activo',
        busqueda: 'empanada',
        pagina: 1,
        limite: 20,
      });

      expect(resultado.paginacion.total).toBe(1);
      expect(resultado.datos).toHaveLength(1);
      const [consulta] = mock.$queryRaw.mock.calls as unknown[][];
      const valores = valoresPlanos(consulta);
      expect(valores).toEqual(
        expect.arrayContaining([
          'informal',
          'Centro - Calle 30',
          'activo',
          '%empanada%',
        ]),
      );
    });

    it('devuelve zona, sector y advertencia de restricción', async () => {
      const { prisma, mock } = crearPrisma();
      mock.$queryRaw.mockResolvedValue([ZONA_RESTRINGIDA]);

      const service = new ModulosService(prisma);
      const resultado = await service.zonaContenedora(4.0885, -76.1955);

      expect(resultado).toMatchObject({
        sector: 'Entorno Hospital',
        requiereConfirmacion: true,
        zona: {
          id: '3',
          nombre: 'Entorno Hospital',
          tipo: 'restringida',
        },
      });
      expect(resultado.advertencias[0].tipo).toBe('zona_restringida');
    });
  });

  describe('actualizar y baja lógica', () => {
    it('actualiza la actividad y registra la edición', async () => {
      const { prisma, mock, tx } = crearPrisma();
      mock.$queryRaw
        .mockResolvedValueOnce([
          {
            id: 7n,
            codigo: 'MOD-0007',
            foto_url: null,
            estado: 'activo',
            titular_id: 4n,
            titular_nombre: null,
            ubicacion: PUNTO,
          },
        ])
        .mockImplementation((...args: unknown[]) => {
          const sql = sqlDe(args);
          if (sql.includes('FROM modulos m')) return Promise.resolve([FILA]);
          if (sql.includes('FROM zonas z')) return Promise.resolve([ZONA]);
          return Promise.resolve([]);
        });
      tx.$queryRaw.mockResolvedValue([{ id: 7n }]);

      const service = new ModulosService(prisma);
      const dto: ActualizarModuloDto = { actividad: 'Artesanías' };
      const resultado = await service.actualizar('7', '1', dto);

      expect(tx.$executeRaw).toHaveBeenCalled();
      expect(sqlDe(tx.$queryRaw.mock.calls[0] as unknown[])).toContain(
        'UPDATE modulos',
      );
      expect(resultado.id).toBe('7');
    });

    it('da de baja y reactiva de forma idempotente', async () => {
      const { prisma, mock } = crearPrisma();
      mock.$queryRaw.mockResolvedValue([
        { id: 7n, codigo: 'MOD-0007', estado: 'activo' },
      ]);

      const service = new ModulosService(prisma);
      const baja = await service.cambiarEstado('7', '1', { estado: 'baja' });

      expect(baja).toMatchObject({
        id: '7',
        estado: 'baja',
        mensaje: 'Módulo dado de baja.',
      });
      expect(mock.$transaction).toHaveBeenCalledTimes(1);

      mock.$queryRaw.mockResolvedValue([
        { id: 7n, codigo: 'MOD-0007', estado: 'baja' },
      ]);
      const reactivado = await service.cambiarEstado('7', '1', {
        estado: 'activo',
      });
      expect(reactivado).toMatchObject({
        estado: 'activo',
        mensaje: 'Módulo reactivado.',
      });
    });

    it('no crea una transacción si el estado no cambia', async () => {
      const { prisma, mock } = crearPrisma();
      mock.$queryRaw.mockResolvedValue([
        { id: 7n, codigo: 'MOD-0007', estado: 'activo' },
      ]);

      const service = new ModulosService(prisma);
      const resultado = await service.cambiarEstado('7', '1', {
        estado: 'activo',
      });

      expect(resultado.mensaje).toBe('Módulo reactivado.');
      expect(mock.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('historial', () => {
    it('lee la auditoría y calcula los cambios de una edición', async () => {
      const { prisma, mock } = crearPrisma();
      mock.$queryRaw.mockImplementation((...args: unknown[]) => {
        const sql = sqlDe(args);
        if (sql.includes('FROM auditoria') && sql.includes('COUNT(')) {
          return Promise.resolve([{ total: 1 }]);
        }
        if (sql.includes('FROM auditoria')) {
          return Promise.resolve([
            {
              id: 11n,
              accion: 'update',
              valor_anterior: {
                estado: 'activo',
                actividad: 'Empanadas',
                ubicacion: PUNTO,
              },
              valor_nuevo: {
                estado: 'baja',
                actividad: 'Artesanías',
                ubicacion: PUNTO,
              },
              actor_id: 1n,
              actor_nombre: 'Laura',
              actor_apellido: 'Martínez',
              actor_correo: 'admin@tulua.gov.co',
              creado_en: FECHA,
            },
          ]);
        }
        return Promise.resolve([
          { id: 7n, codigo: 'MOD-0007', estado: 'baja' },
        ]);
      });

      const service = new ModulosService(prisma);
      const resultado = await service.historial('7', { pagina: 1, limite: 20 });

      expect(resultado.modulo.estado).toBe('baja');
      expect(resultado.datos[0].cambios).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ campo: 'estado', nuevo: 'baja' }),
          expect.objectContaining({ campo: 'actividad', nuevo: 'Artesanías' }),
        ]),
      );
    });
  });
});
