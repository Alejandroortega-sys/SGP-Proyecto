import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import type { UsuarioAutenticado } from '../interfaces/usuario-autenticado.interface';

/** Petición Express con el usuario autenticado adjunto. */
interface PeticionAutenticada extends Request {
  usuario?: UsuarioAutenticado;
}

/**
 * Guard global de autenticación JWT.
 *
 * - Omite los endpoints marcados con `@Public()` (login, registro...).
 * - Exige `Authorization: Bearer <token>` en el resto.
 * - Verifica la firma y la expiración del token (401 si falla).
 * - Recarga el usuario de la base de datos y exige estado `activa` (403 si
 *   fue suspendido o inactivado después de emitir el token).
 * - Adjunta `request.usuario` para `RolesGuard` y `@UsuarioActual()`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (esPublico) {
      return true;
    }

    const request = context.switchToHttp().getRequest<PeticionAutenticada>();
    const token = this.extraerToken(request);
    if (!token) {
      throw new UnauthorizedException(
        'Falta el token de acceso (Authorization: Bearer <token>)',
      );
    }

    const payload = await this.verificarToken(token);

    let id: bigint;
    try {
      id = BigInt(payload.sub);
    } catch {
      throw new UnauthorizedException('Token de acceso inválido');
    }

    const usuario = await this.prisma.usuarios.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        correo: true,
        rol: true,
        estado: true,
        gestores_gestores_usuario_idTousuarios: {
          select: { perfil: true },
        },
      },
    });

    if (!usuario) {
      throw new UnauthorizedException('La cuenta del token ya no existe');
    }
    if (usuario.estado !== 'activa') {
      throw new ForbiddenException('La cuenta no está activa');
    }

    request.usuario = {
      id: usuario.id.toString(),
      nombre: usuario.nombre,
      apellido: usuario.apellido ?? undefined,
      correo: usuario.correo,
      rol: usuario.rol,
      perfil: usuario.gestores_gestores_usuario_idTousuarios?.perfil ?? null,
      estado: usuario.estado,
    };

    return true;
  }

  /** Extrae el token del encabezado `Authorization: Bearer <token>`. */
  private extraerToken(request: PeticionAutenticada): string | null {
    const encabezado = request.headers.authorization;
    if (!encabezado) {
      return null;
    }
    const [esquema, token] = encabezado.split(' ');
    if (esquema?.toLowerCase() !== 'bearer' || !token) {
      return null;
    }
    return token;
  }

  /** Verifica firma y expiración, traduciendo cualquier fallo a 401. */
  private async verificarToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token de acceso inválido o expirado');
    }
  }
}
