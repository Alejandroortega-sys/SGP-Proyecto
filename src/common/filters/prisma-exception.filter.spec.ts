import { NotFoundException } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { PrismaExceptionFilter } from './prisma-exception.filter';
import { Prisma } from '../../generated/prisma/client';

const CLIENT_VERSION = '7.10.0';

function createHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

function knownRequestError(
  code: string,
  options: { message?: string; meta?: Record<string, unknown> } = {},
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    options.message ?? 'Error de prueba',
    { code, clientVersion: CLIENT_VERSION, meta: options.meta },
  );
}

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;

  beforeAll(() => {
    // Silencia los logs de error esperados durante las pruebas.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
  });

  describe('P-codes de Prisma', () => {
    it('P2002 con constraint conocida → 409 con mensaje en español', () => {
      const { host, status, json } = createHost();
      const error = knownRequestError('P2002', {
        message: 'Unique constraint failed',
        meta: {
          driverAdapterError: {
            cause: {
              kind: 'UniqueConstraintViolation',
              originalCode: '23505',
              originalMessage:
                'duplicate key value violates unique constraint "usuarios_correo_key"',
              constraint: { index: 'usuarios_correo_key' },
              table: 'usuarios',
            },
          },
        },
      });

      filter.catch(error, host);

      expect(status).toHaveBeenCalledWith(409);
      expect(json).toHaveBeenCalledWith({
        statusCode: 409,
        message: 'El correo ya está registrado',
        error: 'Conflict',
      });
    });

    it('P2002 con target clásico → 409 mencionando el campo', () => {
      const { host, json } = createHost();
      const error = knownRequestError('P2002', {
        meta: { target: ['correo'] },
      });

      filter.catch(error, host);

      const body = json.mock.calls[0][0];
      expect(body.statusCode).toBe(409);
      expect(body.message).toContain('correo');
    });

    it('P2003 (violación de FK) → 409', () => {
      const { host, json } = createHost();
      const error = knownRequestError('P2003', {
        meta: { driverAdapterError: { cause: { kind: 'ForeignKeyConstraintViolation' } } },
      });

      filter.catch(error, host);

      const body = json.mock.calls[0][0];
      expect(body.statusCode).toBe(409);
      expect(body.error).toBe('Conflict');
    });

    it('P2025 (registro no encontrado) → 404', () => {
      const { host, json } = createHost();
      const error = knownRequestError('P2025', {
        message: 'An operation failed because it depends on one or more records that were required but not found.',
      });

      filter.catch(error, host);

      expect(json).toHaveBeenCalledWith({
        statusCode: 404,
        message: 'El registro solicitado no existe',
        error: 'Not Found',
      });
    });

    it('P2011 (null obligatorio) → 400 mencionando el campo', () => {
      const { host, json } = createHost();
      const error = knownRequestError('P2011', {
        meta: { target: ['password_hash'] },
      });

      filter.catch(error, host);

      const body = json.mock.calls[0][0];
      expect(body.statusCode).toBe(400);
      expect(body.message).toContain('password_hash');
    });

    it('P2010 (raw query) con check 23514 en el mensaje → 400 regla de negocio', () => {
      const { host, json } = createHost();
      const error = knownRequestError('P2010', {
        message:
          'Raw query failed. Code: `23514`. Message: `new row for relation "usuarios" violates check constraint "usuarios_check"`',
      });

      filter.catch(error, host);

      expect(json).toHaveBeenCalledWith({
        statusCode: 400,
        message: 'Un comerciante debe tener documento, teléfono y contraseña',
        error: 'Bad Request',
      });
    });

    it('P2010 con check 23514 en mensaje localizado (español) → 400 regla de negocio', () => {
      const { host, json } = createHost();
      const error = knownRequestError('P2010', {
        message:
          'Raw query failed. Code: `23514`. Message: `el nuevo registro para la relación «usuarios» viola la restricción «check» «usuarios_check»`',
      });

      filter.catch(error, host);

      expect(json).toHaveBeenCalledWith({
        statusCode: 400,
        message: 'Un comerciante debe tener documento, teléfono y contraseña',
        error: 'Bad Request',
      });
    });

    it('P2039 con exclusión 23P01 del adapter → 409 solapamiento', () => {
      const { host, json } = createHost();
      const error = knownRequestError('P2039', {
        message: 'Database error. Code: `23P01`.',
        meta: {
          driverAdapterError: {
            cause: {
              kind: 'postgres',
              originalCode: '23P01',
              code: '23P01',
              originalMessage:
                'insert or update on table "ferias" violates row-exclusion constraint "ferias_zona_id_daterange_excl"',
            },
          },
        },
      });

      filter.catch(error, host);

      expect(json).toHaveBeenCalledWith({
        statusCode: 409,
        message: 'Ya hay una feria en esa zona dentro de esas fechas',
        error: 'Conflict',
      });
    });

    it('P1001 (BD inalcanzable) → 503', () => {
      const { host, json } = createHost();
      const error = knownRequestError('P1001', {
        message: "Can't reach database server at `localhost:5432`",
      });

      filter.catch(error, host);

      const body = json.mock.calls[0][0];
      expect(body.statusCode).toBe(503);
      expect(body.error).toBe('Service Unavailable');
    });
  });

  describe('Clases de error de Prisma', () => {
    it('PrismaClientValidationError → 500 genérico (no expone detalles)', () => {
      const { host, json } = createHost();
      const error = new Prisma.PrismaClientValidationError(
        'Unknown argument `foo`',
        { clientVersion: CLIENT_VERSION },
      );

      filter.catch(error, host);

      expect(json).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Error interno del servidor',
        error: 'Internal Server Error',
      });
    });

    it('PrismaClientInitializationError → 503', () => {
      const { host, json } = createHost();
      const error = new Prisma.PrismaClientInitializationError(
        'Error connecting to the database',
        CLIENT_VERSION,
      );

      filter.catch(error, host);

      const body = json.mock.calls[0][0];
      expect(body.statusCode).toBe(503);
    });
  });

  describe('Errores crudos de PostgreSQL (sin envolver)', () => {
    it('unique_violation 23505 con constraint → 409 con mensaje en español', () => {
      const { host, json } = createHost();
      const rawError = {
        code: '23505',
        severity: 'ERROR',
        message:
          'duplicate key value violates unique constraint "usuarios_correo_key"',
        constraint: 'usuarios_correo_key',
      };

      filter.catch(rawError, host);

      expect(json).toHaveBeenCalledWith({
        statusCode: 409,
        message: 'El correo ya está registrado',
        error: 'Conflict',
      });
    });

    it('exclusion_violation 23P01 sin constraint → 409 genérico de solapamiento', () => {
      const { host, json } = createHost();
      const rawError = {
        code: '23P01',
        severity: 'ERROR',
        message: 'conflicts with existing row',
      };

      filter.catch(rawError, host);

      const body = json.mock.calls[0][0];
      expect(body.statusCode).toBe(409);
      expect(body.message).toContain('solapa');
    });
  });

  describe('Paso de excepciones que NO son de Prisma', () => {
    it('HttpException conserva su estado y cuerpo original', () => {
      const { host, status, json } = createHost();
      const exception = new NotFoundException('Recurso de prueba');

      filter.catch(exception, host);

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({
        statusCode: 404,
        message: 'Recurso de prueba',
        error: 'Not Found',
      });
    });

    it('Error desconocido → 500 genérico', () => {
      const { host, json } = createHost();

      filter.catch(new Error('boom'), host);

      expect(json).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Internal server error',
      });
    });
  });
});
