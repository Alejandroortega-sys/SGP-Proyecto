import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { rol_usuario } from '../../generated/prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { UsuarioAutenticado } from '../interfaces/usuario-autenticado.interface';

/** Petición Express con el usuario autenticado adjunto. */
interface PeticionAutenticada extends Request {
  usuario?: UsuarioAutenticado;
}

/**
 * Guard global de autorización por rol.
 *
 * Se ejecuta después de `JwtAuthGuard` (orden de los `APP_GUARD`). Lee los
 * roles declarados con `@Roles(...)`:
 * - Sin metadatos: cualquier usuario autenticado puede pasar.
 * - Con metadatos: solo los roles listados; el resto recibe 403.
 *
 * El rol se toma de `request.usuario`, que `JwtAuthGuard` recarga de la base
 * de datos, por lo que un cambio de rol surte efecto de inmediato.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesPermitidos = this.reflector.getAllAndOverride<
      rol_usuario[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!rolesPermitidos || rolesPermitidos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<PeticionAutenticada>();
    const usuario = request.usuario;

    if (!usuario) {
      // No debería ocurrir: JwtAuthGuard corre antes y deja `usuario`.
      throw new UnauthorizedException('No hay un usuario autenticado');
    }

    if (!rolesPermitidos.includes(usuario.rol)) {
      throw new ForbiddenException(
        `El rol "${usuario.rol}" no tiene permiso para este recurso. ` +
          `Roles permitidos: ${rolesPermitidos.join(', ')}.`,
      );
    }

    return true;
  }
}
