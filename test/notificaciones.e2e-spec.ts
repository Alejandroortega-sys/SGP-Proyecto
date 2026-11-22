import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import '../src/common/bigint-serialization';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const FECHA = new Date('2026-11-21T10:00:00.000Z');

const MARIA = {
  id: 3n,
  nombre: 'María',
  apellido: 'Gómez',
  correo: 'maria.gomez@gmail.com',
  rol: 'comerciante' as const,
  estado: 'activa' as const,
  gestores_gestores_usuario_idTousuarios: null,
};

const JOSE = {
  id: 4n,
  nombre: 'José',
  apellido: 'Pérez',
  correo: 'jose.perez@hotmail.com',
  rol: 'comerciante' as const,
  estado: 'activa' as const,
  gestores_gestores_usuario_idTousuarios: null,
};

function notificacion(id: bigint, usuarioId: bigint, leida = false) {
  return {
    id,
    solicitud_id: 12n,
    tipo: 'solicitud_aprobada',
    asunto: 'Solicitud SOL-2026-00012: Aprobada',
    cuerpo: 'Tu solicitud fue aprobada.',
    canal: 'app',
    leida,
    creada_en: FECHA,
    usuario_id: usuarioId,
  };
}

describe('Notificaciones (e2e)', () => {
  let app: INestApplication;
  let tokenMaria: string;
  let tokenJose: string;

  const notificaciones = {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
  };
  const prisma = {
    usuarios: { findUnique: jest.fn() },
    sesiones: { findFirst: jest.fn().mockResolvedValue({ id: 1n }) },
    notificaciones,
  };

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
    const firmar = (usuario: typeof MARIA | typeof JOSE) =>
      jwt.signAsync(
        {
          sub: usuario.id.toString(),
          correo: usuario.correo,
          rol: usuario.rol,
          perfil: null,
          sid: usuario.id.toString(),
        },
        { expiresIn: 1_800 },
      );

    [tokenMaria, tokenJose] = await Promise.all([firmar(MARIA), firmar(JOSE)]);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.sesiones.findFirst.mockResolvedValue({ id: 1n });
    prisma.usuarios.findUnique.mockImplementation(
      ({ where }: { where: { id?: bigint } }) => {
        const usuario = [MARIA, JOSE].find(
          (candidato) => candidato.id === where.id,
        );
        return Promise.resolve(usuario ?? null);
      },
    );
    notificaciones.findMany.mockResolvedValue([notificacion(11n, MARIA.id)]);
    notificaciones.count.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    notificaciones.update.mockResolvedValue(notificacion(11n, MARIA.id, true));
    notificaciones.updateMany.mockResolvedValue({ count: 2 });
  });

  it('exige autenticación', async () => {
    await request(app.getHttpServer()).get('/notificaciones').expect(401);
  });

  it('lista solo las notificaciones del usuario autenticado', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/notificaciones?pagina=1&limite=20')
      .set('Authorization', `Bearer ${tokenMaria}`)
      .expect(200);

    expect(notificaciones.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { usuario_id: MARIA.id } }),
    );
    expect(respuesta.body.noLeidas).toBe(2);
    expect(respuesta.body.datos[0]).toMatchObject({
      id: '11',
      solicitudId: '12',
      leida: false,
    });
  });

  it('filtra por no leídas sin cambiar el contador total', async () => {
    await request(app.getHttpServer())
      .get('/notificaciones?leida=false')
      .set('Authorization', `Bearer ${tokenJose}`)
      .expect(200);

    expect(notificaciones.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { usuario_id: JOSE.id, leida: false },
      }),
    );
    expect(notificaciones.count).toHaveBeenNthCalledWith(1, {
      where: { usuario_id: JOSE.id, leida: false },
    });
    expect(notificaciones.count).toHaveBeenNthCalledWith(2, {
      where: { usuario_id: JOSE.id, leida: false },
    });
  });

  it('marca una notificación propia como leída', async () => {
    notificaciones.findFirst.mockResolvedValue({ id: 11n });

    const respuesta = await request(app.getHttpServer())
      .patch('/notificaciones/11/leida')
      .set('Authorization', `Bearer ${tokenMaria}`)
      .send({ leida: true })
      .expect(200);

    expect(notificaciones.findFirst).toHaveBeenCalledWith({
      where: { id: 11n, usuario_id: MARIA.id },
      select: { id: true },
    });
    expect(respuesta.body.leida).toBe(true);
  });

  it('responde 404 al intentar marcar una notificación ajena', async () => {
    notificaciones.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .patch('/notificaciones/11/leida')
      .set('Authorization', `Bearer ${tokenJose}`)
      .send({ leida: true })
      .expect(404);

    expect(notificaciones.update).not.toHaveBeenCalled();
  });

  it('marca todas las no leídas solo del usuario autenticado', async () => {
    const respuesta = await request(app.getHttpServer())
      .patch('/notificaciones/leer-todas')
      .set('Authorization', `Bearer ${tokenJose}`)
      .expect(200);

    expect(notificaciones.updateMany).toHaveBeenCalledWith({
      where: { usuario_id: JOSE.id, leida: false },
      data: { leida: true },
    });
    expect(respuesta.body.actualizadas).toBe(2);
  });

  it('rechaza parámetros inválidos', async () => {
    await request(app.getHttpServer())
      .get('/notificaciones?leida=quizas')
      .set('Authorization', `Bearer ${tokenMaria}`)
      .expect(400);
  });
});
