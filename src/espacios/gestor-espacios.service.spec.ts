import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GestorEspaciosService } from './gestor-espacios.service';

const FECHA = new Date('2026-11-11T10:00:00.000Z');
const PUNTO = { type: 'Point' as const, coordinates: [-76.1908, 4.0885] as [number, number] };

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
      for (const item of valor) recorrer(item);
      return;
    }
    if (typeof valor === 'string') textos.push(valor);
  };
  for (const valor of llamada) recorrer(valor);
  return textos.join('\n');
}

function fila(overrides: Record<string, unknown> = {}) {
  return {
    id: 7n,
    nombre: 'Puesto Plaza Boyacá - Occidente',
    tipo: 'puesto' as const,
    sector: 'Plaza Boyacá',
    dimensiones: '4 × 3 m',
    actividad_permitida: 'Comidas rápidas',
    horario_inicio: '07:00',
    horario_fin: '17:00',
    estado: 'disponible' as const,
    asignacion_manual: false,
    creado_en: FECHA,
    creado_por: 1n,
    creado_por_nombre: 'Laura',
    creado_por_apellido: 'Martínez',
    zona_id: 2n,
    zona_nombre: 'Plaza Boyacá',
    zona_tipo: 'permitida' as const,
    zona_activa: true,
    zona_horario_inicio: '07:00',
    zona_horario_fin: '17:00',
    zona_aforo_maximo: 15,
    zona_productos: ['Artesanías'],
    ubicacion: PUNTO,
    bloqueo_inicio: null,
    bloqueo_fin: null,
    bloqueo_motivo: null,
    bloqueo_activo: null,
    permiso_numero: null,
    permiso_inicio: null,
    permiso_fin: null,
    permiso_hora_inicio: null,
    permiso_hora_fin: null,
    solicitud_numero: null,
    solicitud_inicio: null,
    solicitud_fin: null,
    solicitud_hora_inicio: null,
    solicitud_hora_fin: null,
    total_bloqueos: 0,
    total_filas: 1,
    tiene_permisos: false,
    tiene_solicitudes: false,
    ...overrides,
  };
}

function estadoFila(overrides: Record<string, unknown> = {}) {
  return {
    id: 7n,
    nombre: 'Puesto Plaza Boyacá - Occidente',
    estado: 'disponible' as const,
    asignacion_manual: false,
    zona_id: 2n,
    zona_nombre: 'Plaza Boyacá',
    sector: 'Plaza Boyacá',
    ubicacion: PUNTO,
    ...overrides,
  };
}

interface PrismaMock {
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
  $transaction: jest.Mock;
}

function crearPrisma(): { prisma: PrismaService; mock: PrismaMock } {
  const mock: PrismaMock = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn(),
  };
  mock.$transaction.mockImplementation(
    (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        $queryRaw: mock.$queryRaw,
        $executeRaw: mock.$executeRaw,
      }),
  );
  return { prisma: mock as unknown as PrismaService, mock };
}

describe('GestorEspaciosService', () => {
  it('lista y calcula el estado efectivo del espacio', async () => {
    const { prisma, mock } = crearPrisma();
    mock.$queryRaw.mockResolvedValue([fila()]);

    const servicio = new GestorEspaciosService(prisma);
    const respuesta = await servicio.listar();

    expect(respuesta.total).toBe(1);
    expect(respuesta.datos[0]).toMatchObject({
      id: '7',
      nombre: 'Puesto Plaza Boyacá - Occidente',
      estado: 'disponible',
      estadoEfectivo: 'disponible',
      disponible: true,
      asignacionManual: false,
      zona: { id: '2', nombre: 'Plaza Boyacá', tipo: 'permitida' },
    });
  });

  it('muestra el estado bloqueado cuando hay un bloqueo activo', async () => {
    const { prisma, mock } = crearPrisma();
    mock.$queryRaw.mockResolvedValue([
      fila({
        estado: 'bloqueado',
        bloqueo_inicio: '2026-11-10',
        bloqueo_fin: '2026-11-12',
        bloqueo_motivo: 'Mantenimiento',
        bloqueo_activo: true,
      }),
    ]);

    const servicio = new GestorEspaciosService(prisma);
    const respuesta = await servicio.listar();

    expect(respuesta.datos[0]).toMatchObject({
      estadoEfectivo: 'bloqueado',
      disponible: false,
    });
    expect(respuesta.datos[0].motivoEstado).toContain('Mantenimiento');
  });

  it('responde 404 cuando la ficha no existe', async () => {
    const { prisma, mock } = crearPrisma();
    mock.$queryRaw.mockResolvedValue([]);

    const servicio = new GestorEspaciosService(prisma);
    await expect(servicio.detalle('999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('crea un espacio y detecta la zona del punto', async () => {
    const { prisma, mock } = crearPrisma();
    mock.$queryRaw.mockImplementation((...args: unknown[]) => {
      const sql = sqlDe(args);
      if (sql.includes('FROM zonas z')) {
        return Promise.resolve([
          { id: 2n, nombre: 'Plaza Boyacá', tipo: 'permitida' },
        ]);
      }
      if (sql.includes('INSERT INTO espacios_temporales')) {
        return Promise.resolve([{ id: 7n }]);
      }
      if (sql.includes('FROM espacios_temporales e')) {
        return Promise.resolve([fila()]);
      }
      if (sql.includes('FROM espacio_bloqueos b')) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const servicio = new GestorEspaciosService(prisma);
    const respuesta = await servicio.crear('1', {
      nombre: 'Puesto Plaza Boyacá - Occidente',
      tipo: 'puesto',
      sector: 'Plaza Boyacá',
      dimensiones: '4 × 3 m',
      actividadPermitida: 'Comidas rápidas',
      ubicacion: PUNTO,
      horarioInicio: '07:00',
      horarioFin: '17:00',
    });

    expect(respuesta.id).toBe('7');
    expect(mock.$executeRaw).toHaveBeenCalled();
  });

  it('rechaza un horario incompleto o invertido', async () => {
    const { prisma } = crearPrisma();
    const servicio = new GestorEspaciosService(prisma);

    await expect(
      servicio.crear('1', {
        nombre: 'Espacio',
        tipo: 'puesto',
        ubicacion: PUNTO,
        horarioInicio: '07:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      servicio.crear('1', {
        nombre: 'Espacio',
        tipo: 'puesto',
        ubicacion: PUNTO,
        horarioInicio: '18:00',
        horarioFin: '08:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza eliminar un espacio con permisos o solicitudes', async () => {
    const { prisma, mock } = crearPrisma();
    mock.$queryRaw.mockImplementation((...args: unknown[]) => {
      const sql = sqlDe(args);
      if (sql.includes('SELECT id, nombre') && sql.includes('FROM espacios_temporales')) {
        return Promise.resolve([{ id: 7n, nombre: 'Espacio' }]);
      }
      if (sql.includes('AS permisos')) {
        return Promise.resolve([{ permisos: 1, solicitudes: 0 }]);
      }
      return Promise.resolve([]);
    });

    const servicio = new GestorEspaciosService(prisma);
    await expect(servicio.eliminar('7', '1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('asigna manualmente un espacio disponible', async () => {
    const { prisma, mock } = crearPrisma();
    let estado = 'disponible';
    let manual = false;
    mock.$queryRaw.mockImplementation((...args: unknown[]) => {
      const sql = sqlDe(args);
      if (sql.includes('EXISTS (') && sql.includes('AS bloqueo')) {
        return Promise.resolve([
          { bloqueo: false, permiso: false, solicitud: false },
        ]);
      }
      if (sql.includes('FROM espacios_temporales e')) {
        return Promise.resolve([
          estadoFila({ estado, asignacion_manual: manual }),
        ]);
      }
      return Promise.resolve([]);
    });
    mock.$executeRaw.mockImplementation((...args: unknown[]) => {
      const sql = sqlDe(args);
      if (sql.includes('SET estado = ')) {
        estado = 'asignado';
        manual = true;
      }
      return Promise.resolve(1);
    });

    const servicio = new GestorEspaciosService(prisma);
    const respuesta = await servicio.asignar('7', '1');

    expect(respuesta).toMatchObject({
      id: '7',
      estado: 'asignado',
      asignacionManual: true,
    });
  });

  it('libera una asignación manual y recalcula el estado', async () => {
    const { prisma, mock } = crearPrisma();
    let estado = 'asignado';
    let manual = true;
    mock.$queryRaw.mockImplementation((...args: unknown[]) => {
      const sql = sqlDe(args);
      if (sql.includes('FROM espacios_temporales e')) {
        return Promise.resolve([
          estadoFila({ estado, asignacion_manual: manual }),
        ]);
      }
      return Promise.resolve([]);
    });
    mock.$executeRaw.mockImplementation((...args: unknown[]) => {
      const sql = sqlDe(args);
      if (sql.includes('SET asignacion_manual = false')) {
        manual = false;
        estado = 'disponible';
      }
      return Promise.resolve(1);
    });

    const servicio = new GestorEspaciosService(prisma);
    const respuesta = await servicio.liberar('7', '1');

    expect(respuesta).toMatchObject({
      id: '7',
      estado: 'disponible',
      asignacionManual: false,
    });
  });

  it('rechaza un bloqueo que se cruza con otro bloqueo', async () => {
    const { prisma, mock } = crearPrisma();
    mock.$queryRaw.mockImplementation((...args: unknown[]) => {
      const sql = sqlDe(args);
      if (sql.includes('FROM espacios_temporales e')) {
        return Promise.resolve([estadoFila()]);
      }
      if (sql.includes('FROM espacio_bloqueos b') && sql.includes('daterange')) {
        return Promise.resolve([{ id: 3n }]);
      }
      return Promise.resolve([]);
    });

    const servicio = new GestorEspaciosService(prisma);
    await expect(
      servicio.crearBloqueo('7', '1', {
        fechaInicio: '2026-11-10',
        fechaFin: '2026-11-12',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza un bloqueo que se cruza con un permiso vigente', async () => {
    const { prisma, mock } = crearPrisma();
    mock.$queryRaw.mockImplementation((...args: unknown[]) => {
      const sql = sqlDe(args);
      if (sql.includes('FROM espacios_temporales e')) {
        return Promise.resolve([estadoFila()]);
      }
      if (sql.includes('FROM permisos p') && sql.includes('daterange')) {
        return Promise.resolve([{ numero: 'PER-2026-00001' }]);
      }
      return Promise.resolve([]);
    });

    const servicio = new GestorEspaciosService(prisma);
    const promesa = servicio.crearBloqueo('7', '1', {
      fechaInicio: '2026-11-10',
      fechaFin: '2026-11-12',
    });

    await expect(promesa).rejects.toBeInstanceOf(ConflictException);
    await expect(promesa).rejects.toThrow(/PER-2026-00001/);
  });

  it('rechaza un bloqueo con fechas inválidas', async () => {
    const { prisma } = crearPrisma();
    const servicio = new GestorEspaciosService(prisma);

    await expect(
      servicio.crearBloqueo('7', '1', {
        fechaInicio: '2026-02-31',
        fechaFin: '2026-03-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      servicio.crearBloqueo('7', '1', {
        fechaInicio: '2026-12-10',
        fechaFin: '2026-12-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
