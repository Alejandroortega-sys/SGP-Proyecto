import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { CorreoService } from '../correo/correo.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivarCuentaDto } from './dto/activar-cuenta.dto';
import { ActualizarComercianteGestorDto } from './dto/actualizar-comerciante-gestor.dto';
import { CrearComercianteDto } from './dto/crear-comerciante.dto';
import { CrearOrganizadorDto } from './dto/crear-organizador.dto';
import { ReenviarCodigoDto } from './dto/reenviar-codigo.dto';
import { RestablecerPasswordDto } from './dto/restablecer-password.dto';
import { SolicitarRecuperacionDto } from './dto/solicitar-recuperacion.dto';
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
  usuarios: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  comerciantes: { update: jest.Mock };
  tokens_seguridad: {
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  notificaciones: { create: jest.Mock };
  $executeRaw: jest.Mock;
  $transaction: jest.Mock;
}

function crearPrismaMock(): PrismaMock {
  const prisma: PrismaMock = {
    usuarios: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    comerciantes: { update: jest.fn() },
    tokens_seguridad: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    notificaciones: { create: jest.fn() },
    $executeRaw: jest.fn(),
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
    PASSWORD_RECOVERY_CODE_TTL_MINUTES: '2',
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
  let correo: {
    enviarCodigoActivacion: jest.Mock;
    enviarCodigoRecuperacion: jest.Mock;
  };
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
    correo = {
      enviarCodigoActivacion: jest.fn().mockResolvedValue(undefined),
      enviarCodigoRecuperacion: jest.fn().mockResolvedValue(undefined),
    };
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

      const { expira_en } =
        prisma.tokens_seguridad.create.mock.calls[0][0].data;
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

  describe('crearOrganizador', () => {
    const DTO_ORGANIZADOR: CrearOrganizadorDto = {
      nombre: 'Luis',
      apellido: 'Álvarez',
      tipoDocumento: 'CC',
      documento: '801234567',
      telefono: '3105551234',
      correo: 'Luis.Alvarez@Agrovalle.org',
      password: 'Organizador123',
      confirmarPassword: 'Organizador123',
    };

    const ORGANIZADOR_CREADO = {
      id: 7n,
      nombre: 'Luis',
      apellido: 'Álvarez',
      correo: 'luis.alvarez@agrovalle.org',
      rol: 'organizador',
      estado: 'pendiente_activacion',
    };

    it('crea la cuenta con rol organizador y sin fila de organización', async () => {
      prisma.usuarios.create.mockResolvedValue(ORGANIZADOR_CREADO);

      const resultado = await service.crearOrganizador(DTO_ORGANIZADOR);

      const { data } = prisma.usuarios.create.mock.calls[0][0];
      expect(data.rol).toBe('organizador');
      expect(data.correo).toBe('luis.alvarez@agrovalle.org');
      expect(data.password_hash).toBe('hash-de:Organizador123');
      expect(data.organizadores).toBeUndefined();

      const codigoEnviado = correo.enviarCodigoActivacion.mock.calls[0][2];
      expect(codigoEnviado).toMatch(/^\d{6}$/);
      expect(prisma.tokens_seguridad.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          usuario_id: 7n,
          tipo: 'activacion',
          token_hash: `hash-de:${codigoEnviado}`,
          expira_en: expect.any(Date),
        }),
      });
      expect(prisma.notificaciones.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          usuario_id: 7n,
          tipo: 'activacion',
          canal: 'correo',
        }),
      });

      expect(resultado).toMatchObject({
        id: '7',
        rol: 'organizador',
        estado: 'pendiente_activacion',
      });
      expect(resultado.mensaje).toContain('organizador');
      expect(JSON.stringify(resultado)).not.toContain('password');
      expect(JSON.stringify(resultado)).not.toContain(codigoEnviado);
    });

    it('responde 503 si el correo de activación falla', async () => {
      prisma.usuarios.create.mockResolvedValue(ORGANIZADOR_CREADO);
      correo.enviarCodigoActivacion.mockRejectedValue(new Error('SMTP caído'));

      await expect(service.crearOrganizador(DTO_ORGANIZADOR)).rejects.toThrow(
        'La cuenta fue creada, pero no pudimos enviar el código',
      );
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

      await expect(service.activarCuenta(DTO_ACTIVACION)).rejects.toThrow(
        'El código de activación es inválido o ha expirado',
      );
      expect(prisma.usuarios.update).not.toHaveBeenCalled();
    });

    it('rechaza si el código ya expiró o no existe token vigente', async () => {
      prisma.usuarios.findUnique.mockResolvedValue({
        id: 5n,
        estado: 'pendiente_activacion',
      });
      prisma.tokens_seguridad.findFirst.mockResolvedValue(null);

      await expect(service.activarCuenta(DTO_ACTIVACION)).rejects.toThrow(
        'El código de activación es inválido o ha expirado',
      );
    });

    it('responde 409 si la cuenta ya está activa', async () => {
      prisma.usuarios.findUnique.mockResolvedValue({
        id: 5n,
        estado: 'activa',
      });

      await expect(service.activarCuenta(DTO_ACTIVACION)).rejects.toThrow(
        'La cuenta ya está activa',
      );
      expect(prisma.tokens_seguridad.findFirst).not.toHaveBeenCalled();
    });

    it('responde con mensaje genérico si la cuenta no existe', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(null);

      await expect(service.activarCuenta(DTO_ACTIVACION)).rejects.toThrow(
        'El código de activación es inválido o ha expirado',
      );
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

  describe('solicitarRecuperacion', () => {
    it('crea un token de 2 minutos, invalida los anteriores y envía el correo', async () => {
      prisma.usuarios.findUnique.mockResolvedValue({
        id: 5n,
        nombre: 'María',
        estado: 'activa',
      });

      const resultado = await service.solicitarRecuperacion({
        correo: 'Maria.Gomez@Gmail.com',
      } as SolicitarRecuperacionDto);

      // Invalida los códigos de recuperación pendientes.
      expect(prisma.tokens_seguridad.updateMany).toHaveBeenCalledWith({
        where: {
          usuario_id: 5n,
          tipo: 'recuperacion_password',
          usado: false,
        },
        data: { usado: true },
      });

      // El token guarda el hash del mismo código que se envía por correo.
      const { data } = prisma.tokens_seguridad.create.mock.calls[0][0];
      const codigoEnviado = correo.enviarCodigoRecuperacion.mock.calls[0][2];
      expect(data.usuario_id).toBe(5n);
      expect(data.tipo).toBe('recuperacion_password');
      expect(codigoEnviado).toMatch(/^\d{6}$/);
      expect(data.token_hash).toBe(`hash-de:${codigoEnviado}`);
      expect(data.expira_en.getTime() - Date.now()).toBeGreaterThan(90_000);
      expect(data.expira_en.getTime() - Date.now()).toBeLessThanOrEqual(
        120_000,
      );
      expect(correo.enviarCodigoRecuperacion).toHaveBeenCalledWith(
        'maria.gomez@gmail.com',
        'María',
        codigoEnviado,
        2,
      );

      // Respuesta genérica, sin filtrar el código ni el estado de la cuenta.
      expect(resultado.mensaje).toContain('cuenta activa');
      expect(JSON.stringify(resultado)).not.toContain(codigoEnviado);
    });

    it('responde el mensaje genérico si el correo no existe', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(null);

      const resultado = await service.solicitarRecuperacion({
        correo: 'desconocido@gmail.com',
      } as SolicitarRecuperacionDto);

      expect(resultado.mensaje).toContain('cuenta activa');
      expect(prisma.tokens_seguridad.create).not.toHaveBeenCalled();
      expect(correo.enviarCodigoRecuperacion).not.toHaveBeenCalled();
    });

    it('no envía código si la cuenta no está activa', async () => {
      prisma.usuarios.findUnique.mockResolvedValue({
        id: 5n,
        estado: 'pendiente_activacion',
      });

      const resultado = await service.solicitarRecuperacion({
        correo: 'pedro.sanchez@gmail.com',
      } as SolicitarRecuperacionDto);

      // Mantiene el mensaje genérico para no revelar el estado de la cuenta.
      expect(resultado.mensaje).toContain('cuenta activa');
      expect(prisma.tokens_seguridad.create).not.toHaveBeenCalled();
      expect(correo.enviarCodigoRecuperacion).not.toHaveBeenCalled();
    });

    it('responde 503 si el correo no se pudo enviar', async () => {
      prisma.usuarios.findUnique.mockResolvedValue({
        id: 5n,
        nombre: 'María',
        estado: 'activa',
      });
      correo.enviarCodigoRecuperacion.mockRejectedValue(
        new Error('SMTP caído'),
      );

      await expect(
        service.solicitarRecuperacion({
          correo: 'maria.gomez@gmail.com',
        } as SolicitarRecuperacionDto),
      ).rejects.toThrow('No pudimos enviar el código de recuperación');
      // El token sí quedó creado: el usuario puede pedir un código nuevo.
      expect(prisma.tokens_seguridad.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('restablecerPassword', () => {
    const DTO_RESTABLECER: RestablecerPasswordDto = {
      correo: 'maria.gomez@gmail.com',
      codigo: '483920',
      password: 'NuevaClave456',
      confirmarPassword: 'NuevaClave456',
    };

    it('actualiza la contraseña y limpia el bloqueo con un código válido', async () => {
      prisma.usuarios.findUnique.mockResolvedValue({
        id: 5n,
        nombre: 'María',
        estado: 'activa',
      });
      prisma.tokens_seguridad.findFirst.mockResolvedValue({
        id: 9n,
        token_hash: 'hash-de:483920',
      });
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const resultado = await service.restablecerPassword(DTO_RESTABLECER);

      // Consume todos los códigos de recuperación pendientes.
      expect(prisma.tokens_seguridad.updateMany).toHaveBeenCalledWith({
        where: {
          usuario_id: 5n,
          tipo: 'recuperacion_password',
          usado: false,
        },
        data: { usado: true },
      });
      // Contraseña nueva hasheada y contadores de bloqueo limpios.
      expect(prisma.usuarios.update).toHaveBeenCalledWith({
        where: { id: 5n },
        data: {
          password_hash: 'hash-de:NuevaClave456',
          intentos_fallidos: 0,
          bloqueado_hasta: null,
        },
      });
      expect(prisma.notificaciones.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          usuario_id: 5n,
          tipo: 'recuperacion_password',
          asunto: 'Contraseña actualizada',
        }),
      });
      expect(resultado.mensaje).toContain('actualizada correctamente');
    });

    it('responde 400 genérico con un código incorrecto', async () => {
      prisma.usuarios.findUnique.mockResolvedValue({
        id: 5n,
        nombre: 'María',
        estado: 'activa',
      });
      prisma.tokens_seguridad.findFirst.mockResolvedValue({
        id: 9n,
        token_hash: 'hash-de:483920',
      });
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.restablecerPassword(DTO_RESTABLECER),
      ).rejects.toThrow('El código de recuperación es inválido o ha expirado');
      expect(prisma.usuarios.update).not.toHaveBeenCalled();
    });

    it('responde 400 si el código expiró o no hay token vigente', async () => {
      prisma.usuarios.findUnique.mockResolvedValue({
        id: 5n,
        estado: 'activa',
      });
      prisma.tokens_seguridad.findFirst.mockResolvedValue(null);

      await expect(
        service.restablecerPassword(DTO_RESTABLECER),
      ).rejects.toThrow('El código de recuperación es inválido o ha expirado');
      expect(prisma.usuarios.update).not.toHaveBeenCalled();
    });

    it('responde 400 genérico si la cuenta no existe o no está activa', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(null);

      await expect(
        service.restablecerPassword(DTO_RESTABLECER),
      ).rejects.toThrow('El código de recuperación es inválido o ha expirado');
      expect(prisma.tokens_seguridad.findFirst).not.toHaveBeenCalled();
      expect(prisma.usuarios.update).not.toHaveBeenCalled();
    });
  });

  describe('actualizarComerciantePorGestor', () => {
    const ID_GESTOR = 1n;

    function comercianteCon(overrides: Record<string, unknown> = {}) {
      return {
        id: 5n,
        nombre: 'José',
        apellido: 'Pérez',
        tipo_documento: 'CC',
        documento: '1029384756',
        telefono: '3001122334',
        correo: 'jose.perez@hotmail.com',
        estado: 'activa',
        rol: 'comerciante',
        comerciantes: {
          actividad_comercial: 'Venta de frutas y verduras',
          categoria: 'formal',
        },
        ...overrides,
      };
    }

    it('corrige documento y tipo dentro de la transacción auditada', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(comercianteCon());
      const dto: ActualizarComercianteGestorDto = {
        documento: '7654321987',
        tipoDocumento: 'CE',
      };

      const resultado = await service.actualizarComerciantePorGestor(
        5n,
        dto,
        ID_GESTOR,
      );

      // El actor de auditoría se fija antes del UPDATE auditado por trigger.
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(prisma.usuarios.update).toHaveBeenCalledWith({
        where: { id: 5n },
        data: { documento: '7654321987', tipo_documento: 'CE' },
      });
      // Solo cambió usuarios: sin registro manual de comerciantes.
      expect(prisma.comerciantes.update).not.toHaveBeenCalled();
      expect(resultado.documento).toBe('7654321987');
      expect(resultado.tipoDocumento).toBe('CE');
      expect(resultado.mensaje).toContain('auditoría');
    });

    it('corrige actividad y categoría, y las audita manualmente', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(comercianteCon());
      prisma.comerciantes.update.mockResolvedValue({
        usuario_id: 5n,
        actividad_comercial: 'Venta de artesanías',
        categoria: 'informal',
      });
      const dto: ActualizarComercianteGestorDto = {
        actividadComercial: 'Venta de artesanías',
        categoria: 'informal',
      };

      const resultado = await service.actualizarComerciantePorGestor(
        5n,
        dto,
        ID_GESTOR,
      );

      expect(prisma.usuarios.update).not.toHaveBeenCalled();
      expect(prisma.comerciantes.update).toHaveBeenCalledWith({
        where: { usuario_id: 5n },
        data: {
          actividad_comercial: 'Venta de artesanías',
          categoria: 'informal',
        },
      });
      // `comerciantes` no tiene trigger: la app inserta la auditoría con el
      // valor anterior, el nuevo y el gestor como actor. El primer
      // $executeRaw fija app.actor_id y el segundo es el INSERT manual.
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
      const [, ...valores] = prisma.$executeRaw.mock.calls[1];
      expect(valores[0]).toBe(5n);
      expect(valores[3]).toBe(ID_GESTOR);
      expect(JSON.parse(valores[1])).toEqual({
        usuario_id: '5',
        actividad_comercial: 'Venta de frutas y verduras',
        categoria: 'formal',
      });
      expect(JSON.parse(valores[2])).toEqual({
        usuario_id: '5',
        actividad_comercial: 'Venta de artesanías',
        categoria: 'informal',
      });
      expect(resultado.actividadComercial).toBe('Venta de artesanías');
      expect(resultado.categoria).toBe('informal');
    });

    it('responde 404 si el usuario no existe', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(null);

      await expect(
        service.actualizarComerciantePorGestor(
          99n,
          { documento: '7654321987' },
          ID_GESTOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('responde 404 si el usuario no es comerciante', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(
        comercianteCon({ rol: 'gestor', comerciantes: null }),
      );

      await expect(
        service.actualizarComerciantePorGestor(
          5n,
          { documento: '7654321987' },
          ID_GESTOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('responde 400 si el cuerpo no trae ningún campo', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(comercianteCon());

      await expect(
        service.actualizarComerciantePorGestor(5n, {}, ID_GESTOR),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.usuarios.update).not.toHaveBeenCalled();
      expect(prisma.comerciantes.update).not.toHaveBeenCalled();
    });
  });
});
