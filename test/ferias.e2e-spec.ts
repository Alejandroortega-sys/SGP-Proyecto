import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  estado: 'activa';
  perfil: 'administrador' | 'revisor' | null;
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

const USUARIOS = [ADMIN, ORGANIZADOR, COMERCIANTE];

const ZONA = {
  id: 4n,
  nombre: 'Parque La Guadua',
  tipo: 'permitida' as const,
  activa: true,
  aforo_maximo: 25,
  horario_inicio: '06:00',
  horario_fin: '20:00',
  productos: ['Frutas frescas', 'Artesanías'],
};

const FERIA_RADICADA = {
  id: 12n,
  numero_radicado: 'FER-2026-00003',
  estado: 'radicada' as const,
};

const DATOS = {
  nombre: 'Feria Agroecológica de Primavera',
  tipoFeria: 'Feria agroecológica',
  zonaId: '4',
  fechaInicio: '2099-02-10',
  fechaFin: '2099-02-12',
  numeroPuestos: 20,
  productoIds: ['1'],
};

const PDF = Buffer.from('%PDF-1.4\ncontenido de prueba\n%%EOF');

let ocupados: { id: bigint; fecha_inicio: string; fecha_fin: string }[] = [];
let estadoOrganizacion: 'activa' | 'pendiente_validacion' = 'activa';
let rutaAdjunto: string | null = null;
let directorioSubidas = '';

const prisma = {
  usuarios: { findUnique: jest.fn() },
  sesiones: { findFirst: jest.fn() },
  organizadores: { findUnique: jest.fn() },
  productos: { findMany: jest.fn() },
  ferias: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
  },
  feria_productos: { createMany: jest.fn() },
  feria_documentos: { create: jest.fn(), findFirst: jest.fn() },
  notificaciones: { create: jest.fn() },
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  $transaction: jest.fn(),
};

const correo = {
  enviarConfirmacionFeria: jest.fn(),
};

describe('Ferias (e2e)', () => {
  let app: INestApplication;
  let tokenOrganizador: string;
  let tokenComerciante: string;
  let tokenGestor: string;

  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? 'e2e-secret-sgp-tulua-para-pruebas';
    directorioSubidas = await mkdtemp(join(tmpdir(), 'sgp-ferias-'));
    process.env.UPLOAD_PRIVATE_DIR = directorioSubidas;

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

    [tokenOrganizador, tokenComerciante, tokenGestor] = await Promise.all([
      firmar(ORGANIZADOR),
      firmar(COMERCIANTE),
      firmar(ADMIN),
    ]);
  });

  afterAll(async () => {
    await app.close();
    await rm(directorioSubidas, { recursive: true, force: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    ocupados = [];
    estadoOrganizacion = 'activa';
    rutaAdjunto = null;

    prisma.usuarios.findUnique.mockImplementation(
      ({ where }: { where: { id: bigint } }) =>
        Promise.resolve(
          USUARIOS.find((usuario) => usuario.id === where.id) ?? null,
        ),
    );
    prisma.sesiones.findFirst.mockResolvedValue({ id: 1n });
    prisma.organizadores.findUnique.mockImplementation(() =>
      Promise.resolve({ estado: estadoOrganizacion }),
    );
    prisma.productos.findMany.mockImplementation(
      ({ where }: { where?: { id?: { in?: bigint[] } } }) => {
        const catalogo = [
          { id: 1n, nombre: 'Frutas frescas' },
          { id: 2n, nombre: 'Artesanías' },
        ];
        const ids = where?.id?.in;
        return Promise.resolve(
          ids
            ? catalogo.filter((producto) => ids.includes(producto.id))
            : catalogo,
        );
      },
    );
    prisma.ferias.findMany.mockResolvedValue([]);
    prisma.ferias.count.mockResolvedValue(0);
    prisma.ferias.findFirst.mockResolvedValue(null);
    prisma.feria_productos.createMany.mockResolvedValue({ count: 1 });
    prisma.feria_documentos.create.mockImplementation(
      ({ data }: { data: { archivo_url: string } }) => {
        rutaAdjunto = data.archivo_url;
        return Promise.resolve({ id: 1n });
      },
    );
    prisma.feria_documentos.findFirst.mockResolvedValue(null);
    prisma.notificaciones.create.mockResolvedValue({ id: 1n });
    prisma.$executeRaw.mockResolvedValue(1);
    prisma.$queryRaw.mockImplementation((partes: TemplateStringsArray) => {
      const sql = partes.join(' ');
      if (sql.includes('FROM zonas')) return Promise.resolve([ZONA]);
      if (sql.includes('INSERT INTO ferias')) {
        return Promise.resolve([FERIA_RADICADA]);
      }
      if (sql.includes('FROM ferias')) return Promise.resolve(ocupados);
      return Promise.resolve([]);
    });
    prisma.$transaction.mockImplementation(
      async (callback: (cliente: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );
    correo.enviarConfirmacionFeria.mockResolvedValue(undefined);
  });

  it('lista zonas y productos para el formulario', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/ferias/zonas')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .expect(200);

    expect(respuesta.body.zonas[0]).toMatchObject({
      id: '4',
      nombre: 'Parque La Guadua',
      aforoMaximo: 25,
      admiteFerias: true,
    });
    expect(respuesta.body.productos).toHaveLength(2);
  });

  it('informa conflicto y sugiere fechas libres', async () => {
    ocupados = [
      {
        id: 1n,
        fecha_inicio: '2099-02-10',
        fecha_fin: '2099-02-12',
      },
    ];

    const respuesta = await request(app.getHttpServer())
      .get('/ferias/disponibilidad')
      .query({
        zonaId: '4',
        fechaInicio: '2099-02-10',
        fechaFin: '2099-02-12',
        numeroPuestos: 20,
      })
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .expect(200);

    expect(respuesta.body.disponible).toBe(false);
    expect(respuesta.body.conflicto).toEqual({
      fechaInicio: '2099-02-10',
      fechaFin: '2099-02-12',
    });
    expect(respuesta.body.sugerencias[0]).toEqual({
      fechaInicio: '2099-02-13',
      fechaFin: '2099-02-15',
    });
  });

  it('radica una feria con adjunto y devuelve el número FER', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/ferias')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .field('datos', JSON.stringify(DATOS))
      .attach('adjuntos', PDF, {
        filename: 'acta.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(respuesta.body).toMatchObject({
      id: '12',
      numeroRadicado: 'FER-2026-00003',
      estado: 'radicada',
      correoEnviado: true,
    });
    expect(prisma.feria_productos.createMany).toHaveBeenCalled();
    expect(prisma.feria_documentos.create).toHaveBeenCalled();
    expect(prisma.notificaciones.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: 'feria_radicada',
          feria_id: 12n,
        }),
      }),
    );
    expect(rutaAdjunto).toContain('ferias/12/');
    const contenido = await readFile(join(directorioSubidas, rutaAdjunto!));
    expect(contenido.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('rechaza un número de puestos superior al aforo', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/ferias')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .field('datos', JSON.stringify({ ...DATOS, numeroPuestos: 26 }))
      .expect(400);

    expect(respuesta.body.message).toContain('supera el aforo');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza la radicación cuando hay cruce de agenda', async () => {
    ocupados = [
      {
        id: 1n,
        fecha_inicio: '2099-02-10',
        fecha_fin: '2099-02-12',
      },
    ];

    const respuesta = await request(app.getHttpServer())
      .post('/ferias')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .field('datos', JSON.stringify(DATOS))
      .expect(409);

    expect(respuesta.body.message).toContain('ocupada');
    expect(respuesta.body.sugerencias[0]).toEqual({
      fechaInicio: '2099-02-13',
      fechaFin: '2099-02-15',
    });
  });

  it('rechaza a una organización pendiente de validación', async () => {
    estadoOrganizacion = 'pendiente_validacion';

    await request(app.getHttpServer())
      .post('/ferias')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .field('datos', JSON.stringify(DATOS))
      .expect(403);
  });

  it('rechaza adjuntos con formato no permitido', async () => {
    await request(app.getHttpServer())
      .post('/ferias')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .field('datos', JSON.stringify(DATOS))
      .attach('adjuntos', Buffer.from('texto plano'), {
        filename: 'notas.txt',
        contentType: 'text/plain',
      })
      .expect(400);
  });

  it('impide que un comerciante solicite ferias', async () => {
    await request(app.getHttpServer())
      .post('/ferias')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .field('datos', JSON.stringify(DATOS))
      .expect(403);
  });

  it('permite al gestor descargar un adjunto de la feria', async () => {
    await request(app.getHttpServer())
      .post('/ferias')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .field('datos', JSON.stringify(DATOS))
      .attach('adjuntos', PDF, {
        filename: 'acta.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    prisma.feria_documentos.findFirst.mockResolvedValue({
      archivo_url: rutaAdjunto,
      nombre_original: 'acta.pdf',
      mime_type: 'application/pdf',
    });

    const respuesta = await request(app.getHttpServer())
      .get('/ferias/12/documentos/1/archivo')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .expect(200);

    expect(respuesta.headers['content-type']).toContain('application/pdf');
    expect(respuesta.headers['content-disposition']).toContain('acta.pdf');
  });
});
