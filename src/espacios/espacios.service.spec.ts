import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EspaciosService } from './espacios.service';

const FECHA = new Date('2026-10-01T12:00:00.000Z');

const PUNTO = {
  type: 'Point' as const,
  coordinates: [-76.195, 4.089] as [number, number],
};

function fila(overrides: Record<string, unknown> = {}) {
  return {
    id: 1n,
    nombre: 'Espacio móvil Calle 30 - A',
    tipo: 'espacio_movil' as const,
    sector: 'Centro',
    dimensiones: '3 × 2 m',
    actividad_permitida: 'Venta de alimentos y frutas',
    horario_inicio: '06:00',
    horario_fin: '14:00',
    estado: 'disponible' as const,
    creado_en: FECHA,
    zona_id: 1n,
    zona_nombre: 'Centro - Calle 30',
    zona_tipo: 'permitida' as const,
    zona_activa: true,
    zona_horario_inicio: '06:00',
    zona_horario_fin: '18:00',
    zona_aforo_maximo: 40,
    ubicacion: PUNTO,
    bloqueo_inicio: null,
    bloqueo_fin: null,
    bloqueo_motivo: null,
    bloqueo_activo: null,
    permiso_numero: null,
    permiso_inicio: null,
    permiso_fin: null,
    solicitud_numero: null,
    solicitud_inicio: null,
    solicitud_fin: null,
    productos: ['Frutas frescas', 'Verduras'],
    ...overrides,
  };
}

const FILAS = [
  fila(),
  fila({
    id: 2n,
    nombre: 'Espacio móvil Calle 30 - B',
    horario_inicio: null,
    horario_fin: null,
  }),
  fila({
    id: 3n,
    nombre: 'Espacio Plaza Boyacá - Norte',
    sector: 'Plaza Boyacá',
    estado: 'bloqueado',
    bloqueo_inicio: '2026-10-25',
    bloqueo_fin: '2026-10-31',
    bloqueo_motivo: 'Mantenimiento del andén',
    bloqueo_activo: true,
  }),
  fila({
    id: 4n,
    nombre: 'Kiosco Parque La Guadua',
    tipo: 'kiosco',
    sector: 'Parque La Guadua',
  }),
  fila({
    id: 5n,
    nombre: 'Espacio Plaza Boyacá - Sur',
    estado: 'asignado',
  }),
  fila({
    id: 6n,
    nombre: 'Módulo Parque La Guadua - Este',
    estado: 'mantenimiento',
  }),
];

interface PrismaMock {
  $queryRaw: jest.Mock;
}

function crearPrisma(filas: unknown[] = FILAS): {
  prisma: PrismaService;
  mock: PrismaMock;
} {
  const mock: PrismaMock = {
    $queryRaw: jest.fn().mockResolvedValue(filas),
  };
  return { prisma: mock as unknown as PrismaService, mock };
}

describe('EspaciosService', () => {
  it('devuelve solo los disponibles por defecto y cuenta todos los estados', async () => {
    const { prisma } = crearPrisma();
    const servicio = new EspaciosService(prisma);

    const respuesta = await servicio.listar();

    expect(respuesta.datos).toHaveLength(3);
    expect(respuesta.datos.map((espacio) => espacio.id)).toEqual(['1', '2', '4']);
    expect(respuesta.total).toBe(3);
    expect(respuesta.disponibles).toBe(3);
    expect(respuesta.noDisponibles).toBe(3);
    expect(respuesta.datos[0]).toMatchObject({
      nombre: 'Espacio móvil Calle 30 - A',
      tipo: 'espacio_movil',
      sector: 'Centro',
      dimensiones: '3 × 2 m',
      estado: 'disponible',
      estadoEfectivo: 'disponible',
      disponible: true,
      motivoEstado: null,
      ubicacion: PUNTO,
      horario: { inicio: '06:00', fin: '14:00' },
      zona: { id: '1', nombre: 'Centro - Calle 30', tipo: 'permitida' },
    });
  });

  it('incluye los no disponibles cuando se solicita', async () => {
    const { prisma } = crearPrisma();
    const servicio = new EspaciosService(prisma);

    const respuesta = await servicio.listar({ incluirNoDisponibles: true });

    expect(respuesta.datos).toHaveLength(6);
    expect(respuesta.total).toBe(6);
    expect(respuesta.disponibles).toBe(3);
    expect(respuesta.noDisponibles).toBe(3);

    const bloqueado = respuesta.datos.find((espacio) => espacio.id === '3');
    expect(bloqueado).toMatchObject({
      estado: 'bloqueado',
      estadoEfectivo: 'bloqueado',
      disponible: false,
    });
    expect(bloqueado?.motivoEstado).toContain('Mantenimiento del andén');

    const asignado = respuesta.datos.find((espacio) => espacio.id === '5');
    expect(asignado).toMatchObject({
      estado: 'asignado',
      disponible: false,
    });

    const mantenimiento = respuesta.datos.find((espacio) => espacio.id === '6');
    expect(mantenimiento).toMatchObject({
      estado: 'mantenimiento',
      disponible: false,
    });
  });

  it('hereda el horario de la zona cuando el espacio no tiene uno propio', async () => {
    const { prisma } = crearPrisma();
    const servicio = new EspaciosService(prisma);

    const respuesta = await servicio.listar();
    const espacio = respuesta.datos.find((item) => item.id === '2');

    expect(espacio?.horario).toEqual({ inicio: '06:00', fin: '18:00' });
  });

  it('devuelve la ficha completa con bloqueo y restricciones de la zona', async () => {
    const { prisma } = crearPrisma([FILAS[2]]);
    const servicio = new EspaciosService(prisma);

    const detalle = await servicio.detalle('3');

    expect(detalle).toMatchObject({
      id: '3',
      nombre: 'Espacio Plaza Boyacá - Norte',
      estado: 'bloqueado',
      estadoEfectivo: 'bloqueado',
      disponible: false,
      bloqueo: {
        fechaInicio: '2026-10-25',
        fechaFin: '2026-10-31',
        motivo: 'Mantenimiento del andén',
        activo: true,
      },
      zona: {
        id: '1',
        nombre: 'Centro - Calle 30',
        tipo: 'permitida',
        activa: true,
        horarioInicio: '06:00',
        horarioFin: '18:00',
        aforoMaximo: 40,
        productos: ['Frutas frescas', 'Verduras'],
      },
    });
    expect(detalle.motivoEstado).toContain('Mantenimiento del andén');
    expect(detalle.creadoEn).toBe(FECHA);
  });

  it('marca como ocupado un espacio con permiso vigente', async () => {
    const { prisma } = crearPrisma([
      fila({
        permiso_numero: 'PER-2026-00001',
        permiso_inicio: '2026-11-01',
        permiso_fin: '2026-11-30',
      }),
    ]);
    const servicio = new EspaciosService(prisma);

    const detalle = await servicio.detalle('1');

    expect(detalle).toMatchObject({
      estado: 'disponible',
      estadoEfectivo: 'asignado',
      disponible: false,
      permiso: {
        numero: 'PER-2026-00001',
        fechaInicio: '2026-11-01',
        fechaFin: '2026-11-30',
      },
    });
    expect(detalle.motivoEstado).toContain('PER-2026-00001');
  });

  it('rechaza identificadores inválidos y espacios inexistentes', async () => {
    const { prisma } = crearPrisma([]);
    const servicio = new EspaciosService(prisma);

    await expect(servicio.detalle('abc')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(servicio.detalle('999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('usa la fecha de consulta en la sentencia SQL', async () => {
    const { prisma, mock } = crearPrisma();
    const servicio = new EspaciosService(prisma);

    await servicio.listar({ fecha: '2026-10-31' });

    const argumentos = mock.$queryRaw.mock.calls[0] as unknown[];
    const consulta = JSON.stringify(argumentos);
    expect(consulta).toContain('BETWEEN fecha_inicio AND fecha_fin');
    expect(consulta).toContain('2026-10-31');
  });

  it('envía los filtros de sector y actividad a la consulta SQL', async () => {
    const { prisma, mock } = crearPrisma();
    const servicio = new EspaciosService(prisma);

    await servicio.listar({
      sector: 'Centro',
      actividad: 'Venta de alimentos y frutas',
    });

    const consulta = JSON.stringify(mock.$queryRaw.mock.calls[0]);
    expect(consulta).toContain('e.sector');
    expect(consulta).toContain('e.actividad_permitida');
    expect(consulta).toContain('Centro');
    expect(consulta).toContain('Venta de alimentos y frutas');
  });

  it('excluye los espacios cuyo horario no cubre el rango solicitado', async () => {
    const { prisma } = crearPrisma();
    const servicio = new EspaciosService(prisma);

    const respuesta = await servicio.listar({
      fecha: '2026-11-10',
      horaInicio: '18:00',
      horaFin: '20:00',
    });

    expect(respuesta.datos).toHaveLength(0);
    expect(respuesta.total).toBe(0);
  });

  it('mantiene disponibles los espacios que cubren el horario y no tienen cruces', async () => {
    const { prisma } = crearPrisma();
    const servicio = new EspaciosService(prisma);

    const respuesta = await servicio.listar({
      fecha: '2026-11-10',
      horaInicio: '10:00',
      horaFin: '12:00',
    });

    expect(respuesta.datos.map((espacio) => espacio.id)).toEqual([
      '1',
      '2',
      '4',
    ]);
    expect(respuesta.disponibles).toBe(3);
  });

  it('marca ocupado un espacio cuando el permiso se cruza con el horario', async () => {
    const { prisma } = crearPrisma([
      fila({
        permiso_numero: 'PER-2026-00001',
        permiso_inicio: '2026-11-01',
        permiso_fin: '2026-11-30',
        permiso_hora_inicio: '06:00',
        permiso_hora_fin: '14:00',
      }),
    ]);
    const servicio = new EspaciosService(prisma);

    const respuesta = await servicio.listar({
      fecha: '2026-11-10',
      horaInicio: '10:00',
      horaFin: '12:00',
    });

    expect(respuesta.datos).toHaveLength(0);
    expect(respuesta.noDisponibles).toBe(1);
  });

  it('deja disponible un espacio si el permiso no se cruza con el horario', async () => {
    const { prisma } = crearPrisma([
      fila({
        permiso_numero: 'PER-2026-00001',
        permiso_inicio: '2026-11-01',
        permiso_fin: '2026-11-30',
        permiso_hora_inicio: '06:00',
        permiso_hora_fin: '10:00',
      }),
    ]);
    const servicio = new EspaciosService(prisma);

    const respuesta = await servicio.listar({
      fecha: '2026-11-10',
      horaInicio: '10:00',
      horaFin: '12:00',
    });

    expect(respuesta.datos).toHaveLength(1);
    expect(respuesta.datos[0]).toMatchObject({
      id: '1',
      disponible: true,
    });
  });

  it('valida el rango horario y exige fecha cuando se filtra por hora', async () => {
    const { prisma } = crearPrisma();
    const servicio = new EspaciosService(prisma);

    await expect(
      servicio.listar({ fecha: '2026-11-10', horaInicio: '10:00' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      servicio.listar({ horaInicio: '10:00', horaFin: '12:00' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      servicio.listar({
        fecha: '2026-11-10',
        horaInicio: '12:00',
        horaFin: '10:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('devuelve las opciones de sector y actividad', async () => {
    const { prisma, mock } = crearPrisma();
    mock.$queryRaw
      .mockResolvedValueOnce([{ valor: 'Centro' }, { valor: 'Plaza Boyacá' }])
      .mockResolvedValueOnce([
        { valor: 'Artesanías' },
        { valor: 'Comidas rápidas' },
      ]);
    const servicio = new EspaciosService(prisma);

    const opciones = await servicio.opciones();

    expect(opciones).toEqual({
      sectores: ['Centro', 'Plaza Boyacá'],
      actividades: ['Artesanías', 'Comidas rápidas'],
    });
  });
});
