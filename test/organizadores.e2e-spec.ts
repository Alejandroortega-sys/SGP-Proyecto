import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import '../src/common/bigint-serialization';
import { AppModule } from '../src/app.module';
import { CorreoService } from '../src/correo/correo.service';
import { PrismaService } from '../src/prisma/prisma.service';

const FECHA = new Date('2026-09-15T14:30:00.000Z');

interface UsuarioPrueba {
  id: bigint;
  nombre: string;
  apellido: string | null;
  correo: string;
  rol: 'comerciante' | 'organizador' | 'gestor';
  estado: 'activa' | 'pendiente_activacion';
  perfil: 'administrador' | 'revisor' | null;
  tipo_documento?: string | null;
  documento?: string | null;
  telefono?: string | null;
}

const ADMIN: UsuarioPrueba = {
  id: 1n,
  nombre: 'Laura',
  apellido: 'Martínez',
  correo: 'admin@tulua.gov.co',
  rol: 'gestor',
  estado: 'activa',
  perfil: 'administrador',
};

const REVISOR: UsuarioPrueba = {
  id: 2n,
  nombre: 'Carlos',
  apellido: 'Ramírez',
  correo: 'revisor@tulua.gov.co',
  rol: 'gestor',
  estado: 'activa',
  perfil: 'revisor',
};

const COMERCIANTE: UsuarioPrueba = {
  id: 4n,
  nombre: 'José',
  apellido: 'Pérez',
  correo: 'jose.perez@hotmail.com',
  rol: 'comerciante',
  estado: 'activa',
  perfil: null,
  tipo_documento: 'CC',
  documento: '801234567',
  telefono: '3147788990',
};

const ORGANIZADOR: UsuarioPrueba = {
  id: 7n,
  nombre: 'Luis',
  apellido: 'Álvarez',
  correo: 'luis.alvarez@agrovalle.org',
  rol: 'organizador',
  estado: 'activa',
  perfil: null,
  tipo_documento: 'CC',
  documento: '801234567',
  telefono: '3105551234',
};

let organizacion: {
  usuario_id: bigint;
  nombre_organizacion: string;
  nit: string;
  representante: string;
  tipo_feria: string;
  contacto: string | null;
  estado: 'pendiente_validacion' | 'activa' | 'suspendida';
  validado_por: bigint | null;
  validado_en: Date | null;
} | null = null;

const ORGANIZACION_INICIAL = {
  usuario_id: 7n,
  nombre_organizacion: 'Fundación Agroecológica del Valle',
  nit: '900123456-1',
  representante: 'Luis Álvarez',
  tipo_feria: 'Feria agroecológica',
  contacto: '3105551234',
  estado: 'pendiente_validacion' as const,
  validado_por: null,
  validado_en: null,
};

const usuarios: UsuarioPrueba[] = [ADMIN, REVISOR, COMERCIANTE, ORGANIZADOR];

/** Convierte un usuario en la fila que devuelve el guard JWT. */
function filaGuard(usuario: UsuarioPrueba) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    correo: usuario.correo,
    rol: usuario.rol,
    estado: usuario.estado,
    gestores_gestores_usuario_idTousuarios: usuario.perfil
      ? { perfil: usuario.perfil }
      : null,
  };
}

/** Fila de `GET /perfil` / `PATCH /perfil`. */
function filaPerfil(usuario: UsuarioPrueba) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    tipo_documento: usuario.tipo_documento ?? null,
    documento: usuario.documento ?? null,
    telefono: usuario.telefono ?? null,
    correo: usuario.correo,
    rol: usuario.rol,
    estado: usuario.estado,
    creado_en: FECHA,
    comerciantes:
      usuario.rol === 'comerciante'
        ? {
            actividad_comercial: 'Comidas rápidas',
            categoria: 'informal',
          }
        : null,
    organizadores_organizadores_usuario_idTousuarios:
      usuario.rol === 'organizador' ? organizacion : null,
  };
}

/** Fila de `GET /gestor/organizaciones` y `GET /gestor/organizaciones/:id`. */
function filaGestor(usuario: UsuarioPrueba) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    correo: usuario.correo,
    telefono: usuario.telefono ?? null,
    rol: usuario.rol,
    creado_en: FECHA,
    organizadores_organizadores_usuario_idTousuarios: organizacion,
  };
}

const prisma = {
  usuarios: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  organizadores: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  tokens_seguridad: {
    create: jest.fn(),
  },
  notificaciones: { create: jest.fn() },
  sesiones: {
    deleteMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $executeRaw: jest.fn(),
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
};

const correo = {
  enviarCodigoActivacion: jest.fn(),
  enviarCodigoRecuperacion: jest.fn(),
  enviarAvisoCambioPassword: jest.fn(),
  enviarCredencialesGestor: jest.fn(),
  enviarAvisoEstadoCuenta: jest.fn(),
};

describe('Organizadores (e2e)', () => {
  let app: INestApplication;
  let tokenAdmin: string;
  let tokenRevisor: string;
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

    [tokenAdmin, tokenRevisor, tokenOrganizador, tokenComerciante] =
      await Promise.all([
        firmar(ADMIN),
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
    organizacion = null;

    prisma.usuarios.findUnique.mockImplementation(
      ({
        where,
        select,
      }: {
        where: { id?: bigint; correo?: string };
        select?: Record<string, unknown>;
      }) => {
        const usuario = usuarios.find((candidato) =>
          where.id
            ? candidato.id === where.id
            : candidato.correo === where.correo,
        );
        if (!usuario) {
          return Promise.resolve(null);
        }
        if (select && 'comerciantes' in select) {
          return Promise.resolve(filaPerfil(usuario));
        }
        if (select && 'creado_en' in select) {
          return Promise.resolve(filaGestor(usuario));
        }
        return Promise.resolve(filaGuard(usuario));
      },
    );

    prisma.usuarios.findMany.mockImplementation(() =>
      Promise.resolve([filaGestor(ORGANIZADOR)]),
    );
    prisma.usuarios.count.mockResolvedValue(1);
    prisma.usuarios.create.mockImplementation(
      ({
        data,
      }: {
        data: {
          rol: UsuarioPrueba['rol'];
          nombre: string;
          apellido?: string;
          correo: string;
          estado?: UsuarioPrueba['estado'];
        };
      }) =>
        Promise.resolve({
          id: 10n,
          nombre: data.nombre,
          apellido: data.apellido ?? null,
          correo: data.correo,
          rol: data.rol,
          estado: data.estado ?? 'pendiente_activacion',
        }),
    );

    prisma.organizadores.findUnique.mockImplementation(
      ({ where }: { where: { usuario_id?: bigint; nit?: string } }) => {
        if (where.nit !== undefined) {
          return Promise.resolve(
            organizacion && organizacion.nit === where.nit
              ? organizacion
              : null,
          );
        }
        return Promise.resolve(organizacion);
      },
    );
    prisma.organizadores.findFirst.mockImplementation(
      ({ where }: { where: { nombre_organizacion?: { equals?: string } } }) => {
        const nombre = where.nombre_organizacion?.equals;
        return Promise.resolve(
          organizacion &&
            nombre &&
            organizacion.nombre_organizacion.toLowerCase() ===
              nombre.toLowerCase()
            ? organizacion
            : null,
        );
      },
    );
    prisma.organizadores.create.mockImplementation(
      ({
        data,
      }: {
        data: Omit<
          NonNullable<typeof organizacion>,
          'estado' | 'validado_por' | 'validado_en'
        >;
      }) => {
        organizacion = {
          ...data,
          contacto: data.contacto ?? null,
          estado: 'pendiente_validacion',
          validado_por: null,
          validado_en: null,
        };
        return Promise.resolve(organizacion);
      },
    );
    prisma.organizadores.update.mockImplementation(
      ({ data }: { data: Partial<NonNullable<typeof organizacion>> }) => {
        organizacion = { ...organizacion!, ...data };
        return Promise.resolve(organizacion);
      },
    );

    prisma.tokens_seguridad.create.mockResolvedValue(undefined);
    prisma.notificaciones.create.mockResolvedValue(undefined);
    prisma.$executeRaw.mockResolvedValue(1);
    prisma.sesiones.deleteMany.mockResolvedValue({ count: 0 });
    prisma.sesiones.create.mockResolvedValue({ id: 1n });
    prisma.sesiones.findFirst.mockResolvedValue({ id: 1n });
    prisma.sesiones.update.mockResolvedValue({});
    prisma.sesiones.updateMany.mockResolvedValue({ count: 1 });
    prisma.$queryRaw.mockResolvedValue([{ bloqueado: false, minutos: 0 }]);
    prisma.$transaction.mockImplementation(
      async (callback: (cliente: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );

    correo.enviarCodigoActivacion.mockResolvedValue(undefined);
    correo.enviarCodigoRecuperacion.mockResolvedValue(undefined);
    correo.enviarAvisoCambioPassword.mockResolvedValue(undefined);
    correo.enviarCredencialesGestor.mockResolvedValue(undefined);
    correo.enviarAvisoEstadoCuenta.mockResolvedValue(undefined);
  });

  it('registra la cuenta de organizador y envía el código de activación', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/usuarios/organizadores')
      .send({
        nombre: 'Nuevo',
        apellido: 'Organizador',
        tipoDocumento: 'CC',
        documento: '1099887766',
        telefono: '3100000000',
        correo: 'nuevo.organizador@agrovalle.org',
        password: 'Organizador123',
        confirmarPassword: 'Organizador123',
      })
      .expect(201);

    expect(respuesta.body).toMatchObject({
      id: '10',
      rol: 'organizador',
      estado: 'pendiente_activacion',
    });
    expect(correo.enviarCodigoActivacion).toHaveBeenCalledTimes(1);
    expect(prisma.tokens_seguridad.create).toHaveBeenCalledTimes(1);
  });

  it('exige token y rol organizador para consultar la organización', async () => {
    await request(app.getHttpServer())
      .get('/organizadores/mi-organizacion')
      .expect(401);

    await request(app.getHttpServer())
      .get('/organizadores/mi-organizacion')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .expect(403);
  });

  it('registra la organización, la consulta y la actualiza', async () => {
    const creada = await request(app.getHttpServer())
      .post('/organizadores/mi-organizacion')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .send({
        nombreOrganizacion: 'Fundación Agroecológica del Valle',
        nit: '900123456-1',
        representante: 'Luis Álvarez',
        tipoFeria: 'Feria agroecológica',
        contacto: '3105551234',
      })
      .expect(201);

    expect(creada.body).toMatchObject({
      usuarioId: '7',
      estado: 'pendiente_validacion',
    });

    const consultada = await request(app.getHttpServer())
      .get('/organizadores/mi-organizacion')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .expect(200);

    expect(consultada.body.nombreOrganizacion).toBe(
      'Fundación Agroecológica del Valle',
    );

    const actualizada = await request(app.getHttpServer())
      .patch('/organizadores/mi-organizacion')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .send({ representante: 'Luis A. Álvarez' })
      .expect(200);

    expect(actualizada.body.representante).toBe('Luis A. Álvarez');
  });

  it('devuelve 409 si el organizador intenta registrar una segunda organización', async () => {
    organizacion = { ...ORGANIZACION_INICIAL };

    await request(app.getHttpServer())
      .post('/organizadores/mi-organizacion')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .send({
        nombreOrganizacion: 'Otra organización',
        nit: '900777777-1',
        representante: 'Luis Álvarez',
        tipoFeria: 'Feria campesina',
      })
      .expect(409);
  });

  it('incluye la organización en el perfil del organizador', async () => {
    organizacion = { ...ORGANIZACION_INICIAL };

    const perfil = await request(app.getHttpServer())
      .get('/perfil')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .expect(200);

    expect(perfil.body.actividadComercial).toBeUndefined();
    expect(perfil.body.organizacion).toMatchObject({
      nombreOrganizacion: 'Fundación Agroecológica del Valle',
      estado: 'pendiente_validacion',
    });
  });

  it('permite al gestor listar y ver la organización', async () => {
    organizacion = { ...ORGANIZACION_INICIAL };

    const listado = await request(app.getHttpServer())
      .get('/gestor/organizaciones?estado=pendiente_validacion')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(listado.body.datos).toHaveLength(1);
    expect(listado.body.datos[0]).toMatchObject({
      usuarioId: '7',
      nombreOrganizacion: 'Fundación Agroecológica del Valle',
    });

    const detalle = await request(app.getHttpServer())
      .get('/gestor/organizaciones/7')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(detalle.body.nit).toBe('900123456-1');
  });

  it('solo el administrador activa la organización', async () => {
    organizacion = { ...ORGANIZACION_INICIAL };

    await request(app.getHttpServer())
      .patch('/gestor/organizaciones/7/estado')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .send({ estado: 'activa' })
      .expect(403);

    const activada = await request(app.getHttpServer())
      .patch('/gestor/organizaciones/7/estado')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'activa', motivo: 'Documentación verificada' })
      .expect(200);

    expect(activada.body).toMatchObject({
      estado: 'activa',
      validadoPor: '1',
    });
    expect(prisma.notificaciones.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: 'estado_organizacion',
        asunto: 'Organización activa',
      }),
    });
  });
});
