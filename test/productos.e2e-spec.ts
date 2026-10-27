import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import '../src/common/bigint-serialization';
import { AppModule } from '../src/app.module';
import { CorreoService } from '../src/correo/correo.service';
import { PrismaService } from '../src/prisma/prisma.service';

interface UsuarioPrueba {
  id: bigint;
  nombre: string;
  apellido: string | null;
  correo: string;
  rol: 'comerciante' | 'organizador' | 'gestor';
  estado: 'activa' | 'pendiente_activacion';
  perfil: 'administrador' | 'revisor' | null;
}

interface ProductoPrueba {
  id: bigint;
  nombre: string;
  activo: boolean;
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

const USUARIOS: UsuarioPrueba[] = [ADMIN, REVISOR, COMERCIANTE, ORGANIZADOR];

const PRODUCTOS_INICIALES: readonly ProductoPrueba[] = [
  { id: 1n, nombre: 'Artesanías', activo: true },
  { id: 2n, nombre: 'Comidas rápidas', activo: true },
  { id: 3n, nombre: 'Frutas frescas', activo: true },
  { id: 4n, nombre: 'Plantas ornamentales', activo: false },
];

let productos: ProductoPrueba[] = [];

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

/** Ordena como lo haría PostgreSQL con `ORDER BY nombre`. */
function ordenarPorNombre(filas: ProductoPrueba[]): ProductoPrueba[] {
  return [...filas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

const prisma = {
  usuarios: {
    findUnique: jest.fn(),
  },
  sesiones: {
    findFirst: jest.fn(),
  },
  productos: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const correo = {
  enviarCodigoActivacion: jest.fn(),
  enviarCodigoRecuperacion: jest.fn(),
  enviarAvisoCambioPassword: jest.fn(),
  enviarCredencialesGestor: jest.fn(),
  enviarAvisoEstadoCuenta: jest.fn(),
};

describe('Productos (e2e)', () => {
  let app: INestApplication;
  let tokenAdmin: string;
  let tokenRevisor: string;
  let tokenComerciante: string;
  let tokenOrganizador: string;

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

    [tokenAdmin, tokenRevisor, tokenComerciante, tokenOrganizador] =
      await Promise.all([
        firmar(ADMIN),
        firmar(REVISOR),
        firmar(COMERCIANTE),
        firmar(ORGANIZADOR),
      ]);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    productos = PRODUCTOS_INICIALES.map((producto) => ({ ...producto }));

    prisma.usuarios.findUnique.mockImplementation(
      ({ where }: { where: { id?: bigint; correo?: string } }) => {
        const usuario = USUARIOS.find((candidato) =>
          where.id
            ? candidato.id === where.id
            : candidato.correo === where.correo,
        );
        return Promise.resolve(usuario ? filaGuard(usuario) : null);
      },
    );

    prisma.sesiones.findFirst.mockResolvedValue({ id: 1n });

    prisma.productos.findMany.mockImplementation(
      ({ where }: { where?: { activo?: boolean } }) => {
        const filtrados =
          where?.activo === undefined
            ? productos
            : productos.filter((producto) => producto.activo === where.activo);
        return Promise.resolve(ordenarPorNombre(filtrados));
      },
    );

    prisma.productos.findUnique.mockImplementation(
      ({ where }: { where: { id?: bigint; nombre?: string } }) => {
        const producto = productos.find((candidato) =>
          where.id !== undefined
            ? candidato.id === where.id
            : candidato.nombre === where.nombre,
        );
        return Promise.resolve(producto ?? null);
      },
    );

    prisma.productos.create.mockImplementation(
      ({ data }: { data: { nombre: string } }) => {
        const id = BigInt(
          productos.reduce(
            (maximo, producto) => (producto.id > maximo ? producto.id : maximo),
            0n,
          ) + 1n,
        );
        const creado: ProductoPrueba = {
          id,
          nombre: data.nombre,
          activo: true,
        };
        productos = [...productos, creado];
        return Promise.resolve(creado);
      },
    );

    prisma.productos.update.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: bigint };
        data: { activo: boolean };
      }) => {
        const indice = productos.findIndex(
          (producto) => producto.id === where.id,
        );
        productos[indice] = { ...productos[indice], ...data };
        return Promise.resolve(productos[indice]);
      },
    );

    for (const funcion of Object.values(correo)) {
      funcion.mockResolvedValue(undefined);
    }
  });

  describe('GET /productos', () => {
    it('exige autenticación', async () => {
      await request(app.getHttpServer()).get('/productos').expect(401);
    });

    it.each([
      ['comerciante', () => tokenComerciante],
      ['organizador', () => tokenOrganizador],
    ])('solo muestra productos activos al rol %s', async (_rol, token) => {
      const respuesta = await request(app.getHttpServer())
        .get('/productos')
        .set('Authorization', `Bearer ${token()}`)
        .expect(200);

      expect(respuesta.body.datos).toHaveLength(3);
      expect(
        respuesta.body.datos.every(
          (producto: ProductoPrueba) => producto.activo,
        ),
      ).toBe(true);
      expect(
        respuesta.body.datos.map((producto: ProductoPrueba) => producto.nombre),
      ).not.toContain('Plantas ornamentales');
    });

    it('muestra también los productos inactivos al gestor', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/productos')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .expect(200);

      expect(respuesta.body.datos).toHaveLength(4);
      expect(respuesta.body.datos[3]).toEqual({
        id: '4',
        nombre: 'Plantas ornamentales',
        activo: false,
      });
    });
  });

  describe('POST /productos', () => {
    it.each([
      ['administrador', () => tokenAdmin],
      ['revisor', () => tokenRevisor],
    ])('permite crear al gestor %s', async (_perfil, token) => {
      const respuesta = await request(app.getHttpServer())
        .post('/productos')
        .set('Authorization', `Bearer ${token()}`)
        .send({ nombre: '  Verduras  ' })
        .expect(201);

      expect(respuesta.body).toEqual({
        id: '5',
        nombre: 'Verduras',
        activo: true,
      });
      expect(productos.some((producto) => producto.nombre === 'Verduras')).toBe(
        true,
      );
    });

    it('prohíbe crear a un comerciante', async () => {
      await request(app.getHttpServer())
        .post('/productos')
        .set('Authorization', `Bearer ${tokenComerciante}`)
        .send({ nombre: 'Verduras' })
        .expect(403);

      expect(prisma.productos.create).not.toHaveBeenCalled();
    });

    it('rechaza con 409 un nombre duplicado', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/productos')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ nombre: 'Frutas frescas' })
        .expect(409);

      expect(respuesta.body.message).toBe(
        'Ya existe un producto con ese nombre',
      );
      expect(prisma.productos.create).not.toHaveBeenCalled();
    });

    it('rechaza campos no permitidos, como activo', async () => {
      await request(app.getHttpServer())
        .post('/productos')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ nombre: 'Verduras', activo: false })
        .expect(400);

      expect(prisma.productos.create).not.toHaveBeenCalled();
    });

    it('valida el largo del nombre', async () => {
      await request(app.getHttpServer())
        .post('/productos')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ nombre: 'X' })
        .expect(400);
    });
  });

  describe('PATCH /productos/:id', () => {
    it('activa o desactiva el producto como gestor', async () => {
      const respuesta = await request(app.getHttpServer())
        .patch('/productos/1')
        .set('Authorization', `Bearer ${tokenRevisor}`)
        .send({ activo: false })
        .expect(200);

      expect(respuesta.body).toEqual({
        id: '1',
        nombre: 'Artesanías',
        activo: false,
      });
      expect(productos.find((producto) => producto.id === 1n)?.activo).toBe(
        false,
      );
    });

    it('rechaza un identificador no numérico', async () => {
      await request(app.getHttpServer())
        .patch('/productos/abc')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ activo: false })
        .expect(400);
    });

    it('responde 404 si el producto no existe', async () => {
      await request(app.getHttpServer())
        .patch('/productos/999')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ activo: false })
        .expect(404);
    });

    it('exige el campo activo booleano', async () => {
      await request(app.getHttpServer())
        .patch('/productos/1')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({})
        .expect(400);

      await request(app.getHttpServer())
        .patch('/productos/1')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ activo: 'false' })
        .expect(400);
    });

    it('prohíbe cambiar el estado a un comerciante', async () => {
      await request(app.getHttpServer())
        .patch('/productos/1')
        .set('Authorization', `Bearer ${tokenComerciante}`)
        .send({ activo: false })
        .expect(403);
    });
  });
});
