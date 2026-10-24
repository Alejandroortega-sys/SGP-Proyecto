import { SetMetadata } from '@nestjs/common';

/** Clave de metadatos que marca un endpoint como público. */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca un endpoint (o un controlador completo) como público.
 *
 * `JwtAuthGuard` lo omite: no exige `Authorization: Bearer`. Se usa en
 * login, registro y activación, que deben funcionar sin sesión.
 *
 * @example
 * ```ts
 * @Public()
 * @Post('login')
 * login(): ...
 * ```
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
