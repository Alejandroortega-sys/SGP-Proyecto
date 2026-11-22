import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import '../src/common/bigint-serialization';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const GESTOR = {
  id: 1n,
  nombre: 'Laura',
  apellido: 'Martínez',
  correo: 'admin@tulua.gov.co',
  rol: 'gestor' as const,
  estado: 'activa' as const,
  gestores_gestores_usuario_idTousuarios: { perfil: 'administrador' },
};

const REVISOR = {
  ...GESTOR,
  id: 2n,
  nombre: 'Carlos',
  correo: 'revisor@tulua.gov.co',
  gestores_gestores_usuario_idTousuarios: { perfil: 'revisor' },
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

const FILA = {
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
  solicitud_documentos: [],
  solicitud_historial: [],
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

const BLOQUEO_AJENO = {
  solicitud_id: '12',
  gestor_id: '2',
  iniciada_en: '2099-11-21T10:00:00.000Z',
  ultima_actividad: '2099-11-21T10:00:00.000Z',
  expira_en: '2099-11-21T10:15:00.000Z',
  vigente: true,
  nombre: 'Carlos',
  apellido: 'Ríos',
  perfil: 'revisor',
};

describe('Revisión de solicitudes (e2e)', () => {
  let app: INestApplication;
  let tokenGestor: string;
  let tokenRevisor: string;
  let tokenComerciante: string;

  const tx = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    solicitudes: { update: jest.fn().mockResolvedValue({}) },
    solicitud_historial: { create: jest.fn().mockResolvedValue({}) },
    solicitud_documentos: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    requisitos_documentales: { findFirst: jest.fn() },
  };

  const prisma = {
    usuarios: { findUnique: jest.fn() },
    sesiones: { findFirst: jest.fn() },
    solicitudes: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    requisitos_documentales: { findMany: jest.fn(), findFirst: jest.fn() },
    solicitud_documentos: { findMany: jest.fn() },
    solicitud_revisiones: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    $transaction: jest.fn(),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? 'e2e-secret-sgp-tulua-para-pruebas';

    prisma.$transaction.mockImplementation(
      async (callback: (cliente: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
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
    const firmar = (usuario: typeof GESTOR | typeof COMERCIANTE) =>
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

    [tokenGestor, tokenRevisor, tokenComerciante] = await Promise.all([
      firmar(GESTOR),
      firmar({ ...REVISOR, rol: 'gestor' }),
      firmar(COMERCIANTE),
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.sesiones.findFirst.mockResolvedValue({ id: 1n });
    prisma.usuarios.findUnique.mockImplementation(
      ({ where }: { where: { id?: bigint } }) => {
        const usuario = [GESTOR, REVISOR, COMERCIANTE].find(
          (candidato) => candidato.id === where.id,
        );
        return Promise.resolve(usuario ?? null);
      },
    );
    prisma.solicitudes.findUnique.mockResolvedValue(FILA);
    prisma.requisitos_documentales.findMany.mockResolvedValue(CATALOGO);
    prisma.solicitud_revisiones.findUnique.mockResolvedValue(null);
    prisma.$queryRaw.mockResolvedValue([]);
  });

  it('permite la bandeja a gestor y revisor, y la rechaza al comerciante', async () => {
    prisma.solicitudes.findMany.mockResolvedValue([FILA]);
    prisma.solicitudes.count.mockResolvedValue(1);

    await request(app.getHttpServer())
      .get('/gestor/solicitudes')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.datos).toHaveLength(1);
        expect(body.paginacion.total).toBe(1);
      });

    await request(app.getHttpServer())
      .get('/gestor/solicitudes')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/gestor/solicitudes')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .expect(403);
  });

  it('resuelve opciones antes que el parámetro :id', async () => {
    prisma.solicitudes.findMany
      .mockResolvedValueOnce([
        { espacios_temporales: { sector: 'Centro' } },
      ])
      .mockResolvedValueOnce([
        { espacios_temporales: { actividad_permitida: 'Artesanías' } },
      ]);

    await request(app.getHttpServer())
      .get('/gestor/solicitudes/opciones')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .expect(200)
      .expect({ sectores: ['Centro'], actividades: ['Artesanías'] });
  });

  it('devuelve el detalle en solo lectura cuando otro gestor bloquea', async () => {
    prisma.$queryRaw.mockResolvedValue([BLOQUEO_AJENO]);

    await request(app.getHttpServer())
      .get('/gestor/solicitudes/12')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.puedeVerificar).toBe(false);
        expect(body.bloqueo.esPropio).toBe(false);
        expect(body.bloqueo.gestor.nombre).toBe('Carlos');
      });
  });

  it('impide tomar una revisión bloqueada por otro gestor', async () => {
    tx.$queryRaw
      .mockResolvedValueOnce([
        {
          id: 12n,
          estado: 'radicada',
          numero_radicado: FILA.numero_radicado,
          comerciante_id: 3n,
          correo: 'maria.gomez@gmail.com',
          nombre: 'María',
          espacio_nombre: 'Kiosco',
          bloqueo_gestor_id: 2n,
          bloqueo_vigente: true,
          bloqueo_expira_en: new Date('2099-01-01T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([BLOQUEO_AJENO]);

    await request(app.getHttpServer())
      .post('/gestor/solicitudes/12/revision')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .expect(409)
      .expect(({ body }) => {
        expect(body.message).toContain('Carlos');
      });
  });

  it('exige observación para No cumple', async () => {
    await request(app.getHttpServer())
      .patch('/gestor/solicitudes/12/requisitos/1/verificacion')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ estado: 'no_cumple' })
      .expect(400)
      .expect(({ body }) => {
        expect(String(body.message)).toContain('observación');
      });
  });

  it('rechaza verificar si el bloqueo es de otro gestor', async () => {
    tx.$queryRaw
      .mockResolvedValueOnce([{ estado: 'en_revision', actividad: 'Artesanías' }])
      .mockResolvedValueOnce([{ gestor_id: 2n, vigente: true }]);

    await request(app.getHttpServer())
      .patch('/gestor/solicitudes/12/requisitos/1/verificacion')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ estado: 'cumple' })
      .expect(409);
  });

  it('impide liberar el bloqueo de otro gestor', async () => {
    prisma.solicitud_revisiones.findUnique.mockResolvedValue({
      gestor_id: 2n,
      expira_en: new Date('2099-01-01T00:00:00.000Z'),
    });

    await request(app.getHttpServer())
      .delete('/gestor/solicitudes/12/revision')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .expect(409);
  });

  it('rechaza el detalle sin token', async () => {
    await request(app.getHttpServer())
      .get('/gestor/solicitudes/12')
      .expect(401);
  });
});
