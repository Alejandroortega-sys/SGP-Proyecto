import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import '../src/common/bigint-serialization';
import { AppModule } from '../src/app.module';
import { CorreoService } from '../src/correo/correo.service';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  LIMITE_VERIFICACIONES,
  VENTANA_VERIFICACIONES_MS,
} from '../src/permisos/verificaciones.controller';

const TOKEN_QR =
  'a3f0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b800'.slice(
    0,
    48,
  );

/**
 * Verifica el rate limit del endpoint público de verificación de permisos
 * (HU-33): `LIMITE_VERIFICACIONES` peticiones por IP dentro de la ventana;
 * la siguiente responde 429 con `Retry-After`.
 *
 * Patrón de test/rate-limit.e2e-spec.ts: aplicación propia para que el
 * contador en memoria arranque en cero.
 */
describe('Rate limit de la verificación pública de QR (e2e)', () => {
  let app: INestApplication;

  const prisma = {
    $queryRaw: jest.fn(),
    verificaciones_qr: {
      create: jest.fn().mockResolvedValue({ id: 100n }),
    },
  };

  const correo = {
    enviarCambioEstadoSolicitud: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it(`limita la verificación a ${LIMITE_VERIFICACIONES} peticiones por minuto por IP`, async () => {
    // Todas las consultas responden lo mismo: el guard actúa antes.
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 8n,
        numero: 'PER-2026-00002',
        estado: 'vigente',
        fecha_inicio: new Date('2026-11-01T00:00:00'),
        fecha_fin: new Date('2026-11-30T00:00:00'),
        categoria_autorizada: 'Venta de frutas y verduras',
        titular: 'María Gómez',
      },
    ]);

    const servidor = app.getHttpServer();
    for (let i = 0; i < LIMITE_VERIFICACIONES; i += 1) {
      await request(servidor).get(`/verificaciones/${TOKEN_QR}`).expect(200);
    }

    const bloqueada = await request(servidor)
      .get(`/verificaciones/${TOKEN_QR}`)
      .expect(429);

    expect(bloqueada.body.message).toContain('Demasiadas peticiones');
    expect(bloqueada.headers['retry-after']).toBeDefined();
    expect(VENTANA_VERIFICACIONES_MS).toBe(60_000);
  });
});
