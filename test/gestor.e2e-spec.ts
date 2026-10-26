import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import '../src/common/bigint-serialization';
import { AppModule } from '../src/app.module';
import { CorreoService } from '../src/correo/correo.service';
import type {
  estado_usuario,
  perfil_gestor,
  rol_usuario,
} from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';

const FECHA = new Date('2026-09-15T14:30:00.000Z');

/** Hashes del seed (dataBase/02_seed_datos_prueba.sql). */
const HASH_ADMIN =
  '$argon2id$v=19$m=19456,p=1,t=2$AaTvzKel+egX7v1p9qj7aA$rbPRFYUU/QDiyIP5Zo31mRttjl8D0WuEWj/35jCHQTk';
const HASH_REVISOR =
  '$argon2id$v=19$m=19456,p=1,t=2$EKvrsQRpmO5Mw1zihKyW/A$BrkhKD68THGfyQzx8lLR8NM+J3VByjmJBiHxaIu89aw';
const HASH_TEMPORAL =
  '$argon2id$v=19$m=19456,p=1,t=2$ZsuI7gv2rYDydxc56UPuQA$v61N33PiEmvTI16ia9koNaF6MjW/k8Ayq6caCyEydaE';

const PASSWORD_TEMPORAL = 'Comerciante123';
const PASSWORD_NUEVA = 'NuevaClave456';

interface UsuarioPrueba {
  id: bigint;
  nombre: string;
  apellido: string | null;
  telefono?: string | null;
  correo: string;
  password_hash: string | null;
  rol: rol_usuario;
  estado: estado_usuario;
  perfil: perfil_gestor | null;
}

const ADMIN: UsuarioPrueba = {
  id: 1n,
  nombre: 'Laura',
  apellido: 'Martínez',
  correo: 'admin@tulua.gov.co',
  password_hash: HASH_ADMIN,
  rol: 'gestor',
  estado: 'activa',
  perfil: 'administrador',
};

const REVISOR: UsuarioPrueba = {
  id: 2n,
  nombre: 'Carlos',
  apellido: 'Ramírez',
  correo: 'revisor@tulua.gov.co',
  password_hash: HASH_REVISOR,
  rol: 'gestor',
  estado: 'activa',
  perfil: 'revisor',
};

const OTRO_ADMIN: UsuarioPrueba = {
  id: 5n,
  nombre: 'Marta',
  apellido: 'Cifuentes',
  correo: 'otro.admin@tulua.gov.co',
  password_hash: HASH_ADMIN,
  rol: 'gestor',
  estado: 'activa',
  perfil: 'administrador',
};

const GESTOR_PENDIENTE: UsuarioPrueba = {
  id: 9n,
  nombre: 'Ana',
  apellido: 'López',
  correo: 'ana.lopez@tulua.gov.co',
  password_hash: HASH_TEMPORAL,
  rol: 'gestor',
  estado: 'pendiente_activacion',
  perfil: 'revisor',
};

const ORGANIZADOR: UsuarioPrueba = {
  id: 7n,
  nombre: 'Luis',
  apellido: 'Álvarez',
  correo: 'luis.alvarez@agrovalle.org',
  password_hash: null,
  rol: 'organizador',
  estado: 'activa',
  perfil: null,
};

const COMERCIANTE: UsuarioPrueba = {
  id: 4n,
  nombre: 'José',
  apellido: 'Pérez',
  correo: 'jose.perez@hotmail.com',
  password_hash: null,
  rol: 'comerciante',
  estado: 'activa',
  perfil: null,
};

/** Convierte un usuario de prueba en la fila del listado general. */
function filaUsuario(usuario: UsuarioPrueba) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    correo: usuario.correo,
    documento: usuario.rol === 'comerciante' ? '801234567' : null,
    telefono: usuario.rol === 'comerciante' ? '3147788990' : null,
    rol: usuario.rol,
    estado: usuario.estado,
    creado_en: FECHA,
    gestores_gestores_usuario_idTousuarios: usuario.perfil
      ? { perfil: usuario.perfil }
      : null,
    comerciantes:
      usuario.rol === 'comerciante'
        ? { categoria: 'informal', actividad_comercial: 'Comidas rápidas' }
        : null,
    organizadores_organizadores_usuario_idTousuarios:
      usuario.rol === 'organizador'
        ? { nombre_organizacion: 'Fundación Agroecológica del Valle' }
        : null,
  };
}

/** Convierte un usuario de prueba en la fila del detalle. */
function detalleUsuario(usuario: UsuarioPrueba) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    tipo_documento: usuario.rol === 'comerciante' ? 'CC' : null,
    documento: usuario.rol === 'comerciante' ? '801234567' : null,
    telefono: usuario.telefono ?? (usuario.rol === 'comerciante' ? '3147788990' : null),
    correo: usuario.correo,
    rol: usuario.rol,
    estado: usuario.estado,
    creado_en: FECHA,
    actualizado_en: FECHA,
    gestores_gestores_usuario_idTousuarios: usuario.perfil
      ? { perfil: usuario.perfil, creado_por: 1n }
      : null,
    organizadores_organizadores_usuario_idTousuarios:
      usuario.rol === 'organizador'
        ? {
            nombre_organizacion: 'Fundación Agroecológica del Valle',
            nit: '900123456-1',
            representante: 'Luis Álvarez',
            tipo_feria: 'Feria agroecológica',
            contacto: '3105551234',
            estado: 'activa',
            validado_en: FECHA,
          }
        : null,
    comerciantes:
      usuario.rol === 'comerciante'
        ? {
            actividad_comercial: 'Comidas rápidas',
            categoria: 'informal',
            actualizado_en: FECHA,
            solicitudes: [],
            permisos: [],
          }
        : null,
  };
}

/** Prisma simulado para e2e: no toca la base de datos real. */
const prisma = {
  usuarios: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  notificaciones: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  auditoria: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  sesiones: {
    deleteMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  $transaction: jest.fn(),
};

const correo = {
  enviarCredencialesGestor: jest.fn(),
  enviarCodigoActivacion: jest.fn(),
  enviarCodigoRecuperacion: jest.fn(),
  enviarAvisoCambioPassword: jest.fn(),
  enviarAvisoEstadoCuenta: jest.fn(),
};

describe('Gestor (e2e)', () => {
  let app: INestApplication;
  let usuarios: UsuarioPrueba[];
  let administradoresActivos: number;
  let totalListado: number;
  let tokenAdmin: string;
  let tokenRevisor: string;

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
    tokenAdmin = await jwt.signAsync(
      {
        sub: ADMIN.id.toString(),
        correo: ADMIN.correo,
        rol: 'gestor',
        perfil: 'administrador',
        sid: '1',
      },
      { expiresIn: 1_800 },
    );
    tokenRevisor = await jwt.signAsync(
      {
        sub: REVISOR.id.toString(),
        correo: REVISOR.correo,
        rol: 'gestor',
        perfil: 'revisor',
        sid: '2',
      },
      { expiresIn: 1_800 },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usuarios = [
      ADMIN,
      REVISOR,
      OTRO_ADMIN,
      GESTOR_PENDIENTE,
      ORGANIZADOR,
      COMERCIANTE,
    ].map((usuario) => ({ ...usuario }));
    administradoresActivos = 2;
    totalListado = 0;

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
        if (select && 'password_hash' in select) {
          return Promise.resolve({
            id: usuario.id,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            correo: usuario.correo,
            password_hash: usuario.password_hash,
            rol: usuario.rol,
            estado: usuario.estado,
            gestores_gestores_usuario_idTousuarios: usuario.perfil
              ? { perfil: usuario.perfil }
              : null,
          });
        }
        if (select && 'actualizado_en' in select) {
          return Promise.resolve(detalleUsuario(usuario));
        }
        return Promise.resolve({
          id: usuario.id,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          correo: usuario.correo,
          rol: usuario.rol,
          estado: usuario.estado,
          gestores_gestores_usuario_idTousuarios: usuario.perfil
            ? { perfil: usuario.perfil }
            : null,
        });
      },
    );

    prisma.usuarios.findMany.mockResolvedValue([]);
    prisma.usuarios.count.mockImplementation(
      ({ where }: { where?: { rol?: string; estado?: string } }) => {
        if (where?.rol === 'gestor' && where.estado === 'activa') {
          return Promise.resolve(administradoresActivos);
        }
        return Promise.resolve(totalListado);
      },
    );
    prisma.usuarios.create.mockImplementation(
      ({
        data,
      }: {
        data: {
          nombre: string;
          apellido?: string;
          correo: string;
          password_hash: string;
          estado: estado_usuario;
          gestores_gestores_usuario_idTousuarios: {
            create: { perfil: perfil_gestor };
          };
        };
      }) => {
        const usuario: UsuarioPrueba = {
          id: 10n,
          nombre: data.nombre,
          apellido: data.apellido ?? null,
          correo: data.correo,
          password_hash: data.password_hash,
          rol: 'gestor',
          estado: data.estado,
          perfil: data.gestores_gestores_usuario_idTousuarios.create.perfil,
        };
        usuarios.push(usuario);
        return Promise.resolve({
          id: usuario.id,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          correo: usuario.correo,
          estado: usuario.estado,
          gestores_gestores_usuario_idTousuarios: { perfil: usuario.perfil },
        });
      },
    );
    prisma.usuarios.update.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: bigint };
        data: Partial<UsuarioPrueba> & { actualizado_en?: Date };
      }) => {
        const usuario = usuarios.find((candidato) => candidato.id === where.id);
        if (!usuario) {
          return Promise.reject(new Error('Usuario inexistente'));
        }
        if (data.estado) {
          usuario.estado = data.estado;
        }
        if (data.password_hash) {
          usuario.password_hash = data.password_hash;
        }
        if (data.nombre !== undefined) {
          usuario.nombre = data.nombre;
        }
        if (data.apellido !== undefined) {
          usuario.apellido = data.apellido;
        }
        if (data.telefono !== undefined) {
          usuario.telefono = data.telefono;
        }
        return Promise.resolve({
          id: usuario.id,
          nombre: usuario.nombre,
          correo: usuario.correo,
          estado: usuario.estado,
        });
      },
    );
    prisma.notificaciones.create.mockResolvedValue(undefined);
    prisma.notificaciones.findMany.mockResolvedValue([]);
    prisma.notificaciones.count.mockResolvedValue(0);
    prisma.notificaciones.findFirst.mockResolvedValue(null);
    prisma.notificaciones.updateMany.mockResolvedValue({ count: 0 });
    prisma.auditoria.findMany.mockResolvedValue([]);
    prisma.auditoria.count.mockResolvedValue(0);
    prisma.sesiones.deleteMany.mockResolvedValue({ count: 0 });
    prisma.sesiones.create.mockResolvedValue({ id: 1n });
    prisma.sesiones.findFirst.mockResolvedValue({ id: 1n });
    prisma.sesiones.update.mockResolvedValue({});
    prisma.sesiones.updateMany.mockResolvedValue({ count: 1 });
    prisma.$queryRaw.mockResolvedValue([{ bloqueado: false, minutos: 0 }]);
    prisma.$executeRaw.mockResolvedValue(1);
    prisma.$transaction.mockImplementation(
      async (callback: (cliente: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );

    correo.enviarCredencialesGestor.mockResolvedValue(undefined);
    correo.enviarCodigoActivacion.mockResolvedValue(undefined);
    correo.enviarCodigoRecuperacion.mockResolvedValue(undefined);
    correo.enviarAvisoCambioPassword.mockResolvedValue(undefined);
    correo.enviarAvisoEstadoCuenta.mockResolvedValue(undefined);
  });

  it('exige token para el listado general', async () => {
    await request(app.getHttpServer()).get('/gestor/usuarios').expect(401);
  });

  it('el login de un gestor pendiente devuelve el reto de cambio', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        correo: GESTOR_PENDIENTE.correo,
        password: PASSWORD_TEMPORAL,
      })
      .expect(200);

    expect(respuesta.body).toMatchObject({
      requiereCambioPassword: true,
      correo: GESTOR_PENDIENTE.correo,
      nombre: 'Ana',
      perfil: 'revisor',
    });
    expect(respuesta.body.accessToken).toBeUndefined();
  });

  it('completa el primer acceso y permite iniciar sesión con la nueva contraseña', async () => {
    const cambio = await request(app.getHttpServer())
      .post('/auth/gestor/primer-acceso')
      .send({
        correo: GESTOR_PENDIENTE.correo,
        passwordActual: PASSWORD_TEMPORAL,
        password: PASSWORD_NUEVA,
        confirmarPassword: PASSWORD_NUEVA,
      })
      .expect(200);

    expect(cambio.body.accessToken).toBeDefined();
    expect(cambio.body.usuario.estado).toBe('activa');
    expect(
      usuarios.find((u) => u.correo === GESTOR_PENDIENTE.correo)?.estado,
    ).toBe('activa');

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo: GESTOR_PENDIENTE.correo, password: PASSWORD_NUEVA })
      .expect(200);

    expect(login.body.requiereCambioPassword).toBe(false);
    expect(login.body.accessToken).toBeDefined();
  });

  it('el administrador lista cualquier cuenta y el revisor solo comerciantes y organizadores', async () => {
    prisma.usuarios.findMany.mockResolvedValue([
      filaUsuario(ADMIN),
      filaUsuario(ORGANIZADOR),
    ]);
    totalListado = 2;

    const admin = await request(app.getHttpServer())
      .get('/gestor/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(admin.body.datos).toHaveLength(2);
    expect(admin.body.datos[0]).toMatchObject({
      rol: 'gestor',
      perfil: 'administrador',
    });
    expect(admin.body.datos[1]).toMatchObject({
      rol: 'organizador',
      nombreOrganizacion: 'Fundación Agroecológica del Valle',
    });

    prisma.usuarios.findMany.mockResolvedValue([filaUsuario(ORGANIZADOR)]);
    totalListado = 1;

    const revisor = await request(app.getHttpServer())
      .get('/gestor/usuarios')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .expect(200);

    expect(revisor.body.datos).toHaveLength(1);
    const args = prisma.usuarios.findMany.mock.calls.at(-1)?.[0];
    expect(args.where.AND).toEqual(
      expect.arrayContaining([{ rol: { in: ['comerciante', 'organizador'] } }]),
    );
  });

  it('el revisor no puede filtrar por gestor', async () => {
    await request(app.getHttpServer())
      .get('/gestor/usuarios?rol=gestor')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .expect(403);
  });

  it('el revisor puede ver un organizador pero no un gestor', async () => {
    const organizador = await request(app.getHttpServer())
      .get('/gestor/usuarios/7')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .expect(200);

    expect(organizador.body.usuario.rol).toBe('organizador');
    expect(organizador.body.usuario.organizacion?.nombreOrganizacion).toBe(
      'Fundación Agroecológica del Valle',
    );

    await request(app.getHttpServer())
      .get('/gestor/usuarios/1')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .expect(403);
  });

  it('solo el administrador puede crear gestores', async () => {
    await request(app.getHttpServer())
      .post('/gestor/gestores')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .send({
        nombre: 'Nuevo',
        correo: 'nuevo.revisor@tulua.gov.co',
        perfil: 'revisor',
      })
      .expect(403);

    const creado = await request(app.getHttpServer())
      .post('/gestor/gestores')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        nombre: 'Nuevo',
        apellido: 'Gestor',
        correo: 'nuevo.revisor@tulua.gov.co',
        perfil: 'revisor',
      })
      .expect(201);

    expect(creado.body).toMatchObject({
      id: '10',
      nombre: 'Nuevo',
      apellido: 'Gestor',
      correo: 'nuevo.revisor@tulua.gov.co',
      perfil: 'revisor',
      estado: 'pendiente_activacion',
    });
    expect(creado.body).not.toHaveProperty('password');
    expect(correo.enviarCredencialesGestor).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('el administrador no puede desactivar su propia cuenta', async () => {
    await request(app.getHttpServer())
      .patch('/gestor/usuarios/1/estado')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'suspendida' })
      .expect(403);
  });

  it('exige al menos dos administradores activos para desactivar a otro administrador', async () => {
    administradoresActivos = 1;

    await request(app.getHttpServer())
      .patch('/gestor/usuarios/5/estado')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'suspendida' })
      .expect(409);

    administradoresActivos = 2;

    const cambio = await request(app.getHttpServer())
      .patch('/gestor/usuarios/5/estado')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'suspendida' })
      .expect(200);

    expect(cambio.body.estado).toBe('suspendida');
    expect(correo.enviarAvisoEstadoCuenta).toHaveBeenCalledWith(
      OTRO_ADMIN.correo,
      OTRO_ADMIN.nombre,
      'suspendida',
      undefined,
    );
  });

  it('devuelve la sesión actual en /auth/me', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(respuesta.body).toMatchObject({
      id: '1',
      nombre: ADMIN.nombre,
      correo: ADMIN.correo,
      rol: 'gestor',
      perfil: 'administrador',
      estado: 'activa',
    });
  });

  it('cierra sesión y revoca la sesión en la base de datos', async () => {
    const jwt = app.get(JwtService);
    const token = await jwt.signAsync(
      {
        sub: ADMIN.id.toString(),
        correo: ADMIN.correo,
        rol: 'gestor',
        perfil: 'administrador',
        sid: '999',
      },
      { expiresIn: 600 },
    );

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    expect(prisma.sesiones.updateMany).toHaveBeenCalledWith({
      where: {
        id: 999n,
        usuario_id: ADMIN.id,
        revocada_en: null,
      },
      data: { revocada_en: expect.any(Date) },
    });

    prisma.sesiones.findFirst.mockResolvedValueOnce(null);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('permite consultar y actualizar el perfil del gestor', async () => {
    const perfil = await request(app.getHttpServer())
      .get('/gestor/perfil')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(perfil.body).toMatchObject({
      id: '1',
      nombre: ADMIN.nombre,
      correo: ADMIN.correo,
      perfil: 'administrador',
    });

    const actualizado = await request(app.getHttpServer())
      .patch('/gestor/perfil')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Laura Actualizada', telefono: '3115550000' })
      .expect(200);

    expect(actualizado.body).toMatchObject({
      nombre: 'Laura Actualizada',
      telefono: '3115550000',
    });
  });

  it('reenvía la invitación a un gestor pendiente', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/gestor/gestores/9/reenviar-invitacion')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(respuesta.body).toMatchObject({
      id: '9',
      correo: GESTOR_PENDIENTE.correo,
      perfil: 'revisor',
    });
    expect(correo.enviarCredencialesGestor).toHaveBeenCalledTimes(1);
  });

  it('solo el administrador puede consultar la auditoría y sin datos sensibles', async () => {
    prisma.auditoria.findMany.mockResolvedValue([
      {
        id: 101n,
        tabla: 'usuarios',
        registro_id: 5n,
        accion: 'update',
        valor_anterior: { nombre: 'José', password_hash: 'hash-viejo' },
        valor_nuevo: { nombre: 'José Antonio', password_hash: 'hash-nuevo' },
        creado_en: new Date('2026-09-20T10:00:00.000Z'),
        usuarios: {
          id: 1n,
          nombre: 'Laura',
          apellido: 'Martínez',
          correo: 'admin@tulua.gov.co',
        },
      },
    ]);
    prisma.auditoria.count.mockResolvedValue(1);

    await request(app.getHttpServer())
      .get('/gestor/auditoria')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .expect(403);

    const respuesta = await request(app.getHttpServer())
      .get('/gestor/auditoria?tabla=usuarios&registroId=5')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(respuesta.body.datos[0].valorAnterior).toEqual({ nombre: 'José' });
    expect(respuesta.body.datos[0].valorNuevo).toEqual({
      nombre: 'José Antonio',
    });
    expect(respuesta.body.datos[0].actor).toMatchObject({
      id: '1',
      correo: 'admin@tulua.gov.co',
    });
  });

  it('lista y marca notificaciones propias', async () => {
    prisma.notificaciones.findMany.mockResolvedValue([
      {
        id: 12n,
        tipo: 'cambio_password',
        asunto: 'Contraseña actualizada',
        cuerpo: 'Tu contraseña cambió',
        canal: 'app',
        leida: false,
        creada_en: new Date('2026-09-20T10:00:00.000Z'),
      },
    ]);
    prisma.notificaciones.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    const listado = await request(app.getHttpServer())
      .get('/notificaciones')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(listado.body).toMatchObject({
      noLeidas: 1,
      paginacion: { pagina: 1, limite: 20, total: 1, totalPaginas: 1 },
    });
    expect(listado.body.datos[0]).toMatchObject({
      id: '12',
      asunto: 'Contraseña actualizada',
      leida: false,
    });

    prisma.notificaciones.findFirst.mockResolvedValue({ id: 12n });
    prisma.notificaciones.update.mockResolvedValue({
      id: 12n,
      tipo: 'cambio_password',
      asunto: 'Contraseña actualizada',
      cuerpo: 'Tu contraseña cambió',
      canal: 'app',
      leida: true,
      creada_en: new Date('2026-09-20T10:00:00.000Z'),
    });

    const actualizada = await request(app.getHttpServer())
      .patch('/notificaciones/12/leida')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ leida: true })
      .expect(200);

    expect(actualizada.body.leida).toBe(true);
  });

  it('el revisor no puede cambiar estados', async () => {
    await request(app.getHttpServer())
      .patch('/gestor/usuarios/4/estado')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .send({ estado: 'suspendida' })
      .expect(403);
  });
});
