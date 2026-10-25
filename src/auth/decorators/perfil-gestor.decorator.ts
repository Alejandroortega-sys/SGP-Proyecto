import { SetMetadata } from '@nestjs/common';
import type { perfil_gestor } from '../../generated/prisma/client';

/** Clave de metadatos con los perfiles de gestor autorizados. */
export const PERFIL_GESTOR_KEY = 'perfilGestor';

/**
 * Restringe un endpoint a uno o varios perfiles de gestor.
 *
 * `RolesGuard` ya limita el acceso al rol `gestor`; este decorador permite
 * distinguir dentro de ese rol entre `revisor` y `administrador`. El perfil se
 * toma de `request.usuario.perfil`, que `JwtAuthGuard` recarga de la base de
 * datos en cada petición.
 *
 * @param perfiles Perfiles permitidos: `revisor` y/o `administrador`.
 *
 * @example
 * ```ts
 * @Roles('gestor')
 * @PerfilGestor('administrador')
 * @Patch('usuarios/:id/estado')
 * cambiarEstado(): ...
 * ```
 */
export const PerfilGestor = (
  ...perfiles: perfil_gestor[]
): MethodDecorator & ClassDecorator => SetMetadata(PERFIL_GESTOR_KEY, perfiles);
