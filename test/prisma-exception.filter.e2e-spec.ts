import { Test, TestingModule } from '@nestjs/testing';
import { Controller, Get, INestApplication, NotFoundException, Post } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
// Aplica el parche de serialización de BigInt (main.ts no se ejecuta en tests)
import '../src/common/bigint-serialization';

/**
 * Controller de prueba: expone rutas que disparan errores reales de
 * PostgreSQL contra la base de datos sembrada, para validar de punta a punta
 * la traducción del filtro global PrismaExceptionFilter.
 */
@Controller('db-errors')
class DbErrorsTestController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('usuario-duplicado')
  async usuarioDuplicado() {
    // admin@tulua.gov.co existe en el seed → unique_violation (usuarios_correo_key)
    return this.prisma.usuarios.create({
      data: { rol: 'gestor', nombre: 'Duplicado', correo: 'admin@tulua.gov.co' },
    });
  }

  @Post('fk-inexistente')
  async fkInexistente() {
    // actor_id 999999 no existe en usuarios → foreign_key_violation
    return this.prisma.auditoria.create({
      data: { tabla: 'test', registro_id: 1n, accion: 'INSERT', actor_id: 999999n },
    });
  }

  @Get('usuario-inexistente')
  async usuarioInexistente() {
    // findUniqueOrThrow sin resultado → P2025
    return this.prisma.usuarios.findUniqueOrThrow({ where: { id: 999999n } });
  }

  @Post('check-violacion')
  async checkViolacion() {
    // Un comerciante sin documento/teléfono/contraseña viola usuarios_check
    const correo = `check-test-${Date.now()}@test.local`;
    await this.prisma.$executeRaw`INSERT INTO usuarios (rol, nombre, correo)
      VALUES ('comerciante', 'Check Test', ${correo})`;
    return { ok: true };
  }

  @Get('primer-usuario')
  async primerUsuario() {
    // El id BigInt debe serializarse como string gracias al parche global
    return this.prisma.usuarios.findFirst({
      select: { id: true, nombre: true },
      orderBy: { id: 'asc' },
    });
  }

  @Get('not-found')
  notFound() {
    throw new NotFoundException('Recurso de prueba');
  }
}

describe('PrismaExceptionFilter (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [DbErrorsTestController],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('unique_violation (P2002) → 409 con mensaje en español de la constraint', () => {
    return request(app.getHttpServer())
      .post('/db-errors/usuario-duplicado')
      .expect(409)
      .expect({
        statusCode: 409,
        message: 'El correo ya está registrado',
        error: 'Conflict',
      });
  });

  it('foreign_key_violation (P2003) → 409 con mensaje de datos relacionados', () => {
    return request(app.getHttpServer())
      .post('/db-errors/fk-inexistente')
      .expect(409)
      .expect((res) => {
        expect(res.body.error).toBe('Conflict');
        expect(res.body.message).toContain('relacionado');
      });
  });

  it('registro no encontrado (P2025) → 404', () => {
    return request(app.getHttpServer())
      .get('/db-errors/usuario-inexistente')
      .expect(404)
      .expect({
        statusCode: 404,
        message: 'El registro solicitado no existe',
        error: 'Not Found',
      });
  });

  it('check_violation (23514 vía $executeRaw) → 400 con regla de negocio', () => {
    return request(app.getHttpServer())
      .post('/db-errors/check-violacion')
      .expect(400)
      .expect({
        statusCode: 400,
        message: 'Un comerciante debe tener documento, teléfono y contraseña',
        error: 'Bad Request',
      });
  });

  it('BigInt: el id BIGINT se serializa como string en la respuesta', () => {
    return request(app.getHttpServer())
      .get('/db-errors/primer-usuario')
      .expect(200)
      .expect((res) => {
        expect(typeof res.body.id).toBe('string');
        expect(Number.isNaN(Number(res.body.id))).toBe(false);
        expect(res.body.nombre).toBe('Laura');
      });
  });

  it('las HttpException pasan intactas por el filtro (comportamiento por defecto)', () => {
    return request(app.getHttpServer())
      .get('/db-errors/not-found')
      .expect(404)
      .expect({
        statusCode: 404,
        message: 'Recurso de prueba',
        error: 'Not Found',
      });
  });
});
