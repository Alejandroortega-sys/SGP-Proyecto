import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerException,
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import {
  LIMITE_LOGIN_DEFECTO,
  VENTANA_LOGIN_DEFECTO_MS,
  crearOpcionesThrottler,
  mensajeLimiteExcedido,
} from './throttler.config';

/** ConfigService simulado a partir de un diccionario de variables. */
function crearConfig(valores: Record<string, string> = {}): ConfigService {
  const todas: Record<string, string> = {
    LOGIN_RATE_LIMIT_MAX: '10',
    LOGIN_RATE_LIMIT_WINDOW_MS: '60000',
    ...valores,
  };
  return { get: (clave: string) => todas[clave] } as unknown as ConfigService;
}

const MANEJADOR = () => undefined;
class CONTROLADOR {}

interface RespuestaFalsa {
  header: jest.Mock;
  setHeader: jest.Mock;
}

function crearContexto(ip: string): {
  contexto: ExecutionContext;
  respuesta: RespuestaFalsa;
} {
  const respuesta = { header: jest.fn(), setHeader: jest.fn() };
  const contexto = {
    getHandler: () => MANEJADOR,
    getClass: () => CONTROLADOR,
    switchToHttp: () => ({
      getRequest: () => ({ ip, headers: {} }),
      getResponse: () => respuesta,
    }),
  } as unknown as ExecutionContext;
  return { contexto, respuesta };
}

/**
 * Construye el guard igual que en tiempo de ejecución: con las opciones de
 * `crearOpcionesThrottler`, el almacenamiento en memoria y el Reflector.
 */
async function crearGuard(
  config: ConfigService = crearConfig(),
): Promise<ThrottlerGuard> {
  const guard = new ThrottlerGuard(
    crearOpcionesThrottler(config),
    new ThrottlerStorageService(),
    new Reflector(),
  );
  await guard.onModuleInit();
  return guard;
}

describe('Rate limit del login', () => {
  describe('crearOpcionesThrottler', () => {
    it('usa 10 peticiones y una ventana de 60 segundos por defecto', () => {
      const opciones = crearOpcionesThrottler(crearConfig());

      expect(opciones.throttlers[0]?.limit).toBe(LIMITE_LOGIN_DEFECTO);
      expect(LIMITE_LOGIN_DEFECTO).toBe(10);
      expect(opciones.throttlers[0]?.ttl).toBe(VENTANA_LOGIN_DEFECTO_MS);
      expect(VENTANA_LOGIN_DEFECTO_MS).toBe(60_000);
    });

    it('lee el límite y la ventana del entorno', () => {
      const opciones = crearOpcionesThrottler(
        crearConfig({
          LOGIN_RATE_LIMIT_MAX: '3',
          LOGIN_RATE_LIMIT_WINDOW_MS: '2000',
        }),
      );

      expect(opciones.throttlers[0]?.limit).toBe(3);
      expect(opciones.throttlers[0]?.ttl).toBe(2000);
    });

    it('ignora valores vacíos o no positivos', () => {
      const opciones = crearOpcionesThrottler(
        crearConfig({
          LOGIN_RATE_LIMIT_MAX: 'abc',
          LOGIN_RATE_LIMIT_WINDOW_MS: '0',
        }),
      );

      expect(opciones.throttlers[0]?.limit).toBe(10);
      expect(opciones.throttlers[0]?.ttl).toBe(60_000);
    });
  });

  describe('mensajeLimiteExcedido', () => {
    it('incluye el límite y los segundos restantes', () => {
      const mensaje = mensajeLimiteExcedido({
        limit: 10,
        timeToBlockExpire: 42,
      } as ThrottlerLimitDetail);

      expect(mensaje).toContain('Demasiadas peticiones');
      expect(mensaje).toContain('10 peticiones por minuto');
      expect(mensaje).toContain('42 segundo(s)');
    });

    it('nunca promete menos de 1 segundo de espera', () => {
      const mensaje = mensajeLimiteExcedido({
        limit: 10,
        timeToBlockExpire: 0,
      } as ThrottlerLimitDetail);

      expect(mensaje).toContain('1 segundo(s)');
    });
  });

  describe('ThrottlerGuard con la configuración del login', () => {
    it('permite 10 peticiones y responde 429 en la 11', async () => {
      const guard = await crearGuard();
      const { contexto } = crearContexto('203.0.113.10');

      for (let intento = 1; intento <= 10; intento++) {
        await expect(guard.canActivate(contexto)).resolves.toBe(true);
      }

      // La 11.ª petición de la misma IP recibe 429 en español.
      await expect(guard.canActivate(contexto)).rejects.toBeInstanceOf(
        ThrottlerException,
      );
      const error = await guard.canActivate(contexto).catch((e) => e);
      expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(error.message).toContain('Demasiadas peticiones');
    });

    it('cuenta cada IP por separado', async () => {
      const guard = await crearGuard();
      const primera = crearContexto('203.0.113.10');
      const segunda = crearContexto('198.51.100.20');

      for (let intento = 0; intento < 10; intento++) {
        await guard.canActivate(primera.contexto);
      }
      await expect(guard.canActivate(primera.contexto)).rejects.toBeInstanceOf(
        ThrottlerException,
      );

      // La otra IP no se ve afectada por el bloqueo de la primera.
      await expect(guard.canActivate(segunda.contexto)).resolves.toBe(true);
    });

    it('envía los encabezados X-RateLimit y Retry-After', async () => {
      const guard = await crearGuard();
      const { contexto, respuesta } = crearContexto('203.0.113.10');

      await guard.canActivate(contexto);
      expect(respuesta.header).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
      expect(respuesta.header).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        9,
      );

      for (let intento = 0; intento < 10; intento++) {
        await guard.canActivate(contexto).catch(() => undefined);
      }
      expect(respuesta.header).toHaveBeenCalledWith(
        'Retry-After',
        expect.any(Number),
      );
    });

    it('desbloquea la IP al expirar la ventana', async () => {
      // Ventana corta para no alargar la prueba: 2 peticiones / 150 ms.
      const guard = await crearGuard(
        crearConfig({
          LOGIN_RATE_LIMIT_MAX: '2',
          LOGIN_RATE_LIMIT_WINDOW_MS: '150',
        }),
      );
      const { contexto } = crearContexto('192.0.2.30');

      await expect(guard.canActivate(contexto)).resolves.toBe(true);
      await expect(guard.canActivate(contexto)).resolves.toBe(true);
      await expect(guard.canActivate(contexto)).rejects.toBeInstanceOf(
        ThrottlerException,
      );

      await new Promise((resolver) => setTimeout(resolver, 250));

      // La ventana ya expiró: la misma IP puede volver a intentar.
      await expect(guard.canActivate(contexto)).resolves.toBe(true);
    });
  });
});
