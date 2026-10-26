import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const FECHA = new Date('2026-09-20T10:00:00.000Z');
const ADMIN_ID = 1n;

interface SesionPrueba {
  id: bigint;
  usuario_id: bigint;
  refresh_token_hash: string;
  refresh_token_anterior_hash: string | null;
  refresh_expira_en: Date;
  revocada_en: Date | null;
  creada_en: Date;
  actualizado_en: Date;
}

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function crearSesion(
  id: bigint,
  refreshToken: string,
): SesionPrueba {
  return {
    id,
    usuario_id: ADMIN_ID,
    refresh_token_hash: hash(refreshToken),
    refresh_token_anterior_hash: null,
    refresh_expira_en: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
    revocada_en: null,
    creada_en: FECHA,
    actualizado_en: FECHA,
  };
}

const ADMIN = {
  id: ADMIN_ID,
  nombre: 'Laura',
  apellido: 'Martínez',
  correo: 'admin@tulua.gov.co',
  rol: 'gestor',
  estado: 'activa',
  gestores_gestores_usuario_idTousuarios: { perfil: 'administrador' },
};

describe('Sesiones: refresh y logout persistente (e2e)', () => {
  let app: INestApplication;
  let sesiones: SesionPrueba[];

  const prisma = {
    usuarios: {
      findUnique: jest.fn().mockResolvedValue(ADMIN),
    },
    sesiones: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeAll(() => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? 'e2e-secret-sgp-tulua-para-pruebas';
  });

  beforeEach(() => {
    sesiones = [];
    prisma.sesiones.findFirst.mockImplementation(
      ({ where }: { where: Record<string, unknown> }) => {
        const encontrada = sesiones.find((sesion) => {
          if (where.id !== undefined && sesion.id !== where.id) return false;
          if (
            where.usuario_id !== undefined &&
            sesion.usuario_id !== where.usuario_id
          ) {
            return false;
          }
          if (
            where.refresh_token_hash !== undefined &&
            sesion.refresh_token_hash !== where.refresh_token_hash
          ) {
            return false;
          }
          if (
            where.refresh_token_anterior_hash !== undefined &&
            sesion.refresh_token_anterior_hash !==
              where.refresh_token_anterior_hash
          ) {
            return false;
          }
          if (where.revocada_en === null && sesion.revocada_en !== null) {
            return false;
          }
          const expira = where.refresh_expira_en as
            | { gt?: Date }
            | undefined;
          if (expira?.gt && sesion.refresh_expira_en <= expira.gt) {
            return false;
          }
          return true;
        });
        return Promise.resolve(encontrada ?? null);
      },
    );
    prisma.sesiones.update.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: bigint };
        data: Partial<SesionPrueba>;
      }) => {
        const sesion = sesiones.find((candidata) => candidata.id === where.id);
        if (!sesion) return Promise.reject(new Error('Sesión inexistente'));
        Object.assign(sesion, data, { actualizado_en: new Date() });
        return Promise.resolve(sesion);
      },
    );
    prisma.sesiones.updateMany.mockImplementation(
      ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Partial<SesionPrueba>;
      }) => {
        let count = 0;
        for (const sesion of sesiones) {
          const coincideId =
            where.id === undefined || sesion.id === where.id;
          const coincideUsuario =
            where.usuario_id === undefined ||
            sesion.usuario_id === where.usuario_id;
          const coincideRevocada =
            where.revocada_en !== null || sesion.revocada_en === null;
          if (coincideId && coincideUsuario && coincideRevocada) {
            Object.assign(sesion, data);
            count += 1;
          }
        }
        return Promise.resolve({ count });
      },
    );
  });

  async function crearApp(): Promise<INestApplication> {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    const aplicacion = moduleFixture.createNestApplication();
    aplicacion.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await aplicacion.init();
    return aplicacion;
  }

  async function firmarAccess(sid: string): Promise<string> {
    const jwt = app.get(JwtService);
    return jwt.signAsync(
      {
        sub: ADMIN_ID.toString(),
        correo: ADMIN.correo,
        rol: 'gestor',
        perfil: 'administrador',
        sid,
      },
      { expiresIn: 1_800 },
    );
  }

  it('el logout revoca la sesión y persiste al recrear la aplicación', async () => {
    sesiones.push(crearSesion(50n, 'refresh-persistente'));
    app = await crearApp();
    const accessToken = await firmarAccess('50');

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    expect(sesiones[0].revocada_en).toBeInstanceOf(Date);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    await app.close();

    // Nueva instancia con el mismo almacenamiento: la revocación persiste.
    app = await crearApp();
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });

  it('rota el refresh y rechaza el refresh anterior', async () => {
    sesiones.push(crearSesion(51n, 'refresh-viejo'));
    app = await crearApp();

    const respuesta = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'refresh-viejo' })
      .expect(200);

    expect(respuesta.body.accessToken).toBeDefined();
    expect(respuesta.body.refreshToken).toBeDefined();
    expect(respuesta.body.refreshToken).not.toBe('refresh-viejo');
    expect(sesiones[0].refresh_token_anterior_hash).toBe(
      hash('refresh-viejo'),
    );
    expect(sesiones[0].refresh_token_hash).toBe(
      hash(respuesta.body.refreshToken),
    );

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'refresh-viejo' })
      .expect(401);

    expect(sesiones[0].revocada_en).toBeInstanceOf(Date);
  });

  afterEach(async () => {
    await app.close();
  });
});
