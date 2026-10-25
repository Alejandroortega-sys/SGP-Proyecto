import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { PerfilGestorGuard } from './perfil-gestor.guard';

function crearContexto(usuario?: unknown): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class ControladorDePrueba {},
    switchToHttp: () => ({ getRequest: () => ({ usuario }) }),
  } as unknown as ExecutionContext;
}

const usuarioCon = (rol: string, perfil: string | null) => ({
  id: '3',
  nombre: 'Prueba',
  correo: 'prueba@tulua.gov.co',
  rol,
  perfil,
  estado: 'activa',
});

describe('PerfilGestorGuard', () => {
  let guard: PerfilGestorGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new PerfilGestorGuard(reflector as unknown as Reflector);
  });

  it('permite el paso si el endpoint no declara @PerfilGestor', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(
      guard.canActivate(crearContexto(usuarioCon('comerciante', null))),
    ).toBe(true);
  });

  it('permite el paso a un gestor con el perfil autorizado', () => {
    reflector.getAllAndOverride.mockReturnValue(['administrador']);

    expect(
      guard.canActivate(crearContexto(usuarioCon('gestor', 'administrador'))),
    ).toBe(true);
  });

  it('responde 403 si el gestor tiene otro perfil', () => {
    reflector.getAllAndOverride.mockReturnValue(['administrador']);

    expect(() =>
      guard.canActivate(crearContexto(usuarioCon('gestor', 'revisor'))),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(crearContexto(usuarioCon('gestor', 'revisor'))),
    ).toThrow('no tiene permiso');
  });

  it('responde 403 si el usuario no es gestor', () => {
    reflector.getAllAndOverride.mockReturnValue(['administrador']);

    expect(() =>
      guard.canActivate(crearContexto(usuarioCon('comerciante', null))),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(crearContexto(usuarioCon('comerciante', null))),
    ).toThrow('no tiene permiso');
  });

  it('responde 403 si el gestor no tiene perfil', () => {
    reflector.getAllAndOverride.mockReturnValue(['administrador']);

    expect(() =>
      guard.canActivate(crearContexto(usuarioCon('gestor', null))),
    ).toThrow(ForbiddenException);
  });

  it('responde 401 si no hay usuario autenticado', () => {
    reflector.getAllAndOverride.mockReturnValue(['administrador']);

    expect(() => guard.canActivate(crearContexto(undefined))).toThrow(
      UnauthorizedException,
    );
  });
});
