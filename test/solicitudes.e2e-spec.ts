import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import '../src/common/bigint-serialization';
import { AppModule } from '../src/app.module';
import { CorreoService } from '../src/correo/correo.service';
import { PrismaService } from '../src/prisma/prisma.service';

const PDF = Buffer.from('%PDF-1.4 solicitud de prueba');

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
  solicitud_productos: [{ productos: { id: 1n, nombre: 'Artesanías' } }],
  solicitud_documentos: [],
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

const COMERCIANTE = {
  id: 3n,
  nombre: 'María',
  apellido: 'Gómez',
  correo: 'maria.gomez@gmail.com',
  rol: 'comerciante' as const,
  estado: 'activa' as const,
  gestores_gestores_usuario_idTousuarios: null,
};

const GESTOR = {
  id: 1n,
  nombre: 'Laura',
  apellido: 'Martínez',
  correo: 'admin@tulua.gov.co',
  rol: 'gestor' as const,
  estado: 'activa' as const,
  gestores_gestores_usuario_idTousuarios: { perfil: 'administrador' },
};

const OTRO_COMERCIANTE = {
  id: 4n,
  nombre: 'José',
  apellido: 'Pérez',
  correo: 'jose.perez@hotmail.com',
  rol: 'comerciante' as const,
  estado: 'activa' as const,
  gestores_gestores_usuario_idTousuarios: null,
};

describe('Solicitudes (e2e)', () => {
  let app: INestApplication;
  let tokenComerciante: string;
  let tokenGestor: string;
  let tokenOtroComerciante: string;
  let temporal: string;
  let entornoAnterior: string | undefined;

  const DOCUMENTO = {
    id: 9n,
    solicitud_id: 12n,
    requisito_id: 1n,
    tipo_documento: 'Documento de identidad',
    nombre_original: 'nuevo.pdf',
    mime_type: 'application/pdf',
    tamano_bytes: PDF.length,
    estado: 'pendiente',
    observacion: null,
    cargado_en: new Date('2026-11-21T10:00:00.000Z'),
    archivo_url: 'solicitudes/12/nuevo.pdf',
    reemplaza_a: null,
  };

  const tx = {
    $queryRaw: jest
      .fn()
      .mockResolvedValue([{ id: 12n, numero_radicado: 'SOL-2026-00012' }]),
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    solicitud_productos: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    solicitud_documentos: {
      create: jest.fn().mockResolvedValue(DOCUMENTO),
      findMany: jest.fn().mockResolvedValue([]),
    },
    solicitud_historial: { create: jest.fn().mockResolvedValue({}) },
    notificaciones: { create: jest.fn().mockResolvedValue({ id: 21n }) },
    solicitudes: {
      update: jest.fn(),
    },
  };

  const prisma = {
    usuarios: { findUnique: jest.fn() },
    sesiones: { findFirst: jest.fn() },
    solicitudes: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    requisitos_documentales: {
      findMany: jest.fn().mockResolvedValue(REQUISITOS),
    },
    productos: {
      findMany: jest.fn().mockResolvedValue([{ id: 1n, nombre: 'Artesanías' }]),
    },
    solicitud_documentos: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(
      async (callback: (cliente: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
  };

  const correo = {
    enviarConfirmacionRadicacion: jest.fn().mockResolvedValue(undefined),
    enviarCambioEstadoSolicitud: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    entornoAnterior = process.env.UPLOAD_PRIVATE_DIR;
    temporal = await mkdtemp(join(tmpdir(), 'sgp-solicitudes-e2e-'));
    process.env.UPLOAD_PRIVATE_DIR = temporal;
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? 'e2e-secret-sgp-tulua-para-pruebas';

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(CorreoService)
      .useValue(correo)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const jwt = app.get(JwtService);
    const firmar = (
      usuario: typeof COMERCIANTE | typeof GESTOR | typeof OTRO_COMERCIANTE,
    ) =>
      jwt.signAsync(
        {
          sub: usuario.id.toString(),
          correo: usuario.correo,
          rol: usuario.rol,
          perfil:
            usuario.gestores_gestores_usuario_idTousuarios?.perfil ?? null,
          sid: usuario.id.toString(),
        },
        { expiresIn: 1_800 },
      );

    [tokenComerciante, tokenGestor, tokenOtroComerciante] = await Promise.all([
      firmar(COMERCIANTE),
      firmar(GESTOR),
      firmar(OTRO_COMERCIANTE),
    ]);
  });

  afterAll(async () => {
    await app.close();
    if (entornoAnterior === undefined) {
      delete process.env.UPLOAD_PRIVATE_DIR;
    } else {
      process.env.UPLOAD_PRIVATE_DIR = entornoAnterior;
    }
    await rm(temporal, { recursive: true, force: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.sesiones.findFirst.mockResolvedValue({ id: 1n });
    prisma.usuarios.findUnique.mockImplementation(
      ({ where }: { where: { id?: bigint } }) => {
        const usuario = [COMERCIANTE, GESTOR, OTRO_COMERCIANTE].find(
          (candidato) => candidato.id === where.id,
        );
        return Promise.resolve(usuario ?? null);
      },
    );

    prisma.$queryRaw.mockImplementation(
      (strings: TemplateStringsArray, ..._valores: unknown[]) => {
        const sql = strings.join('?');
        if (sql.includes('FROM espacios_temporales')) {
          return Promise.resolve([ESPACIO]);
        }
        if (sql.includes('FROM espacio_bloqueos')) return Promise.resolve([]);
        if (sql.includes('FROM permisos')) return Promise.resolve([]);
        if (sql.includes("estado = 'aprobada'")) return Promise.resolve([]);
        if (sql.includes('estado IN')) return Promise.resolve([]);
        throw new Error(`Consulta no simulada: ${sql}`);
      },
    );

    prisma.solicitudes.findMany.mockResolvedValue([FILA]);
    prisma.solicitudes.count.mockResolvedValue(1);
    prisma.solicitudes.findFirst.mockResolvedValue(FILA);
    correo.enviarConfirmacionRadicacion.mockResolvedValue(undefined);
  });

  function peticionMultipart(token: string | null = tokenComerciante) {
    let peticion = request(app.getHttpServer())
      .post('/solicitudes')
      .field('datos', JSON.stringify(DATOS))
      .field(
        'documentosMeta',
        JSON.stringify([
          { requisitoId: '1', nombreOriginal: 'cedula.pdf' },
          { requisitoId: '2', nombreOriginal: 'rut.pdf' },
        ]),
      )
      .attach('documentos', PDF, {
        filename: 'cedula.pdf',
        contentType: 'application/pdf',
      })
      .attach('documentos', PDF, {
        filename: 'rut.pdf',
        contentType: 'application/pdf',
      });

    if (token) peticion = peticion.set('Authorization', `Bearer ${token}`);
    return peticion;
  }

  it('exige autenticación', async () => {
    await request(app.getHttpServer()).get('/solicitudes/mias').expect(401);
  });

  it('rechaza a los gestores en la radicación', async () => {
    await peticionMultipart(tokenGestor).expect(403);
  });

  it('radica una solicitud válida con sus documentos', async () => {
    const respuesta = await peticionMultipart().expect(201);

    expect(respuesta.body).toMatchObject({
      id: '12',
      numeroRadicado: 'SOL-2026-00012',
      estado: 'radicada',
      correoEnviado: true,
    });
    expect(correo.enviarConfirmacionRadicacion).toHaveBeenCalled();
    expect(tx.solicitud_historial.create).toHaveBeenCalled();
    expect(tx.notificaciones.create).toHaveBeenCalled();
  });

  it('rechaza la radicación si faltan documentos obligatorios', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/solicitudes')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .field('datos', JSON.stringify(DATOS))
      .field(
        'documentosMeta',
        JSON.stringify([{ requisitoId: '1', nombreOriginal: 'cedula.pdf' }]),
      )
      .attach('documentos', PDF, {
        filename: 'cedula.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    expect(JSON.stringify(respuesta.body.message)).toContain('RUT');
  });

  it('rechaza un duplicado del mismo comerciante', async () => {
    prisma.$queryRaw.mockImplementation(
      (strings: TemplateStringsArray, ..._valores: unknown[]) => {
        const sql = strings.join('?');
        if (sql.includes('FROM espacios_temporales')) {
          return Promise.resolve([ESPACIO]);
        }
        if (sql.includes('FROM espacio_bloqueos')) return Promise.resolve([]);
        if (sql.includes('FROM permisos')) return Promise.resolve([]);
        if (sql.includes("estado = 'aprobada'")) return Promise.resolve([]);
        if (sql.includes('estado IN')) {
          return Promise.resolve([
            { id: 1n, numero_radicado: 'SOL-2026-00001' },
          ]);
        }
        throw new Error(`Consulta no simulada: ${sql}`);
      },
    );

    const respuesta = await peticionMultipart().expect(409);
    expect(JSON.stringify(respuesta.body.message)).toContain('SOL-2026-00001');
  });

  it('lista las solicitudes propias', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/solicitudes/mias?pagina=1&limite=10')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .expect(200);

    expect(respuesta.body.datos).toHaveLength(1);
    expect(respuesta.body.datos[0].numeroRadicado).toBe('SOL-2026-00012');
    expect(respuesta.body.paginacion.total).toBe(1);
  });

  it('devuelve el detalle con historial', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/solicitudes/12')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .expect(200);

    expect(respuesta.body.historial[0]).toMatchObject({
      estadoAnterior: 'borrador',
      estadoNuevo: 'radicada',
    });
  });

  it('devuelve los requisitos documentales', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/solicitudes/requisitos')
      .query({ actividad: 'Artesanías' })
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .expect(200);

    expect(respuesta.body.requisitos).toHaveLength(2);
  });

  it('consulta la disponibilidad antes de radicar', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/solicitudes/disponibilidad')
      .query({
        espacioId: DATOS.espacioId,
        fechaInicio: DATOS.fechaInicio,
        fechaFin: DATOS.fechaFin,
        horaInicio: DATOS.horaInicio,
        horaFin: DATOS.horaFin,
      })
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .expect(200);

    expect(respuesta.body).toMatchObject({
      disponible: true,
      espacio: { id: '1' },
    });
  });

  it('descarga un documento propio con su nombre original', async () => {
    const carpeta = join(temporal, 'solicitudes', '12');
    await mkdir(carpeta, { recursive: true });
    await writeFile(join(carpeta, 'cedula.pdf'), PDF);
    prisma.solicitud_documentos.findFirst.mockResolvedValue({
      archivo_url: 'solicitudes/12/cedula.pdf',
      nombre_original: 'cedula.pdf',
      mime_type: 'application/pdf',
    });

    const respuesta = await request(app.getHttpServer())
      .get('/solicitudes/12/documentos/5/archivo')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .expect(200);

    expect(respuesta.headers['content-type']).toContain('application/pdf');
    expect(respuesta.headers['content-disposition']).toContain(
      'filename="cedula.pdf"',
    );
  });

  it('lista los requisitos documentales de una solicitud propia', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/solicitudes/12/requisitos')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .expect(200);

    expect(respuesta.body).toMatchObject({
      solicitudId: '12',
      numeroRadicado: 'SOL-2026-00012',
      estado: 'radicada',
      puedeCargar: true,
      faltantes: ['Documento de identidad', 'RUT'],
    });
    expect(respuesta.body.requisitos).toHaveLength(2);
  });

  it('carga un documento válido en la solicitud', async () => {
    tx.$queryRaw.mockResolvedValueOnce([{ estado: 'radicada' }]);
    tx.solicitud_documentos.findMany.mockResolvedValue([]);
    prisma.solicitud_documentos.findMany.mockResolvedValue([DOCUMENTO]);

    const respuesta = await request(app.getHttpServer())
      .post('/solicitudes/12/documentos')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .field('requisitoId', '1')
      .attach('archivo', PDF, {
        filename: 'cedula.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(respuesta.body).toMatchObject({
      mensaje: 'Documento cargado correctamente.',
      estadoSolicitud: 'radicada',
      volvioARevision: false,
    });
    expect(tx.solicitud_documentos.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requisito_id: 1n,
          reemplaza_a: null,
          estado: 'pendiente',
        }),
      }),
    );
  });

  it('rechaza un formato no permitido', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/solicitudes/12/documentos')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .field('requisitoId', '1')
      .attach('archivo', Buffer.from('texto plano'), {
        filename: 'documento.txt',
        contentType: 'text/plain',
      })
      .expect(400);

    expect(JSON.stringify(respuesta.body.message)).toContain('PDF, JPG o PNG');
  });

  it('rechaza un archivo que supera el tamaño máximo', async () => {
    await request(app.getHttpServer())
      .post('/solicitudes/12/documentos')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .field('requisitoId', '1')
      .attach('archivo', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'grande.pdf',
        contentType: 'application/pdf',
      })
      .expect(413);
  });

  it('rechaza la carga de un requisito de otra actividad', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/solicitudes/12/documentos')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .field('requisitoId', '99')
      .attach('archivo', PDF, {
        filename: 'cedula.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    expect(JSON.stringify(respuesta.body.message)).toContain(
      'no aplica a la actividad',
    );
  });

  it('versiona un reemplazo y devuelve la solicitud a revisión', async () => {
    const solicitudDevuelta = { ...FILA, estado: 'devuelta' };
    const solicitudEnRevision = { ...FILA, estado: 'en_revision' };
    const observado = {
      ...DOCUMENTO,
      id: 5n,
      estado: 'observado',
      observacion: 'Documento ilegible.',
      cargado_en: new Date('2026-11-20T10:00:00.000Z'),
      archivo_url: 'solicitudes/12/observado.pdf',
    };

    prisma.solicitudes.findFirst
      .mockResolvedValueOnce(solicitudDevuelta)
      .mockResolvedValueOnce(solicitudEnRevision);
    tx.$queryRaw.mockResolvedValueOnce([{ estado: 'devuelta' }]);
    tx.solicitud_documentos.findMany.mockResolvedValue([observado]);
    tx.solicitud_documentos.create.mockResolvedValue({
      ...DOCUMENTO,
      id: 9n,
      reemplaza_a: 5n,
    });
    prisma.solicitud_documentos.findMany.mockResolvedValue([
      observado,
      { ...DOCUMENTO, id: 9n, reemplaza_a: 5n },
    ]);

    const respuesta = await request(app.getHttpServer())
      .post('/solicitudes/12/documentos')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .field('requisitoId', '1')
      .attach('archivo', PDF, {
        filename: 'corregido.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(respuesta.body).toMatchObject({
      mensaje: 'Documento reemplazado correctamente.',
      estadoSolicitud: 'en_revision',
      volvioARevision: true,
    });
    expect(tx.solicitud_documentos.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reemplaza_a: 5n }),
      }),
    );
    expect(tx.solicitud_historial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado_anterior: 'devuelta',
          estado_nuevo: 'en_revision',
        }),
      }),
    );
    expect(tx.notificaciones.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: 'solicitud_en_revision' }),
      }),
    );
  });

  it('rechaza la carga en una solicitud ajena', async () => {
    prisma.solicitudes.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post('/solicitudes/12/documentos')
      .set('Authorization', `Bearer ${tokenOtroComerciante}`)
      .field('requisitoId', '1')
      .attach('archivo', PDF, {
        filename: 'cedula.pdf',
        contentType: 'application/pdf',
      })
      .expect(404);
  });

  it('rechaza la descarga anónima y la de otro comerciante', async () => {
    prisma.solicitud_documentos.findFirst.mockResolvedValue({
      archivo_url: 'solicitudes/12/cedula.pdf',
      nombre_original: 'cedula.pdf',
      mime_type: 'application/pdf',
    });

    await request(app.getHttpServer())
      .get('/solicitudes/12/documentos/5/archivo')
      .expect(401);

    prisma.solicitud_documentos.findFirst.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get('/solicitudes/12/documentos/5/archivo')
      .set('Authorization', `Bearer ${tokenOtroComerciante}`)
      .expect(404);
  });

  it('no permite consultar el detalle de una solicitud ajena', async () => {
    prisma.solicitudes.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/solicitudes/12')
      .set('Authorization', `Bearer ${tokenOtroComerciante}`)
      .expect(404);
  });

  it('solo permite cambiar el estado al rol gestor', async () => {
    await request(app.getHttpServer())
      .patch('/gestor/solicitudes/12/estado')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .send({ estado: 'en_revision' })
      .expect(403);
  });

  it('cambia el estado, registra historial, notifica y envía correo', async () => {
    tx.$queryRaw.mockResolvedValueOnce([
      {
        id: 12n,
        numero_radicado: 'SOL-2026-00012',
        estado: 'radicada',
        comerciante_id: 3n,
        correo: COMERCIANTE.correo,
        nombre: COMERCIANTE.nombre,
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

    const respuesta = await request(app.getHttpServer())
      .patch('/gestor/solicitudes/12/estado')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ estado: 'en_revision' })
      .expect(200);

    expect(respuesta.body).toMatchObject({
      estadoAnterior: 'radicada',
      estado: 'en_revision',
      correoEnviado: true,
    });
    expect(tx.solicitudes.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: 'en_revision' }),
      }),
    );
    expect(tx.solicitud_historial.create).toHaveBeenCalled();
    expect(tx.notificaciones.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: 'solicitud_en_revision',
          solicitud_id: 12n,
        }),
      }),
    );
    expect(correo.enviarCambioEstadoSolicitud).toHaveBeenCalled();
  });

  it('exige motivo al rechazar y no ejecuta la transacción', async () => {
    await request(app.getHttpServer())
      .patch('/gestor/solicitudes/12/estado')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ estado: 'rechazada' })
      .expect(400);

    expect(tx.solicitudes.update).not.toHaveBeenCalled();
  });

  it('rechaza una transición no permitida', async () => {
    tx.$queryRaw.mockResolvedValueOnce([
      {
        id: 12n,
        numero_radicado: 'SOL-2026-00012',
        estado: 'radicada',
        comerciante_id: 3n,
        correo: COMERCIANTE.correo,
        nombre: COMERCIANTE.nombre,
        espacio_nombre: 'Kiosco Parque La Guadua',
      },
    ]);

    await request(app.getHttpServer())
      .patch('/gestor/solicitudes/12/estado')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ estado: 'aprobada' })
      .expect(409);
  });
});
