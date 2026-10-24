import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { CorreoService } from '../correo/correo.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivarCuentaDto } from './dto/activar-cuenta.dto';
import { CrearComercianteDto } from './dto/crear-comerciante.dto';
import { ReenviarCodigoDto } from './dto/reenviar-codigo.dto';
import { UsuariosService } from './usuarios.service';

// argon2 se simula: `hash(x)` → `hash-de:x`. Así los tests son rápidos y
// deterministas, y se puede verificar que el hash guardado corresponde al
// código enviado por correo.
jest.mock('argon2', () => ({
  argon2id: 'argon2id',
  hash: jest.fn(async (valor: string) => `hash-de:${valor}`),
  verify: jest.fn(),
}));

/** Prisma simulado: los métodos por tabla son jest.fn y $transaction pasa
 *  el propio mock como cliente de la transacción. */
interface PrismaMock {
  usuarios: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  tokens_seguridad: {
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  notificaciones: { create: jest.Mock };
  $transaction: jest.Mock;
}

function crearPrismaMock(): PrismaMock {
  const prisma: PrismaMock = {
    usuarios: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    tokens_seguridad: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    notificaciones: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  // Soporta las dos formas usadas por el servicio: callback y arreglo.
  prisma.$transaction.mockImplementation(async (operacion: unknown) => {
    if (typeof operacion === 'function') {
      return (operacion as (tx: PrismaMock) => unknown)(prisma);
    }
    return Promise.all(operacion as Promise<unknown>[]);
  });
  return prisma;
}

/** ConfigService simulado a partir de un diccionario de variables. */
function crearConfig(valores: Record<string, string> = {}): ConfigService {
  const todas: Record<string, string> = {
    ACTIVATION_CODE_TTL_MINUTES: '15',
    ...valores,
  };
  return { get: (clave: string) => todas[clave] } as unknown as ConfigService;
}

const DTO_CREACION: CrearComercianteDto = {
  nombre: 'María',
  apellido: 'Gómez',
  tipoDocumento: 'CC',
  documento: '1029384756',
  telefono: '3001122334',
  correo: 'Maria.Gomez@Gmail.com',
  password: 'Comerciante123',
  confirmarPassword: 'Comerciante123',
  actividadComercial: 'Venta de frutas y verduras',
  categoria: 'formal',
};

const USUARIO_CREADO = {
  id: 5n,
  nombre: 'María',
  apellido: 'Gómez',
  correo: 'maria.gomez@gmail.com',
  rol: 'comerciante',
  estado: 'pendiente_activacion',
  comerciantes: {
    actividad_comercial: 'Venta de frutas y verduras',
    categoria: 'formal',
  },
};

describe('UsuariosService', () => {
  let prisma: PrismaMock;
  let correo: { enviarCodigoActivacion: jest.Mock };
  let service: UsuariosService;

  beforeAll(() => {
    // Silencia los logs de error/espera esperados durante las pruebas.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    prisma = crearPrismaMock();
    correo = { enviarCodigoActivacion: jest.fn().mockResolvedValue(undefined) };
    service = new UsuariosService(
      prisma as unknown as PrismaService,
      correo as unknown as CorreoService,
      crearConfig(),
    );
  });

  describe('crearComerciante', () => {
    it('crea cuenta pendiente con contraseña hasheada y envía el código', async () => {
      prisma.usuarios.create.mockResolvedValue(USUARIO_CREADO);

      const resultado = await service.crearComerciante(DTO_CREACION);

      // La cuenta se crea con rol comerciante, correo normalizado y hash.
      expect(prisma.usuarios.create).toHaveBeenCalledTimes(1);
      const { data } = prisma.usuarios.create.mock.calls[0][0];
      expect(data.rol).toBe('comerciante');
      expect(data.correo).toBe('maria.gomez@gmail.com');
      expect(data.password_hash).toBe('hash-de:Comerciante123');
      expect(data.comerciantes.create).toEqual({
        actividad_comercial: 'Venta de frutas y verduras',
        categoria: 'formal',
      });

      // El token guarda el hash del mismo código que se envía por correo.
      const codigoEnviado = correo.enviarCodigoActivacion.mock.calls[0][2];
      expect(codigoEnviado).toMatch(/^\d{6}$/);
      expect(prisma.tokens_seguridad.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          usuario_id: 5n,
          tipo: 'activacion',
          token_hash: `hash-de:${codigoEnviado}`,
          expira_en: expect.any(Date),
        }),
      });

      // Se registra el aviso de activación para el usuario.
      expect(prisma.notificaciones.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          usuario_id: 5n,
          tipo: 'activacion',
          canal: 'correo',
        }),
      });

      // Respuesta: estado pendiente, id como string, sin datos sensibles.
      expect(resultado.id).toBe('5');
      expect(resultado.estado).toBe('pendiente_activacion');
      expect(resultado.mensaje).toContain('Pendiente de activación');
      expect(JSON.stringify(resultado)).not.toContain('password');
      expect(JSON.stringify(resultado)).not.toContain(codigoEnviado);
    });

    it('expira el código según el TTL configurado', async () => {
      prisma.usuarios.create.mockResolvedValue(USUARIO_CREADO);
      const ttl = crearConfig({ ACTIVATION_CODE_TTL_MINUTES: '30' });
      const svc = new UsuariosService(
        prisma as unknown as PrismaService,
        correo as unknown as CorreoService,
        ttl,
      );
      const antes = Date.now();

      await svc.crearComerciante(DTO_CREACION);

      const { expira_en } = prisma.tokens_seguridad.create.mock.calls[0][0].data;
      const minutos = (expira_en.getTime() - antes) / 60_000;
      expect(minutos).toBeGreaterThan(29);
      expect(minutos).toBeLessThanOrEqual(30);
    });

    it('responde 503 si el correo no se pudo enviar', async () => {
      prisma.usuarios.create.mockResolvedValue(USUARIO_CREADO);
      correo.enviarCodigoActivacion.mockRejectedValue(new Error('SMTP caído'));

      await expect(service.crearComerciante(DTO_CREACION)).rejects.toThrow(
        'La cuenta fue creada, pero no pudimos enviar el código',
      );
      // La cuenta y el token sí quedaron creados (el commit ya ocurrió).
      expect(prisma.usuarios.create).toHaveBeenCalledTimes(1);
      expect(prisma.tokens_seguridad.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('activarCuenta', () => {
    const DTO_ACTIVACION: ActivarCuentaDto = {
      correo: 'maria.gomez@gmail.com',
      codigo: '483920',
    };

    it('activa la cuenta cuando el código coincide', async () => {
      prisma.usuarios.findUnique.mockResolvedValue({
        id: 5n,
        nombre: 'María',
        correo: 'maria.gomez@gmail.com',
        rol: 'comerciante',
        estado: 'pendiente_activacion',
      });
      prisma.tokens_seguridad.findFirst.mockResolvedValue({
        id: 9n,
        token_hash: 'hash-de:483920',
      });
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const resultado = await service.activarCuenta(DTO_ACTIVACION);

      expect(prisma.tokens_seguridad.update).toHaveBeenCalledWith({
        where: { id: 9n },
        data: { usado: true },
      });
      expect(prisma.usuarios.update).toHaveBeenCalledWith({
        where: { id: 5n },
        data: { estado: 'activa' },
      });
      expect(resultado.estado).toBe('activa');
    });

    it('rechaza con mensaje genérico si el código no coincide', async () => {
      prisma.usuarios.findUnique.mockResolvedValue({
        id: 5n,
        nombre: 'María',
        correo: 'maria.gomez@gmail.com',
        rol: 'comerciante',
        estado: 'pendiente_activacion',
      });
      prisma.tokens_seguridad.findFirst.mockResolvedValue({
        id: 9n,
        token_hash: 'hash-de:483920',
      });
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.activarCuenta(DTO_ACTIVACION),
      ).rejects.toThrow('El código de activación es inválido o ha expirado');
      expect(prisma.usuarios.update).not.toHaveBeenCalled();
    });

    it('rechaza si el código ya expiró o no existe token vigente', async () => {
      prisma.usuarios.findUnique.mockResolvedValue({
        id: 5n,
        estado: 'pendiente_activacion',
      });
      prisma.tokens_seguridad.findFirst.mockResolvedValue(null);

      await expect(
        service.activarCuenta(DTO_ACTIVACION),
      ).rejects.toThrow('El código de activación es inválido o ha expirado');
    });

    it('responde 409 si la cuenta ya está activa', async () => {
      prisma.usuarios.findUnique.mockResolvedValue({
        id: 5n,
        estado: 'activa',
      });

      await expect(
        service.activarCuenta(DTO_ACTIVACION),
      ).rejects.toThrow('La cuenta ya está activa');
      expect(prisma.tokens_seguridad.findFirst).not.toHaveBeenCalled();
    });

    it('responde con mensaje genérico si la cuenta no existe', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(null);

      await expect(
        service.activarCuenta(DTO_ACTIVACION),
      ).rejects.toThrow('El código de activación es inválido o ha expirado');
      expect(prisma.tokens_seguridad.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('reenviarCodigo', () => {
    it('genera un código nuevo e invalida los anteriores', async () => {
      prisma.usuarios.findUnique.mockResolvedValue({
        id: 5n,
        nombre: 'María',
        estado: 'pendiente_activacion',
      });

      const resultado = await service.reenviarCodigo({
        correo: 'maria.gomez@gmail.com',
      } as ReenviarCodigoDto);

      expect(prisma.tokens_seguridad.updateMany).toHaveBeenCalledWith({
        where: { usuario_id: 5n, tipo: 'activacion', usado: false },
        data: { usado: true },
      });
      const { data } = prisma.tokens_seguridad.create.mock.calls[0][0];
      expect(data.usuario_id).toBe(5n);
      expect(data.token_hash).toMatch(/^hash-de:\d{6}$/);
      expect(correo.enviarCodigoActivacion).toHaveBeenCalledTimes(1);
      expect(resultado.mensaje).toContain('pendiente de activación');
    });

    it('responde el mensaje genérico si la cuenta no existe', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(null);

      const resultado = await service.reenviarCodigo({
        correo: 'desconocido@gmail.com',
      } as ReenviarCodigoDto);

      expect(resultado.mensaje).toContain('pendiente de activación');
      expect(prisma.tokens_seguridad.create).not.toHaveBeenCalled();
      expect(correo.enviarCodigoActivacion).not.toHaveBeenCalled();
    });

    it('no reenvía código si la cuenta ya está activa', async () => {
      prisma.usuarios.findUnique.mockResolvedValue({
        id: 5n,
        estado: 'activa',
      });

      const resultado = await service.reenviarCodigo({
        correo: 'maria.gomez@gmail.com',
      } as ReenviarCodigoDto);

      // Mantiene el mensaje genérico para no revelar el estado de la cuenta.
      expect(resultado.mensaje).toContain('pendiente de activación');
      expect(prisma.tokens_seguridad.create).not.toHaveBeenCalled();
      expect(correo.enviarCodigoActivacion).not.toHaveBeenCalled();
    });
  });
});
