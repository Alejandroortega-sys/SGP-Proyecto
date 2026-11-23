import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { CorreoService } from '../correo/correo.service';
import type { NotificacionesService } from '../notificaciones/notificaciones.service';
import type { PrismaService } from '../prisma/prisma.service';
import { FeriasService } from './ferias.service';

const ZONA = {
  id: 4n,
  nombre: 'Parque La Guadua',
  tipo: 'permitida' as const,
  activa: true,
  aforo_maximo: 25,
  horario_inicio: '06:00',
  horario_fin: '20:00',
  productos: ['Frutas frescas', 'Artesanías'],
};

const EVALUACION_BASE = {
  disponible: true,
  zona: {
    id: '4',
    nombre: 'Parque La Guadua',
    tipo: 'permitida' as const,
    activa: true,
    aforoMaximo: 25,
    horarioInicio: '06:00',
    horarioFin: '20:00',
    productosPermitidos: ['Frutas frescas', 'Artesanías'],
    admiteFerias: true,
  },
  aforo: { solicitado: 20, maximo: 25, suficiente: true },
  conflicto: null,
  sugerencias: [],
  motivo: null,
};

const ORGANIZADOR = {
  id: '7',
  nombre: 'Luis',
  apellido: 'Álvarez',
  correo: 'luis.alvarez@agrovalle.org',
  rol: 'organizador' as const,
  perfil: null,
  estado: 'activa' as const,
};

const DATOS = {
  nombre: 'Feria Agroecológica de Primavera',
  tipoFeria: 'Feria agroecológica',
  zonaId: '4',
  fechaInicio: '2099-02-10',
  fechaFin: '2099-02-12',
  numeroPuestos: 20,
  productoIds: ['1'],
};

function crearServicio() {
  const prisma = {
    organizadores: { findUnique: jest.fn() },
    productos: { findMany: jest.fn() },
    ferias: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    feria_documentos: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  const correo = { enviarConfirmacionFeria: jest.fn() };
  const notificaciones = { crearAvisoFeria: jest.fn() };
  const service = new FeriasService(
    prisma as unknown as PrismaService,
    correo as unknown as CorreoService,
    notificaciones as unknown as NotificacionesService,
  );

  return { service, prisma, correo, notificaciones };
}

function conEvaluacion(
  service: FeriasService,
  evaluacion: typeof EVALUACION_BASE,
) {
  (service as unknown as { evaluar: jest.Mock }).evaluar = jest
    .fn()
    .mockResolvedValue(evaluacion);
}

describe('FeriasService', () => {
  describe('opciones', () => {
    it('devuelve zonas con aforo, productos y catálogo activo', async () => {
      const { service, prisma } = crearServicio();
      prisma.$queryRaw.mockResolvedValue([ZONA]);
      prisma.productos.findMany.mockResolvedValue([
        { id: 1n, nombre: 'Frutas frescas' },
      ]);

      const respuesta = await service.opciones();

      expect(respuesta.zonas).toEqual([
        {
          id: '4',
          nombre: 'Parque La Guadua',
          tipo: 'permitida',
          activa: true,
          aforoMaximo: 25,
          horarioInicio: '06:00',
          horarioFin: '20:00',
          productosPermitidos: ['Frutas frescas', 'Artesanías'],
          admiteFerias: true,
        },
      ]);
      expect(respuesta.productos).toEqual([
        { id: '1', nombre: 'Frutas frescas' },
      ]);
    });
  });

  describe('agenda', () => {
    it('devuelve los rangos ocupados sin datos del organizador', async () => {
      const { service, prisma } = crearServicio();
      prisma.$queryRaw.mockResolvedValueOnce([ZONA]).mockResolvedValueOnce([
        {
          id: 12n,
          fecha_inicio: '2026-12-10',
          fecha_fin: '2026-12-12',
        },
      ]);

      const respuesta = await service.agenda({
        zonaId: '4',
        desde: '2026-12-01',
        hasta: '2026-12-31',
      });

      expect(respuesta).toEqual({
        zonaId: '4',
        desde: '2026-12-01',
        hasta: '2026-12-31',
        ocupados: [{ fechaInicio: '2026-12-10', fechaFin: '2026-12-12' }],
      });
    });

    it('rechaza una agenda con fechas invertidas', async () => {
      const { service, prisma } = crearServicio();
      prisma.$queryRaw.mockResolvedValueOnce([ZONA]);

      await expect(
        service.agenda({
          zonaId: '4',
          desde: '2026-12-31',
          hasta: '2026-12-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('listarMias', () => {
    it('filtra por el organizador autenticado y pagina', async () => {
      const { service, prisma } = crearServicio();
      prisma.ferias.findMany.mockResolvedValue([]);
      prisma.ferias.count.mockResolvedValue(0);

      const respuesta = await service.listarMias('7', { pagina: 2, limite: 5 });

      expect(prisma.ferias.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizador_id: 7n },
          skip: 5,
          take: 5,
        }),
      );
      expect(respuesta.paginacion).toEqual({
        pagina: 2,
        limite: 5,
        total: 0,
        totalPaginas: 0,
      });
    });
  });

  describe('detalle', () => {
    it('oculta las ferias de otro organizador como 404', async () => {
      const { service, prisma } = crearServicio();
      prisma.ferias.findFirst.mockResolvedValue(null);

      await expect(service.detalle('7', '12')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.ferias.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 12n, organizador_id: 7n } }),
      );
    });
  });

  describe('radicar', () => {
    const form = { datos: JSON.stringify(DATOS) };

    it('rechaza a un organizador sin organización registrada', async () => {
      const { service, prisma } = crearServicio();
      prisma.organizadores.findUnique.mockResolvedValue(null);

      await expect(
        service.radicar(ORGANIZADOR, form, []),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rechaza una organización pendiente de validación', async () => {
      const { service, prisma } = crearServicio();
      prisma.organizadores.findUnique.mockResolvedValue({
        estado: 'pendiente_validacion',
      });

      await expect(
        service.radicar(ORGANIZADOR, form, []),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rechaza puestos que superan el aforo', async () => {
      const { service, prisma } = crearServicio();
      prisma.organizadores.findUnique.mockResolvedValue({ estado: 'activa' });
      conEvaluacion(service, {
        ...EVALUACION_BASE,
        disponible: false,
        aforo: { solicitado: 26, maximo: 25, suficiente: false },
        motivo:
          'El número de puestos (26) supera el aforo máximo de la zona (25)',
      });

      await expect(
        service.radicar(ORGANIZADOR, form, []),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('devuelve conflicto y sugerencias cuando la zona está ocupada', async () => {
      const { service, prisma } = crearServicio();
      prisma.organizadores.findUnique.mockResolvedValue({ estado: 'activa' });
      conEvaluacion(service, {
        ...EVALUACION_BASE,
        disponible: false,
        conflicto: { fechaInicio: '2099-02-10', fechaFin: '2099-02-12' },
        sugerencias: [{ fechaInicio: '2099-02-13', fechaFin: '2099-02-15' }],
        motivo: 'La zona ya está ocupada por otra feria',
      });

      try {
        await service.radicar(ORGANIZADOR, form, []);
        throw new Error('La radicación debió fallar');
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        const respuesta = (error as ConflictException).getResponse() as {
          sugerencias: unknown[];
        };
        expect(respuesta.sugerencias).toEqual([
          { fechaInicio: '2099-02-13', fechaFin: '2099-02-15' },
        ]);
      }
    });

    it('rechaza un JSON de datos inválido', async () => {
      const { service } = crearServicio();

      await expect(
        service.radicar(ORGANIZADOR, { datos: '{no-json' }, []),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('descargarDocumento', () => {
    it('limita la consulta del organizador a sus propias ferias', async () => {
      const { service, prisma } = crearServicio();
      prisma.feria_documentos.findFirst.mockResolvedValue(null);

      await expect(
        service.descargarDocumento(ORGANIZADOR, '12', '3'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.feria_documentos.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 3n,
            feria_id: 12n,
            ferias: { organizador_id: 7n },
          },
        }),
      );
    });
  });
});
