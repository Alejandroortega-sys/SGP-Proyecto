import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import type { NotificacionesService } from '../notificaciones/notificaciones.service';
import type { PrismaService } from '../prisma/prisma.service';
import { GestorFeriasService } from './gestor-ferias.service';

const GESTOR = {
  id: '1',
  nombre: 'Carlos',
  apellido: 'Ramírez',
  correo: 'revisor@tulua.gov.co',
  rol: 'gestor' as const,
  perfil: 'revisor' as const,
  estado: 'activa' as const,
};

const FERIA = {
  id: 12n,
  numero_radicado: 'FER-2026-00003',
  nombre: 'Feria Agroecológica',
  estado: 'radicada' as const,
  organizador_id: 7n,
  zona_id: 4n,
  zona_nombre: 'Parque La Guadua',
  fecha_inicio: '2099-02-10',
  fecha_fin: '2099-02-12',
  numero_puestos: 20,
  correo: 'luis@example.com',
  nombre_organizador: 'Luis',
};

const ZONA = {
  id: '4',
  nombre: 'Parque La Guadua',
  tipo: 'permitida' as const,
  activa: true,
  aforoMaximo: 25,
  horarioInicio: '06:00',
  horarioFin: '20:00',
};

const CONFLICTO = {
  tipo: 'feria' as const,
  feriaId: '13',
  feriaNombre: 'Otra feria',
  espacioId: null,
  espacioNombre: null,
  referencia: 'FER-2026-00004',
  fechaInicio: '2099-02-10',
  fechaFin: '2099-02-12',
  mensaje: 'La zona ya está ocupada por otra feria.',
};

function crearServicio() {
  const tx = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn().mockResolvedValue(1),
    ferias: { update: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: jest.fn(
      async (callback: (cliente: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };
  const notificaciones = {
    crearAvisoFeria: jest.fn().mockResolvedValue('1'),
    enviarCorreoFeria: jest
      .fn()
      .mockResolvedValue({ correoEnviado: true, mensajeCorreo: null }),
  };
  const service = new GestorFeriasService(
    prisma as unknown as PrismaService,
    notificaciones as unknown as NotificacionesService,
  );

  const comoMock = service as unknown as Record<string, jest.Mock>;
  comoMock.bloquearFeria = jest.fn().mockResolvedValue(FERIA);
  comoMock.obtenerZona = jest.fn().mockResolvedValue(ZONA);
  comoMock.bloquearZona = jest.fn().mockResolvedValue(undefined);
  comoMock.consultarConflictosFeria = jest.fn().mockResolvedValue([]);
  comoMock.bloquearEspacios = jest.fn().mockResolvedValue([
    { id: 31n, nombre: 'Kiosco Parque La Guadua' },
    { id: 32n, nombre: 'Módulo Parque La Guadua' },
  ]);
  comoMock.consultarConflictosEspacios = jest.fn().mockResolvedValue([]);
  comoMock.consultarZonas = jest.fn().mockResolvedValue([ZONA]);
  comoMock.consultarEventos = jest.fn().mockResolvedValue([]);

  return { service, prisma, tx, notificaciones, comoMock };
}

describe('GestorFeriasService', () => {
  describe('aprobar', () => {
    it('cambia el estado, bloquea los espacios y notifica', async () => {
      const { service, tx, notificaciones, comoMock } = crearServicio();

      const respuesta = await service.aprobar(GESTOR, '12');

      expect(comoMock.bloquearFeria).toHaveBeenCalledWith(tx, 12n);
      expect(tx.ferias.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 12n },
          data: expect.objectContaining({
            estado: 'aprobada',
            revisor_id: 1n,
          }),
        }),
      );
      expect(tx.$executeRaw).toHaveBeenCalled();
      expect(notificaciones.crearAvisoFeria).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          feriaId: 12n,
          tipo: 'feria_aprobada',
          usuarioId: 7n,
        }),
      );
      expect(notificaciones.enviarCorreoFeria).toHaveBeenCalledWith(
        expect.objectContaining({ correo: 'luis@example.com' }),
        expect.objectContaining({
          accion: 'aprobada',
          numeroRadicado: 'FER-2026-00003',
        }),
      );
      expect(respuesta).toMatchObject({
        estado: 'aprobada',
        espaciosBloqueados: [
          { id: '31' },
          { id: '32' },
        ],
        correoEnviado: true,
      });
    });

    it('rechaza la aprobación si hay un cruce de zona', async () => {
      const { service, tx, notificaciones, comoMock } = crearServicio();
      comoMock.consultarConflictosFeria.mockResolvedValue([CONFLICTO]);

      await expect(service.aprobar(GESTOR, '12')).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(tx.ferias.update).not.toHaveBeenCalled();
      expect(notificaciones.crearAvisoFeria).not.toHaveBeenCalled();
      expect(notificaciones.enviarCorreoFeria).not.toHaveBeenCalled();
    });

    it('rechaza la aprobación si un espacio está ocupado', async () => {
      const { service, tx, comoMock } = crearServicio();
      comoMock.consultarConflictosEspacios.mockResolvedValue([
        { ...CONFLICTO, tipo: 'permiso', mensaje: 'El espacio está ocupado.' },
      ]);

      await expect(service.aprobar(GESTOR, '12')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(tx.ferias.update).not.toHaveBeenCalled();
    });

    it('no aprueba una feria en estado cancelada', async () => {
      const { service, comoMock } = crearServicio();
      comoMock.bloquearFeria.mockResolvedValue({
        ...FERIA,
        estado: 'cancelada',
      });

      await expect(service.aprobar(GESTOR, '12')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('cancelar', () => {
    it('exige motivo antes de abrir la transacción', async () => {
      const { service, prisma } = crearServicio();

      await expect(
        service.cancelar(GESTOR, '12', '   '),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('cancela, libera los bloqueos y notifica el motivo', async () => {
      const { service, tx, notificaciones, comoMock } = crearServicio();
      comoMock.bloquearFeria.mockResolvedValue({
        ...FERIA,
        estado: 'aprobada',
      });
      tx.$executeRaw.mockResolvedValue(2);

      const respuesta = await service.cancelar(
        GESTOR,
        '12',
        'Jornada institucional',
      );

      expect(tx.ferias.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            estado: 'cancelada',
            motivo_cancelacion: 'Jornada institucional',
            cancelada_por: 1n,
          }),
        }),
      );
      expect(notificaciones.crearAvisoFeria).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          tipo: 'feria_cancelada',
          cuerpo: expect.stringContaining('Jornada institucional'),
        }),
      );
      expect(notificaciones.enviarCorreoFeria).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          accion: 'cancelada',
          motivo: 'Jornada institucional',
        }),
      );
      expect(respuesta).toMatchObject({
        estado: 'cancelada',
        espaciosLiberados: 2,
        motivoCancelacion: 'Jornada institucional',
      });
    });

    it('no cancela una feria ya cancelada', async () => {
      const { service, comoMock } = crearServicio();
      comoMock.bloquearFeria.mockResolvedValue({
        ...FERIA,
        estado: 'cancelada',
      });

      await expect(
        service.cancelar(GESTOR, '12', 'Motivo'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('mover', () => {
    it('actualiza las fechas y reubica los bloqueos de una feria aprobada', async () => {
      const { service, tx, notificaciones, comoMock } = crearServicio();
      comoMock.bloquearFeria.mockResolvedValue({
        ...FERIA,
        estado: 'aprobada',
      });

      const respuesta = await service.mover(GESTOR, '12', {
        zonaId: '4',
        fechaInicio: '2099-03-10',
        fechaFin: '2099-03-12',
        motivo: 'Ajuste de agenda',
      });

      expect(tx.ferias.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            zona_id: 4n,
          }),
        }),
      );
      expect(notificaciones.crearAvisoFeria).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ tipo: 'feria_movida' }),
      );
      expect(notificaciones.enviarCorreoFeria).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          accion: 'movida',
          fechaInicioAnterior: '2099-02-10',
          fechaFinAnterior: '2099-02-12',
        }),
      );
      expect(respuesta).toMatchObject({
        estado: 'aprobada',
        fechaInicio: '2099-03-10',
        fechaFin: '2099-03-12',
        espaciosBloqueados: [{ id: '31' }, { id: '32' }],
      });
    });

    it('no mueve a una zona con cruce de feria', async () => {
      const { service, tx, comoMock } = crearServicio();
      comoMock.bloquearFeria.mockResolvedValue({
        ...FERIA,
        estado: 'aprobada',
      });
      comoMock.consultarConflictosFeria.mockResolvedValue([CONFLICTO]);

      await expect(
        service.mover(GESTOR, '12', {
          zonaId: '4',
          fechaInicio: '2099-03-10',
          fechaFin: '2099-03-12',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tx.ferias.update).not.toHaveBeenCalled();
    });
  });

  describe('agenda', () => {
    it('marca los eventos que se cruzan y devuelve el resumen', async () => {
      const { service, comoMock } = crearServicio();
      const base = {
        numero_radicado: 'FER-2026-00001',
        nombre: 'Feria',
        tipo_feria: 'Agroecológica',
        estado: 'aprobada' as const,
        numero_puestos: 10,
        radicada_en: new Date('2026-11-01T10:00:00.000Z'),
        aprobada_en: new Date('2026-11-02T10:00:00.000Z'),
        cancelada_en: null,
        actualizado_en: new Date('2026-11-02T10:00:00.000Z'),
        motivo_cancelacion: null,
        zona_id: 4n,
        zona_nombre: 'Parque La Guadua',
        zona_tipo: 'permitida' as const,
        zona_activa: true,
        zona_aforo_maximo: 25,
        zona_horario_inicio: '06:00',
        zona_horario_fin: '20:00',
        organizador_id: 7n,
        organizador_nombre: 'Luis',
        organizador_apellido: 'Álvarez',
        organizador_correo: 'luis@example.com',
        organizacion: 'Fundación',
        nit: '901234567-8',
        aprobada_por: 'Carlos',
      };
      comoMock.consultarEventos.mockResolvedValue([
        {
          ...base,
          id: 1n,
          fecha_inicio: '2026-12-10',
          fecha_fin: '2026-12-12',
        },
        {
          ...base,
          id: 2n,
          estado: 'radicada',
          fecha_inicio: '2026-12-11',
          fecha_fin: '2026-12-13',
        },
      ]);

      const respuesta = await service.agenda({
        desde: '2026-12-01',
        hasta: '2026-12-31',
      });

      expect(respuesta.eventos).toHaveLength(2);
      expect(respuesta.cruces[0]?.tipo).toBe('feria');
      expect(respuesta.eventos.every((evento) => evento.tieneCruces)).toBe(
        true,
      );
      expect(respuesta.resumen.aprobadas).toBe(1);
    });
  });
});
