import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import '../src/common/bigint-serialization';
import { AppModule } from '../src/app.module';
import { CorreoService } from '../src/correo/correo.service';
import { PrismaService } from '../src/prisma/prisma.service';

interface UsuarioPrueba {
  id: bigint;
  nombre: string;
  apellido: string | null;
  correo: string;
  rol: 'gestor' | 'comerciante';
  estado: 'activa';
  perfil: 'administrador' | 'revisor' | null;
}

interface SqlLike {
  strings: string[];
  values: unknown[];
}

const FECHA = new Date('2026-10-01T12:00:00.000Z');
const PUNTO = { type: 'Point', coordinates: [-76.1955, 4.0885] };
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

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
  nombre: 'Ana',
  apellido: 'López',
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

const USUARIOS = [ADMIN, REVISOR, COMERCIANTE];

function esSql(valor: unknown): valor is SqlLike {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    'strings' in valor &&
    'values' in valor
  );
}

function sqlDe(llamada: unknown[]): string {
  const textos: string[] = [];
  const recorrer = (valor: unknown): void => {
    if (esSql(valor)) {
      textos.push(valor.strings.join('?'));
      for (const item of valor.values) recorrer(item);
      return;
    }
    if (Array.isArray(valor)) {
      if (valor.every((item) => typeof item === 'string')) {
        textos.push(valor.join('?'));
      } else {
        for (const item of valor) recorrer(item);
      }
      return;
    }
    if (typeof valor === 'string') textos.push(valor);
  };
  for (const valor of llamada) recorrer(valor);
  return textos.join('\n');
}

function valoresPlanos(llamada: unknown[]): unknown[] {
  const valores: unknown[] = [];
  const recorrer = (valor: unknown): void => {
    if (esSql(valor)) {
      for (const item of valor.values) recorrer(item);
      return;
    }
    if (Array.isArray(valor)) {
      for (const item of valor) recorrer(item);
      return;
    }
    valores.push(valor);
  };
  for (const valor of llamada.slice(1)) recorrer(valor);
  return valores;
}

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

const prisma = {
  usuarios: { findUnique: jest.fn() },
  sesiones: { findFirst: jest.fn() },
  comerciantes: { findUnique: jest.fn() },
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

const ZONAS = {
  permitida: {
    id: 1n,
    nombre: 'Centro - Calle 30',
    tipo: 'permitida',
    horario_inicio: '06:00',
    horario_fin: '18:00',
    aforo_maximo: 40,
    productos: ['Frutas frescas'],
  },
  restringida: {
    id: 3n,
    nombre: 'Entorno Hospital',
    tipo: 'restringida',
    horario_inicio: '06:00',
    horario_fin: '18:00',
    aforo_maximo: 5,
    productos: ['Frutas frescas'],
  },
} as const;

describe('Módulos del censo (e2e)', () => {
  let app: INestApplication;
  let tokenAdmin: string;
  let tokenRevisor: string;
  let tokenComerciante: string;
  let estadoMock: 'activo' | 'baja';
  let zonaMock: keyof typeof ZONAS | null;
  let fotoUrlMock: string | null;
  let directorioTemporal: string;

  function filaActual() {
    const zona = zonaMock ? ZONAS[zonaMock] : null;
    return {
      id: 7n,
      codigo: 'MOD-0007',
      categoria: 'informal',
      titular_id: 4n,
      titular_nombre: null,
      actividad: 'Venta de empanadas',
      foto_url: fotoUrlMock,
      estado: estadoMock,
      registrado_por_id: 2n,
      creado_en: FECHA,
      ubicacion: PUNTO,
      titular_usuario_nombre: 'José',
      titular_usuario_apellido: 'Pérez',
      titular_usuario_correo: 'jose.perez@hotmail.com',
      registrado_por_nombre: 'Ana',
      registrado_por_apellido: 'López',
      registrado_por_correo: 'revisor@tulua.gov.co',
      zona_id: zona?.id ?? null,
      zona_nombre: zona?.nombre ?? null,
      zona_tipo: zona?.tipo ?? null,
      zona_horario_inicio: zona?.horario_inicio ?? null,
      zona_horario_fin: zona?.horario_fin ?? null,
      zona_aforo_maximo: zona?.aforo_maximo ?? null,
      zona_productos: zona?.productos ?? [],
    };
  }

  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? 'e2e-secret-sgp-tulua-para-pruebas';
    directorioTemporal = mkdtempSync(join(tmpdir(), 'sgp-modulos-'));
    process.env.UPLOAD_DIR = directorioTemporal;
    process.env.UPLOAD_MAX_BYTES = String(5 * 1024 * 1024);

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
    if (directorioTemporal && existsSync(directorioTemporal)) {
      rmSync(directorioTemporal, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    estadoMock = 'activo';
    zonaMock = 'permitida';
    fotoUrlMock = null;

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
    prisma.comerciantes.findUnique.mockResolvedValue({ usuario_id: 4n });

    const tx = {
      $executeRaw: jest.fn().mockImplementation((...args: unknown[]) => {
        const sql = sqlDe(args);
        if (sql.includes('UPDATE modulos')) {
          const valores = valoresPlanos(args);
          const estado = valores.find(
            (valor) => valor === 'activo' || valor === 'baja',
          );
          if (estado === 'activo' || estado === 'baja') estadoMock = estado;
        }
        return Promise.resolve(1);
      }),
      $queryRaw: jest.fn().mockImplementation((...args: unknown[]) => {
        const valores = valoresPlanos(args);
        const foto = valores.find(
          (valor) =>
            typeof valor === 'string' && valor.startsWith('/uploads/modulos/'),
        );
        if (foto) fotoUrlMock = foto;
        return Promise.resolve([{ id: 7n }]);
      }),
    };
    prisma.$transaction.mockImplementation(
      (callback: (cliente: typeof tx) => Promise<unknown>) => callback(tx),
    );

    prisma.$queryRaw.mockImplementation((...args: unknown[]) => {
      const sql = sqlDe(args);

      if (sql.includes('SELECT DISTINCT nombre')) {
        return Promise.resolve([
          { nombre: 'Centro - Calle 30' },
          { nombre: 'Entorno Hospital' },
        ]);
      }
      if (sql.includes('FROM auditoria') && sql.includes('COUNT(')) {
        return Promise.resolve([{ total: 1 }]);
      }
      if (sql.includes('FROM auditoria')) {
        return Promise.resolve([
          {
            id: 11n,
            accion: 'insert',
            valor_anterior: null,
            valor_nuevo: filaActual(),
            actor_id: 2n,
            actor_nombre: 'Ana',
            actor_apellido: 'López',
            actor_correo: 'revisor@tulua.gov.co',
            creado_en: FECHA,
          },
        ]);
      }
      if (sql.includes('FROM modulos')) {
        if (sql.includes('COUNT(')) return Promise.resolve([{ total: 1 }]);
        return Promise.resolve([filaActual()]);
      }
      if (sql.includes('FROM zonas')) {
        return Promise.resolve(
          zonaMock ? [ZONAS[zonaMock]] : [],
        );
      }
      return Promise.resolve([]);
    });

    for (const funcion of Object.values(correo)) {
      funcion.mockResolvedValue(undefined);
    }
  });

  function postModulo(
    token: string,
    campos: Record<string, string> = {},
    archivo?: { buffer: Buffer; nombre: string; tipo: string },
  ) {
    let peticion = request(app.getHttpServer())
      .post('/modulos')
      .set('Authorization', `Bearer ${token}`)
      .field('categoria', 'informal')
      .field('actividad', 'Venta de empanadas')
      .field('ubicacion', JSON.stringify(PUNTO))
      .field('titularNombre', 'Nelson Mina');

    for (const [clave, valor] of Object.entries(campos)) {
      peticion = peticion.field(clave, valor);
    }
    if (archivo) {
      peticion = peticion.attach('foto', archivo.buffer, {
        filename: archivo.nombre,
        contentType: archivo.tipo,
      });
    }
    return peticion;
  }

  it('exige autenticación y rol gestor', async () => {
    await request(app.getHttpServer()).get('/modulos').expect(401);

    await request(app.getHttpServer())
      .get('/modulos')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .expect(403);
  });

  it('permite listar y consultar la ficha a revisor y administrador', async () => {
    const listado = await request(app.getHttpServer())
      .get('/modulos?categoria=informal&sector=Centro%20-%20Calle%2030')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .expect(200);

    expect(listado.body.paginacion.total).toBe(1);
    expect(listado.body.datos[0]).toMatchObject({
      id: '7',
      codigo: 'MOD-0007',
      categoria: 'informal',
      sector: 'Centro - Calle 30',
      titular: { nombre: 'José', correo: 'jose.perez@hotmail.com' },
      estado: 'activo',
    });

    const ficha = await request(app.getHttpServer())
      .get('/modulos/7')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(ficha.body).toMatchObject({
      id: '7',
      codigo: 'MOD-0007',
      zonaContenedora: {
        id: '1',
        nombre: 'Centro - Calle 30',
        tipo: 'permitida',
      },
      advertencias: [],
      registradoPor: { correo: 'revisor@tulua.gov.co' },
    });
  });

  it('consulta la zona contenedora y la advertencia de zona restringida', async () => {
    zonaMock = 'restringida';

    const respuesta = await request(app.getHttpServer())
      .get('/modulos/zona-contenedora?lat=4.0885&lng=-76.1955')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .expect(200);

    expect(respuesta.body).toMatchObject({
      sector: 'Entorno Hospital',
      requiereConfirmacion: true,
      zona: { tipo: 'restringida' },
    });
    expect(respuesta.body.advertencias[0].tipo).toBe('zona_restringida');
  });

  it('rechaza el alta en zona restringida sin aceptación y la permite con aceptación', async () => {
    zonaMock = 'restringida';

    const rechazada = await postModulo(tokenRevisor).expect(422);
    expect(rechazada.body.message).toContain('zona restringida');
    expect(rechazada.body.advertencias[0].tipo).toBe('zona_restringida');

    const aceptada = await postModulo(tokenRevisor, {
      aceptaAdvertencia: 'true',
    }).expect(201);

    expect(aceptada.body).toMatchObject({
      id: '7',
      codigo: 'MOD-0007',
      zonaContenedora: { nombre: 'Entorno Hospital' },
    });
    expect(aceptada.body.advertencias[0].tipo).toBe('zona_restringida');
  });

  it('censa un módulo con foto PNG válida', async () => {
    const respuesta = await postModulo(
      tokenAdmin,
      {},
      { buffer: PNG, nombre: 'puesto.png', tipo: 'image/png' },
    ).expect(201);

    expect(respuesta.body.fotoUrl).toMatch(/^\/uploads\/modulos\/.+\.png$/);

    const carpeta = join(directorioTemporal, 'modulos');
    expect(existsSync(carpeta)).toBe(true);
    expect(readdirSync(carpeta).some((archivo) => archivo.endsWith('.png'))).toBe(
      true,
    );
  });

  it('rechaza una foto con contenido que no es una imagen real', async () => {
    await postModulo(
      tokenAdmin,
      {},
      {
        buffer: Buffer.from('esto no es una imagen'),
        nombre: 'falsa.png',
        tipo: 'image/png',
      },
    ).expect(400);
  });

  it('rechaza una foto que supera 5 MB', async () => {
    const grande = Buffer.alloc(5 * 1024 * 1024 + 1);
    await postModulo(
      tokenAdmin,
      {},
      { buffer: grande, nombre: 'grande.png', tipo: 'image/png' },
    ).expect(413);
  });

  it('da de baja, conserva la ficha y reactiva el módulo', async () => {
    const baja = await request(app.getHttpServer())
      .patch('/modulos/7/estado')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .send({ estado: 'baja' })
      .expect(200);

    expect(baja.body).toMatchObject({
      id: '7',
      estado: 'baja',
      mensaje: 'Módulo dado de baja.',
    });

    const fichaBaja = await request(app.getHttpServer())
      .get('/modulos/7')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(fichaBaja.body.estado).toBe('baja');

    const reactivado = await request(app.getHttpServer())
      .patch('/modulos/7/estado')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'activo' })
      .expect(200);
    expect(reactivado.body.estado).toBe('activo');
  });

  it('devuelve el historial de auditoría del módulo', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/modulos/7/historial')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .expect(200);

    expect(respuesta.body.modulo).toMatchObject({
      id: '7',
      codigo: 'MOD-0007',
    });
    expect(respuesta.body.datos[0]).toMatchObject({
      accion: 'insert',
      actor: { correo: 'revisor@tulua.gov.co' },
    });
  });

  it('valida las coordenadas y los identificadores', async () => {
    await request(app.getHttpServer())
      .get('/modulos/zona-contenedora?lat=200&lng=-76.19')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(400);

    await request(app.getHttpServer())
      .get('/modulos/abc')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(400);
  });
});
