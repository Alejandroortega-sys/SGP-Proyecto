import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import type { CorreoService } from '../correo/correo.service';
import type { NotificacionesService } from '../notificaciones/notificaciones.service';
import type { PrismaService } from '../prisma/prisma.service';
import { SolicitudesService } from './solicitudes.service';

const PDF = Buffer.from('%PDF-1.4 documento de prueba');

const USUARIO: UsuarioAutenticado = {
  id: '3',
  nombre: 'María',
  apellido: 'Gómez',
  correo: 'maria.gomez@gmail.com',
  rol: 'comerciante',
  perfil: null,
  estado: 'activa',
};

const GESTOR: UsuarioAutenticado = {
  id: '1',
  nombre: 'Laura',
  apellido: 'Martínez',
  correo: 'admin@tulua.gov.co',
  rol: 'gestor',
  perfil: 'administrador',
  estado: 'activa',
};

function fechaFutura(dias: number): string {
  const fecha = new Date();
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

const DATOS = {
  espacioId: '1',
  actividad: 'Artesanías',
  productoIds: ['1'],
  fechaInicio: fechaFutura(7),
  fechaFin: fechaFutura(9),
  horaInicio: '09:00',
  horaFin: '12:00',
};

const ESPACIO = {
  id: 1n,
  nombre: 'Kiosco Parque La Guadua',
  estado: 'disponible',
  sector: 'Parque La Guadua',
  tipo: 'kiosco',
  actividad_permitida: 'Artesanías',
  horario_inicio: '08:00',
  horario_fin: '18:00',
  zona_id: 2n,
  zona_nombre: 'Parque La Guadua',
  zona_activa: true,
  zona_horario_inicio: '08:00',
  zona_horario_fin: '18:00',
  zona_productos: ['Artesanías'],
};

const REQUISITOS = [
  {
    id: 1n,
    nombre: 'Documento de identidad',
    descripcion: 'Copia legible',
    obligatorio: true,
    tipo_actividad: null,
    orden: 10,
  },
  {
    id: 2n,
    nombre: 'RUT',
    descripcion: 'Registro único tributario',
    obligatorio: true,
    tipo_actividad: null,
    orden: 20,
  },
];

const PRODUCTO = { id: 1n, nombre: 'Artesanías' };

const FILA = {
  id: 12n,
  numero_radicado: 'SOL-2026-00012',
  estado: 'radicada',
  actividad: 'Artesanías',
  fecha_inicio: new Date('2027-02-10T00:00:00.000Z'),
  fecha_fin: new Date('2027-02-12T00:00:00.000Z'),
  hora_inicio: new Date('1970-01-01T09:00:00.000Z'),
  hora_fin: new Date('1970-01-01T12:00:00.000Z'),
  radicada_en: new Date('2026-11-20T10:00:00.000Z'),
  decidida_en: null,
  motivo_rechazo: null,
  creado_en: new Date('2026-11-20T10:00:00.000Z'),
  actualizado_en: new Date('2026-11-20T10:00:00.000Z'),
  espacios_temporales: {
    id: 1n,
    nombre: 'Kiosco Parque La Guadua',
    sector: 'Parque La Guadua',
    tipo: 'kiosco',
    actividad_permitida: 'Artesanías',
  },
  solicitud_productos: [{ productos: PRODUCTO }],
  solicitud_documentos: [
    {
      id: 5n,
      requisito_id: 1n,
      tipo_documento: 'Documento de identidad',
      nombre_original: 'cedula.pdf',
      mime_type: 'application/pdf',
      tamano_bytes: PDF.length,
      estado: 'pendiente',
      observacion: null,
      cargado_en: new Date('2026-11-20T10:00:00.000Z'),
      archivo_url: 'solicitudes/12/cedula.pdf',
      reemplaza_a: null,
    },
  ],
  solicitud_historial: [
    {
      id: 1n,
      estado_anterior: 'borrador',
      estado_nuevo: 'radicada',
      observacion: 'Solicitud radicada por el comerciante.',
      creado_en: new Date('2026-11-20T10:00:00.000Z'),
      usuarios: { id: 3n, nombre: 'María', apellido: 'Gómez' },
    },
  ],
};

function archivoPdf(nombre = 'documento.pdf'): Express.Multer.File {
  return {
    fieldname: 'documentos',
    originalname: nombre,
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: PDF.length,
    buffer: PDF,
    destination: '',
    filename: nombre,
    path: '',
    stream: undefined as never,
  };
}

interface TxMock {
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
  solicitudes: { update: jest.Mock };
  solicitud_productos: { createMany: jest.Mock };
  solicitud_documentos: { create: jest.Mock; findMany: jest.Mock };
  solicitud_historial: { create: jest.Mock };
  notificaciones: { create: jest.Mock };
}

const DOCUMENTO_NUEVO = {
  id: 9n,
  solicitud_id: 12n,
  requisito_id: 1n,
  tipo_documento: 'Documento de identidad',
  archivo_url: 'solicitudes/12/nuevo.pdf',
  estado: 'pendiente',
  observacion: null,
  reemplaza_a: null,
  cargado_en: new Date('2026-11-21T10:00:00.000Z'),
  nombre_original: 'nuevo.pdf',
  mime_type: 'application/pdf',
  tamano_bytes: PDF.length,
};

function crearMocks() {
  const tx: TxMock = {
    $queryRaw: jest
      .fn()
      .mockResolvedValue([{ id: 12n, numero_radicado: 'SOL-2026-00012' }]),
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    solicitudes: { update: jest.fn() },
    solicitud_productos: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    solicitud_documentos: {
      create: jest.fn().mockResolvedValue(DOCUMENTO_NUEVO),
      findMany: jest.fn().mockResolvedValue([]),
    },
    solicitud_historial: { create: jest.fn().mockResolvedValue({}) },
    notificaciones: { create: jest.fn().mockResolvedValue({ id: 1n }) },
  };

  const prisma = {
    solicitudes: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    requisitos_documentales: {
      findMany: jest.fn().mockResolvedValue(REQUISITOS),
    },
    productos: { findMany: jest.fn().mockResolvedValue([PRODUCTO]) },
    solicitud_documentos: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(
      async (callback: (cliente: TxMock) => Promise<unknown>) => callback(tx),
    ),
  };

  const correo = {
    enviarConfirmacionRadicacion: jest.fn().mockResolvedValue(undefined),
    enviarCambioEstadoSolicitud: jest.fn().mockResolvedValue(undefined),
  };

  const notificaciones = {
    crearCambioEstadoSolicitud: jest.fn().mockResolvedValue('1'),
    enviarCorreoCambioEstadoSolicitud: jest.fn().mockResolvedValue({
      correoEnviado: true,
      mensajeCorreo: null,
    }),
  };

  return { prisma, correo, notificaciones, tx };
}

function crearServicio(
  prisma: ReturnType<typeof crearMocks>['prisma'],
  correo: ReturnType<typeof crearMocks>['correo'],
  notificaciones = crearMocks().notificaciones,
): SolicitudesService {
  return new SolicitudesService(
    prisma as unknown as PrismaService,
    correo as unknown as CorreoService,
    notificaciones as unknown as NotificacionesService,
  );
}

function mockConsultaBase(
  prisma: ReturnType<typeof crearMocks>['prisma'],
  opciones: { duplicado?: boolean; espacio?: typeof ESPACIO } = {},
) {
  prisma.$queryRaw.mockImplementation(
    (strings: TemplateStringsArray, ..._valores: unknown[]) => {
      const sql = strings.join('?');
      if (sql.includes('FROM espacios_temporales')) {
        return Promise.resolve([opciones.espacio ?? ESPACIO]);
      }
      if (sql.includes('FROM espacio_bloqueos')) {
        return Promise.resolve([]);
      }
      if (sql.includes('FROM permisos')) {
        return Promise.resolve([]);
      }
      if (sql.includes("estado = 'aprobada'")) {
        return Promise.resolve([]);
      }
      if (sql.includes('estado IN') && opciones.duplicado) {
        return Promise.resolve([{ id: 1n, numero_radicado: 'SOL-2026-00001' }]);
      }
      if (sql.includes('estado IN')) {
        return Promise.resolve([]);
      }
      throw new Error(`Consulta no simulada: ${sql}`);
    },
  );
}

describe('SolicitudesService', () => {
  let temporal: string;
  let entornoAnterior: string | undefined;

  beforeEach(async () => {
    entornoAnterior = process.env.UPLOAD_PRIVATE_DIR;
    temporal = await mkdtemp(join(tmpdir(), 'sgp-solicitudes-'));
    process.env.UPLOAD_PRIVATE_DIR = temporal;
  });

  afterEach(async () => {
    if (entornoAnterior === undefined) {
      delete process.env.UPLOAD_PRIVATE_DIR;
    } else {
      process.env.UPLOAD_PRIVATE_DIR = entornoAnterior;
    }
    await rm(temporal, { recursive: true, force: true });
  });

  it('lista las solicitudes radicadas propias', async () => {
    const { prisma, correo } = crearMocks();
    prisma.solicitudes.findMany.mockResolvedValue([FILA]);
    prisma.solicitudes.count.mockResolvedValue(1);
    const servicio = crearServicio(prisma, correo);

    const respuesta = await servicio.listarMias('3', { pagina: 1, limite: 10 });

    expect(respuesta.paginacion).toEqual({
      pagina: 1,
      limite: 10,
      total: 1,
      totalPaginas: 1,
    });
    expect(respuesta.datos[0]).toMatchObject({
      numeroRadicado: 'SOL-2026-00012',
      estado: 'radicada',
      fechaInicio: '2027-02-10',
      horaInicio: '09:00',
      productos: [{ nombre: 'Artesanías' }],
    });
    expect(prisma.solicitudes.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { comerciante_id: 3n, estado: { not: 'borrador' } },
      }),
    );
  });

  it('no devuelve borradores del backend en el listado', async () => {
    const { prisma, correo } = crearMocks();
    const servicio = crearServicio(prisma, correo);

    const respuesta = await servicio.listarMias('3', { estado: 'borrador' });

    expect(respuesta.datos).toEqual([]);
    expect(prisma.solicitudes.findMany).not.toHaveBeenCalled();
  });

  it('devuelve el detalle propio y rechaza solicitudes ajenas', async () => {
    const { prisma, correo } = crearMocks();
    prisma.solicitudes.findFirst.mockResolvedValue(FILA);
    const servicio = crearServicio(prisma, correo);

    const detalle = await servicio.detalle('3', '12');
    expect(detalle.historial[0]).toMatchObject({
      estadoAnterior: 'borrador',
      estadoNuevo: 'radicada',
      actor: { nombre: 'María' },
    });

    prisma.solicitudes.findFirst.mockResolvedValue(null);
    await expect(servicio.detalle('3', '99')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('consulta los requisitos globales y de la actividad', async () => {
    const { prisma, correo } = crearMocks();
    const servicio = crearServicio(prisma, correo);

    const respuesta = await servicio.requisitos({ actividad: 'Artesanías' });

    expect(respuesta.requisitos).toHaveLength(2);
    expect(prisma.requisitos_documentales.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          activo: true,
          OR: [{ tipo_actividad: null }, { tipo_actividad: 'Artesanías' }],
        },
      }),
    );
  });

  it('radica una solicitud válida y registra historial, notificación y correo', async () => {
    const { prisma, correo, notificaciones, tx } = crearMocks();
    mockConsultaBase(prisma);
    const servicio = crearServicio(prisma, correo, notificaciones);

    const respuesta = await servicio.radicar(
      USUARIO,
      {
        datos: JSON.stringify(DATOS),
        documentosMeta: JSON.stringify([
          { requisitoId: '1', nombreOriginal: 'cedula.pdf' },
          { requisitoId: '2', nombreOriginal: 'rut.pdf' },
        ]),
      },
      [archivoPdf('cedula.pdf'), archivoPdf('rut.pdf')],
    );

    expect(respuesta).toMatchObject({
      id: '12',
      numeroRadicado: 'SOL-2026-00012',
      estado: 'radicada',
      correoEnviado: true,
    });
    expect(tx.solicitud_productos.createMany).toHaveBeenCalled();
    expect(tx.solicitud_documentos.create).toHaveBeenCalledTimes(2);
    expect(tx.solicitud_historial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado_anterior: 'borrador',
          estado_nuevo: 'radicada',
        }),
      }),
    );
    expect(notificaciones.crearCambioEstadoSolicitud).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        solicitudId: 12n,
        estadoAnterior: 'borrador',
        estadoNuevo: 'radicada',
        numeroRadicado: 'SOL-2026-00012',
      }),
    );
    expect(correo.enviarConfirmacionRadicacion).toHaveBeenCalledWith(
      USUARIO.correo,
      USUARIO.nombre,
      expect.objectContaining({ numeroRadicado: 'SOL-2026-00012' }),
    );
  });

  it('rechaza la radicación si faltan documentos obligatorios', async () => {
    const { prisma, correo } = crearMocks();
    mockConsultaBase(prisma);
    const servicio = crearServicio(prisma, correo);

    await expect(
      servicio.radicar(
        USUARIO,
        {
          datos: JSON.stringify(DATOS),
          documentosMeta: JSON.stringify([
            { requisitoId: '1', nombreOriginal: 'cedula.pdf' },
          ]),
        },
        [archivoPdf('cedula.pdf')],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza un horario fuera del permitido', async () => {
    const { prisma, correo } = crearMocks();
    mockConsultaBase(prisma);
    const servicio = crearServicio(prisma, correo);

    await expect(
      servicio.radicar(
        USUARIO,
        {
          datos: JSON.stringify({
            ...DATOS,
            horaInicio: '07:00',
            horaFin: '12:00',
          }),
          documentosMeta: JSON.stringify([
            { requisitoId: '1', nombreOriginal: 'cedula.pdf' },
            { requisitoId: '2', nombreOriginal: 'rut.pdf' },
          ]),
        },
        [archivoPdf(), archivoPdf('rut.pdf')],
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza fechas pasadas', async () => {
    const { prisma, correo } = crearMocks();
    mockConsultaBase(prisma);
    const servicio = crearServicio(prisma, correo);

    await expect(
      servicio.radicar(
        USUARIO,
        {
          datos: JSON.stringify({
            ...DATOS,
            fechaInicio: '2020-01-01',
            fechaFin: '2020-01-02',
          }),
          documentosMeta: JSON.stringify([
            { requisitoId: '1', nombreOriginal: 'cedula.pdf' },
            { requisitoId: '2', nombreOriginal: 'rut.pdf' },
          ]),
        },
        [archivoPdf(), archivoPdf('rut.pdf')],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza una solicitud duplicada del mismo comerciante', async () => {
    const { prisma, correo } = crearMocks();
    mockConsultaBase(prisma, { duplicado: true });
    const servicio = crearServicio(prisma, correo);

    await expect(
      servicio.radicar(
        USUARIO,
        {
          datos: JSON.stringify(DATOS),
          documentosMeta: JSON.stringify([
            { requisitoId: '1', nombreOriginal: 'cedula.pdf' },
            { requisitoId: '2', nombreOriginal: 'rut.pdf' },
          ]),
        },
        [archivoPdf(), archivoPdf('rut.pdf')],
      ),
    ).rejects.toThrow('Ya tienes una solicitud activa');
  });

  it('informa la disponibilidad del espacio', async () => {
    const { prisma, correo } = crearMocks();
    mockConsultaBase(prisma);
    const servicio = crearServicio(prisma, correo);

    const respuesta = await servicio.consultarDisponibilidad('3', DATOS);

    expect(respuesta).toEqual({
      disponible: true,
      motivo: null,
      espacio: { id: '1', nombre: ESPACIO.nombre },
    });
  });

  it('no permite descargar documentos ajenos o inexistentes', async () => {
    const { prisma, correo } = crearMocks();
    prisma.solicitud_documentos.findFirst.mockResolvedValue(null);
    const servicio = crearServicio(prisma, correo);

    await expect(
      servicio.descargarDocumento(USUARIO, '12', '5'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('devuelve la ruta de un documento propio existente', async () => {
    const { prisma, correo } = crearMocks();
    const carpeta = join(temporal, 'solicitudes', '12');
    await mkdir(carpeta, { recursive: true });
    await writeFile(join(carpeta, 'cedula.pdf'), PDF);
    prisma.solicitud_documentos.findFirst.mockResolvedValue({
      archivo_url: 'solicitudes/12/cedula.pdf',
      nombre_original: 'cedula.pdf',
      mime_type: 'application/pdf',
    });
    const servicio = crearServicio(prisma, correo);

    const archivo = await servicio.descargarDocumento(USUARIO, '12', '5');

    expect(archivo).toMatchObject({
      nombreOriginal: 'cedula.pdf',
      mimeType: 'application/pdf',
    });
  });

  function solicitudDocumentos(estado: string) {
    return {
      id: 12n,
      numero_radicado: 'SOL-2026-00012',
      estado,
      espacios_temporales: { actividad_permitida: 'Artesanías' },
    };
  }

  function documento(
    id: bigint,
    requisitoId: bigint | null,
    estado: 'pendiente' | 'validado' | 'observado',
    reemplazaA: bigint | null = null,
    tipoDocumento = 'Documento de identidad',
  ) {
    return {
      id,
      requisito_id: requisitoId,
      tipo_documento: tipoDocumento,
      nombre_original: `documento-${id.toString()}.pdf`,
      mime_type: 'application/pdf',
      tamano_bytes: PDF.length,
      estado,
      observacion: estado === 'observado' ? 'Documento ilegible.' : null,
      cargado_en: new Date(
        `2026-11-${id.toString().padStart(2, '0')}T10:00:00.000Z`,
      ),
      archivo_url: `solicitudes/12/documento-${id.toString()}.pdf`,
      reemplaza_a: reemplazaA,
    };
  }

  it('lista requisitos con estado, versión vigente y faltantes', async () => {
    const { prisma, correo } = crearMocks();
    prisma.solicitudes.findFirst.mockResolvedValue(
      solicitudDocumentos('devuelta'),
    );
    prisma.solicitud_documentos.findMany.mockResolvedValue([
      documento(5n, 1n, 'observado'),
      documento(6n, 1n, 'validado', 5n),
      documento(7n, null, 'pendiente', null, 'Documento antiguo'),
    ]);
    const servicio = crearServicio(prisma, correo);

    const respuesta = await servicio.listarRequisitosSolicitud('3', '12');

    expect(respuesta.estado).toBe('devuelta');
    expect(respuesta.faltantes).toEqual(['RUT']);
    expect(respuesta.requisitos[0]).toMatchObject({
      nombre: 'Documento de identidad',
      estado: 'cumple',
      documentoActual: { id: '6', numeroVersion: 2, esActual: true },
    });
    expect(respuesta.requisitos[0].versiones.map((v) => v.id)).toEqual([
      '6',
      '5',
    ]);
    expect(respuesta.requisitos[1]).toMatchObject({
      nombre: 'RUT',
      estado: 'faltante',
      documentoActual: null,
    });
    expect(respuesta.otrosDocumentos).toHaveLength(1);
    expect(respuesta.otrosDocumentos[0].tipoDocumento).toBe(
      'Documento antiguo',
    );
  });

  it('carga un documento nuevo en estado radicada sin cambiar el estado', async () => {
    const { prisma, correo, tx } = crearMocks();
    prisma.solicitudes.findFirst.mockResolvedValue(
      solicitudDocumentos('radicada'),
    );
    tx.$queryRaw.mockResolvedValue([{ estado: 'radicada' }]);
    tx.solicitud_documentos.findMany.mockResolvedValue([]);
    prisma.solicitud_documentos.findMany.mockResolvedValue([DOCUMENTO_NUEVO]);
    const servicio = crearServicio(prisma, correo);

    const respuesta = await servicio.cargarDocumentoSolicitud(
      USUARIO,
      '12',
      { requisitoId: '1' },
      archivoPdf('cedula.pdf'),
    );

    expect(respuesta).toMatchObject({
      mensaje: 'Documento cargado correctamente.',
      estadoSolicitud: 'radicada',
      volvioARevision: false,
    });
    expect(tx.solicitud_documentos.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requisito_id: 1n,
          estado: 'pendiente',
          reemplaza_a: null,
        }),
      }),
    );
    expect(
      tx.$executeRaw.mock.calls.some(([sql]) =>
        String(sql).includes('UPDATE solicitudes'),
      ),
    ).toBe(false);
    expect(tx.solicitud_historial.create).not.toHaveBeenCalled();
  });

  it('reemplaza en devuelta y vuelve a en_revision cuando ya no quedan observados', async () => {
    const { prisma, correo, notificaciones, tx } = crearMocks();
    prisma.solicitudes.findFirst
      .mockResolvedValueOnce(solicitudDocumentos('devuelta'))
      .mockResolvedValueOnce(solicitudDocumentos('en_revision'));
    tx.$queryRaw.mockResolvedValue([{ estado: 'devuelta' }]);
    tx.solicitud_documentos.findMany.mockResolvedValue([
      documento(5n, 1n, 'observado'),
    ]);
    prisma.solicitud_documentos.findMany.mockResolvedValue([
      documento(5n, 1n, 'observado'),
      DOCUMENTO_NUEVO,
    ]);
    const servicio = crearServicio(prisma, correo, notificaciones);

    const respuesta = await servicio.cargarDocumentoSolicitud(
      USUARIO,
      '12',
      { requisitoId: '1' },
      archivoPdf('cedula.pdf'),
    );

    expect(respuesta).toMatchObject({
      mensaje: 'Documento reemplazado correctamente.',
      estadoSolicitud: 'en_revision',
      volvioARevision: true,
    });
    expect(tx.solicitud_documentos.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reemplaza_a: 5n }),
      }),
    );
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.solicitud_historial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado_anterior: 'devuelta',
          estado_nuevo: 'en_revision',
        }),
      }),
    );
    expect(notificaciones.crearCambioEstadoSolicitud).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        estadoAnterior: 'devuelta',
        estadoNuevo: 'en_revision',
      }),
    );
    expect(notificaciones.enviarCorreoCambioEstadoSolicitud).toHaveBeenCalled();
  });

  it('no vuelve a revisión si todavía quedan requisitos observados', async () => {
    const { prisma, correo, tx } = crearMocks();
    prisma.solicitudes.findFirst.mockResolvedValue(
      solicitudDocumentos('devuelta'),
    );
    tx.$queryRaw.mockResolvedValue([{ estado: 'devuelta' }]);
    tx.solicitud_documentos.findMany.mockResolvedValue([
      documento(5n, 1n, 'observado'),
      documento(6n, 2n, 'observado', null, 'RUT'),
    ]);
    prisma.solicitud_documentos.findMany.mockResolvedValue([
      documento(5n, 1n, 'observado'),
      documento(6n, 2n, 'observado', null, 'RUT'),
      DOCUMENTO_NUEVO,
    ]);
    const servicio = crearServicio(prisma, correo);

    const respuesta = await servicio.cargarDocumentoSolicitud(
      USUARIO,
      '12',
      { requisitoId: '1' },
      archivoPdf('cedula.pdf'),
    );

    expect(respuesta.estadoSolicitud).toBe('devuelta');
    expect(respuesta.volvioARevision).toBe(false);
    expect(
      tx.$executeRaw.mock.calls.some(([sql]) =>
        String(sql).includes('UPDATE solicitudes'),
      ),
    ).toBe(false);
    expect(tx.solicitud_historial.create).not.toHaveBeenCalled();
  });

  it('rechaza cargar documentos en estados no editables', async () => {
    const { prisma, correo } = crearMocks();
    prisma.solicitudes.findFirst.mockResolvedValue(
      solicitudDocumentos('en_revision'),
    );
    const servicio = crearServicio(prisma, correo);

    await expect(
      servicio.cargarDocumentoSolicitud(
        USUARIO,
        '12',
        { requisitoId: '1' },
        archivoPdf('cedula.pdf'),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza requisitos que no aplican a la actividad', async () => {
    const { prisma, correo } = crearMocks();
    prisma.solicitudes.findFirst.mockResolvedValue(
      solicitudDocumentos('radicada'),
    );
    const servicio = crearServicio(prisma, correo);

    await expect(
      servicio.cargarDocumentoSolicitud(
        USUARIO,
        '12',
        { requisitoId: '99' },
        archivoPdf('cedula.pdf'),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza cargar documentos de una solicitud ajena', async () => {
    const { prisma, correo } = crearMocks();
    prisma.solicitudes.findFirst.mockResolvedValue(null);
    const servicio = crearServicio(prisma, correo);

    await expect(
      servicio.cargarDocumentoSolicitud(
        USUARIO,
        '12',
        { requisitoId: '1' },
        archivoPdf('cedula.pdf'),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cambia el estado, registra historial y notifica al comerciante', async () => {
    const { prisma, correo, notificaciones, tx } = crearMocks();
    tx.$queryRaw.mockResolvedValue([
      {
        id: 12n,
        numero_radicado: 'SOL-2026-00012',
        estado: 'radicada',
        comerciante_id: 3n,
        correo: USUARIO.correo,
        nombre: USUARIO.nombre,
        espacio_nombre: 'Kiosco Parque La Guadua',
      },
    ]);
    tx.solicitudes.update.mockResolvedValue({
      id: 12n,
      numero_radicado: 'SOL-2026-00012',
      estado: 'en_revision',
      motivo_rechazo: null,
      decidida_en: null,
      actualizado_en: new Date('2026-11-21T10:00:00.000Z'),
    });
    const servicio = crearServicio(prisma, correo, notificaciones);

    const respuesta = await servicio.cambiarEstado(GESTOR, '12', {
      estado: 'en_revision',
    });

    expect(respuesta).toMatchObject({
      id: '12',
      estadoAnterior: 'radicada',
      estado: 'en_revision',
      correoEnviado: true,
    });
    expect(tx.solicitudes.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 12n },
        data: expect.objectContaining({
          estado: 'en_revision',
          revisor_id: 1n,
        }),
      }),
    );
    expect(tx.solicitud_historial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado_anterior: 'radicada',
          estado_nuevo: 'en_revision',
          actor_id: 1n,
        }),
      }),
    );
    expect(notificaciones.crearCambioEstadoSolicitud).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        solicitudId: 12n,
        estadoAnterior: 'radicada',
        estadoNuevo: 'en_revision',
      }),
    );
    expect(notificaciones.enviarCorreoCambioEstadoSolicitud).toHaveBeenCalled();
  });

  it('rechaza una transición no permitida y los estados finales', async () => {
    const { prisma, correo, tx } = crearMocks();
    const servicio = crearServicio(prisma, correo);
    tx.$queryRaw.mockResolvedValue([
      {
        id: 12n,
        numero_radicado: 'SOL-2026-00012',
        estado: 'radicada',
        comerciante_id: 3n,
        correo: USUARIO.correo,
        nombre: USUARIO.nombre,
        espacio_nombre: 'Kiosco Parque La Guadua',
      },
    ]);

    await expect(
      servicio.cambiarEstado(GESTOR, '12', { estado: 'aprobada' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    tx.$queryRaw.mockResolvedValue([
      {
        id: 12n,
        numero_radicado: 'SOL-2026-00012',
        estado: 'aprobada',
        comerciante_id: 3n,
        correo: USUARIO.correo,
        nombre: USUARIO.nombre,
        espacio_nombre: 'Kiosco Parque La Guadua',
      },
    ]);
    await expect(
      servicio.cambiarEstado(GESTOR, '12', { estado: 'en_revision' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('exige observación al devolver y deriva la resolución al endpoint de HU-20', async () => {
    const { prisma, correo } = crearMocks();
    const servicio = crearServicio(prisma, correo);

    await expect(
      servicio.cambiarEstado(GESTOR, '12', { estado: 'devuelta' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      servicio.cambiarEstado(GESTOR, '12', { estado: 'rechazada' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      servicio.cambiarEstado(GESTOR, '12', { estado: 'aprobada' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('devuelve correoEnviado=false sin revertir el cambio de estado', async () => {
    const { prisma, correo, notificaciones, tx } = crearMocks();
    tx.$queryRaw.mockResolvedValue([
      {
        id: 12n,
        numero_radicado: 'SOL-2026-00012',
        estado: 'en_revision',
        comerciante_id: 3n,
        correo: USUARIO.correo,
        nombre: USUARIO.nombre,
        espacio_nombre: 'Kiosco Parque La Guadua',
      },
    ]);
    tx.solicitudes.update.mockResolvedValue({
      id: 12n,
      numero_radicado: 'SOL-2026-00012',
      estado: 'devuelta',
      motivo_rechazo: null,
      decidida_en: null,
      actualizado_en: new Date('2026-11-21T10:00:00.000Z'),
    });
    notificaciones.enviarCorreoCambioEstadoSolicitud.mockResolvedValue({
      correoEnviado: false,
      mensajeCorreo: 'SMTP no disponible',
    });
    const servicio = crearServicio(prisma, correo, notificaciones);

    const respuesta = await servicio.cambiarEstado(GESTOR, '12', {
      estado: 'devuelta',
      observacion: 'Documento inválido',
    });

    expect(respuesta.estado).toBe('devuelta');
    expect(respuesta.correoEnviado).toBe(false);
    expect(respuesta.mensajeCorreo).toBe('SMTP no disponible');
  });
});
