import { SetMetadata } from '@nestjs/common';
import type { rol_usuario } from '../../generated/prisma/client';

/** Clave de metadatos con los roles autorizados para un endpoint. */
export const ROLES_KEY = 'roles';

/**
 * Restringe un endpoint a los roles indicados.
 *
 * `RolesGuard` compara el rol del usuario autenticado (recargado de la BD)
 * con la lista. Sin este decorador, cualquier usuario autenticado puede
 * acceder.
 *
 * @param roles Roles permitidos: `comerciante`, `organizador` o `gestor`.
 *
 * @example
 * ```ts
 * @Roles('gestor')
 * @Get('usuarios')
 * listar(): ...
 * ```
 */
export const Roles = (
  ...roles: rol_usuario[]
): MethodDecorator & ClassDecorator => SetMetadata(ROLES_KEY, roles);
