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
  rol: 'gestor' | 'comerciante';
  estado: 'activa';
  perfil: 'administrador' | 'revisor' | null;
}

interface SqlLike {
  strings: string[];
  values: unknown[];
}

const FECHA = new Date('2026-11-11T10:00:00.000Z');
const PUNTO = { type: 'Point', coordinates: [-76.1908, 4.0885] };

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
      for (const item of valor) recorrer(item);
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

type Estado = 'disponible' | 'bloqueado' | 'asignado' | 'mantenimiento';

interface BloqueoMock {
  id: bigint;
  espacio_id: bigint;
  fecha_inicio: string;
  fecha_fin: string;
  motivo: string | null;
  creado_por: bigint;
  creado_en: Date;
}

const prisma = {
  usuarios: { findUnique: jest.fn() },
  sesiones: { findFirst: jest.fn() },
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

describe('Gestión de espacios temporales (e2e)', () => {
  let app: INestApplication;
  let tokenAdmin: string;
  let tokenRevisor: string;
  let tokenComerciante: string;
  let estadoMock: Estado;
  let manualMock: boolean;
  let espacioExiste: boolean;
  let bloqueosMock: BloqueoMock[];
  let permisosMock: Array<{ numero: string }>;
  let solicitudesMock: Array<{ numero_radicado: string }>;
  let relacionesMock: { permisos: number; solicitudes: number };

  function fila() {
    const bloqueo = bloqueosMock[0] ?? null;
    return {
      id: 7n,
      nombre: 'Puesto Plaza Boyacá - Occidente',
      tipo: 'puesto',
      sector: 'Plaza Boyacá',
      dimensiones: '4 × 3 m',
      actividad_permitida: 'Comidas rápidas',
      horario_inicio: '07:00',
      horario_fin: '17:00',
      estado: estadoMock,
      asignacion_manual: manualMock,
      creado_en: FECHA,
      creado_por: 1n,
      creado_por_nombre: 'Laura',
      creado_por_apellido: 'Martínez',
      zona_id: 2n,
      zona_nombre: 'Plaza Boyacá',
      zona_tipo: 'permitida',
      zona_activa: true,
      zona_horario_inicio: '07:00',
      zona_horario_fin: '17:00',
      zona_aforo_maximo: 15,
      zona_productos: ['Artesanías'],
      ubicacion: PUNTO,
      bloqueo_inicio: bloqueo?.fecha_inicio ?? null,
      bloqueo_fin: bloqueo?.fecha_fin ?? null,
      bloqueo_motivo: bloqueo?.motivo ?? null,
      bloqueo_activo: bloqueo !== null,
      permiso_numero: permisosMock[0]?.numero ?? null,
      permiso_inicio: permisosMock[0] ? '2026-11-01' : null,
      permiso_fin: permisosMock[0] ? '2026-11-30' : null,
      permiso_hora_inicio: null,
      permiso_hora_fin: null,
      solicitud_numero: solicitudesMock[0]?.numero_radicado ?? null,
      solicitud_inicio: solicitudesMock[0] ? '2026-11-01' : null,
      solicitud_fin: solicitudesMock[0] ? '2026-11-30' : null,
      solicitud_hora_inicio: null,
      solicitud_hora_fin: null,
      total_bloqueos: bloqueosMock.length,
      total_filas: 1,
      tiene_permisos: relacionesMock.permisos > 0,
      tiene_solicitudes: relacionesMock.solicitudes > 0,
    };
  }

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
    estadoMock = 'disponible';
    manualMock = false;
    espacioExiste = true;
    bloqueosMock = [];
    permisosMock = [];
    solicitudesMock = [];
    relacionesMock = { permisos: 0, solicitudes: 0 };

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

    prisma.$queryRaw.mockImplementation((...args: unknown[]) => {
      const sql = sqlDe(args);

      if (sql.includes('SELECT DISTINCT btrim(sector)')) {
        return Promise.resolve([{ valor: 'Plaza Boyacá' }]);
      }
      if (sql.includes('FROM zonas z') && !sql.includes('FROM espacios_temporales')) {
        return Promise.resolve([
          { id: 2n, nombre: 'Plaza Boyacá', tipo: 'permitida' },
        ]);
      }
      if (sql.includes('SELECT id, nombre, tipo') && sql.includes('FROM zonas')) {
        return Promise.resolve([
          { id: 2n, nombre: 'Plaza Boyacá', tipo: 'permitida' },
        ]);
      }
      if (sql.includes('INSERT INTO espacios_temporales')) {
        espacioExiste = true;
        return Promise.resolve([{ id: 7n }]);
      }
      if (sql.includes('INSERT INTO espacio_bloqueos')) {
        const valores = valoresPlanos(args);
        const fechas = valores.filter(
          (valor) => typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor),
        );
        const motivo = valores.find(
          (valor) =>
            typeof valor === 'string' &&
            !/^\d{4}-\d{2}-\d{2}$/.test(valor),
        );
        bloqueosMock = [
          {
            id: 12n,
            espacio_id: 7n,
            fecha_inicio:
              typeof fechas[0] === 'string' ? fechas[0] : '2026-12-20',
            fecha_fin:
              typeof fechas[1] === 'string' ? fechas[1] : '2026-12-24',
            motivo: typeof motivo === 'string' ? motivo : null,
            creado_por: 1n,
            creado_en: FECHA,
          },
        ];
        return Promise.resolve([{ id: 12n }]);
      }
      if (sql.includes('SELECT fecha_inicio, fecha_fin') && sql.includes('FROM espacio_bloqueos')) {
        return Promise.resolve(
          bloqueosMock.length > 0
            ? [
                {
                  fecha_inicio: bloqueosMock[0].fecha_inicio,
                  fecha_fin: bloqueosMock[0].fecha_fin,
                },
              ]
            : [],
        );
      }
      if (sql.includes('SELECT id, nombre') && sql.includes('FROM espacios_temporales')) {
        return espacioExiste
          ? Promise.resolve([
              { id: 7n, nombre: 'Puesto Plaza Boyacá - Occidente' },
            ])
          : Promise.resolve([]);
      }
      if (sql.includes('AS permisos')) {
        return Promise.resolve([relacionesMock]);
      }
      if (sql.includes('AS bloqueo,') && sql.includes('EXISTS (')) {
        return Promise.resolve([
          {
            bloqueo: bloqueosMock.length > 0,
            permiso: permisosMock.length > 0,
            solicitud: solicitudesMock.length > 0,
          },
        ]);
      }
      if (sql.includes('FROM espacios_temporales e')) {
        const id = valoresPlanos(args).find(
          (valor) => typeof valor === 'bigint',
        );
        const existe = espacioExiste && (id === undefined || id === 7n);
        return existe ? Promise.resolve([fila()]) : Promise.resolve([]);
      }
      if (sql.includes('FROM espacio_bloqueos b')) {
        if (sql.includes('WHERE b.id =')) {
          const id = valoresPlanos(args).find(
            (valor) => typeof valor === 'bigint',
          );
          const bloqueo = bloqueosMock.find((item) => item.id === id);
          return Promise.resolve(
            bloqueo
              ? [
                  {
                    ...bloqueo,
                    activo: true,
                    creado_por_nombre: 'Laura',
                    creado_por_apellido: 'Martínez',
                  },
                ]
              : [],
          );
        }
        if (sql.includes('daterange')) {
          if (sql.includes('b.id <>')) return Promise.resolve([]);
          return Promise.resolve(
            bloqueosMock.length > 0 ? [{ id: bloqueosMock[0].id }] : [],
          );
        }
        return Promise.resolve(
          bloqueosMock.map((bloqueo) => ({
            ...bloqueo,
            activo: true,
            creado_por_nombre: 'Laura',
            creado_por_apellido: 'Martínez',
          })),
        );
      }
      if (sql.includes('FROM permisos p') && sql.includes('daterange')) {
        return Promise.resolve(permisosMock);
      }
      if (sql.includes('FROM solicitudes s') && sql.includes('daterange')) {
        return Promise.resolve(solicitudesMock);
      }
      if (sql.includes('FROM auditoria')) {
        if (sql.includes('COUNT(')) return Promise.resolve([{ total: 1 }]);
        return Promise.resolve([
          {
            id: 31n,
            tabla: 'espacios_temporales',
            accion: 'insert',
            valor_anterior: null,
            valor_nuevo: fila(),
            actor_id: 1n,
            actor_nombre: 'Laura',
            actor_apellido: 'Martínez',
            actor_correo: 'admin@tulua.gov.co',
            creado_en: FECHA,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    prisma.$executeRaw.mockImplementation((...args: unknown[]) => {
      const sql = sqlDe(args);
      const valores = valoresPlanos(args);
      if (sql.includes('SET estado = ')) {
        const estado = valores.find(
          (valor) =>
            valor === 'disponible' ||
            valor === 'bloqueado' ||
            valor === 'asignado' ||
            valor === 'mantenimiento',
        );
        if (typeof estado === 'string') estadoMock = estado as Estado;
        if (sql.includes("'asignado'")) estadoMock = 'asignado';
        if (sql.includes("'mantenimiento'")) estadoMock = 'mantenimiento';
        if (sql.includes("'disponible'")) estadoMock = 'disponible';
      }
      if (sql.includes('asignacion_manual = true')) manualMock = true;
      if (sql.includes('asignacion_manual = false')) manualMock = false;
      if (sql.includes('fn_recalcular_estado_espacio')) {
        if (!manualMock && estadoMock !== 'mantenimiento') {
          estadoMock = 'disponible';
        }
      }
      if (sql.includes('UPDATE espacio_bloqueos')) {
        const fechas = valores.filter(
          (valor) => typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor),
        );
        const motivo = valores.find(
          (valor) =>
            typeof valor === 'string' &&
            !/^\d{4}-\d{2}-\d{2}$/.test(valor),
        );
        if (bloqueosMock[0]) {
          if (typeof fechas[0] === 'string') {
            bloqueosMock[0].fecha_inicio = fechas[0];
          }
          if (typeof fechas[1] === 'string') {
            bloqueosMock[0].fecha_fin = fechas[1];
          }
          if (typeof motivo === 'string') bloqueosMock[0].motivo = motivo;
        }
      }
      if (sql.includes('DELETE FROM espacio_bloqueos')) {
        const id = valores.find((valor) => typeof valor === 'bigint');
        bloqueosMock = bloqueosMock.filter((bloqueo) => bloqueo.id !== id);
      }
      if (sql.includes('DELETE FROM espacios_temporales')) {
        espacioExiste = false;
      }
      return Promise.resolve(1);
    });

    prisma.$transaction.mockImplementation(
      (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          $queryRaw: prisma.$queryRaw,
          $executeRaw: prisma.$executeRaw,
        }),
    );

    for (const funcion of Object.values(correo)) {
      funcion.mockResolvedValue(undefined);
    }
  });

  it('exige autenticación y rol gestor', async () => {
    await request(app.getHttpServer()).get('/gestor/espacios').expect(401);
    await request(app.getHttpServer())
      .get('/gestor/espacios')
      .set('Authorization', `Bearer ${tokenComerciante}`)
      .expect(403);
  });

  it('lista y consulta la ficha como revisor y administrador', async () => {
    const listado = await request(app.getHttpServer())
      .get('/gestor/espacios?estado=disponible')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .expect(200);

    expect(listado.body.total).toBe(1);
    expect(listado.body.datos[0]).toMatchObject({
      id: '7',
      nombre: 'Puesto Plaza Boyacá - Occidente',
      estadoEfectivo: 'disponible',
      disponible: true,
      asignacionManual: false,
      zona: { id: '2', nombre: 'Plaza Boyacá' },
      horarioPropio: { inicio: '07:00', fin: '17:00' },
    });

    const ficha = await request(app.getHttpServer())
      .get('/gestor/espacios/7')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(ficha.body).toMatchObject({
      id: '7',
      puedeEliminar: true,
      creadoPor: 'Laura Martínez',
    });
  });

  it('devuelve las opciones y la zona contenedora', async () => {
    const opciones = await request(app.getHttpServer())
      .get('/gestor/espacios/opciones')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(opciones.body.tipos).toContain('puesto');
    expect(opciones.body.estados).toContain('mantenimiento');
    expect(opciones.body.zonas[0]).toMatchObject({ id: '2', nombre: 'Plaza Boyacá' });

    const zona = await request(app.getHttpServer())
      .get('/gestor/espacios/zona-contenedora?lat=4.0885&lng=-76.1955')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(zona.body).toMatchObject({
      zona: { id: '2', nombre: 'Plaza Boyacá' },
      sector: 'Plaza Boyacá',
    });
  });

  it('crea un espacio válido y rechaza cuerpos inválidos', async () => {
    const creado = await request(app.getHttpServer())
      .post('/gestor/espacios')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .send({
        nombre: 'Puesto Plaza Boyacá - Occidente',
        tipo: 'puesto',
        sector: 'Plaza Boyacá',
        dimensiones: '4 × 3 m',
        actividadPermitida: 'Comidas rápidas',
        ubicacion: PUNTO,
        horarioInicio: '07:00',
        horarioFin: '17:00',
      })
      .expect(201);

    expect(creado.body.id).toBe('7');

    await request(app.getHttpServer())
      .post('/gestor/espacios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: '', tipo: 'puesto', ubicacion: PUNTO })
      .expect(400);

    await request(app.getHttpServer())
      .post('/gestor/espacios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        nombre: 'Espacio',
        tipo: 'puesto',
        ubicacion: PUNTO,
        horarioInicio: '18:00',
        horarioFin: '08:00',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/gestor/espacios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        nombre: 'Espacio',
        tipo: 'puesto',
        ubicacion: { type: 'Point', coordinates: [200, 4] },
      })
      .expect(400);
  });

  it('edita, asigna, libera y cambia el mantenimiento', async () => {
    const editado = await request(app.getHttpServer())
      .patch('/gestor/espacios/7')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Puesto actualizado', dimensiones: '5 × 4 m' })
      .expect(200);
    expect(editado.body.id).toBe('7');

    const asignado = await request(app.getHttpServer())
      .post('/gestor/espacios/7/asignar')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .send({ motivo: 'Evento municipal' })
      .expect(200);
    expect(asignado.body).toMatchObject({
      estado: 'asignado',
      asignacionManual: true,
    });

    const bloqueadoManual = await request(app.getHttpServer())
      .patch('/gestor/espacios/7/estado')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'mantenimiento' })
      .expect(409);
    expect(bloqueadoManual.body.message).toContain('asignación manual');

    const liberado = await request(app.getHttpServer())
      .post('/gestor/espacios/7/liberar')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .send({})
      .expect(200);
    expect(liberado.body).toMatchObject({
      estado: 'disponible',
      asignacionManual: false,
    });

    const mantenimiento = await request(app.getHttpServer())
      .patch('/gestor/espacios/7/estado')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'mantenimiento' })
      .expect(200);
    expect(mantenimiento.body.estado).toBe('mantenimiento');
  });

  it('crea, edita y elimina bloqueos, y rechaza conflictos', async () => {
    const creado = await request(app.getHttpServer())
      .post('/gestor/espacios/7/bloqueos')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .send({
        fechaInicio: '2026-12-20',
        fechaFin: '2026-12-24',
        motivo: 'Evento navideño',
      })
      .expect(201);

    expect(creado.body).toMatchObject({
      id: '12',
      fechaInicio: '2026-12-20',
      fechaFin: '2026-12-24',
      motivo: 'Evento navideño',
    });

    await request(app.getHttpServer())
      .post('/gestor/espacios/7/bloqueos')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ fechaInicio: '2026-02-31', fechaFin: '2026-03-01' })
      .expect(400);

    bloqueosMock = [
      {
        id: 12n,
        espacio_id: 7n,
        fecha_inicio: '2026-12-20',
        fecha_fin: '2026-12-24',
        motivo: 'Evento navideño',
        creado_por: 1n,
        creado_en: FECHA,
      },
    ];

    await request(app.getHttpServer())
      .post('/gestor/espacios/7/bloqueos')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ fechaInicio: '2026-12-22', fechaFin: '2026-12-26' })
      .expect(409);

    permisosMock = [{ numero: 'PER-2026-00001' }];
    bloqueosMock = [];
    const conflictPermiso = await request(app.getHttpServer())
      .post('/gestor/espacios/7/bloqueos')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ fechaInicio: '2026-11-10', fechaFin: '2026-11-12' })
      .expect(409);
    expect(conflictPermiso.body.message).toContain('PER-2026-00001');

    bloqueosMock = [
      {
        id: 12n,
        espacio_id: 7n,
        fecha_inicio: '2026-12-20',
        fecha_fin: '2026-12-24',
        motivo: 'Evento navideño',
        creado_por: 1n,
        creado_en: FECHA,
      },
    ];
    permisosMock = [];

    const editado = await request(app.getHttpServer())
      .patch('/gestor/espacios/7/bloqueos/12')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .send({ motivo: 'Evento actualizado' })
      .expect(200);
    expect(editado.body.motivo).toBe('Evento actualizado');

    await request(app.getHttpServer())
      .delete('/gestor/espacios/7/bloqueos/12')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .expect(204);
  });

  it('elimina un espacio sin relaciones y rechaza si tiene permisos', async () => {
    await request(app.getHttpServer())
      .delete('/gestor/espacios/7')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(204);

    espacioExiste = true;
    relacionesMock = { permisos: 1, solicitudes: 0 };

    await request(app.getHttpServer())
      .delete('/gestor/espacios/7')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(409);
  });

  it('devuelve el historial del espacio', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/gestor/espacios/7/historial')
      .set('Authorization', `Bearer ${tokenRevisor}`)
      .expect(200);

    expect(respuesta.body.espacio).toMatchObject({ id: '7' });
    expect(respuesta.body.datos[0]).toMatchObject({
      tabla: 'espacios_temporales',
      accion: 'insert',
      actorNombre: 'Laura',
    });
  });

  it('valida identificadores y paginación', async () => {
    await request(app.getHttpServer())
      .get('/gestor/espacios/abc')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(400);

    await request(app.getHttpServer())
      .get('/gestor/espacios/999')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(404);

    await request(app.getHttpServer())
      .get('/gestor/espacios?pagina=0')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(400);
  });
});
