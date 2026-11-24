import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CobrosService } from './cobros.service';

/** Comerciante autenticado (titular del permiso del cobro). */
const COMERCIANTE: UsuarioAutenticado = {
  id: '3',
  nombre: 'María',
  apellido: 'Gómez',
  correo: 'maria.gomez@gmail.com',
  rol: 'comerciante',
  perfil: null,
  estado: 'activa',
};

/** Cobro pendiente del listado. */
const FILA_COBRO = {
  id: 1n,
  valor: new Prisma.Decimal('50000.00'),
  estado: 'pendiente',
  pagado_en: null,
  recibo_url: null,
  creado_en: new Date('2026-11-23T10:00:00'),
  permisos: {
    id: 8n,
    numero: 'PER-2026-00008',
    titular_id: 3n,
    comerciantes: {
      usuarios: { nombre: 'María', apellido: 'Gómez' },
    },
  },
};

/** Prisma simulado; el cliente de transacción comparte los mismos mocks. */
function crearPrismaMock(tx: Record<string, unknown>): PrismaService {
  return {
    $transaction: jest.fn(async (fn: (cliente: unknown) => Promise<unknown>) =>
      fn(tx),
    ),
    $queryRaw: (tx.$queryRaw as jest.Mock) ?? jest.fn(),
    cobros: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;
}

describe('CobrosService — listado (HU-36-CA1)', () => {
  it('lista los cobros propios con el número del permiso y paginación', async () => {
    const prisma = crearPrismaMock({});
    (prisma.cobros.findMany as jest.Mock).mockResolvedValue([FILA_COBRO]);
    (prisma.cobros.count as jest.Mock).mockResolvedValue(1);
    const service = new CobrosService(prisma);

    const respuesta = await service.listar(COMERCIANTE, {
      pagina: 1,
      limite: 20,
    });

    expect(respuesta.datos).toHaveLength(1);
    expect(respuesta.datos[0].permisoNumero).toBe('PER-2026-00008');
    // El valor NUMERIC viaja como string (Prisma.Decimal normaliza ceros).
    expect(respuesta.datos[0].valor).toBe('50000');
    expect(respuesta.datos[0].estado).toBe('pendiente');
    expect(respuesta.paginacion.totalPaginas).toBe(1);
    // El listado siempre se filtra por el titular del JWT.
    const llamada = (prisma.cobros.findMany as jest.Mock).mock.calls[0]?.[0];
    expect(llamada).toMatchObject({ where: { permisos: { titular_id: 3n } } });
  });
});

describe('CobrosService — pago simulado (HU-36-CA2)', () => {
  function txConCobro(estado: string): Record<string, jest.Mock> {
    return {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: 1n,
          estado,
          valor: new Prisma.Decimal('50000.00'),
          permiso_numero: 'PER-2026-00008',
          titular_id: 3n,
          titular_nombre: 'María',
          titular_apellido: 'Gómez',
        },
      ]),
      cobros: {
        update: jest.fn().mockResolvedValue({
          id: 1n,
          pagado_en: new Date('2026-11-23T10:05:00'),
        }),
      },
    };
  }

  it('pasa el cobro pendiente a «pagado» con recibo disponible', async () => {
    const tx = txConCobro('pendiente');
    const service = new CobrosService(crearPrismaMock(tx));

    const respuesta = await service.pagar(COMERCIANTE, '1');

    expect(respuesta.estado).toBe('pagado');
    expect(respuesta.valor).toBe('50000');
    expect(respuesta.reciboUrl).toBe('/cobros/mios/1/recibo');
    expect(respuesta.mensaje).toContain('simulado');
    expect(tx.cobros.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: 'pagado' }),
      }),
    );
  });

  it('un cobro ya pagado responde 409', async () => {
    const service = new CobrosService(crearPrismaMock(txConCobro('pagado')));

    await expect(service.pagar(COMERCIANTE, '1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('un cobro anulado responde 422', async () => {
    const service = new CobrosService(crearPrismaMock(txConCobro('anulado')));

    await expect(service.pagar(COMERCIANTE, '1')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('un cobro ajeno responde 404 (IDOR)', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      cobros: { update: jest.fn() },
    };
    const service = new CobrosService(crearPrismaMock(tx));

    await expect(service.pagar(COMERCIANTE, '99')).rejects.toThrow(
      NotFoundException,
    );
    // La consulta bloquea por cobro y titular del JWT a la vez.
    const sql = JSON.stringify(tx.$queryRaw.mock.calls[0][0]);
    expect(sql).toContain('titular_id');
  });
});

describe('CobrosService — recibo (HU-36, tarea 1245)', () => {
  it('genera el PDF del recibo solo cuando el cobro está pagado', async () => {
    const prisma = crearPrismaMock({});
    (prisma.cobros.findFirst as jest.Mock).mockResolvedValue({
      ...FILA_COBRO,
      estado: 'pagado',
      pagado_en: new Date('2026-11-23T10:05:00'),
    });
    const service = new CobrosService(prisma);

    const { buffer, nombreArchivo } = await service.reciboMio(COMERCIANTE, '1');

    expect(nombreArchivo).toBe('recibo-COB-1.pdf');
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('rechaza el recibo de un cobro pendiente (422)', async () => {
    const prisma = crearPrismaMock({});
    (prisma.cobros.findFirst as jest.Mock).mockResolvedValue(FILA_COBRO);
    const service = new CobrosService(prisma);

    await expect(service.reciboMio(COMERCIANTE, '1')).rejects.toThrow(
      /después de registrar el pago/,
    );
  });

  it('un cobro ajeno no tiene recibo (404, IDOR)', async () => {
    const prisma = crearPrismaMock({});
    (prisma.cobros.findFirst as jest.Mock).mockResolvedValue(null);
    const service = new CobrosService(prisma);

    await expect(service.reciboMio(COMERCIANTE, '99')).rejects.toThrow(
      NotFoundException,
    );
  });
});
