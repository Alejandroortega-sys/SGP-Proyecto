import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import '../src/common/bigint-serialization';
import { AppModule } from '../src/app.module';
import { CorreoService } from '../src/correo/correo.service';
import { AlmacenPrevisualizaciones } from '../src/importaciones/almacen-previsualizaciones';
import { ModulosService } from '../src/modulos/modulos.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ZonasService } from '../src/zonas/zonas.service';

interface UsuarioPrueba {
  id: bigint;
  nombre: string;
  apellido: string | null;
  correo: string;
  rol: 'gestor' | 'comerciante';
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

const POLIGONO = {
  type: 'Polygon',
  coordinates: [
    [
      [-76.2, 4.08],
      [-76.19, 4.08],
      [-76.19, 4.09],
      [-76.2, 4.09],
      [-76.2, 4.08],
    ],
  ],
};

const CSV_RESTRINGIDO =
  'categoria,actividad,latitud,longitud,titular_documento,titular_nombre\n' +
  'informal,Empanadas restringidas,4.09,-76.19,,Nelson\n';

const CSV_PARCIAL =
  'categoria,actividad,latitud,longitud,titular_documento,titular_nombre\n' +
  'informal,Empanadas válidas,4.08,-76.19,123,\n' +
  'otra,Empanadas inválidas,4.08,-76.19,,\n';

interface SqlLike {
  strings: string[];
  values: unknown[];
}

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
      for (const item of valor) recorrer(item);
      return;
    }
    if (typeof valor === 'string') textos.push(valor);
  };
  for (const valor of llamada) recorrer(valor);
  return textos.join('\n');
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

const zonas = { crear: jest.fn() };
const modulos = { crear: jest.fn() };

function coleccion(features: unknown[]): string {
  return JSON.stringify({ type: 'FeatureCollection', features });
}

function feature(
  propiedades: Record<string, unknown>,
  geometria: unknown = POLIGONO,
): unknown {
  return { type: 'Feature', properties: propiedades, geometry: geometria };
}

describe('Importaciones (e2e)', () => {
  let app: INestApplication;
  let tokenAdmin: string;
  let tokenRevisor: string;
  let tokenComerciante: string;
  let tx: { $executeRaw: jest.Mock; $queryRaw: jest.Mock };

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
      .overrideProvider(ZonasService)
      .useValue(zonas)
      .overrideProvider(ModulosService)
      .useValue(modulos)
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

    tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    prisma.$transaction.mockImplementation(
      (callback: (cliente: typeof tx) => Promise<unknown>) => callback(tx),
    );

    prisma.$queryRaw.mockImplementation((...args: unknown[]) => {
      const sql = sqlDe(args);
      if (sql.includes('spatial_ref_sys')) {
        return Promise.resolve([{ srid: 4326 }]);
      }
      if (sql.includes('WITH entradas') && sql.includes('ST_IsValid')) {
        return Promise.resolve([
          { fila: 1, geometria: POLIGONO, valida: true, motivo: null },
        ]);
      }
      if (sql.includes('FROM productos')) {
        return Promise.resolve([
          { id: '1', nombre: 'Frutas frescas', activo: true },
        ]);
      }
      if (sql.includes('FROM zonas WHERE nombre')) {
        return Promise.resolve([]);
      }
      if (sql.includes('FROM usuarios u')) {
        return Promise.resolve([{ documento: '123', id: '4' }]);
      }
      if (sql.includes('WITH puntos')) {
        return Promise.resolve([
          {
            fila: 2,
            zona_id: '1',
            zona_nombre: 'Centro',
            zona_tipo: 'permitida',
            zona_horario_inicio: '06:00',
            zona_horario_fin: '18:00',
            zona_aforo_maximo: 40,
            zona_productos: ['Frutas frescas'],
          },
        ]);
      }
      return Promise.resolve([]);
    });

    for (const funcion of Object.values(correo)) {
      funcion.mockResolvedValue(undefined);
    }
    zonas.crear.mockResolvedValue({ id: '10', nombre: 'Zona importada' });
    modulos.crear.mockResolvedValue({
      id: '20',
      codigo: 'MOD-0020',
      actividad: 'Empanadas restringidas',
    });
  });

  function previsualizarZonas(
    token: string,
    contenido = coleccion([
      feature({
        nombre: 'Zona importada',
        tipo: 'permitida',
        productosPermitidos: 'Frutas frescas',
      }),
    ]),
    nombre = 'zonas.geojson',
  ) {
    return request(app.getHttpServer())
      .post('/importaciones/zonas/previsualizar')
      .set('Authorization', `Bearer ${token}`)
      .attach('archivo', Buffer.from(contenido, 'utf8'), {
        filename: nombre,
        contentType: 'application/geo+json',
      });
  }

  function previsualizarModulos(token: string, contenido = CSV_PARCIAL) {
    return request(app.getHttpServer())
      .post('/importaciones/modulos/previsualizar')
      .set('Authorization', `Bearer ${token}`)
      .attach('archivo', Buffer.from(contenido, 'utf8'), {
        filename: 'modulos.csv',
        contentType: 'text/csv',
      });
  }

  it('exige autenticación y rol gestor', async () => {
    await request(app.getHttpServer())
      .post('/importaciones/modulos/previsualizar')
      .attach('archivo', Buffer.from(CSV_PARCIAL), {
        filename: 'modulos.csv',
        contentType: 'text/csv',
      })
      .expect(401);

    await request(app.getHttpServer())
      .post('/importaciones/modulos/previsualizar')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .attach('archivo', Buffer.from(CSV_PARCIAL), {
        filename: 'modulos.csv',
        contentType: 'text/csv',
      })
      .expect(403);
  });

  it('impide que el revisor importe zonas', async () => {
    await previsualizarZonas(tokenRevisor).expect(403);
  });

  it('previsualiza y confirma un GeoJSON válido', async () => {
    const preview = await previsualizarZonas(tokenAdmin).expect(200);

    expect(preview.body).toMatchObject({
      tipo: 'zonas',
      sridOrigen: 4326,
      resumen: { total: 1, validas: 1, rechazadas: 0 },
    });
    expect(preview.body.filas[0]).toMatchObject({
      fila: 1,
      estado: 'valida',
    });

    const confirmacion = await request(app.getHttpServer())
      .post('/importaciones/zonas/confirmar')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ token: preview.body.token })
      .expect(200);

    expect(confirmacion.body).toMatchObject({
      resumen: { total: 1, importados: 1, rechazados: 0 },
      importados: [{ fila: 1, id: '10', nombre: 'Zona importada' }],
    });
    expect(zonas.crear).toHaveBeenCalledTimes(1);
  });

  it('importa parcialmente y descarga el reporte CSV', async () => {
    const preview = await previsualizarZonas(
      tokenAdmin,
      coleccion([
        feature({ nombre: 'Zona válida', tipo: 'permitida' }),
        feature({ nombre: '', tipo: 'permitida' }),
      ]),
    ).expect(200);

    expect(preview.body.resumen).toMatchObject({
      total: 2,
      validas: 1,
      rechazadas: 1,
    });

    await request(app.getHttpServer())
      .post('/importaciones/zonas/confirmar')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ token: preview.body.token })
      .expect(200);

    const reporte = await request(app.getHttpServer())
      .get(`/importaciones/${preview.body.token}/reporte`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(reporte.headers['content-type']).toContain('text/csv');
    expect(reporte.headers['content-disposition']).toContain('attachment');
    expect(reporte.text).toContain('Reporte de importación de zonas');
    expect(reporte.text).toContain('Rechazados: 1');
  });

  it('rechaza un GeoJSON con formato incorrecto', async () => {
    const respuesta = await previsualizarZonas(
      tokenAdmin,
      '{ esto no es json',
    ).expect(422);

    expect(respuesta.body.message).toMatch(/JSON válido/i);
  });

  it('previsualiza un CSV parcial con errores por fila', async () => {
    const preview = await previsualizarModulos(tokenRevisor).expect(200);

    expect(preview.body.resumen).toMatchObject({
      total: 2,
      validas: 1,
      rechazadas: 1,
    });
    expect(preview.body.filas[1]?.errores[0]).toMatch(/categoría/i);
  });

  it('rechaza un CSV con encabezados incorrectos', async () => {
    const respuesta = await previsualizarModulos(
      tokenRevisor,
      'categoria,actividad\ninformal,Empanadas\n',
    ).expect(422);

    expect(respuesta.body.message).toMatch(/faltan las columnas/i);
  });

  it('exige confirmación global para una zona restringida', async () => {
    prisma.$queryRaw.mockImplementation((...args: unknown[]) => {
      const sql = sqlDe(args);
      if (sql.includes('FROM usuarios u')) {
        return Promise.resolve([]);
      }
      if (sql.includes('WITH puntos')) {
        return Promise.resolve([
          {
            fila: 2,
            zona_id: '3',
            zona_nombre: 'Entorno Hospital',
            zona_tipo: 'restringida',
            zona_horario_inicio: '06:00',
            zona_horario_fin: '18:00',
            zona_aforo_maximo: 5,
            zona_productos: ['Frutas frescas'],
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const preview = await previsualizarModulos(
      tokenRevisor,
      CSV_RESTRINGIDO,
    ).expect(200);

    expect(preview.body.filas[0]?.requiereConfirmacion).toBe(true);

    const rechazada = await request(app.getHttpServer())
      .post('/importaciones/modulos/confirmar')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .send({ token: preview.body.token })
      .expect(200);

    expect(rechazada.body.resumen.importados).toBe(0);
    expect(modulos.crear).not.toHaveBeenCalled();

    const segundo = await previsualizarModulos(
      tokenRevisor,
      CSV_RESTRINGIDO,
    ).expect(200);

    const aceptada = await request(app.getHttpServer())
      .post('/importaciones/modulos/confirmar')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .send({
        token: segundo.body.token,
        aceptaAdvertencia: true,
      })
      .expect(200);

    expect(aceptada.body.resumen).toMatchObject({
      importados: 1,
      rechazados: 0,
      conAdvertencia: 1,
    });
    expect(modulos.crear).toHaveBeenCalledWith(
      '2',
      expect.objectContaining({ aceptaAdvertencia: true }),
    );
  });

  it('rechaza el token de otro gestor y el reporte antes de confirmar', async () => {
    const preview = await previsualizarModulos(tokenAdmin).expect(200);

    await request(app.getHttpServer())
      .post('/importaciones/modulos/confirmar')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .send({ token: preview.body.token })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/importaciones/${preview.body.token}/reporte`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(409);
  });

  it('responde 410 cuando la previsualización ya no existe', async () => {
    const preview = await previsualizarModulos(tokenRevisor).expect(200);
    app.get(AlmacenPrevisualizaciones).eliminar(preview.body.token);

    await request(app.getHttpServer())
      .post('/importaciones/modulos/confirmar')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .send({ token: preview.body.token })
      .expect(410);
  });

  it('valida el formato del token y la extensión del archivo', async () => {
    await request(app.getHttpServer())
      .post('/importaciones/modulos/confirmar')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .send({ token: 'no-es-un-uuid' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/importaciones/modulos/previsualizar')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .attach('archivo', Buffer.from('contenido'), {
        filename: 'modulos.txt',
        contentType: 'text/plain',
      })
      .expect(400);
  });
});
