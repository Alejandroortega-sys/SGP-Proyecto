import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { perfil_gestor } from '../../generated/prisma/client';
import { PERFIL_GESTOR_KEY } from '../decorators/perfil-gestor.decorator';
import type { UsuarioAutenticado } from '../interfaces/usuario-autenticado.interface';

/** Petición Express con el usuario autenticado adjunto. */
interface PeticionAutenticada extends Request {
  usuario?: UsuarioAutenticado;
}

/**
 * Guard global de autorización por perfil de gestor.
 *
 * Se ejecuta después de `JwtAuthGuard` y `RolesGuard` (orden de los
 * `APP_GUARD`). Lee los perfiles declarados con `@PerfilGestor(...)`:
 * - Sin metadatos: cualquier usuario autenticado puede pasar.
 * - Con metadatos: solo los gestores con uno de esos perfiles; el resto
 *   recibe 403.
 *
 * El perfil se toma de `request.usuario`, recargado de la base de datos por
 * `JwtAuthGuard`, por lo que un cambio de perfil surte efecto de inmediato.
 */
@Injectable()
export class PerfilGestorGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const perfilesPermitidos = this.reflector.getAllAndOverride<
      perfil_gestor[] | undefined
    >(PERFIL_GESTOR_KEY, [context.getHandler(), context.getClass()]);

    if (!perfilesPermitidos || perfilesPermitidos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<PeticionAutenticada>();
    const usuario = request.usuario;

    if (!usuario) {
      // No debería ocurrir: JwtAuthGuard corre antes y deja `usuario`.
      throw new UnauthorizedException('No hay un usuario autenticado');
    }

    if (usuario.rol !== 'gestor') {
      throw new ForbiddenException(
        `El rol "${usuario.rol}" no tiene permiso para este recurso. ` +
          `Perfiles de gestor permitidos: ${perfilesPermitidos.join(', ')}.`,
      );
    }

    if (!usuario.perfil || !perfilesPermitidos.includes(usuario.perfil)) {
      throw new ForbiddenException(
        `El perfil de gestor "${usuario.perfil ?? 'sin perfil'}" no tiene ` +
          `permiso para este recurso. Perfiles permitidos: ` +
          `${perfilesPermitidos.join(', ')}.`,
      );
    }

    return true;
  }
}
