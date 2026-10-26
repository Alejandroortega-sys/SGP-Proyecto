import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { CorreoService } from '../src/correo/correo.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Verifica el rate limit de 10 peticiones por minuto en registro y activación.
 * Las peticiones usan un cuerpo inválido para que el guard actúe antes de la
 * lógica de negocio (no se hashea ninguna contraseña).
 */
describe('Rate limit de registro y activación (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? 'e2e-secret-sgp-tulua-para-pruebas';

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(CorreoService)
      .useValue({
        enviarCodigoActivacion: jest.fn(),
        enviarCodigoRecuperacion: jest.fn(),
        enviarAvisoCambioPassword: jest.fn(),
        enviarCredencialesGestor: jest.fn(),
        enviarAvisoEstadoCuenta: jest.fn(),
      })
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
  });

  afterAll(async () => {
    await app.close();
  });

  async function consumirLimite(ruta: string): Promise<void> {
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer()).post(ruta).send({}).expect(400);
    }
    await request(app.getHttpServer()).post(ruta).send({}).expect(429);
  }

  it('limita el registro de comerciantes a 10 peticiones por minuto', async () => {
    await consumirLimite('/usuarios/comerciantes');
  });

  it('limita la activación a 10 peticiones por minuto', async () => {
    await consumirLimite('/usuarios/activacion');
  });

  it('limita el refresh a 10 peticiones por minuto', async () => {
    await consumirLimite('/auth/refresh');
  });
});
