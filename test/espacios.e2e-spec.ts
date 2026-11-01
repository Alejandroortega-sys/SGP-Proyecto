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

interface SqlLike {
  strings: string[];
  values: unknown[];
}

const FECHA = new Date('2026-10-01T12:00:00.000Z');

const PUNTO = {
  type: 'Point',
  coordinates: [-76.195, 4.089],
};

function fila(overrides: Record<string, unknown> = {}) {
  return {
    id: 1n,
    nombre: 'Espacio móvil Calle 30 - A',
    tipo: 'espacio_movil',
    sector: 'Centro',
    dimensiones: '3 × 2 m',
    actividad_permitida: 'Venta de alimentos y frutas',
    horario_inicio: '06:00',
    horario_fin: '14:00',
    estado: 'disponible',
    creado_en: FECHA,
    zona_id: 1n,
    zona_nombre: 'Centro - Calle 30',
    zona_tipo: 'permitida',
    zona_activa: true,
    zona_horario_inicio: '06:00',
    zona_horario_fin: '18:00',
    zona_aforo_maximo: 40,
    ubicacion: PUNTO,
    bloqueo_inicio: null,
    bloqueo_fin: null,
    bloqueo_motivo: null,
    bloqueo_activo: null,
    permiso_numero: null,
    permiso_inicio: null,
    permiso_fin: null,
    solicitud_numero: null,
    solicitud_inicio: null,
    solicitud_fin: null,
    productos: ['Frutas frescas', 'Verduras'],
    ...overrides,
  };
}

const FILAS = [
  fila(),
  fila({
    id: 2n,
    nombre: 'Espacio móvil Calle 30 - B',
  }),
  fila({
    id: 3n,
    nombre: 'Espacio Plaza Boyacá - Norte',
    sector: 'Plaza Boyacá',
    estado: 'bloqueado',
    bloqueo_inicio: '2026-10-25',
    bloqueo_fin: '2026-10-31',
    bloqueo_motivo: 'Mantenimiento del andén',
    bloqueo_activo: true,
  }),
  fila({
    id: 4n,
    nombre: 'Kiosco Parque La Guadua',
    tipo: 'kiosco',
    sector: 'Parque La Guadua',
  }),
  fila({
    id: 5n,
    nombre: 'Espacio Plaza Boyacá - Sur',
    estado: 'asignado',
  }),
  fila({
    id: 6n,
    nombre: 'Módulo Parque La Guadua - Este',
    estado: 'mantenimiento',
  }),
];

const ADMIN: UsuarioPrueba = {
  id: 1n,
  nombre: 'Laura',
  apellido: 'Martínez',
  correo: 'admin@tulua.gov.co',
  rol: 'gestor',
  estado: 'activa',
  perfil: 'administrador',
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

const USUARIOS = [ADMIN, COMERCIANTE, ORGANIZADOR];

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
    'strings' in valor &&
    'values' in valor
  );
}

function recogerValores(valor: unknown, resultado: unknown[]): void {
  if (esSql(valor)) {
    for (const item of valor.values) {
      recogerValores(item, resultado);
    }
    return;
  }
  resultado.push(valor);
}

function valoresDe(argumentos: unknown[]): unknown[] {
  const resultado: unknown[] = [];
  for (const argumento of argumentos.slice(1)) {
    recogerValores(argumento, resultado);
  }
  return resultado;
}

const prisma = {
  usuarios: { findUnique: jest.fn() },
  sesiones: { findFirst: jest.fn() },
  $queryRaw: jest.fn(),
};

const correo = {
  enviarCodigoActivacion: jest.fn(),
  enviarCodigoRecuperacion: jest.fn(),
  enviarAvisoCambioPassword: jest.fn(),
  enviarCredencialesGestor: jest.fn(),
  enviarAvisoEstadoCuenta: jest.fn(),
};

describe('Espacios (e2e)', () => {
  let app: INestApplication;
  let tokenComerciante: string;
  let tokenAdmin: string;
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

    [tokenAdmin, tokenComerciante, tokenOrganizador] = await Promise.all([
      firmar(ADMIN),
      firmar(COMERCIANTE),
      firmar(ORGANIZADOR),
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

    prisma.$queryRaw.mockImplementation(
      (strings: TemplateStringsArray, ...valores: unknown[]) => {
        const argumentos = [strings, ...valores];
        const planos = valoresDe(argumentos);

        const id = planos.find((valor) => typeof valor === 'bigint');
        if (id !== undefined) {
          const encontrada = FILAS.find((espacio) => espacio.id === id);
          return Promise.resolve(encontrada ? [encontrada] : []);
        }

        return Promise.resolve(FILAS);
      },
    );

    for (const funcion of Object.values(correo)) {
      funcion.mockResolvedValue(undefined);
    }
  });

  describe('GET /espacios', () => {
    it('exige autenticación', async () => {
      await request(app.getHttpServer()).get('/espacios').expect(401);
    });

    it('permite consultar al comerciante y devuelve solo disponibles', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/espacios')
        .set('Authorization', `Bearer ${tokenComerciante}`)
        .expect(200);

      expect(respuesta.body.datos).toHaveLength(3);
      expect(respuesta.body.total).toBe(3);
      expect(respuesta.body.disponibles).toBe(3);
      expect(respuesta.body.noDisponibles).toBe(3);
      expect(
        respuesta.body.datos.map((espacio: { id: string }) => espacio.id),
      ).toEqual(['1', '2', '4']);
      expect(respuesta.body.datos[0]).toMatchObject({
        nombre: 'Espacio móvil Calle 30 - A',
        tipo: 'espacio_movil',
        sector: 'Centro',
        dimensiones: '3 × 2 m',
        estado: 'disponible',
        estadoEfectivo: 'disponible',
        disponible: true,
        ubicacion: { type: 'Point' },
        zona: { id: '1', nombre: 'Centro - Calle 30' },
      });
    });

    it('prohíbe la consulta a gestores y organizadores', async () => {
      await request(app.getHttpServer())
        .get('/espacios')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .expect(403);

      await request(app.getHttpServer())
        .get('/espacios')
        .set('Authorization', `Bearer ${tokenOrganizador}`)
        .expect(403);
    });

    it('incluye los no disponibles para consultar su estado', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/espacios')
        .query({ incluirNoDisponibles: true, fecha: '2026-10-31' })
        .set('Authorization', `Bearer ${tokenComerciante}`)
        .expect(200);

      expect(respuesta.body.datos).toHaveLength(6);
      expect(respuesta.body.total).toBe(6);
      expect(respuesta.body.disponibles).toBe(3);
      expect(respuesta.body.noDisponibles).toBe(3);

      const bloqueado = respuesta.body.datos.find(
        (espacio: { id: string }) => espacio.id === '3',
      );
      expect(bloqueado).toMatchObject({
        estado: 'bloqueado',
        estadoEfectivo: 'bloqueado',
        disponible: false,
      });
      expect(bloqueado.motivoEstado).toContain('Mantenimiento del andén');

      const asignado = respuesta.body.datos.find(
        (espacio: { id: string }) => espacio.id === '5',
      );
      expect(asignado).toMatchObject({
        estado: 'asignado',
        disponible: false,
      });
    });

    it('rechaza fechas y booleanos inválidos', async () => {
      await request(app.getHttpServer())
        .get('/espacios')
        .query({ fecha: '31-10-2026' })
        .set('Authorization', `Bearer ${tokenComerciante}`)
        .expect(400);

      await request(app.getHttpServer())
        .get('/espacios')
        .query({ incluirNoDisponibles: 'quizá' })
        .set('Authorization', `Bearer ${tokenComerciante}`)
        .expect(400);
    });
  });

  describe('GET /espacios/:id', () => {
    it('devuelve la ficha de un espacio bloqueado con las restricciones de su zona', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/espacios/3')
        .set('Authorization', `Bearer ${tokenComerciante}`)
        .expect(200);

      expect(respuesta.body).toMatchObject({
        id: '3',
        nombre: 'Espacio Plaza Boyacá - Norte',
        estado: 'bloqueado',
        estadoEfectivo: 'bloqueado',
        disponible: false,
        bloqueo: {
          fechaInicio: '2026-10-25',
          fechaFin: '2026-10-31',
          motivo: 'Mantenimiento del andén',
          activo: true,
        },
        zona: {
          id: '1',
          nombre: 'Centro - Calle 30',
          tipo: 'permitida',
          activa: true,
          horarioInicio: '06:00',
          horarioFin: '18:00',
          aforoMaximo: 40,
          productos: ['Frutas frescas', 'Verduras'],
        },
      });
      expect(respuesta.body.motivoEstado).toContain('Mantenimiento del andén');
    });

    it('devuelve la ficha de un espacio disponible', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/espacios/1')
        .set('Authorization', `Bearer ${tokenComerciante}`)
        .expect(200);

      expect(respuesta.body).toMatchObject({
        id: '1',
        estado: 'disponible',
        disponible: true,
        motivoEstado: null,
      });
    });

    it('responde 400 con un id no numérico y 404 si no existe', async () => {
      await request(app.getHttpServer())
        .get('/espacios/abc')
        .set('Authorization', `Bearer ${tokenComerciante}`)
        .expect(400);

      await request(app.getHttpServer())
        .get('/espacios/999')
        .set('Authorization', `Bearer ${tokenComerciante}`)
        .expect(404);
    });

    it('prohíbe la ficha a un gestor', async () => {
      await request(app.getHttpServer())
        .get('/espacios/1')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .expect(403);
    });
  });
});
