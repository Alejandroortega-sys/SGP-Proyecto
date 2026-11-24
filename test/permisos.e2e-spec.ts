import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import '../src/common/bigint-serialization';
import { AppModule } from '../src/app.module';
import { CorreoService } from '../src/correo/correo.service';
import { PrismaService } from '../src/prisma/prisma.service';

const GESTOR = {
  id: 2n,
  nombre: 'Carlos',
  apellido: 'Ramírez',
  correo: 'revisor@tulua.gov.co',
  rol: 'gestor' as const,
  estado: 'activa' as const,
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

const TOKEN_QR = 'a3f0c44298fc1c149afbf4c8996fb92427ae41e4649b934c';

const SOLICITUD_APROBADA = {
  id: 12n,
  numero_radicado: 'SOL-2026-00012',
  estado: 'aprobada',
  comerciante_id: 3n,
  espacio_id: 4n,
  actividad: 'Venta de frutas y verduras',
  espacio_nombre: 'Kiosco Parque La Guadua',
  zona_id: 4n,
  titular_nombre: 'María',
  titular_apellido: 'Gómez',
};

const PERMISO_EMITIDO = {
  id: 8n,
  numero: 'PER-2026-00002',
  qr_token: TOKEN_QR,
  categoria_autorizada: 'Venta de frutas y verduras',
  fecha_inicio: new Date('2026-11-23T00:00:00'),
  fecha_fin: new Date('2026-12-22T00:00:00'),
  estado: 'vigente' as const,
  emitido_en: new Date('2026-11-23T10:00:00'),
};

const FILA_MI_PERMISO = {
  id: 8n,
  numero: 'PER-2026-00002',
  categoria_autorizada: 'Venta de frutas y verduras',
  fecha_inicio: new Date('2026-11-23T00:00:00'),
  fecha_fin: new Date('2026-12-22T00:00:00'),
  estado: 'vigente' as const,
  qr_token: TOKEN_QR,
  emitido_en: new Date('2026-11-23T10:00:00'),
  renovado_desde: null,
  espacios_temporales: { nombre: 'Kiosco Parque La Guadua' },
  permisos: null,
  comerciantes: { usuarios: { id: 3n, nombre: 'María', apellido: 'Gómez' } },
};

const FILA_PERMISO_GESTOR = {
  id: 8n,
  numero: 'PER-2026-00002',
  solicitud_id: 12n,
  titular_id: 3n,
  espacio_id: 4n,
  categoria_autorizada: 'Venta de frutas y verduras',
  fecha_inicio: new Date('2026-11-23T00:00:00'),
  fecha_fin: new Date('2026-12-22T00:00:00'),
  estado: 'vigente' as const,
  qr_token: TOKEN_QR,
  emitido_por: 2n,
  emitido_en: new Date('2026-11-23T10:00:00'),
  renovado_desde: null,
  solicitudes: { numero_radicado: 'SOL-2026-00012' },
  comerciantes: { usuarios: { id: 3n, nombre: 'María', apellido: 'Gómez' } },
  espacios_temporales: { id: 4n, nombre: 'Kiosco Parque La Guadua' },
  gestores: {
    usuarios_gestores_usuario_idTousuarios: {
      id: 2n,
      nombre: 'Carlos',
      apellido: 'Ramírez',
    },
  },
  permisos: null,
  other_permisos: [],
  cobros: { id: 1n, valor: 50000, estado: 'pendiente', pagado_en: null },
};

describe('Permisos digitales (e2e)', () => {
  let app: INestApplication;
  let tokenGestor: string;
  let tokenComerciante: string;

  const tx = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn().mockResolvedValue(0),
    permisos: { findUnique: jest.fn(), update: jest.fn() },
    notificaciones: { create: jest.fn().mockResolvedValue({ id: 21n }) },
    solicitudes: { count: jest.fn().mockResolvedValue(0) },
    solicitud_historial: { create: jest.fn().mockResolvedValue({}) },
  };

  const prisma = {
    usuarios: { findUnique: jest.fn() },
    sesiones: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
    permisos: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    permiso_eventos: { findMany: jest.fn() },
    verificaciones_qr: {
      create: jest.fn(),
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

    [tokenGestor, tokenComerciante] = await Promise.all([
      firmar(GESTOR),
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
        const usuario = [GESTOR, COMERCIANTE].find(
          (candidato) => candidato.id === where.id,
        );
        return Promise.resolve(usuario ?? null);
      },
    );
    tx.$queryRaw.mockResolvedValue([]);
    tx.permisos.findUnique.mockResolvedValue(null);
    tx.permisos.update.mockResolvedValue({ id: 8n });
  });

  describe('HU-31 · POST /gestor/permisos', () => {
    it('exige autenticación y rol gestor', async () => {
      await request(app.getHttpServer())
        .post('/gestor/permisos')
        .send({ solicitudId: '12' })
        .expect(401);

      await request(app.getHttpServer())
        .post('/gestor/permisos')
        .set('Authorization', `Bearer ${tokenComerciante}`)
        .send({ solicitudId: '12' })
        .expect(403);
    });

    it('rechaza un cuerpo inválido (400)', async () => {
      await request(app.getHttpServer())
        .post('/gestor/permisos')
        .set('Authorization', `Bearer ${tokenGestor}`)
        .send({ solicitudId: 'abc' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/gestor/permisos')
        .set('Authorization', `Bearer ${tokenGestor}`)
        .send({})
        .expect(400);
    });

    it('HU-31-CA1: emite el permiso con QR único y tarda menos de 2 s', async () => {
      tx.$queryRaw
        .mockResolvedValueOnce([SOLICITUD_APROBADA])
        .mockResolvedValueOnce([PERMISO_EMITIDO])
        .mockResolvedValueOnce([{ id: 1n, valor: 50000 }])
        .mockResolvedValueOnce([{ id: 1n, valor: 50000, estado: 'pendiente' }]);

      const inicio = Date.now();
      const respuesta = await request(app.getHttpServer())
        .post('/gestor/permisos')
        .set('Authorization', `Bearer ${tokenGestor}`)
        .send({ solicitudId: '12' })
        .expect(201);
      const duracionMs = Date.now() - inicio;

      expect(duracionMs).toBeLessThan(2000);
      expect(respuesta.body).toMatchObject({
        id: '8',
        numero: 'PER-2026-00002',
        solicitudId: '12',
        titular: { id: '3', nombre: 'María Gómez' },
        espacio: { id: '4', nombre: 'Kiosco Parque La Guadua' },
        categoria: 'Venta de frutas y verduras',
        fechaInicio: '2026-11-23',
        fechaFin: '2026-12-22',
        estado: 'vigente',
        qrToken: TOKEN_QR,
        cobro: { id: '1', valor: '50000', estado: 'pendiente' },
      });
      // HU-31-CA3: el comerciante queda notificado del carné disponible.
      expect(tx.notificaciones.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            usuario_id: 3n,
            tipo: 'permiso_emitido',
          }),
        }),
      );
    });

    it('HU-31-CA4: una solicitud no aprobada responde 422 en español', async () => {
      tx.$queryRaw.mockResolvedValueOnce([
        { ...SOLICITUD_APROBADA, estado: 'radicada' },
      ]);

      const respuesta = await request(app.getHttpServer())
        .post('/gestor/permisos')
        .set('Authorization', `Bearer ${tokenGestor}`)
        .send({ solicitudId: '12' })
        .expect(422);

      expect(respuesta.body.message).toContain('solicitudes aprobadas');
    });

    it('HU-31: una solicitud con permiso previo responde 409', async () => {
      tx.$queryRaw.mockResolvedValueOnce([SOLICITUD_APROBADA]);
      tx.permisos.findUnique.mockResolvedValueOnce({
        numero: 'PER-2026-00002',
      });

      const respuesta = await request(app.getHttpServer())
        .post('/gestor/permisos')
        .set('Authorization', `Bearer ${tokenGestor}`)
        .send({ solicitudId: '12' })
        .expect(409);

      expect(respuesta.body.message).toContain('ya tiene el permiso');
      expect(tx.notificaciones.create).not.toHaveBeenCalled();
    });
  });

  describe('HU-35 · PATCH /gestor/permisos/:id/estado', () => {
    it('HU-35-CA1: suspende con motivo y registra la variable de sesión', async () => {
      tx.$queryRaw.mockResolvedValueOnce([
        {
          id: 8n,
          numero: 'PER-2026-00002',
          estado: 'vigente',
          titular_id: 3n,
          titular_nombre: 'María',
          titular_apellido: 'Gómez',
        },
      ]);

      const respuesta = await request(app.getHttpServer())
        .patch('/gestor/permisos/8/estado')
        .set('Authorization', `Bearer ${tokenGestor}`)
        .send({ estado: 'suspendido', motivo: 'Inspección: horario excedido' })
        .expect(200);

      expect(respuesta.body).toMatchObject({
        numero: 'PER-2026-00002',
        estadoAnterior: 'vigente',
        estado: 'suspendido',
      });
      // El motivo se fija por variable de sesión antes del UPDATE.
      const plantilla = tx.$executeRaw.mock.calls[1]?.[0] as readonly string[];
      expect(plantilla?.join('?')).toContain('app.motivo');
      expect(tx.notificaciones.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tipo: 'permiso_suspendido' }),
        }),
      );
    });

    it('HU-35: sin motivo responde 422 antes de tocar la BD', async () => {
      await request(app.getHttpServer())
        .patch('/gestor/permisos/8/estado')
        .set('Authorization', `Bearer ${tokenGestor}`)
        .send({ estado: 'suspendido' })
        .expect(422);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('HU-35-CA2: levanta la suspensión y vuelve a vigente', async () => {
      tx.$queryRaw.mockResolvedValueOnce([
        {
          id: 8n,
          numero: 'PER-2026-00002',
          estado: 'suspendido',
          titular_id: 3n,
          titular_nombre: 'María',
          titular_apellido: 'Gómez',
        },
      ]);

      const respuesta = await request(app.getHttpServer())
        .patch('/gestor/permisos/8/estado')
        .set('Authorization', `Bearer ${tokenGestor}`)
        .send({ estado: 'vigente', motivo: 'Levantado tras verificación' })
        .expect(200);

      expect(respuesta.body.estado).toBe('vigente');
      expect(tx.notificaciones.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tipo: 'permiso_reactivado' }),
        }),
      );
    });

    it('HU-35: revoca un permiso suspendido con motivo', async () => {
      tx.$queryRaw.mockResolvedValueOnce([
        {
          id: 8n,
          numero: 'PER-2026-00002',
          estado: 'suspendido',
          titular_id: 3n,
          titular_nombre: 'María',
          titular_apellido: 'Gómez',
        },
      ]);

      const respuesta = await request(app.getHttpServer())
        .patch('/gestor/permisos/8/estado')
        .set('Authorization', `Bearer ${tokenGestor}`)
        .send({ estado: 'revocado', motivo: 'Incumplimiento reiterado' })
        .expect(200);

      expect(respuesta.body.estado).toBe('revocado');
    });

    it('HU-35: el permiso inexistente responde 404', async () => {
      tx.$queryRaw.mockResolvedValueOnce([]);

      await request(app.getHttpServer())
        .patch('/gestor/permisos/999/estado')
        .set('Authorization', `Bearer ${tokenGestor}`)
        .send({ estado: 'suspendido', motivo: 'Prueba' })
        .expect(404);
    });
  });

  describe('HU-37 · GET /gestor/permisos y trazabilidad', () => {
    it('HU-37-CA2: lista con paginación y filtros', async () => {
      prisma.permisos.findMany.mockResolvedValue([FILA_PERMISO_GESTOR]);
      prisma.permisos.count.mockResolvedValue(1);

      const respuesta = await request(app.getHttpServer())
        .get('/gestor/permisos')
        .query({ q: 'María', estado: 'vigente', pagina: 1, limite: 20 })
        .set('Authorization', `Bearer ${tokenGestor}`)
        .expect(200);

      expect(respuesta.body.datos).toHaveLength(1);
      expect(respuesta.body.datos[0]).toMatchObject({
        numero: 'PER-2026-00002',
        titularNombre: 'María Gómez',
        estado: 'vigente',
      });
      expect(respuesta.body.paginacion).toEqual({
        pagina: 1,
        limite: 20,
        total: 1,
        totalPaginas: 1,
      });
    });

    it('HU-37-CA1/CA3: la trazabilidad une eventos y verificaciones QR', async () => {
      prisma.permisos.findUnique.mockResolvedValue(FILA_PERMISO_GESTOR);
      prisma.permiso_eventos.findMany.mockResolvedValue([
        {
          id: 31n,
          evento: 'emitido',
          motivo: null,
          creado_en: new Date('2026-11-23T10:00:00'),
          usuarios: { id: 2n, nombre: 'Carlos', apellido: 'Ramírez' },
        },
      ]);
      prisma.verificaciones_qr.count.mockResolvedValue(5);
      prisma.verificaciones_qr.findFirst.mockResolvedValue({
        creado_en: new Date('2026-11-24T15:30:00.000Z'),
      });

      const respuesta = await request(app.getHttpServer())
        .get('/gestor/permisos/8/trazabilidad')
        .set('Authorization', `Bearer ${tokenGestor}`)
        .expect(200);

      expect(respuesta.body.permiso.numero).toBe('PER-2026-00002');
      expect(respuesta.body.eventos[0].evento).toBe('emitido');
      expect(respuesta.body.verificaciones).toEqual({
        total: 5,
        ultima: '2026-11-24T15:30:00.000Z',
      });
    });
  });

  describe('HU-32 · GET /permisos/mios y carné', () => {
    it('HU-32-CA1: lista los permisos propios del comerciante', async () => {
      prisma.permisos.findMany.mockResolvedValue([FILA_MI_PERMISO]);
      prisma.permisos.count.mockResolvedValue(1);

      const respuesta = await request(app.getHttpServer())
        .get('/permisos/mios')
        .set('Authorization', `Bearer ${tokenComerciante}`)
        .expect(200);

      expect(respuesta.body.datos[0]).toMatchObject({
        numero: 'PER-2026-00002',
        estado: 'vigente',
        espacioNombre: 'Kiosco Parque La Guadua',
      });
    });

    it('HU-32: un gestor no puede consultar «mis permisos» (403)', async () => {
      await request(app.getHttpServer())
        .get('/permisos/mios')
        .set('Authorization', `Bearer ${tokenGestor}`)
        .expect(403);
    });

    it('HU-32-CA1: el detalle propio incluye la URL de verificación del QR', async () => {
      prisma.permisos.findFirst.mockResolvedValue(FILA_MI_PERMISO);

      const respuesta = await request(app.getHttpServer())
        .get('/permisos/mios/8')
        .set('Authorization', `Bearer ${tokenComerciante}`)
        .expect(200);

      expect(respuesta.body.urlVerificacion).toBe(
        `http://localhost:3001/verificar/${TOKEN_QR}`,
      );
    });

    it('HU-32-CA2: el carné se descarga como PDF', async () => {
      prisma.permisos.findFirst.mockResolvedValue(FILA_MI_PERMISO);

      const respuesta = await request(app.getHttpServer())
        .get('/permisos/mios/8/carne')
        .set('Authorization', `Bearer ${tokenComerciante}`)
        .expect(200);

      expect(respuesta.headers['content-type']).toContain('application/pdf');
      expect(respuesta.headers['content-disposition']).toContain(
        'carne-PER-2026-00002.pdf',
      );
      expect(respuesta.body.subarray(0, 4).toString()).toBe('%PDF');
    });

    it('HU-32: el permiso de otro titular responde 404 (IDOR)', async () => {
      prisma.permisos.findFirst.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/permisos/mios/99')
        .set('Authorization', `Bearer ${tokenComerciante}`)
        .expect(404);
    });
  });

  describe('HU-34 · POST /permisos/mios/:id/renovacion', () => {
    it('HU-34-CA2: radica la solicitud de renovación precargada', async () => {
      tx.$queryRaw
        .mockResolvedValueOnce([
          {
            id: 8n,
            numero: 'PER-2026-00002',
            estado: 'vigente',
            titular_id: 3n,
            solicitud_id: 12n,
            espacio_id: 4n,
            categoria_autorizada: 'Venta de frutas y verduras',
            fecha_inicio: new Date('2026-11-23T00:00:00'),
            fecha_fin: new Date('2026-12-22T00:00:00'),
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 13n,
            numero_radicado: 'SOL-2026-00013',
            fecha_inicio: new Date('2026-12-23T00:00:00'),
            fecha_fin: new Date('2027-01-21T00:00:00'),
          },
        ]);

      const respuesta = await request(app.getHttpServer())
        .post('/permisos/mios/8/renovacion')
        .set('Authorization', `Bearer ${tokenComerciante}`)
        .expect(201);

      expect(respuesta.body).toMatchObject({
        permisoNumero: 'PER-2026-00002',
        numeroRadicado: 'SOL-2026-00013',
      });
      expect(tx.solicitud_historial.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ estado_nuevo: 'radicada' }),
        }),
      );
    });

    it('HU-34-CA4: un permiso vencido responde 422 con la indicación de radicar de nuevo', async () => {
      tx.$queryRaw.mockResolvedValueOnce([
        {
          id: 8n,
          numero: 'PER-2026-00002',
          estado: 'vigente',
          titular_id: 3n,
          solicitud_id: 12n,
          espacio_id: 4n,
          categoria_autorizada: 'Venta de frutas y verduras',
          fecha_inicio: new Date('2026-10-01T00:00:00'),
          fecha_fin: new Date('2026-10-30T00:00:00'),
        },
      ]);

      const respuesta = await request(app.getHttpServer())
        .post('/permisos/mios/8/renovacion')
        .set('Authorization', `Bearer ${tokenComerciante}`)
        .expect(422);

      expect(respuesta.body.message).toContain(
        'debe radicar una nueva solicitud',
      );
    });
  });
});
