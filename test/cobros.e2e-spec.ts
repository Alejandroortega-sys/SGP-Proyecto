import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import '../src/common/bigint-serialization';
import { AppModule } from '../src/app.module';
import { CorreoService } from '../src/correo/correo.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { Prisma } from '../src/generated/prisma/client';

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
  id: 2n,
  nombre: 'Carlos',
  apellido: 'Ramírez',
  correo: 'revisor@tulua.gov.co',
  rol: 'gestor' as const,
  estado: 'activa' as const,
  gestores_gestores_usuario_idTousuarios: { perfil: 'revisor' },
};

const FILA_COBRO = {
  id: 1n,
  valor: new Prisma.Decimal('50000'),
  estado: 'pendiente',
  pagado_en: null,
  recibo_url: null,
  creado_en: new Date('2026-11-23T10:00:00'),
  permisos: {
    id: 8n,
    numero: 'PER-2026-00008',
    titular_id: 3n,
    comerciantes: { usuarios: { nombre: 'María', apellido: 'Gómez' } },
  },
};

describe('Cobros simulados del uso de suelo (e2e)', () => {
  let app: INestApplication;
  let tokenComerciante: string;
  let tokenGestor: string;

  const tx = {
    $queryRaw: jest.fn(),
    cobros: {
      update: jest.fn().mockResolvedValue({
        id: 1n,
        pagado_en: new Date('2026-11-23T10:05:00'),
      }),
    },
  };

  const prisma = {
    usuarios: { findUnique: jest.fn() },
    sesiones: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
    cobros: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const correo = {
    enviarCambioEstadoSolicitud: jest.fn().mockResolvedValue(undefined),
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
    const firmar = (usuario: typeof COMERCIANTE | typeof GESTOR) =>
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

    [tokenComerciante, tokenGestor] = await Promise.all([
      firmar(COMERCIANTE),
      firmar(GESTOR),
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
        const usuario = [COMERCIANTE, GESTOR].find(
          (candidato) => candidato.id === where.id,
        );
        return Promise.resolve(usuario ?? null);
      },
    );
    tx.$queryRaw.mockResolvedValue([]);
  });

  it('HU-36-CA1: lista los cobros propios con valor y estado pendiente', async () => {
    prisma.cobros.findMany.mockResolvedValue([FILA_COBRO]);
    prisma.cobros.count.mockResolvedValue(1);

    const respuesta = await request(app.getHttpServer())
      .get('/cobros/mios')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .expect(200);

    expect(respuesta.body.datos[0]).toMatchObject({
      id: '1',
      permisoNumero: 'PER-2026-00008',
      valor: '50000',
      estado: 'pendiente',
      reciboUrl: null,
    });
  });

  it('HU-36: un gestor no puede consultar «mis cobros» (403)', async () => {
    await request(app.getHttpServer())
      .get('/cobros/mios')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .expect(403);
  });

  it('HU-36-CA2: el pago simulado pasa el cobro a pagado y habilita el recibo', async () => {
    tx.$queryRaw.mockResolvedValueOnce([
      {
        id: 1n,
        estado: 'pendiente',
        valor: new Prisma.Decimal('50000'),
        permiso_numero: 'PER-2026-00008',
        titular_id: 3n,
        titular_nombre: 'María',
        titular_apellido: 'Gómez',
      },
    ]);

    const respuesta = await request(app.getHttpServer())
      .post('/cobros/mios/1/pago')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .expect(200);

    expect(respuesta.body).toMatchObject({
      id: '1',
      estado: 'pagado',
      valor: '50000',
      reciboUrl: '/cobros/mios/1/recibo',
    });
    expect(respuesta.body.mensaje).toContain('simulado');
    // Nunca se piden datos de tarjeta: el cuerpo va vacío.
    expect(tx.cobros.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: 'pagado' }),
      }),
    );
  });

  it('HU-36: un cobro ya pagado responde 409', async () => {
    tx.$queryRaw.mockResolvedValueOnce([
      {
        id: 1n,
        estado: 'pagado',
        valor: new Prisma.Decimal('50000'),
        permiso_numero: 'PER-2026-00008',
        titular_id: 3n,
        titular_nombre: 'María',
        titular_apellido: 'Gómez',
      },
    ]);

    await request(app.getHttpServer())
      .post('/cobros/mios/1/pago')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .expect(409);
  });

  it('HU-36: el recibo PDF solo existe tras el pago', async () => {
    prisma.cobros.findFirst.mockResolvedValueOnce({
      ...FILA_COBRO,
      estado: 'pagado',
      pagado_en: new Date('2026-11-23T10:05:00'),
    });

    const respuesta = await request(app.getHttpServer())
      .get('/cobros/mios/1/recibo')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .expect(200);

    expect(respuesta.headers['content-type']).toContain('application/pdf');
    expect(respuesta.body.subarray(0, 4).toString()).toBe('%PDF');

    // Pendiente → 422; ajeno → 404.
    prisma.cobros.findFirst.mockResolvedValueOnce(FILA_COBRO);
    await request(app.getHttpServer())
      .get('/cobros/mios/1/recibo')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .expect(422);

    prisma.cobros.findFirst.mockResolvedValueOnce(null);
    await request(app.getHttpServer())
      .get('/cobros/mios/99/recibo')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .expect(404);
  });
});
