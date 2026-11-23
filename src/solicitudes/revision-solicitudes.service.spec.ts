import { ConflictException, BadRequestException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import type { NotificacionesService } from '../notificaciones/notificaciones.service';
import type { PrismaService } from '../prisma/prisma.service';
import { RevisionSolicitudesService } from './revision-solicitudes.service';

const GESTOR: UsuarioAutenticado = {
  id: '1',
  nombre: 'Laura',
  apellido: 'Martínez',
  correo: 'admin@tulua.gov.co',
  rol: 'gestor',
  perfil: 'administrador',
  estado: 'activa',
};

const FILA_SOLICITUD = {
  id: 12n,
  numero_radicado: 'SOL-2026-00012',
  estado: 'en_revision',
  actividad: 'Artesanías',
  fecha_inicio: new Date('2026-12-01T00:00:00.000Z'),
  fecha_fin: new Date('2026-12-03T00:00:00.000Z'),
  hora_inicio: new Date('1970-01-01T09:00:00.000Z'),
  hora_fin: new Date('1970-01-01T12:00:00.000Z'),
  radicada_en: new Date('2026-11-20T10:00:00.000Z'),
  decidida_en: null,
  motivo_rechazo: null,
  creado_en: new Date('2026-11-20T10:00:00.000Z'),
  actualizado_en: new Date('2026-11-20T10:00:00.000Z'),
  comerciantes: {
    actividad_comercial: 'Artesanías',
    categoria: 'informal',
    usuarios: {
      id: 3n,
      nombre: 'María',
      apellido: 'Gómez',
      correo: 'maria.gomez@gmail.com',
      documento: '11223344',
      telefono: '3001234567',
    },
  },
  espacios_temporales: {
    id: 4n,
    nombre: 'Kiosco Parque La Guadalupe',
    sector: 'Parque La Guadalupe',
    tipo: 'kiosco',
    actividad_permitida: 'Artesanías',
  },
  solicitud_productos: [{ productos: { id: 1n, nombre: 'Artesanías' } }],
  solicitud_documentos: [
    {
      id: 8n,
      requisito_id: 1n,
      tipo_documento: 'Documento de identidad',
      nombre_original: 'cedula.pdf',
      mime_type: 'application/pdf',
      tamano_bytes: 1200,
      estado: 'pendiente',
      observacion: null,
      cargado_en: new Date('2026-11-20T10:00:00.000Z'),
      archivo_url: 'solicitudes/12/cedula.pdf',
      reemplaza_a: null,
      verificado_en: null,
      usuarios: null,
    },
  ],
  solicitud_historial: [
    {
      id: 1n,
      estado_anterior: 'radicada',
      estado_nuevo: 'en_revision',
      observacion: 'El gestor inició la revisión.',
      creado_en: new Date('2026-11-20T10:00:00.000Z'),
      usuarios: { id: 1n, nombre: 'Laura', apellido: 'Martínez' },
    },
  ],
};

const CATALOGO = [
  {
    id: 1n,
    nombre: 'Documento de identidad',
    descripcion: 'Copia legible',
    obligatorio: true,
    tipo_actividad: null,
    orden: 10,
  },
];

const FILA_RESOLUCION = {
  id: 12n,
  numero_radicado: 'SOL-2026-00012',
  estado: 'en_revision' as const,
  comerciante_id: 3n,
  espacio_id: 4n,
  fecha_inicio: '2026-12-01',
  fecha_fin: '2026-12-03',
  hora_inicio: '09:00',
  hora_fin: '12:00',
  correo: 'maria.gomez@gmail.com',
  nombre: 'María',
  espacio_nombre: 'Kiosco Parque La Guadalupe',
};

const ACTUALIZADA_APROBADA = {
  id: 12n,
  numero_radicado: 'SOL-2026-00012',
  estado: 'aprobada' as const,
  motivo_rechazo: null,
  decidida_en: new Date('2026-11-22T10:00:00.000Z'),
  actualizado_en: new Date('2026-11-22T10:00:00.000Z'),
};

const BLOQUEO_PROPIO = {
  solicitud_id: '12',
  gestor_id: '1',
  token: '7b0d4a4e-9f0c-4d7b-8a5e-1f2c3d4e5f6a',
  iniciada_en: '2026-11-21T10:00:00.000Z',
  ultima_actividad: '2026-11-21T10:00:00.000Z',
  expira_en: '2099-11-21T10:15:00.000Z',
  vigente: true,
  nombre: 'Laura',
  apellido: 'Martínez',
  perfil: 'administrador',
};

const BLOQUEO_AJENO = {
  ...BLOQUEO_PROPIO,
  gestor_id: '2',
  nombre: 'Carlos',
  apellido: 'Ríos',
  perfil: 'revisor',
};

describe('RevisionSolicitudesService', () => {
  const prisma = {
    solicitudes: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    requisitos_documentales: { findMany: jest.fn(), findFirst: jest.fn() },
    solicitud_documentos: { findMany: jest.fn(), update: jest.fn() },
    solicitud_historial: { create: jest.fn() },
    solicitud_revisiones: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  const notificaciones = {
    crearCambioEstadoSolicitud: jest.fn(),
    enviarCorreoCambioEstadoSolicitud: jest.fn(),
  };
  let servicio: RevisionSolicitudesService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );
    prisma.solicitudes.findUnique.mockResolvedValue(FILA_SOLICITUD);
    prisma.requisitos_documentales.findMany.mockResolvedValue(CATALOGO);
    prisma.$queryRaw.mockResolvedValue([BLOQUEO_PROPIO]);
    prisma.$executeRaw.mockResolvedValue(undefined);
    prisma.solicitudes.update.mockResolvedValue({});
    notificaciones.crearCambioEstadoSolicitud.mockResolvedValue('21');
    notificaciones.enviarCorreoCambioEstadoSolicitud.mockResolvedValue({
      correoEnviado: true,
      mensajeCorreo: null,
    });
    servicio = new RevisionSolicitudesService(
      prisma as unknown as PrismaService,
      notificaciones as unknown as NotificacionesService,
    );
  });

  it('lista la cola activa por defecto', async () => {
    prisma.solicitudes.findMany.mockResolvedValue([FILA_SOLICITUD]);
    prisma.solicitudes.count.mockResolvedValue(1);

    const resultado = await servicio.listar(GESTOR, {});

    expect(prisma.solicitudes.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          estado: { in: ['radicada', 'en_revision'] },
        }),
        orderBy: [
          { radicada_en: { sort: 'asc', nulls: 'last' } },
          { id: 'asc' },
        ],
      }),
    );
    expect(resultado.paginacion.total).toBe(1);
    expect(resultado.datos[0]?.bloqueo?.esPropio).toBe(true);
  });

  it('aplica los filtros de estado, sector y actividad', async () => {
    prisma.solicitudes.findMany.mockResolvedValue([]);
    prisma.solicitudes.count.mockResolvedValue(0);

    await servicio.listar(GESTOR, {
      estado: 'devuelta',
      sector: 'Centro',
      actividad: 'Artesanías',
      orden: 'reciente',
    });

    expect(prisma.solicitudes.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          estado: 'devuelta',
          espacios_temporales: { actividad_permitida: 'Artesanías' },
        }),
      }),
    );
  });

  it('devuelve el detalle con checklist y progreso', async () => {
    prisma.solicitudes.findUnique.mockResolvedValue(FILA_SOLICITUD);
    prisma.$queryRaw.mockResolvedValue([BLOQUEO_PROPIO]);

    const detalle = await servicio.detalle(GESTOR, '12');

    expect(detalle.numeroRadicado).toBe('SOL-2026-00012');
    expect(detalle.requisitos).toHaveLength(1);
    expect(detalle.requisitos[0]?.estado).toBe('cargado');
    expect(detalle.puedeVerificar).toBe(true);
    expect(detalle.progreso.pendientes).toBe(1);
  });

  it('abre en solo lectura cuando otro gestor tiene el bloqueo', async () => {
    prisma.$queryRaw.mockResolvedValue([BLOQUEO_AJENO]);

    const detalle = await servicio.detalle(GESTOR, '12');

    expect(detalle.puedeVerificar).toBe(false);
    expect(detalle.motivoBloqueo).toContain('Carlos');
  });

  it('rechaza tomar la revisión si otro gestor la tiene bloqueada', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          id: 12n,
          estado: 'radicada',
          numero_radicado: 'SOL-2026-00012',
          comerciante_id: 3n,
          correo: 'maria.gomez@gmail.com',
          nombre: 'María',
          espacio_nombre: 'Kiosco',
          bloqueo_gestor_id: 2n,
          bloqueo_vigente: true,
          bloqueo_expira_en: new Date(),
        },
      ])
      .mockResolvedValueOnce([BLOQUEO_AJENO]);

    await expect(servicio.tomarRevision(GESTOR, '12')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.solicitudes.update).not.toHaveBeenCalled();
  });

  it('transiciona radicada a en revisión al tomar el bloqueo', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          id: 12n,
          estado: 'radicada',
          numero_radicado: 'SOL-2026-00012',
          comerciante_id: 3n,
          correo: 'maria.gomez@gmail.com',
          nombre: 'María',
          espacio_nombre: 'Kiosco',
          bloqueo_gestor_id: null,
          bloqueo_vigente: null,
          bloqueo_expira_en: null,
        },
      ])
      .mockResolvedValueOnce([BLOQUEO_PROPIO])
      .mockResolvedValueOnce([BLOQUEO_PROPIO]);
    prisma.solicitudes.findUnique.mockResolvedValue({
      ...FILA_SOLICITUD,
      estado: 'en_revision',
    });

    const respuesta = await servicio.tomarRevision(GESTOR, '12');

    expect(prisma.solicitudes.update).toHaveBeenCalledWith({
      where: { id: 12n },
      data: { estado: 'en_revision', revisor_id: 1n },
    });
    expect(prisma.solicitud_historial.create).toHaveBeenCalled();
    expect(notificaciones.crearCambioEstadoSolicitud).toHaveBeenCalled();
    expect(respuesta.transiciono).toBe(true);
  });

  it('renueva el bloqueo activo', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { expira_en: new Date('2099-11-21T10:20:00.000Z') },
    ]);

    const respuesta = await servicio.renovarRevision(GESTOR, '12');

    expect(respuesta.expiraEn).toBeInstanceOf(Date);
  });

  it('rechaza renovar si el bloqueo expiró', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await expect(servicio.renovarRevision(GESTOR, '12')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('libera solo el bloqueo propio', async () => {
    prisma.solicitud_revisiones.findUnique.mockResolvedValue({
      gestor_id: 2n,
      token: BLOQUEO_PROPIO.token,
      expira_en: new Date('2099-01-01T00:00:00.000Z'),
    });
    await expect(servicio.liberarRevision(GESTOR, '12')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('no libera el bloqueo si el token de la pantalla ya no coincide', async () => {
    prisma.solicitud_revisiones.findUnique.mockResolvedValue({
      gestor_id: 1n,
      token: 'otro-token',
      expira_en: new Date('2099-01-01T00:00:00.000Z'),
    });

    const respuesta = await servicio.liberarRevision(
      GESTOR,
      '12',
      'token-viejo',
    );

    expect(respuesta.liberado).toBe(false);
    expect(prisma.solicitud_revisiones.delete).not.toHaveBeenCalled();
  });

  it('exige observación al marcar No cumple', async () => {
    await expect(
      servicio.verificarRequisito(GESTOR, '12', '1', {
        estado: 'no_cumple',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza verificar sin bloqueo propio', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        { estado: 'en_revision', actividad: 'Artesanías' },
      ])
      .mockResolvedValueOnce([{ gestor_id: 2n, vigente: true }]);

    await expect(
      servicio.verificarRequisito(GESTOR, '12', '1', {
        estado: 'cumple',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza verificar si el requisito no tiene documento vigente', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        { estado: 'en_revision', actividad: 'Artesanías' },
      ])
      .mockResolvedValueOnce([{ gestor_id: 1n, vigente: true }]);
    prisma.requisitos_documentales.findFirst.mockResolvedValue(CATALOGO[0]);
    prisma.solicitud_documentos.findMany.mockResolvedValue([]);

    await expect(
      servicio.verificarRequisito(GESTOR, '12', '1', {
        estado: 'cumple',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('guarda la verificación y el progreso', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        { estado: 'en_revision', actividad: 'Artesanías' },
      ])
      .mockResolvedValueOnce([{ gestor_id: 1n, vigente: true }])
      .mockResolvedValueOnce([BLOQUEO_PROPIO]);
    prisma.requisitos_documentales.findFirst.mockResolvedValue(CATALOGO[0]);
    prisma.solicitud_documentos.findMany.mockResolvedValue(
      FILA_SOLICITUD.solicitud_documentos,
    );
    prisma.solicitud_documentos.update.mockResolvedValue({});
    prisma.solicitudes.findUnique.mockResolvedValue({
      ...FILA_SOLICITUD,
      solicitud_documentos: [
        {
          ...FILA_SOLICITUD.solicitud_documentos[0],
          estado: 'validado',
          verificado_en: new Date('2026-11-21T10:00:00.000Z'),
          usuarios: { id: 1n, nombre: 'Laura', apellido: 'Martínez' },
        },
      ],
    });

    const respuesta = await servicio.verificarRequisito(GESTOR, '12', '1', {
      estado: 'cumple',
    });

    expect(prisma.solicitud_documentos.update).toHaveBeenCalledWith({
      where: { id: 8n },
      data: expect.objectContaining({
        estado: 'validado',
        observacion: null,
        verificado_por: 1n,
      }),
    });
    expect(respuesta.requisito.estado).toBe('cumple');
    expect(respuesta.progreso.cumple).toBe(1);
  });

  it('aprueba, asigna el espacio y notifica al comerciante', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([FILA_RESOLUCION])
      .mockResolvedValueOnce([{ gestor_id: 1n, vigente: true }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 4n, nombre: 'Kiosco Parque La Guadalupe', estado: 'disponible' },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prisma.solicitudes.update.mockResolvedValue(ACTUALIZADA_APROBADA);

    const respuesta = await servicio.resolver(GESTOR, '12', {
      decision: 'aprobar',
      dictamen: 'Cumple con los requisitos documentales.',
    });

    expect(respuesta).toMatchObject({
      estado: 'aprobada',
      dictamen: 'Cumple con los requisitos documentales.',
      asignacion: {
        espacioId: '4',
        fechaInicio: '2026-12-01',
        fechaFin: '2026-12-03',
        horaInicio: '09:00',
        horaFin: '12:00',
      },
    });
    expect(prisma.solicitudes.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 12n },
        data: expect.objectContaining({
          estado: 'aprobada',
          revisor_id: 1n,
          motivo_rechazo: null,
        }),
      }),
    );
    expect(prisma.solicitud_historial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado_nuevo: 'aprobada',
          observacion: 'Cumple con los requisitos documentales.',
        }),
      }),
    );
    expect(notificaciones.crearCambioEstadoSolicitud).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        estadoNuevo: 'aprobada',
        observacion: 'Cumple con los requisitos documentales.',
      }),
    );
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(notificaciones.enviarCorreoCambioEstadoSolicitud).toHaveBeenCalled();
  });

  it('rechaza con motivo obligatorio y lo guarda en la solicitud', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([FILA_RESOLUCION])
      .mockResolvedValueOnce([{ gestor_id: 1n, vigente: true }]);
    prisma.solicitudes.update.mockResolvedValue({
      ...ACTUALIZADA_APROBADA,
      estado: 'rechazada',
      motivo_rechazo: 'Documentación incompleta.',
    });

    const respuesta = await servicio.resolver(GESTOR, '12', {
      decision: 'rechazar',
      motivoRechazo: 'Documentación incompleta.',
    });

    expect(respuesta.estado).toBe('rechazada');
    expect(respuesta.motivoRechazo).toBe('Documentación incompleta.');
    expect(respuesta.asignacion).toBeNull();
    expect(prisma.solicitudes.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: 'rechazada',
          motivo_rechazo: 'Documentación incompleta.',
        }),
      }),
    );
  });

  it('no abre transacción al rechazar sin motivo', async () => {
    await expect(
      servicio.resolver(GESTOR, '12', { decision: 'rechazar' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('impide aprobar con un requisito vigente No cumple', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([FILA_RESOLUCION])
      .mockResolvedValueOnce([{ gestor_id: 1n, vigente: true }])
      .mockResolvedValueOnce([
        { tipo_documento: 'RUT', observacion: 'RUT vencido' },
      ]);

    await expect(
      servicio.resolver(GESTOR, '12', { decision: 'aprobar' }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.solicitudes.update).not.toHaveBeenCalled();
  });

  it('impide aprobar si el espacio ya tiene una solicitud aprobada', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([FILA_RESOLUCION])
      .mockResolvedValueOnce([{ gestor_id: 1n, vigente: true }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 4n, nombre: 'Kiosco Parque La Guadalupe', estado: 'disponible' },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          referencia: 'SOL-2026-00010',
          fecha_inicio: '2026-12-01',
          fecha_fin: '2026-12-02',
        },
      ]);

    await expect(
      servicio.resolver(GESTOR, '12', { decision: 'aprobar' }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.solicitudes.update).not.toHaveBeenCalled();
  });

  it('impide resolver una solicitud que ya no está en revisión', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      { ...FILA_RESOLUCION, estado: 'aprobada' },
    ]);

    await expect(
      servicio.resolver(GESTOR, '12', { decision: 'aprobar' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
