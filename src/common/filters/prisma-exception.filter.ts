import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

/**
 * Información del error original de PostgreSQL extraída del error de Prisma.
 *
 * Con el driver adapter (`@prisma/adapter-pg`) el error crudo queda anidado en
 * `meta.driverAdapterError`. Los códigos que el adapter NO mapea (checks
 * `23514`, exclusiones `23P01`, etc.) llegan como P2010/P2039 con el código
 * PostgreSQL original en `originalCode` o dentro del mensaje del error.
 */
interface DbErrorInfo {
  /** Código original de PostgreSQL (ej. '23505', '23514', '23P01'). */
  pgCode?: string;
  /** Nombre de la constraint violada (ej. 'usuarios_correo_key'). */
  constraint?: string;
  /** Columnas involucradas, cuando el adapter las reporta. */
  fields?: string[];
  /** Tabla involucrada. */
  table?: string;
}

interface TranslatedError {
  status: number;
  message: string;
}

type JsonRecord = Record<string, unknown>;

/** Mensajes amigables para las restricciones UNIQUE del modelo. */
const UNIQUE_CONSTRAINT_MESSAGES: Record<string, string> = {
  usuarios_correo_key: 'El correo ya está registrado',
  usuarios_documento_key: 'El documento ya está registrado',
  organizadores_nit_key: 'El NIT ya está registrado',
  productos_nombre_key: 'Ya existe un producto con ese nombre',
  modulos_codigo_key: 'Ya existe un módulo con ese código',
  solicitudes_numero_radicado_key: 'El número de radicado ya existe',
  ferias_numero_radicado_key: 'El número de radicado de feria ya existe',
  permisos_numero_key: 'El número de permiso ya existe',
  permisos_qr_token_key: 'El token QR ya existe',
  permisos_solicitud_id_key: 'La solicitud ya tiene un permiso asociado',
  cobros_permiso_id_key: 'El permiso ya tiene un cobro asociado',
  tokens_seguridad_token_hash_key: 'El token de seguridad ya existe',
  feria_vendedores_feria_id_documento_key:
    'El vendedor ya está registrado en esta feria',
};

/** Mensajes amigables para los CHECK del modelo (reglas de negocio en la BD). */
const CHECK_CONSTRAINT_MESSAGES: Record<string, string> = {
  usuarios_check: 'Un comerciante debe tener documento, teléfono y contraseña',
  usuarios_check1: 'La cuenta no puede quedar activa sin contraseña',
  solicitudes_check: 'La fecha fin debe ser mayor o igual a la fecha de inicio',
  solicitudes_check1: 'La hora fin debe ser mayor a la hora de inicio',
  ferias_check: 'La fecha fin de la feria debe ser mayor o igual a la fecha de inicio',
  ferias_numero_puestos_check: 'El número de puestos debe ser mayor que cero',
  permisos_check: 'La fecha fin del permiso debe ser mayor o igual a la fecha de inicio',
  espacio_bloqueos_check:
    'La fecha fin del bloqueo debe ser mayor o igual a la fecha de inicio',
  zonas_geometria_check: 'La geometría de la zona no es válida',
  zonas_aforo_maximo_check: 'El aforo máximo debe ser mayor que cero',
  tarifas_valor_check: 'El valor de la tarifa no puede ser negativo',
  parametros_motor_valor_check: 'El valor del parámetro no puede ser negativo',
  modulos_check: 'El módulo debe tener titular o nombre de titular',
};

/** Mensajes para las restricciones de EXCLUSIÓN (solapamientos con gist). */
const EXCLUSION_CONSTRAINT_MESSAGES: Record<string, string> = {
  espacio_bloqueos_espacio_id_daterange_excl:
    'El espacio ya tiene un bloqueo que se solapa con esas fechas',
  ferias_zona_id_daterange_excl: 'Ya hay una feria en esa zona dentro de esas fechas',
  permisos_espacio_id_daterange_excl:
    'El espacio ya está asignado a otro permiso dentro de esas fechas',
};

const FOREIGN_KEY_MESSAGE =
  'No se puede completar la operación porque el registro está relacionado con otros datos';

/** Título estándar del campo `error` en el cuerpo de respuesta de NestJS. */
const HTTP_ERROR_TITLES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
};

const PG_CODE_IN_MESSAGE = /Code: `([^`]+)`/;
const CONSTRAINT_IN_MESSAGE = /constraint "([^"]+)"/;
const CONSTRAINT_TOKEN_IN_MESSAGE = /[«"]([^«»"]+)[»"]/g;
/** Sufijos estándar de constraints de PostgreSQL. */
const CONSTRAINT_SUFFIX = /_(?:key|check|excl|fkey|pkey)$/;

/**
 * Filtro global de excepciones: traduce los errores de Prisma/PostgreSQL a
 * respuestas HTTP con mensajes en español. Cualquier otra excepción (p. ej.
 * `HttpException` lanzada por un pipe o un servicio) se maneja con el
 * comportamiento por defecto de NestJS, sin interferir.
 *
 * Se registra como `APP_FILTER` en `AppModule`, por lo que aplica a todos los
 * módulos sin necesidad de importar nada. Ver `docs/uso_db.md` (sección
 * "Manejo de errores") para la tabla completa de traducciones.
 */
@Catch()
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('PrismaExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const translated = this.translate(exception);

    if (translated) {
      const { status, message } = translated;

      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        const error = exception as Error;
        this.logger.error(
          `${message} — ${error?.message ?? String(exception)}`,
          error instanceof Error ? error.stack : undefined,
        );
      }

      const response = host.switchToHttp().getResponse();
      response.status(status).json({
        statusCode: status,
        message,
        error: HTTP_ERROR_TITLES[status] ?? 'Error',
      });
      return;
    }

    this.defaultHandling(exception, host);
  }

  /**
   * Traduce un error de Prisma/PostgreSQL. Devuelve `undefined` si la
   * excepción no pertenece a la base de datos y debe manejarse por defecto.
   */
  private translate(exception: unknown): TranslatedError | undefined {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromKnownRequestError(exception);
    }
    if (exception instanceof Prisma.PrismaClientValidationError) {
      // Bug de código: la consulta Prisma está mal construida. No se exponen
      // detalles al cliente, pero el mensaje real queda en los logs.
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error interno del servidor',
      };
    }
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'No fue posible conectar con la base de datos',
      };
    }
    if (exception instanceof Prisma.PrismaClientUnknownRequestError) {
      const info = extractFromCause(exception);
      if (info.pgCode) {
        return this.fromPgCode(info);
      }
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error inesperado de la base de datos',
      };
    }
    // Error crudo de PostgreSQL que el driver adapter propagó sin envolver.
    if (isRawPgError(exception)) {
      return this.fromPgCode(extractFromRawPgError(exception));
    }
    return undefined;
  }

  private fromKnownRequestError(
    err: Prisma.PrismaClientKnownRequestError,
  ): TranslatedError {
    const info = extractDbInfo(err);

    switch (err.code) {
      case 'P2002': // unique_violation
        return { status: HttpStatus.CONFLICT, message: uniqueMessage(info) };
      case 'P2003': // foreign_key_violation / restrict
        return { status: HttpStatus.CONFLICT, message: FOREIGN_KEY_MESSAGE };
      case 'P2011': // not_null_violation
        return { status: HttpStatus.BAD_REQUEST, message: nullMessage(info) };
      case 'P2025': // registro requerido no encontrado
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'El registro solicitado no existe',
        };
      case 'P2020': // value_out_of_range
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Un valor numérico está fuera del rango permitido',
        };
      case 'P2007': // invalid_input_value (22P02)
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Uno de los valores enviados no es válido',
        };
      // Errores genéricos del driver adapter: llevan el código PostgreSQL
      // original en `originalCode` o en el mensaje ("... Code: `X` ...").
      // Aquí caen los checks (23514) y las exclusiones (23P01) de PostGIS.
      case 'P2010':
      case 'P2039': {
        if (info.pgCode) {
          return this.fromPgCode(info);
        }
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Error al ejecutar la consulta en la base de datos',
        };
      }
      case 'P1001':
      case 'P1002':
      case 'P1008':
      case 'P1017':
      case 'P2037': // conexiones caídas / demasiadas conexiones
        return {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'No fue posible conectar con la base de datos',
        };
      case 'P1000':
      case 'P1010':
      case 'P1011': // credenciales / permisos / TLS
        return {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'La configuración de acceso a la base de datos es inválida',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Error interno del servidor',
        };
    }
  }

  private fromPgCode(info: DbErrorInfo): TranslatedError {
    switch (info.pgCode) {
      case '23505': // unique_violation
        return { status: HttpStatus.CONFLICT, message: uniqueMessage(info) };
      case '23503': // foreign_key_violation
        return { status: HttpStatus.CONFLICT, message: FOREIGN_KEY_MESSAGE };
      case '23502': // not_null_violation
        return { status: HttpStatus.BAD_REQUEST, message: nullMessage(info) };
      case '23514': // check_violation (reglas de negocio en la BD)
        return { status: HttpStatus.BAD_REQUEST, message: checkMessage(info) };
      case '23P01': // exclusion_violation (solapamientos de fechas/zona)
        return { status: HttpStatus.CONFLICT, message: exclusionMessage(info) };
      case '22003': // numeric_value_out_of_range
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Un valor numérico está fuera del rango permitido',
        };
      case '22001': // string_data_right_truncation
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Un valor excede la longitud máxima permitida',
        };
      case '22P02': // invalid_text_representation (ej. enum inexistente)
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Uno de los valores enviados no es válido',
        };
      case '40001':
      case '40P01': // serialización fallida
        return {
          status: HttpStatus.CONFLICT,
          message:
            'Conflicto de concurrencia al actualizar los datos, reintenta la operación',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Error inesperado de la base de datos',
        };
    }
  }

  /**
   * Comportamiento por defecto de NestJS para las excepciones que no son de
   * Prisma/PostgreSQL: una `HttpException` conserva su estado y cuerpo
   * original, cualquier otra cosa responde 500 y se registra en los logs.
   */
  private defaultHandling(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json(
        typeof body === 'string' ? { statusCode: status, message: body } : body,
      );
      return;
    }

    const error = exception instanceof Error ? exception : undefined;
    this.logger.error(
      `Unhandled exception: ${error?.message ?? String(exception)}`,
      error?.stack,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}

// ---------------------------------------------------------------------------
// Extracción de información del error original
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'string')
    ? (value as string[])
    : undefined;
}

/**
 * Detecta un error crudo de PostgreSQL (el driver adapter lo propaga sin
 * envolver cuando no reconoce su forma): tiene `code`, `message` y
 * `severity` como strings, igual que el chequeo `isDriverError` del adapter.
 */
function isRawPgError(err: unknown): err is JsonRecord {
  return (
    isObject(err) &&
    asString(err['code']) !== undefined &&
    asString(err['severity']) !== undefined &&
    asString(err['message']) !== undefined
  );
}

function extractFromRawPgError(err: JsonRecord): DbErrorInfo {
  return {
    pgCode: asString(err['code']),
    constraint: asString(err['constraint']),
    table: asString(err['table']),
  };
}

/**
 * El driver adapter envuelve el error original en un objeto con `kind`,
 * `originalCode`, `originalMessage`, `constraint`, etc. Puede venir directo o
 * dentro de un `Error` intermedio (propiedad `cause`).
 */
function unwrapAdapterError(value: unknown): JsonRecord | undefined {
  if (!isObject(value)) return undefined;
  const cause = value['cause'];
  if (isObject(cause) && typeof cause['kind'] === 'string') return cause;
  if (typeof value['kind'] === 'string') return value;
  return undefined;
}

/**
 * La constraint puede venir como `{ index: 'nombre' }`, como
 * `{ fields: ['col'] }` o como un string plano.
 */
function constraintFrom(value: unknown): {
  constraint?: string;
  fields?: string[];
} {
  if (typeof value === 'string') return { constraint: value };
  if (isObject(value)) {
    return {
      constraint: asString(value['index']),
      fields: asStringArray(value['fields']),
    };
  }
  return {};
}

function pgCodeFromMessage(message: string | undefined): string | undefined {
  if (!message) return undefined;
  return PG_CODE_IN_MESSAGE.exec(message)?.[1];
}

function constraintFromMessage(
  message: string | undefined,
): string | undefined {
  if (!message) return undefined;
  // Servidor con mensajes en inglés: ... violates check constraint "NAME" ...
  const english = CONSTRAINT_IN_MESSAGE.exec(message)?.[1];
  if (english) return english;
  // Servidor localizado (p. ej. español): la constraint aparece entre
  // guillemets («NAME»). Se prefiere el token con sufijo de constraint de
  // PostgreSQL (_key, _check, _excl, _fkey, _pkey) y como último recurso
  // se toma el último token entrecomillado del mensaje.
  const tokens = [...message.matchAll(CONSTRAINT_TOKEN_IN_MESSAGE)].map(
    (match) => match[1],
  );
  return tokens.find((token) => CONSTRAINT_SUFFIX.test(token)) ?? tokens.at(-1);
}

function extractDbInfo(err: Prisma.PrismaClientKnownRequestError): DbErrorInfo {
  const meta = isObject(err.meta) ? (err.meta as JsonRecord) : {};
  const adapter = unwrapAdapterError(meta['driverAdapterError']);
  const fromMeta = constraintFrom(meta['constraint']);
  const fromAdapter = adapter ? constraintFrom(adapter['constraint']) : {};
  const innerMessage = asString(adapter?.['originalMessage']) ?? err.message;

  return {
    pgCode:
      asString(adapter?.['originalCode']) ??
      asString(adapter?.['code']) ??
      pgCodeFromMessage(err.message),
    constraint:
      fromMeta.constraint ??
      fromAdapter.constraint ??
      constraintFromMessage(innerMessage),
    fields:
      asStringArray(meta['target']) ??
      fromMeta.fields ??
      fromAdapter.fields ??
      asStringArray(adapter?.['fields']),
    table: asString(meta['table']) ?? asString(adapter?.['table']),
  };
}

function extractFromCause(err: Prisma.PrismaClientUnknownRequestError): DbErrorInfo {
  const info: DbErrorInfo = {};
  const cause = err.cause;

  if (isRawPgError(cause)) {
    return extractFromRawPgError(cause);
  }
  if (isObject(cause)) {
    info.constraint = asString(cause['constraint']);
    info.pgCode =
      asString(cause['originalCode']) ??
      asString(cause['code']) ??
      pgCodeFromMessage(err.message);
  } else {
    info.pgCode = pgCodeFromMessage(err.message);
  }
  return info;
}

// ---------------------------------------------------------------------------
// Construcción de mensajes
// ---------------------------------------------------------------------------

function uniqueMessage(info: DbErrorInfo): string {
  if (info.constraint) {
    return (
      UNIQUE_CONSTRAINT_MESSAGES[info.constraint] ??
      `Ya existe un registro con ese valor (restricción "${info.constraint}")`
    );
  }
  if (info.fields?.length) {
    return `Ya existe un registro con el valor de: ${info.fields.join(', ')}`;
  }
  return 'Ya existe un registro con ese valor';
}

function checkMessage(info: DbErrorInfo): string {
  if (info.constraint) {
    return (
      CHECK_CONSTRAINT_MESSAGES[info.constraint] ??
      `La operación viola una regla de negocio de la base de datos (restricción "${info.constraint}")`
    );
  }
  return 'La operación viola una regla de negocio de la base de datos';
}

function exclusionMessage(info: DbErrorInfo): string {
  if (info.constraint) {
    return (
      EXCLUSION_CONSTRAINT_MESSAGES[info.constraint] ??
      `El registro se solapa con otro ya existente (restricción "${info.constraint}")`
    );
  }
  return 'El registro se solapa con otro ya existente (fechas, zona o espacio ocupado)';
}

function nullMessage(info: DbErrorInfo): string {
  if (info.fields?.length) {
    return `Falta un valor obligatorio en: ${info.fields.join(', ')}`;
  }
  return 'Falta un valor obligatorio';
}
