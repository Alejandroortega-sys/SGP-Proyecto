import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import '../src/common/bigint-serialization';
import { AppModule } from '../src/app.module';
import { CorreoService } from '../src/correo/correo.service';
import type { tipo_zona } from '../src/generated/prisma/client';
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

interface ZonaPrueba {
  id: bigint;
  nombre: string;
  tipo: tipo_zona;
  horario_inicio: string | null;
  horario_fin: string | null;
  aforo_maximo: number | null;
  activa: boolean;
  creado_por: bigint | null;
  geometria: unknown;
}

interface ProductoPrueba {
  id: bigint;
  nombre: string;
  activo: boolean;
}

interface ZonaProductoPrueba {
  zona_id: bigint;
  producto_id: bigint;
}

interface SqlLike {
  sql: string;
  values: unknown[];
}

const FECHA = new Date('2026-09-15T14:30:00.000Z');

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

const USUARIOS: UsuarioPrueba[] = [ADMIN, REVISOR, COMERCIANTE];

const POLIGONO = {
  type: 'Polygon',
  coordinates: [
    [
      [-76.196, 4.088],
      [-76.192, 4.088],
      [-76.192, 4.09],
      [-76.196, 4.09],
      [-76.196, 4.088],
    ],
  ],
};

const PRODUCTOS: ProductoPrueba[] = [
  { id: 1n, nombre: 'Frutas frescas', activo: true },
  { id: 2n, nombre: 'Verduras', activo: true },
  { id: 3n, nombre: 'Plantas ornamentales', activo: false },
];

const ZONAS_INICIALES: ZonaPrueba[] = [
  {
    id: 1n,
    nombre: 'Centro - Calle 30',
    tipo: 'permitida',
    horario_inicio: '06:00',
    horario_fin: '18:00',
    aforo_maximo: 40,
    activa: true,
    creado_por: 1n,
    geometria: POLIGONO,
  },
  {
    id: 2n,
    nombre: 'Plaza Boyacá',
    tipo: 'alta_congestion',
    horario_inicio: '07:00',
    horario_fin: '17:00',
    aforo_maximo: 15,
    activa: true,
    creado_por: 1n,
    geometria: POLIGONO,
  },
  {
    id: 3n,
    nombre: 'Entorno Hospital',
    tipo: 'restringida',
    horario_inicio: null,
    horario_fin: null,
    aforo_maximo: 5,
    activa: false,
    creado_por: 1n,
    geometria: POLIGONO,
  },
];

let zonas: ZonaPrueba[] = [];
let zonaProductos: ZonaProductoPrueba[] = [];

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

function esSql(valor: unknown): valor is SqlLike {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    'sql' in valor &&
    'values' in valor
  );
}

function filaDetalle(zona: ZonaPrueba) {
  return {
    id: zona.id,
    nombre: zona.nombre,
    tipo: zona.tipo,
    horario_inicio: zona.horario_inicio,
    horario_fin: zona.horario_fin,
    aforo_maximo: zona.aforo_maximo,
    activa: zona.activa,
    creado_por: zona.creado_por,
    creado_en: FECHA,
    actualizado_en: FECHA,
    geometria: zona.geometria,
  };
}

function filaListado(zona: ZonaPrueba) {
  return {
    id: zona.id,
    nombre: zona.nombre,
    tipo: zona.tipo,
    horario_inicio: zona.horario_inicio,
    horario_fin: zona.horario_fin,
    aforo_maximo: zona.aforo_maximo,
    activa: zona.activa,
    total_espacios: zona.id === 1n ? 2 : 0,
    total_modulos: zona.id === 1n ? 3 : 0,
    creado_en: FECHA,
    actualizado_en: FECHA,
  };
}

function filaGeoJson(zona: ZonaPrueba) {
  const productos = zonaProductos
    .filter((asociacion) => asociacion.zona_id === zona.id)
    .map((asociacion) =>
      PRODUCTOS.find((producto) => producto.id === asociacion.producto_id),
    )
    .filter((producto): producto is ProductoPrueba => producto?.activo === true)
    .map((producto) => producto.nombre)
    .sort();

  return {
    id: zona.id,
    nombre: zona.nombre,
    tipo: zona.tipo,
    horario_inicio: zona.horario_inicio,
    horario_fin: zona.horario_fin,
    aforo_maximo: zona.aforo_maximo,
    geometria: zona.geometria,
    productos,
  };
}

function aplicarFiltros(where: unknown): ZonaPrueba[] {
  if (!esSql(where) || where.sql === '') {
    return zonas;
  }

  let filtradas = zonas;
  let indice = 0;

  if (where.sql.includes('z.tipo')) {
    const tipo = where.values[indice++] as tipo_zona;
    filtradas = filtradas.filter((zona) => zona.tipo === tipo);
  }
  if (where.sql.includes('z.activa')) {
    const activa = where.values[indice++] as boolean;
    filtradas = filtradas.filter((zona) => zona.activa === activa);
  }
  if (where.sql.includes('z.nombre')) {
    const patron = where.values[indice++] as string;
    const termino = patron.slice(1, -1).toLowerCase();
    filtradas = filtradas.filter((zona) =>
      zona.nombre.toLowerCase().includes(termino),
    );
  }

  return filtradas;
}

const prisma = {
  usuarios: { findUnique: jest.fn() },
  sesiones: { findFirst: jest.fn() },
  productos: { findMany: jest.fn() },
  zona_productos: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  $transaction: jest.fn(),
};

const correo = {
  enviarCodigoActivacion: jest.fn(),
  enviarCodigoRecuperacion: jest.fn(),
  enviarAvisoCambioPassword: jest.fn(),
  enviarCredencialesGestor: jest.fn(),
  enviarAvisoEstadoCuenta: jest.fn(),
};

describe('Zonas (e2e)', () => {
  let app: INestApplication;
  let tokenAdmin: string;
  let tokenRevisor: string;
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

    [tokenAdmin, tokenRevisor, tokenComerciante] = await Promise.all([
      firmar(ADMIN),
      firmar(REVISOR),
      firmar(COMERCIANTE),
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    zonas = ZONAS_INICIALES.map((zona) => ({ ...zona }));
    zonaProductos = [
      { zona_id: 1n, producto_id: 1n },
      { zona_id: 1n, producto_id: 2n },
      { zona_id: 2n, producto_id: 1n },
      { zona_id: 2n, producto_id: 3n },
    ];

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
      ({ where }: { where: { id: { in: bigint[] } } }) =>
        Promise.resolve(
          PRODUCTOS.filter((producto) => where.id.in.includes(producto.id)),
        ),
    );

    prisma.zona_productos.findMany.mockImplementation(
      ({ where }: { where: { zona_id: bigint } }) =>
        Promise.resolve(
          zonaProductos
            .filter((asociacion) => asociacion.zona_id === where.zona_id)
            .map((asociacion) => ({
              productos: PRODUCTOS.find(
                (producto) => producto.id === asociacion.producto_id,
              ),
            })),
        ),
    );
    prisma.zona_productos.deleteMany.mockImplementation(
      ({ where }: { where: { zona_id: bigint } }) => {
        zonaProductos = zonaProductos.filter(
          (asociacion) => asociacion.zona_id !== where.zona_id,
        );
        return Promise.resolve({ count: 0 });
      },
    );
    prisma.zona_productos.createMany.mockImplementation(
      ({ data }: { data: ZonaProductoPrueba[] }) => {
        zonaProductos = [...zonaProductos, ...data];
        return Promise.resolve({ count: data.length });
      },
    );

    prisma.$executeRaw.mockResolvedValue(1);
    prisma.$transaction.mockImplementation(
      (callback: (cliente: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );

    prisma.$queryRaw.mockImplementation(
      (strings: TemplateStringsArray, ...valores: unknown[]) => {
        const sql = strings.join('?');

        if (sql.includes('INSERT INTO zonas')) {
          const nuevoId = BigInt(
            zonas.reduce(
              (maximo, zona) => (zona.id > maximo ? zona.id : maximo),
              0n,
            ) + 1n,
          );
          const zona: ZonaPrueba = {
            id: nuevoId,
            nombre: valores[0] as string,
            tipo: valores[1] as tipo_zona,
            horario_inicio: valores[3] as string | null,
            horario_fin: valores[4] as string | null,
            aforo_maximo: valores[5] as number | null,
            activa: true,
            creado_por: valores[6] as bigint,
            geometria: POLIGONO,
          };
          zonas = [...zonas, zona];
          return Promise.resolve([filaDetalle(zona)]);
        }

        if (sql.includes('UPDATE zonas') && sql.includes('SET activa = ?')) {
          const activa = valores[0] as boolean;
          const id = valores[1] as bigint;
          const zona = zonas.find((candidata) => candidata.id === id);
          if (!zona) {
            return Promise.resolve([]);
          }
          zona.activa = activa;
          return Promise.resolve([
            {
              id: zona.id,
              nombre: zona.nombre,
              activa: zona.activa,
              actualizado_en: FECHA,
            },
          ]);
        }

        if (sql.includes('UPDATE zonas')) {
          const id = valores[valores.length - 2] as bigint;
          const zona = zonas.find((candidata) => candidata.id === id);
          return Promise.resolve(zona ? [filaDetalle(zona)] : []);
        }

        if (sql.includes('COUNT(*)::int AS total')) {
          return Promise.resolve([
            { total: aplicarFiltros(valores[0]).length },
          ]);
        }

        if (sql.includes('total_espacios')) {
          const filtradas = aplicarFiltros(valores[0]);
          const limite = valores[1] as number;
          const offset = valores[2] as number;
          return Promise.resolve(
            filtradas.slice(offset, offset + limite).map(filaListado),
          );
        }

        if (sql.includes('FROM zonas z') && sql.includes('jsonb_agg')) {
          return Promise.resolve(
            zonas
              .filter((zona) => zona.activa)
              .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
              .map(filaGeoJson),
          );
        }

        if (sql.includes('FROM zonas') && sql.includes('WHERE id = ?')) {
          const id = valores[valores.length - 1] as bigint;
          const zona = zonas.find((candidata) => candidata.id === id);
          return Promise.resolve(zona ? [filaDetalle(zona)] : []);
        }

        throw new Error(`Consulta no simulada: ${sql}`);
      },
    );

    for (const funcion of Object.values(correo)) {
      funcion.mockResolvedValue(undefined);
    }
  });

  describe('GET /zonas/geojson', () => {
    it('es público y devuelve solo las zonas activas como FeatureCollection', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/zonas/geojson')
        .expect(200);

      expect(respuesta.body.type).toBe('FeatureCollection');
      expect(respuesta.body.features).toHaveLength(2);
      expect(
        respuesta.body.features.map(
          (feature: { properties: { nombre: string } }) =>
            feature.properties.nombre,
        ),
      ).not.toContain('Entorno Hospital');
      expect(respuesta.body.features[0]).toMatchObject({
        type: 'Feature',
        geometry: { type: 'Polygon' },
        properties: {
          id: '1',
          nombre: 'Centro - Calle 30',
          tipo: 'permitida',
          horarios: { inicio: '06:00', fin: '18:00' },
          aforo: 40,
          productos: ['Frutas frescas', 'Verduras'],
        },
      });
    });

    it('no es capturado por la ruta /zonas/:id', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/zonas/geojson')
        .expect(200);

      expect(respuesta.body.type).toBe('FeatureCollection');
    });
  });

  describe('GET /zonas', () => {
    it('exige autenticación', async () => {
      await request(app.getHttpServer()).get('/zonas').expect(401);
    });

    it.each([
      ['administrador', () => tokenAdmin],
      ['revisor', () => tokenRevisor],
    ])('permite listar al gestor %s', async (_perfil, token) => {
      const respuesta = await request(app.getHttpServer())
        .get('/zonas')
        .set('Authorization', `Bearer ${token()}`)
        .expect(200);

      expect(respuesta.body.datos).toHaveLength(3);
      expect(respuesta.body.paginacion).toEqual({
        pagina: 1,
        limite: 20,
        total: 3,
        totalPaginas: 1,
      });
      expect(respuesta.body.datos[0]).not.toHaveProperty('geometria');
      expect(respuesta.body.datos[0]).toMatchObject({
        id: '1',
        totalEspacios: 2,
        totalModulos: 3,
      });
    });

    it('prohíbe listar a un comerciante', async () => {
      await request(app.getHttpServer())
        .get('/zonas')
        .set('Authorization', `Bearer ${tokenComerciante}`)
        .expect(403);
    });

    it('aplica los filtros de tipo, activo y búsqueda', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/zonas')
        .query({ tipo: 'permitida', activo: true, busqueda: 'Centro' })
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .expect(200);

      expect(respuesta.body.datos).toHaveLength(1);
      expect(respuesta.body.datos[0].nombre).toBe('Centro - Calle 30');
    });
  });

  describe('GET /zonas/:id', () => {
    it('devuelve atributos, geometría y productos permitidos', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/zonas/1')
        .set('Authorization', `Bearer ${tokenRevisor}`)
        .expect(200);

      expect(respuesta.body).toMatchObject({
        id: '1',
        nombre: 'Centro - Calle 30',
        creadoPor: '1',
        geometria: { type: 'Polygon' },
        productosPermitidos: [
          { id: '1', nombre: 'Frutas frescas', activo: true },
          { id: '2', nombre: 'Verduras', activo: true },
        ],
      });
    });

    it('responde 400 con un id no numérico y 404 si no existe', async () => {
      await request(app.getHttpServer())
        .get('/zonas/abc')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .expect(400);

      await request(app.getHttpServer())
        .get('/zonas/999')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .expect(404);
    });

    it('prohíbe el detalle a un comerciante', async () => {
      await request(app.getHttpServer())
        .get('/zonas/1')
        .set('Authorization', `Bearer ${tokenComerciante}`)
        .expect(403);
    });
  });

  describe('POST /zonas', () => {
    const cuerpo = {
      nombre: 'Parque La Guadua',
      tipo: 'permitida',
      geometria: POLIGONO,
      horarioInicio: '08:00',
      horarioFin: '16:00',
      aforoMaximo: 25,
      productosPermitidos: ['1', '2'],
    };

    it('prohíbe crear al revisor y al comerciante', async () => {
      await request(app.getHttpServer())
        .post('/zonas')
        .set('Authorization', `Bearer ${tokenRevisor}`)
        .send(cuerpo)
        .expect(403);

      await request(app.getHttpServer())
        .post('/zonas')
        .set('Authorization', `Bearer ${tokenComerciante}`)
        .send(cuerpo)
        .expect(403);
    });

    it('crea la zona como administrador', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/zonas')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(cuerpo)
        .expect(201);

      expect(respuesta.body).toMatchObject({
        id: '4',
        nombre: 'Parque La Guadua',
        tipo: 'permitida',
        horarioInicio: '08:00',
        horarioFin: '16:00',
        aforoMaximo: 25,
        activa: true,
        creadoPor: '1',
        productosPermitidos: [
          { id: '1', nombre: 'Frutas frescas', activo: true },
          { id: '2', nombre: 'Verduras', activo: true },
        ],
      });
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('valida el tipo y la geometría', async () => {
      await request(app.getHttpServer())
        .post('/zonas')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ ...cuerpo, tipo: 'otro' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/zonas')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ ...cuerpo, geometria: { type: 'Polygon', coordinates: [] } })
        .expect(400);
    });

    it('valida horarios y productos inactivos', async () => {
      await request(app.getHttpServer())
        .post('/zonas')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ ...cuerpo, horarioFin: '07:00' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/zonas')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ ...cuerpo, productosPermitidos: ['3'] })
        .expect(400);
    });
  });

  describe('PATCH /zonas/:id', () => {
    it('prohíbe editar al revisor', async () => {
      await request(app.getHttpServer())
        .patch('/zonas/1')
        .set('Authorization', `Bearer ${tokenRevisor}`)
        .send({ nombre: 'Centro renovado' })
        .expect(403);
    });

    it('edita la zona como administrador', async () => {
      zonas[0].nombre = 'Centro renovado';

      const respuesta = await request(app.getHttpServer())
        .patch('/zonas/1')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ nombre: 'Centro renovado' })
        .expect(200);

      expect(respuesta.body.nombre).toBe('Centro renovado');
    });

    it('rechaza un cuerpo vacío y valida los campos', async () => {
      await request(app.getHttpServer())
        .patch('/zonas/1')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({})
        .expect(400);

      await request(app.getHttpServer())
        .patch('/zonas/1')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ tipo: 'otro' })
        .expect(400);
    });
  });

  describe('PATCH /zonas/:id/estado', () => {
    it('prohíbe cambiar el estado al revisor', async () => {
      await request(app.getHttpServer())
        .patch('/zonas/1/estado')
        .set('Authorization', `Bearer ${tokenRevisor}`)
        .send({ activa: false })
        .expect(403);
    });

    it('cambia el estado como administrador', async () => {
      const respuesta = await request(app.getHttpServer())
        .patch('/zonas/1/estado')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ activa: false })
        .expect(200);

      expect(respuesta.body).toMatchObject({
        id: '1',
        activa: false,
        mensaje: 'Zona desactivada.',
      });
      expect(zonas[0].activa).toBe(false);
    });
  });

  describe('rate limit del GeoJSON', () => {
    it('responde 429 al superar 60 peticiones por minuto desde la misma IP', async () => {
      let bloqueado = false;

      for (let intento = 0; intento < 70; intento += 1) {
        const respuesta = await request(app.getHttpServer()).get(
          '/zonas/geojson',
        );
        if (respuesta.status === 429) {
          bloqueado = true;
          break;
        }
        expect(respuesta.status).toBe(200);
      }

      expect(bloqueado).toBe(true);
    });
  });
});
