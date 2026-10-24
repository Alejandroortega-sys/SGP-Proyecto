import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UsuarioAutenticado } from '../interfaces/usuario-autenticado.interface';

/**
 * Inyecta el usuario autenticado en un parámetro del controlador.
 *
 * El objeto lo coloca `JwtAuthGuard` tras validar el token y recargar la
 * cuenta desde la base de datos.
 *
 * @example
 * ```ts
 * @Get('perfil')
 * perfil(@UsuarioActual() usuario: UsuarioAutenticado) {
 *   return usuario;
 * }
 * ```
 */
export const UsuarioActual = createParamDecorator(
  (_datos: unknown, contexto: ExecutionContext): UsuarioAutenticado => {
    const request = contexto.switchToHttp().getRequest<{
      usuario?: UsuarioAutenticado;
    }>();
    return request.usuario as UsuarioAutenticado;
  },
);
