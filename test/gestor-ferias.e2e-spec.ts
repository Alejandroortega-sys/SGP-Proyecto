import {
  ConflictException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import '../src/common/bigint-serialization';
import { AppModule } from '../src/app.module';
import { GestorFeriasService } from '../src/ferias/gestor-ferias.service';
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

const REVISOR: UsuarioPrueba = {
  id: 2n,
  nombre: 'Carlos',
  apellido: 'Ramírez',
  correo: 'revisor@tulua.gov.co',
  rol: 'gestor',
  estado: 'activa',
  perfil: 'revisor',
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

const USUARIOS = [REVISOR, ORGANIZADOR, COMERCIANTE];

const EVENTO = {
  id: '1',
  numeroRadicado: 'FER-2026-00001',
  nombre: 'Feria Agroecológica de Diciembre',
  tipoFeria: 'Feria agroecológica',
  estado: 'aprobada',
  fechaInicio: '2026-12-10',
  fechaFin: '2026-12-12',
  numeroPuestos: 20,
  zona: {
    id: '4',
    nombre: 'Parque La Guadua',
    tipo: 'permitida',
    activa: true,
    aforoMaximo: 25,
    horarioInicio: '06:00',
    horarioFin: '20:00',
  },
  organizador: {
    id: '7',
    nombre: 'Luis',
    apellido: 'Álvarez',
    correo: 'luis.alvarez@agrovalle.org',
    organizacion: 'Fundación Agroecológica del Valle',
    nit: '900123456-1',
  },
  tieneCruces: false,
  motivoCancelacion: null,
  aprobadaEn: '2026-11-07T10:00:00.000Z',
  canceladaEn: null,
};

const prisma = {
  usuarios: { findUnique: jest.fn() },
  sesiones: { findFirst: jest.fn() },
};

const gestorFerias = {
  listar: jest.fn(),
  agenda: jest.fn(),
  detalle: jest.fn(),
  cruces: jest.fn(),
  aprobar: jest.fn(),
  cancelar: jest.fn(),
  mover: jest.fn(),
};

describe('Gestor de ferias (e2e)', () => {
  let app: INestApplication;
  let tokenGestor: string;
  let tokenOrganizador: string;
  let tokenComerciante: string;

  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? 'e2e-secret-sgp-tulua-para-pruebas';

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(GestorFeriasService)
      .useValue(gestorFerias)
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

    [tokenGestor, tokenOrganizador, tokenComerciante] = await Promise.all([
      firmar(REVISOR),
      firmar(ORGANIZADOR),
      firmar(COMERCIANTE),
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.usuarios.findUnique.mockImplementation(
      ({ where }: { where: { id: bigint } }) =>
        Promise.resolve(
          USUARIOS.find((usuario) => usuario.id === where.id) ?? null,
        ),
    );
    prisma.sesiones.findFirst.mockResolvedValue({ id: 1n });

    gestorFerias.agenda.mockResolvedValue({
      desde: '2026-12-01',
      hasta: '2026-12-31',
      zonaId: null,
      zonas: [EVENTO.zona],
      eventos: [EVENTO],
      cruces: [],
      resumen: {
        total: 1,
        radicadas: 0,
        aprobadas: 1,
        canceladas: 0,
        rechazadas: 0,
        realizadas: 0,
      },
    });
    gestorFerias.listar.mockResolvedValue({
      datos: [EVENTO],
      paginacion: { pagina: 1, limite: 20, total: 1, totalPaginas: 1 },
    });
    gestorFerias.detalle.mockResolvedValue({
      ...EVENTO,
      radicadaEn: '2026-11-01T10:00:00.000Z',
      actualizadoEn: '2026-11-07T10:00:00.000Z',
      productos: [],
      documentos: [],
      espaciosBloqueados: [],
      aprobadaPor: 'Carlos',
    });
    gestorFerias.cruces.mockResolvedValue({
      disponible: true,
      conflictos: [],
      sugerencias: [],
    });
    gestorFerias.aprobar.mockResolvedValue({
      id: '2',
      numeroRadicado: 'FER-2026-00002',
      estadoAnterior: 'radicada',
      estado: 'aprobada',
      aprobadaEn: '2026-11-22T10:00:00.000Z',
      espaciosBloqueados: [{ id: '1', nombre: 'Espacio A' }],
      correoEnviado: true,
      mensajeCorreo: null,
      mensaje: 'Feria aprobada y espacios bloqueados.',
    });
    gestorFerias.cancelar.mockResolvedValue({
      id: '2',
      numeroRadicado: 'FER-2026-00002',
      estadoAnterior: 'aprobada',
      estado: 'cancelada',
      motivoCancelacion: 'Jornada institucional',
      canceladaEn: '2026-11-22T10:00:00.000Z',
      espaciosLiberados: 1,
      correoEnviado: true,
      mensajeCorreo: null,
      mensaje: 'Feria cancelada y espacios liberados.',
    });
    gestorFerias.mover.mockResolvedValue({
      id: '2',
      numeroRadicado: 'FER-2026-00002',
      estado: 'aprobada',
      fechaInicioAnterior: '2027-01-15',
      fechaFinAnterior: '2027-01-17',
      zonaAnteriorId: '1',
      zonaAnteriorNombre: 'Centro - Calle 30',
      fechaInicio: '2027-02-15',
      fechaFin: '2027-02-17',
      zona: EVENTO.zona,
      espaciosBloqueados: [],
      correoEnviado: true,
      mensajeCorreo: null,
      mensaje: 'Feria movida correctamente.',
    });
  });

  it('consulta la agenda por rango de fechas', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/gestor/ferias/agenda')
      .query({ desde: '2026-12-01', hasta: '2026-12-31' })
      .set('Authorization', `Bearer ${tokenGestor}`)
      .expect(200);

    expect(respuesta.body.eventos[0]).toMatchObject({
      numeroRadicado: 'FER-2026-00001',
      estado: 'aprobada',
    });
    expect(gestorFerias.agenda).toHaveBeenCalled();
  });

  it('convierte incluirTodos a booleano', async () => {
    await request(app.getHttpServer())
      .get('/gestor/ferias/agenda')
      .query({
        desde: '2026-12-01',
        hasta: '2026-12-31',
        incluirTodos: 'true',
      })
      .set('Authorization', `Bearer ${tokenGestor}`)
      .expect(200);

    expect(gestorFerias.agenda).toHaveBeenCalledWith(
      expect.objectContaining({ incluirTodos: true }),
    );
  });

  it('lista ferias con filtros administrativos', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/gestor/ferias')
      .query({ estado: 'radicada', zonaId: '4', limite: 5 })
      .set('Authorization', `Bearer ${tokenGestor}`)
      .expect(200);

    expect(respuesta.body.paginacion.total).toBe(1);
    expect(gestorFerias.listar).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'radicada', zonaId: '4', limite: 5 }),
    );
  });

  it('consulta los cruces antes de aprobar o mover', async () => {
    await request(app.getHttpServer())
      .get('/gestor/ferias/2/cruces')
      .query({
        zonaId: '4',
        fechaInicio: '2027-02-10',
        fechaFin: '2027-02-12',
        paraAprobacion: 'true',
      })
      .set('Authorization', `Bearer ${tokenGestor}`)
      .expect(200);

    expect(gestorFerias.cruces).toHaveBeenCalledWith('2', {
      zonaId: '4',
      fechaInicio: '2027-02-10',
      fechaFin: '2027-02-12',
      paraAprobacion: true,
    });
  });

  it('aprueba una feria radicada', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/gestor/ferias/2/aprobar')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .expect(200);

    expect(respuesta.body.estado).toBe('aprobada');
    expect(gestorFerias.aprobar).toHaveBeenCalledWith(
      expect.objectContaining({ id: '2', rol: 'gestor' }),
      '2',
    );
  });

  it('cancela una feria con motivo', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/gestor/ferias/2/cancelar')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ motivo: 'Jornada institucional' })
      .expect(200);

    expect(respuesta.body.estado).toBe('cancelada');
    expect(gestorFerias.cancelar).toHaveBeenCalledWith(
      expect.anything(),
      '2',
      'Jornada institucional',
    );
  });

  it('rechaza la cancelación sin motivo', async () => {
    await request(app.getHttpServer())
      .post('/gestor/ferias/2/cancelar')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ motivo: '   ' })
      .expect(400);

    expect(gestorFerias.cancelar).not.toHaveBeenCalled();
  });

  it('mueve una feria a otra zona y fechas', async () => {
    const respuesta = await request(app.getHttpServer())
      .patch('/gestor/ferias/2/agenda')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({
        zonaId: '4',
        fechaInicio: '2027-02-15',
        fechaFin: '2027-02-17',
        motivo: 'Ajuste de agenda',
      })
      .expect(200);

    expect(respuesta.body.mensaje).toContain('movida');
    expect(gestorFerias.mover).toHaveBeenCalledWith(
      expect.anything(),
      '2',
      expect.objectContaining({
        zonaId: '4',
        fechaInicio: '2027-02-15',
        fechaFin: '2027-02-17',
      }),
    );
  });

  it('propaga el conflicto de la aprobación', async () => {
    gestorFerias.aprobar.mockRejectedValueOnce(
      new ConflictException('La zona ya está ocupada.'),
    );

    await request(app.getHttpServer())
      .post('/gestor/ferias/2/aprobar')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .expect(409);
  });

  it('impide que un organizador o comerciante use el calendario', async () => {
    await request(app.getHttpServer())
      .get('/gestor/ferias/agenda')
      .query({ desde: '2026-12-01', hasta: '2026-12-31' })
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/gestor/ferias/2/aprobar')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .expect(403);
  });
});
