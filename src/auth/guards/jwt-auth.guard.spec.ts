import {
  ExecutionContext,
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';

interface PeticionFalsa {
  headers: Record<string, string | undefined>;
  usuario?: unknown;
}

function crearContexto(peticion: PeticionFalsa): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class ControladorDePrueba {},
    switchToHttp: () => ({ getRequest: () => peticion }),
  } as unknown as ExecutionContext;
}

const USUARIO_ACTIVO = {
  id: 3n,
  nombre: 'María',
  apellido: 'Gómez',
  correo: 'maria.gomez@gmail.com',
  rol: 'comerciante',
  estado: 'activa',
  gestores_gestores_usuario_idTousuarios: null,
};

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let jwt: { verifyAsync: jest.Mock };
  let prisma: { usuarios: { findUnique: jest.Mock } };

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    jwt = { verifyAsync: jest.fn() };
    prisma = { usuarios: { findUnique: jest.fn() } };
    guard = new JwtAuthGuard(
      jwt as unknown as JwtService,
      prisma as unknown as PrismaService,
      reflector as unknown as Reflector,
    );
  });

  it('deja pasar los endpoints marcados con @Public sin validar el token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const peticion: PeticionFalsa = { headers: {} };

    await expect(guard.canActivate(crearContexto(peticion))).resolves.toBe(
      true,
    );
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
    expect(prisma.usuarios.findUnique).not.toHaveBeenCalled();
  });

  it('responde 401 si falta el encabezado Authorization', async () => {
    const peticion: PeticionFalsa = { headers: {} };

    await expect(guard.canActivate(crearContexto(peticion))).rejects.toThrow(
      new UnauthorizedException(
        'Falta el token de acceso (Authorization: Bearer <token>)',
      ),
    );
  });

  it('responde 401 si el esquema no es Bearer', async () => {
    const peticion: PeticionFalsa = {
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    };

    await expect(guard.canActivate(crearContexto(peticion))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('responde 401 si el token es inválido o expiró', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const peticion: PeticionFalsa = {
      headers: { authorization: 'Bearer token.invalido' },
    };

    await expect(guard.canActivate(crearContexto(peticion))).rejects.toThrow(
      'Token de acceso inválido o expirado',
    );
  });

  it('responde 401 si el sub del token no es un identificador válido', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'abc', rol: 'comerciante' });
    const peticion: PeticionFalsa = {
      headers: { authorization: 'Bearer token.valido' },
    };

    await expect(guard.canActivate(crearContexto(peticion))).rejects.toThrow(
      'Token de acceso inválido',
    );
    expect(prisma.usuarios.findUnique).not.toHaveBeenCalled();
  });

  it('responde 401 si la cuenta del token ya no existe', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: '3', rol: 'comerciante' });
    prisma.usuarios.findUnique.mockResolvedValue(null);
    const peticion: PeticionFalsa = {
      headers: { authorization: 'Bearer token.valido' },
    };

    await expect(guard.canActivate(crearContexto(peticion))).rejects.toThrow(
      'La cuenta del token ya no existe',
    );
  });

  it('responde 403 si la cuenta fue suspendida después de emitir el token', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: '3', rol: 'comerciante' });
    prisma.usuarios.findUnique.mockResolvedValue({
      ...USUARIO_ACTIVO,
      estado: 'suspendida',
    });
    const peticion: PeticionFalsa = {
      headers: { authorization: 'Bearer token.valido' },
    };

    await expect(guard.canActivate(crearContexto(peticion))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('adjunta el usuario recargado de la BD cuando la cuenta está activa', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: '3',
      correo: 'maria.gomez@gmail.com',
      rol: 'comerciante',
    });
    prisma.usuarios.findUnique.mockResolvedValue(USUARIO_ACTIVO);
    const peticion: PeticionFalsa = {
      headers: { authorization: 'Bearer token.valido' },
    };

    await expect(guard.canActivate(crearContexto(peticion))).resolves.toBe(
      true,
    );
    // El rol se toma de la BD, no del token.
    expect(peticion.usuario).toEqual({
      id: '3',
      nombre: 'María',
      apellido: 'Gómez',
      correo: 'maria.gomez@gmail.com',
      rol: 'comerciante',
      perfil: null,
      estado: 'activa',
    });
  });

  it('incluye el perfil del gestor en request.usuario', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: '1', rol: 'gestor' });
    prisma.usuarios.findUnique.mockResolvedValue({
      id: 1n,
      nombre: 'Laura',
      apellido: 'Martínez',
      correo: 'admin@tulua.gov.co',
      rol: 'gestor',
      estado: 'activa',
      gestores_gestores_usuario_idTousuarios: { perfil: 'administrador' },
    });
    const peticion: PeticionFalsa = {
      headers: { authorization: 'Bearer token.valido' },
    };

    await guard.canActivate(crearContexto(peticion));

    expect(peticion.usuario).toEqual(
      expect.objectContaining({ rol: 'gestor', perfil: 'administrador' }),
    );
  });
});
