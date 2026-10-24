import {
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import type { LoginDto } from './dto/login.dto';

jest.mock('argon2', () => ({
  argon2id: 'argon2id',
  hash: jest.fn(),
  verify: jest.fn(),
}));

interface PrismaMock {
  usuarios: { findUnique: jest.Mock; update: jest.Mock };
  $queryRaw: jest.Mock;
}

function crearPrismaMock(): PrismaMock {
  return {
    usuarios: { findUnique: jest.fn(), update: jest.fn() },
    // $queryRaw se usa como template tag: (strings, ...valores).
    $queryRaw: jest.fn(),
  };
}

function crearConfig(valores: Record<string, string> = {}): ConfigService {
  const todas: Record<string, string> = {
    JWT_EXPIRES_IN_SECONDS: '28800',
    JWT_GESTOR_EXPIRES_IN_SECONDS: '1800',
    LOGIN_MAX_ATTEMPTS: '5',
    LOGIN_LOCK_MINUTES: '15',
    ...valores,
  };
  return { get: (clave: string) => todas[clave] } as unknown as ConfigService;
}

const DTO: LoginDto = {
  correo: '  Maria.Gomez@Gmail.com ',
  password: 'Comerciante123',
};

const USUARIO_COMERCIANTE = {
  id: 3n,
  nombre: 'María',
  apellido: 'Gómez',
  correo: 'maria.gomez@gmail.com',
  password_hash: '$argon2id$hash-real',
  rol: 'comerciante',
  estado: 'activa',
  intentos_fallidos: 0,
  bloqueado_hasta: null,
  gestores_gestores_usuario_idTousuarios: null,
};

const USUARIO_GESTOR = {
  id: 1n,
  nombre: 'Laura',
  apellido: 'Martínez',
  correo: 'admin@tulua.gov.co',
  password_hash: '$argon2id$hash-gestor',
  rol: 'gestor',
  estado: 'activa',
  intentos_fallidos: 0,
  bloqueado_hasta: null,
  gestores_gestores_usuario_idTousuarios: { perfil: 'administrador' },
};

/** Ejecuta y devuelve el status HTTP del error lanzado. */
async function statusDe(promesa: Promise<unknown>): Promise<number> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof HttpException) {
      return error.getStatus();
    }
    throw error;
  }
  throw new Error('La promesa no lanzó ninguna excepción');
}

describe('AuthService', () => {
  let prisma: PrismaMock;
  let jwt: { signAsync: jest.Mock };
  let service: AuthService;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    prisma = crearPrismaMock();
    jwt = { signAsync: jest.fn().mockResolvedValue('jwt.firmado') };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      crearConfig(),
    );
    (argon2.verify as jest.Mock).mockReset();
    // Por defecto la cuenta no está bloqueada.
    prisma.$queryRaw.mockResolvedValue([{ bloqueado: false, minutos: 0 }]);
  });

  describe('login correcto', () => {
    it('emite un token para un comerciante con vigencia de 8 horas', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(USUARIO_COMERCIANTE);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const resultado = await service.login(DTO);

      // El correo se normaliza antes de buscar.
      expect(prisma.usuarios.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { correo: 'maria.gomez@gmail.com' },
        }),
      );
      expect(resultado.accessToken).toBe('jwt.firmado');
      expect(resultado.tokenType).toBe('Bearer');
      expect(resultado.expiresIn).toBe(28_800);
      expect(resultado.usuario).toEqual({
        id: '3',
        nombre: 'María',
        apellido: 'Gómez',
        correo: 'maria.gomez@gmail.com',
        rol: 'comerciante',
        perfil: null,
        estado: 'activa',
      });
      expect(jwt.signAsync).toHaveBeenCalledWith(
        {
          sub: '3',
          correo: 'maria.gomez@gmail.com',
          rol: 'comerciante',
        },
        { expiresIn: 28_800 },
      );
    });

    it('emite un token de 30 minutos para un gestor e incluye su perfil', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(USUARIO_GESTOR);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const resultado = await service.login({
        correo: 'admin@tulua.gov.co',
        password: 'Admin1234',
      });

      expect(resultado.expiresIn).toBe(1_800);
      expect(resultado.usuario.perfil).toBe('administrador');
      expect(jwt.signAsync).toHaveBeenCalledWith(
        {
          sub: '1',
          correo: 'admin@tulua.gov.co',
          rol: 'gestor',
          perfil: 'administrador',
        },
        { expiresIn: 1_800 },
      );
    });

    it('limpia los intentos fallidos y el bloqueo anterior', async () => {
      prisma.usuarios.findUnique.mockResolvedValue({
        ...USUARIO_COMERCIANTE,
        intentos_fallidos: 3,
        bloqueado_hasta: new Date(Date.now() - 60_000),
      });
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await service.login(DTO);

      expect(prisma.usuarios.update).toHaveBeenCalledWith({
        where: { id: 3n },
        data: { intentos_fallidos: 0, bloqueado_hasta: null },
      });
    });
  });

  describe('credenciales inválidas', () => {
    it('responde 401 si el correo no existe y verifica un hash de descarte', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(null);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      const status = await statusDe(service.login(DTO));

      expect(status).toBe(401);
      expect(argon2.verify).toHaveBeenCalledTimes(1);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it('responde 401 y suma un intento si la contraseña es incorrecta', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(USUARIO_COMERCIANTE);
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      prisma.$queryRaw
        .mockResolvedValueOnce([{ bloqueado: false, minutos: 0 }])
        .mockResolvedValueOnce([{ bloqueado: false, minutos: null }]);

      const status = await statusDe(service.login(DTO));

      expect(status).toBe(401);
      // Primero consulta el bloqueo y después incrementa el contador.
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it('responde 401 si la cuenta no tiene contraseña registrada', async () => {
      prisma.usuarios.findUnique.mockResolvedValue({
        ...USUARIO_COMERCIANTE,
        password_hash: null,
      });
      prisma.$queryRaw
        .mockResolvedValueOnce([{ bloqueado: false, minutos: 0 }])
        .mockResolvedValueOnce([{ bloqueado: false, minutos: null }]);

      const status = await statusDe(service.login(DTO));

      expect(status).toBe(401);
      expect(argon2.verify).not.toHaveBeenCalled();
    });
  });

  describe('bloqueo por intentos fallidos', () => {
    it('responde 423 al alcanzar el máximo de intentos', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(USUARIO_COMERCIANTE);
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      prisma.$queryRaw
        .mockResolvedValueOnce([{ bloqueado: false, minutos: 0 }])
        .mockResolvedValueOnce([{ bloqueado: true, minutos: 15 }]);

      const status = await statusDe(service.login(DTO));

      expect(status).toBe(423);
      expect(jwt.signAsync).not.toHaveBeenCalled();
      // El SQL usa los parámetros configurados y el id como texto.
      const valores = prisma.$queryRaw.mock.calls[1].slice(1);
      expect(valores).toEqual(expect.arrayContaining([5, 15, '3']));
    });

    it('responde 423 sin verificar la contraseña si la cuenta ya está bloqueada', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(USUARIO_COMERCIANTE);
      prisma.$queryRaw.mockResolvedValueOnce([
        { bloqueado: true, minutos: 10 },
      ]);

      const status = await statusDe(service.login(DTO));

      expect(status).toBe(423);
      expect(argon2.verify).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('permite el login cuando el bloqueo ya expiró', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(USUARIO_COMERCIANTE);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      prisma.$queryRaw.mockResolvedValueOnce([
        { bloqueado: false, minutos: 0 },
      ]);

      const resultado = await service.login(DTO);

      expect(resultado.accessToken).toBe('jwt.firmado');
      expect(prisma.usuarios.update).toHaveBeenCalled();
    });
  });

  describe('cuentas no activas', () => {
    it('responde 403 con mensaje de activación pendiente', async () => {
      prisma.usuarios.findUnique.mockResolvedValue({
        ...USUARIO_COMERCIANTE,
        estado: 'pendiente_activacion',
      });

      await expect(service.login(DTO)).rejects.toThrow(ForbiddenException);
      await expect(service.login(DTO)).rejects.toThrow(
        'pendiente de activación',
      );
      expect(argon2.verify).not.toHaveBeenCalled();
    });

    it('responde 403 si la cuenta está suspendida', async () => {
      prisma.usuarios.findUnique.mockResolvedValue({
        ...USUARIO_COMERCIANTE,
        estado: 'suspendida',
      });

      const status = await statusDe(service.login(DTO));

      expect(status).toBe(403);
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it('responde 403 si la cuenta está inactiva', async () => {
      prisma.usuarios.findUnique.mockResolvedValue({
        ...USUARIO_COMERCIANTE,
        estado: 'inactiva',
      });

      await expect(service.login(DTO)).rejects.toThrow('inactiva');
    });
  });

  describe('configuración', () => {
    it('usa los valores por defecto si faltan las variables', async () => {
      const svc = new AuthService(
        prisma as unknown as PrismaService,
        jwt as unknown as JwtService,
        crearConfig({
          JWT_EXPIRES_IN_SECONDS: '',
          JWT_GESTOR_EXPIRES_IN_SECONDS: '0',
        }),
      );
      prisma.usuarios.findUnique.mockResolvedValue(USUARIO_GESTOR);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const resultado = await svc.login({
        correo: 'admin@tulua.gov.co',
        password: 'Admin1234',
      });

      // Valores por defecto documentados: 8 h y 30 min.
      expect(resultado.expiresIn).toBe(1_800);
    });

    it('un usuario inexistente nunca revela si el correo existe', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(null);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.login(DTO)).rejects.toThrow(
        new UnauthorizedException('Credenciales inválidas'),
      );
    });
  });
});
