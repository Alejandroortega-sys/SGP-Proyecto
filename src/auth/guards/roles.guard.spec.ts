import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function crearContexto(usuario?: unknown): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class ControladorDePrueba {},
    switchToHttp: () => ({ getRequest: () => ({ usuario }) }),
  } as unknown as ExecutionContext;
}

const usuarioCon = (rol: string) => ({
  id: '3',
  nombre: 'Prueba',
  correo: 'prueba@tulua.gov.co',
  rol,
  perfil: rol === 'gestor' ? 'revisor' : null,
  estado: 'activa',
});

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('permite el paso si el endpoint no declara @Roles', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(crearContexto(usuarioCon('comerciante')))).toBe(
      true,
    );
  });

  it('permite el paso a un rol incluido en @Roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['gestor']);

    expect(guard.canActivate(crearContexto(usuarioCon('gestor')))).toBe(true);
  });

  it('responde 403 si el rol no está permitido', () => {
    reflector.getAllAndOverride.mockReturnValue(['gestor']);

    expect(() =>
      guard.canActivate(crearContexto(usuarioCon('comerciante'))),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(crearContexto(usuarioCon('comerciante'))),
    ).toThrow('no tiene permiso');
  });

  it('acepta cualquiera de los roles listados', () => {
    reflector.getAllAndOverride.mockReturnValue(['gestor', 'organizador']);

    expect(guard.canActivate(crearContexto(usuarioCon('organizador')))).toBe(
      true,
    );
  });

  it('responde 401 si no hay usuario autenticado', () => {
    reflector.getAllAndOverride.mockReturnValue(['gestor']);

    expect(() => guard.canActivate(crearContexto(undefined))).toThrow(
      UnauthorizedException,
    );
  });
});
