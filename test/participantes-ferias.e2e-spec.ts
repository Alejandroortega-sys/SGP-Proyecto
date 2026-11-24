import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import '../src/common/bigint-serialization';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface UsuarioPrueba {
  id: bigint;
  nombre: string;
  apellido: string | null;
  correo: string;
  rol: 'comerciante' | 'organizador' | 'gestor';
  estado: 'activa';
  perfil: 'administrador' | 'revisor' | null;
}

const GESTOR: UsuarioPrueba = {
  id: 1n,
  nombre: 'Laura',
  apellido: 'Martínez',
  correo: 'admin@tulua.gov.co',
  rol: 'gestor',
  estado: 'activa',
  perfil: 'administrador',
};

const ORGANIZADOR: UsuarioPrueba = {
  id: 7n,
  nombre: 'Luis',
  apellido: 'Álvarez',
  correo: 'luis.alvarez@agrovalle.org',
  rol: 'organizador',
  estado: 'activa',
  perfil: null,
};

const COMERCIANTE: UsuarioPrueba = {
  id: 4n,
  nombre: 'José',
  apellido: 'Pérez',
  correo: 'jose.perez@hotmail.com',
  rol: 'comerciante',
  estado: 'activa',
  perfil: null,
};

const USUARIOS = [GESTOR, ORGANIZADOR, COMERCIANTE];

const FERIA_BASE = {
  id: 1n,
  numero_radicado: 'FER-2026-00001',
  nombre: 'Feria Agroecológica de Diciembre',
  estado: 'aprobada' as
    | 'radicada'
    | 'aprobada'
    | 'rechazada'
    | 'cancelada'
    | 'realizada',
  fecha_inicio: new Date('2026-12-10T00:00:00.000Z'),
  fecha_fin: new Date('2026-12-12T00:00:00.000Z'),
  numero_puestos: 2,
  organizador_id: 7n,
  participantes_enviados_en: null as Date | null,
  zonas: { id: 4n, nombre: 'Parque La Guadua' },
  organizadores: {
    nombre_organizacion: 'Fundación Agroecológica del Valle',
    nit: '900123456-7',
    usuarios_organizadores_usuario_idTousuarios: {
      id: 7n,
      nombre: 'Luis',
      apellido: 'Álvarez',
      correo: 'luis.alvarez@agrovalle.org',
    },
  },
};

const PARTICIPANTE = {
  id: 5n,
  nombre_vendedor: 'Doralice Lozano',
  documento: 'CC 43789123',
  creado_en: new Date('2026-11-23T10:00:00.000Z'),
  actualizado_en: new Date('2026-11-23T10:00:00.000Z'),
  feria_vendedor_productos: [
    { productos: { id: 1n, nombre: 'Frutas frescas' } },
  ],
};

const DTO = {
  nombre: 'Doralice Lozano',
  documento: 'CC 43789123',
  productoIds: ['1'],
};

let feriaEstado: typeof FERIA_BASE.estado = 'aprobada';
let enviadoEn: Date | null = null;
let organizadorFeria = 7n;
let ocupados = 0;
let participanteActivo = true;
let productoId = 1n;
let productoNombre = 'Frutas frescas';

const prisma = {
  usuarios: { findUnique: jest.fn() },
  sesiones: { findFirst: jest.fn() },
  ferias: { findFirst: jest.fn(), update: jest.fn() },
  feria_vendedores: {
    count: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  feria_vendedor_productos: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  productos: { findMany: jest.fn() },
  zona_productos: { findMany: jest.fn() },
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  $transaction: jest.fn(),
};

describe('Participantes de feria (e2e)', () => {
  let app: INestApplication;
  let tokenOrganizador: string;
  let tokenComerciante: string;
  let tokenGestor: string;

  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? 'e2e-secret-sgp-tulua-para-pruebas';

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
    const firmar = (usuario: UsuarioPrueba) =>
      jwt.signAsync(
        {
          sub: usuario.id.toString(),
          correo: usuario.correo,
          rol: usuario.rol,
          perfil: usuario.perfil,
          sid: usuario.id.toString(),
        },
        { expiresIn: 1_800 },
      );

    [tokenOrganizador, tokenComerciante, tokenGestor] = await Promise.all([
      firmar(ORGANIZADOR),
      firmar(COMERCIANTE),
      firmar(GESTOR),
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    feriaEstado = 'aprobada';
    enviadoEn = null;
    organizadorFeria = 7n;
    ocupados = 0;
    participanteActivo = true;
    productoId = 1n;
    productoNombre = 'Frutas frescas';

    prisma.usuarios.findUnique.mockImplementation(
      ({ where }: { where: { id: bigint } }) =>
        Promise.resolve(
          USUARIOS.find((usuario) => usuario.id === where.id) ?? null,
        ),
    );
    prisma.sesiones.findFirst.mockResolvedValue({ id: 1n });
    prisma.ferias.findFirst.mockImplementation(() =>
      Promise.resolve({
        ...FERIA_BASE,
        estado: feriaEstado,
        participantes_enviados_en: enviadoEn,
        organizador_id: organizadorFeria,
      }),
    );
    prisma.ferias.update.mockResolvedValue({ id: 1n });
    prisma.$queryRaw.mockResolvedValue([{ id: 1n }]);
    prisma.$executeRaw.mockResolvedValue(1);
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
    prisma.feria_vendedores.count.mockImplementation(() =>
      Promise.resolve(ocupados),
    );
    prisma.feria_vendedores.findUnique.mockResolvedValue(null);
    prisma.feria_vendedores.findFirst.mockImplementation(() =>
      Promise.resolve(
        participanteActivo ? { id: 5n, documento: 'CC 43789123' } : null,
      ),
    );
    prisma.feria_vendedores.findMany.mockResolvedValue([PARTICIPANTE]);
    prisma.feria_vendedores.findUniqueOrThrow.mockResolvedValue(PARTICIPANTE);
    prisma.feria_vendedores.create.mockResolvedValue({ id: 5n });
    prisma.feria_vendedores.update.mockResolvedValue({ id: 5n });
    prisma.feria_vendedor_productos.deleteMany.mockResolvedValue({ count: 1 });
    prisma.feria_vendedor_productos.createMany.mockResolvedValue({ count: 1 });
    prisma.productos.findMany.mockImplementation(() =>
      Promise.resolve([{ id: productoId, nombre: productoNombre }]),
    );
    prisma.zona_productos.findMany.mockImplementation(
      ({ select }: { select?: { producto_id?: boolean } }) =>
        Promise.resolve(
          select?.producto_id
            ? [{ producto_id: 1n }]
            : [{ productos: { id: 1n, nombre: 'Frutas frescas' } }],
        ),
    );
  });

  it('lista los participantes del organizador con cupo y productos', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/ferias/1/participantes')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .expect(200);

    expect(respuesta.body.cupo).toEqual({
      aprobado: 2,
      ocupados: 1,
      disponibles: 1,
      completo: false,
    });
    expect(respuesta.body.productosPermitidos).toEqual([
      { id: '1', nombre: 'Frutas frescas' },
    ]);
    expect(respuesta.body.participantes[0].nombre).toBe('Doralice Lozano');
  });

  it('rechaza el listado de otro organizador con 404', async () => {
    organizadorFeria = 99n;

    await request(app.getHttpServer())
      .get('/ferias/1/participantes')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .expect(404);
  });

  it('rechaza el rol de comerciante con 403', async () => {
    await request(app.getHttpServer())
      .get('/ferias/1/participantes')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .expect(403);
  });

  it('crea un participante válido', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/ferias/1/participantes')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .send(DTO)
      .expect(201);

    expect(respuesta.body).toMatchObject({
      id: '5',
      nombre: 'Doralice Lozano',
      documento: 'CC 43789123',
    });
    expect(prisma.feria_vendedor_productos.createMany).toHaveBeenCalled();
  });

  it('rechaza un producto no permitido con 400', async () => {
    productoId = 2n;
    productoNombre = 'Verduras';

    await request(app.getHttpServer())
      .post('/ferias/1/participantes')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .send({ ...DTO, productoIds: ['2'] })
      .expect(400);
  });

  it('rechaza el alta cuando el cupo está lleno con 409', async () => {
    ocupados = 2;

    await request(app.getHttpServer())
      .post('/ferias/1/participantes')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .send(DTO)
      .expect(409);
  });

  it('rechaza el alta si la feria no está aprobada con 409', async () => {
    feriaEstado = 'radicada';

    await request(app.getHttpServer())
      .post('/ferias/1/participantes')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .send(DTO)
      .expect(409);
  });

  it('rechaza una mutación si el listado final ya fue enviado', async () => {
    enviadoEn = new Date();

    await request(app.getHttpServer())
      .post('/ferias/1/participantes')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .send(DTO)
      .expect(409);
  });

  it('edita un participante activo', async () => {
    const respuesta = await request(app.getHttpServer())
      .patch('/ferias/1/participantes/5')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .send({ nombre: 'Doralice Lozano Actualizada' })
      .expect(200);

    expect(respuesta.body.id).toBe('5');
  });

  it('retira un participante con baja lógica', async () => {
    await request(app.getHttpServer())
      .delete('/ferias/1/participantes/5')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .expect(204);

    expect(prisma.feria_vendedores.update).toHaveBeenCalledWith({
      where: { id: 5n },
      data: { activo: false, eliminado_en: expect.any(Date) },
    });
  });

  it('exige al menos un participante para enviar el listado', async () => {
    ocupados = 0;

    await request(app.getHttpServer())
      .post('/ferias/1/participantes/enviar')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .expect(400);
  });

  it('envía el listado final', async () => {
    ocupados = 1;

    const respuesta = await request(app.getHttpServer())
      .post('/ferias/1/participantes/enviar')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .expect(200);

    expect(respuesta.body.totalParticipantes).toBe(1);
    expect(prisma.ferias.update).toHaveBeenCalledWith({
      where: { id: 1n },
      data: { participantes_enviados_en: expect.any(Date) },
    });
  });

  it('el gestor no ve el listado antes del envío', async () => {
    await request(app.getHttpServer())
      .get('/gestor/ferias/1/participantes')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .expect(409);
  });

  it('el gestor consulta el listado final enviado', async () => {
    enviadoEn = new Date('2026-11-24T10:00:00.000Z');

    const respuesta = await request(app.getHttpServer())
      .get('/gestor/ferias/1/participantes')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .expect(200);

    expect(respuesta.body.organizador).toEqual({
      id: '7',
      nombre: 'Luis',
      apellido: 'Álvarez',
      correo: 'luis.alvarez@agrovalle.org',
      organizacion: 'Fundación Agroecológica del Valle',
      nit: '900123456-7',
    });
    expect(respuesta.body.listadoFinal.enviado).toBe(true);
  });

  it('rechaza el listado del gestor para un rol no gestor', async () => {
    await request(app.getHttpServer())
      .get('/gestor/ferias/1/participantes')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .expect(403);
  });
});
