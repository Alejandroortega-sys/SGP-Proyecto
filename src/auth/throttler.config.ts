import { ConfigService } from '@nestjs/config';
import type {
  ThrottlerLimitDetail,
  ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { enteroPositivo } from '../common/entero-positivo';

/** Límite por defecto del login: 10 peticiones por IP. */
export const LIMITE_LOGIN_DEFECTO = 10;

/** Ventana por defecto del login: 1 minuto, en milisegundos. */
export const VENTANA_LOGIN_DEFECTO_MS = 60_000;

/**
 * Mensaje del 429 del login con los segundos restantes de la ventana.
 *
 * Lo usa `ThrottlerGuard` a través de la opción `errorMessage`, que recibe
 * el detalle del intento bloqueado (`timeToBlockExpire` viene en segundos).
 */
export function mensajeLimiteExcedido(
  detalle: ThrottlerLimitDetail,
): string {
  const segundos = Math.max(1, Math.ceil(detalle.timeToBlockExpire));
  return (
    `Demasiadas peticiones desde esta IP: este recurso admite ` +
    `${detalle.limit} peticiones por minuto. Inténtalo de nuevo en ` +
    `${segundos} segundo(s).`
  );
}

/**
 * Opciones del `ThrottlerModule` para el rate limit del login.
 *
 * Limita cada IP a `LOGIN_RATE_LIMIT_MAX` peticiones por
 * `LOGIN_RATE_LIMIT_WINDOW_MS`; al superarlo, la IP recibe 429 (con el
 * encabezado `Retry-After`, que el guard setea automáticamente) hasta que
 * se libera la ventana. Se complementa con el bloqueo por cuenta de
 * `AuthService`: el rate limit protege por IP, el bloqueo por usuario.
 *
 * El contador vive en memoria del proceso: reiniciar el servidor lo limpia
 * y, con varias instancias, cada una contaría por separado (para eso se
 * usaría un almacenamiento compartido como Redis en el futuro).
 */
export function crearOpcionesThrottler(
  config: ConfigService,
): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        // Sin `name`, el guard usa el nombre "default" y los encabezados de
        // la respuesta quedan estándar: Retry-After y X-RateLimit-*.
        limit: enteroPositivo(
          config.get('LOGIN_RATE_LIMIT_MAX'),
          LIMITE_LOGIN_DEFECTO,
        ),
        ttl: enteroPositivo(
          config.get('LOGIN_RATE_LIMIT_WINDOW_MS'),
          VENTANA_LOGIN_DEFECTO_MS,
        ),
      },
    ],
    // El guard llama a errorMessage con (contexto, detalle): se ignora el
    // contexto y el mensaje se arma con el detalle del intento bloqueado.
    errorMessage: (_contexto, detalle) => mensajeLimiteExcedido(detalle),
  };
}
