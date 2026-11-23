import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import '../src/common/bigint-serialization';
import { AppModule } from '../src/app.module';
import { CorreoService } from '../src/correo/correo.service';
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

const COMERCIANTE = {
  id: 3n,
  nombre: 'María',
  apellido: 'Gómez',
  correo: 'maria.gomez@gmail.com',
  rol: 'comerciante' as const,
  estado: 'activa' as const,
  gestores_gestores_usuario_idTousuarios: null,
};

const FILA_RESOLUCION = {
  id: 12n,
  numero_radicado: 'SOL-2026-00012',
  estado: 'en_revision' as const,
  comerciante_id: 3n,
  espacio_id: 4n,
  fecha_inicio: '2026-12-01',
  fecha_fin: '2026-12-03',
  hora_inicio: '09:00',
  hora_fin: '12:00',
  correo: 'maria.gomez@gmail.com',
  nombre: 'María',
  espacio_nombre: 'Kiosco Parque La Guadalupe',
};

const ACTUALIZADA = {
  id: 12n,
  numero_radicado: 'SOL-2026-00012',
  estado: 'aprobada' as const,
  motivo_rechazo: null,
  decidida_en: new Date('2026-11-22T10:00:00.000Z'),
  actualizado_en: new Date('2026-11-22T10:00:00.000Z'),
};

describe('Resolución de solicitudes (e2e)', () => {
  let app: INestApplication;
  let tokenGestor: string;
  let tokenComerciante: string;

  const tx = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    solicitudes: { update: jest.fn() },
    solicitud_historial: { create: jest.fn().mockResolvedValue({}) },
    notificaciones: { create: jest.fn().mockResolvedValue({ id: 21n }) },
  };

  const prisma = {
    usuarios: { findUnique: jest.fn() },
    sesiones: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
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
    tx.solicitudes.update.mockResolvedValue(ACTUALIZADA);
  });

  it('exige autenticación y rol gestor', async () => {
    await request(app.getHttpServer())
      .patch('/gestor/solicitudes/12/resolucion')
      .send({ decision: 'aprobar' })
      .expect(401);

    await request(app.getHttpServer())
      .patch('/gestor/solicitudes/12/resolucion')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .send({ decision: 'aprobar' })
      .expect(403);
  });

  it('exige el motivo al rechazar', async () => {
    await request(app.getHttpServer())
      .patch('/gestor/solicitudes/12/resolucion')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ decision: 'rechazar' })
      .expect(400);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza una decisión desconocida', async () => {
    await request(app.getHttpServer())
      .patch('/gestor/solicitudes/12/resolucion')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ decision: 'cancelar' })
      .expect(400);
  });

  it('aprueba, asigna el espacio y notifica al comerciante', async () => {
    tx.$queryRaw
      .mockResolvedValueOnce([FILA_RESOLUCION])
      .mockResolvedValueOnce([{ gestor_id: 1n, vigente: true }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 4n, nombre: 'Kiosco Parque La Guadalupe', estado: 'disponible' },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const respuesta = await request(app.getHttpServer())
      .patch('/gestor/solicitudes/12/resolucion')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({
        decision: 'aprobar',
        dictamen: 'Cumple con los requisitos documentales.',
      })
      .expect(200);

    expect(respuesta.body).toMatchObject({
      estado: 'aprobada',
      dictamen: 'Cumple con los requisitos documentales.',
      asignacion: {
        espacioId: '4',
        fechaInicio: '2026-12-01',
        fechaFin: '2026-12-03',
        horaInicio: '09:00',
        horaFin: '12:00',
      },
    });
    expect(tx.notificaciones.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: 'solicitud_aprobada',
          solicitud_id: 12n,
        }),
      }),
    );
    expect(correo.enviarCambioEstadoSolicitud).toHaveBeenCalled();
  });

  it('rechaza con motivo y lo devuelve en la respuesta', async () => {
    tx.$queryRaw
      .mockResolvedValueOnce([FILA_RESOLUCION])
      .mockResolvedValueOnce([{ gestor_id: 1n, vigente: true }]);
    tx.solicitudes.update.mockResolvedValue({
      ...ACTUALIZADA,
      estado: 'rechazada',
      motivo_rechazo: 'Documentación incompleta.',
    });

    const respuesta = await request(app.getHttpServer())
      .patch('/gestor/solicitudes/12/resolucion')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({
        decision: 'rechazar',
        motivoRechazo: 'Documentación incompleta.',
      })
      .expect(200);

    expect(respuesta.body).toMatchObject({
      estado: 'rechazada',
      motivoRechazo: 'Documentación incompleta.',
      asignacion: null,
    });
  });

  it('impide aprobar con requisitos No cumple', async () => {
    tx.$queryRaw
      .mockResolvedValueOnce([FILA_RESOLUCION])
      .mockResolvedValueOnce([{ gestor_id: 1n, vigente: true }])
      .mockResolvedValueOnce([
        { tipo_documento: 'RUT', observacion: 'RUT vencido' },
      ]);

    await request(app.getHttpServer())
      .patch('/gestor/solicitudes/12/resolucion')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ decision: 'aprobar' })
      .expect(409)
      .expect(({ body }) => {
        expect(String(body.message)).toContain('No cumple');
      });

    expect(tx.solicitudes.update).not.toHaveBeenCalled();
  });

  it('impide aprobar si el espacio ya está asignado', async () => {
    tx.$queryRaw
      .mockResolvedValueOnce([FILA_RESOLUCION])
      .mockResolvedValueOnce([{ gestor_id: 1n, vigente: true }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 4n, nombre: 'Kiosco Parque La Guadalupe', estado: 'disponible' },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          referencia: 'SOL-2026-00010',
          fecha_inicio: '2026-12-01',
          fecha_fin: '2026-12-02',
        },
      ]);

    await request(app.getHttpServer())
      .patch('/gestor/solicitudes/12/resolucion')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ decision: 'aprobar' })
      .expect(409)
      .expect(({ body }) => {
        expect(String(body.message)).toContain('SOL-2026-00010');
      });

    expect(tx.solicitudes.update).not.toHaveBeenCalled();
  });

  it('impide resolver una solicitud que ya no está en revisión', async () => {
    tx.$queryRaw.mockResolvedValueOnce([
      { ...FILA_RESOLUCION, estado: 'aprobada' },
    ]);

    await request(app.getHttpServer())
      .patch('/gestor/solicitudes/12/resolucion')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ decision: 'aprobar' })
      .expect(409);

    expect(tx.solicitudes.update).not.toHaveBeenCalled();
  });
});
