import * as argon2 from 'argon2';

/**
 * Parámetros de hash argon2id compartidos por todos los flujos que crean o
 * actualizan contraseñas (registro, restablecimiento y cambio desde el
 * perfil). Mínimo recomendado por OWASP para aplicaciones web.
 */
export const OPCIONES_ARGON2: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};
