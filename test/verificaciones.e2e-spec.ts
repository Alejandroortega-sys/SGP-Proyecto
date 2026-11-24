import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import '../src/common/bigint-serialization';
import { AppModule } from '../src/app.module';
import { CorreoService } from '../src/correo/correo.service';
import { PrismaService } from '../src/prisma/prisma.service';

const TOKEN_QR = 'a3f0c44298fc1c149afbf4c8996fb92427ae41e4649b934c';

function fechaLocal(dias: number): Date {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dias);
}

function filaPermiso(
  estado: 'vigente' | 'suspendido' | 'revocado',
  diasInicio: number,
  diasFin: number,
): {
  id: bigint;
  numero: string;
  estado: string;
  fecha_inicio: Date;
  fecha_fin: Date;
  categoria_autorizada: string;
  titular: string;
} {
  return {
    id: 8n,
    numero: 'PER-2026-00002',
    estado,
    fecha_inicio: fechaLocal(diasInicio),
    fecha_fin: fechaLocal(diasFin),
    categoria_autorizada: 'Venta de frutas y verduras',
    titular: 'María Gómez',
  };
}

describe('Verificación pública de permisos por QR (e2e)', () => {
  let app: INestApplication;

  const prisma = {
    $queryRaw: jest.fn(),
    verificaciones_qr: {
      create: jest.fn().mockResolvedValue({ id: 100n }),
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

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$queryRaw.mockResolvedValue([]);
  });

  it('HU-33-CA1: un QR vigente responde válido sin sesión', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([filaPermiso('vigente', -1, 29)]);

    const respuesta = await request(app.getHttpServer())
      .get(`/verificaciones/${TOKEN_QR}`)
      .expect(200);

    expect(respuesta.body).toMatchObject({
      valido: true,
      estado: 'vigente',
      categoria: 'Venta de frutas y verduras',
      titular: 'María Gómez',
    });
    expect(prisma.verificaciones_qr.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ resultado: 'valido' }),
      }),
    );
  });

  it('HU-33-CA2: suspendido y revocado responden no vigente con su estado', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([filaPermiso('suspendido', -1, 29)]);
    const suspendido = await request(app.getHttpServer())
      .get(`/verificaciones/${TOKEN_QR}`)
      .expect(200);
    expect(suspendido.body.valido).toBe(false);
    expect(suspendido.body.estado).toBe('suspendido');

    prisma.$queryRaw.mockResolvedValueOnce([filaPermiso('revocado', -1, 29)]);
    const revocado = await request(app.getHttpServer())
      .get(`/verificaciones/${TOKEN_QR}`)
      .expect(200);
    expect(revocado.body.valido).toBe(false);
    expect(revocado.body.estado).toBe('revocado');
  });

  it('HU-33/D3: vigente con vigencia vencida se reporta como vencido', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([filaPermiso('vigente', -30, -1)]);

    const respuesta = await request(app.getHttpServer())
      .get(`/verificaciones/${TOKEN_QR}`)
      .expect(200);

    expect(respuesta.body.valido).toBe(false);
    expect(respuesta.body.estado).toBe('vencido');
  });

  it('HU-33-CA3: un token inexistente o mal formado responde 404', async () => {
    await request(app.getHttpServer())
      .get('/verificaciones/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934d')
      .expect(404)
      .expect((res) => {
        expect(res.body.message).toBe('Permiso no encontrado');
      });

    await request(app.getHttpServer())
      .get('/verificaciones/token-invalido')
      .expect(404);
  });

  it('HU-33-CA4: la respuesta pública solo contiene los campos permitidos', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([filaPermiso('vigente', -1, 29)]);

    const respuesta = await request(app.getHttpServer())
      .get(`/verificaciones/${TOKEN_QR}`)
      .expect(200);

    expect(Object.keys(respuesta.body).sort()).toEqual(
      [
        'categoria',
        'estado',
        'titular',
        'valido',
        'vigenciaFin',
        'vigenciaInicio',
      ].sort(),
    );
    expect(JSON.stringify(respuesta.body)).not.toMatch(
      /documento|correo|telefono|motivo|password|hash/i,
    );
  });

  // El límite por IP se verifica en test/verificacion-rate-limit.e2e-spec.ts
  // con una aplicación propia, siguiendo el patrón de rate-limit.e2e-spec.ts.
});
