import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { PerfilService } from './perfil.service';

// argon2 se simula como en usuarios.service.spec: rápido y determinista.
jest.mock('argon2', () => ({
  argon2id: 'argon2id',
  hash: jest.fn(async (valor: string) => `hash-de:${valor}`),
  verify: jest.fn(),
}));

/** Prisma simulado: $transaction (callback) pasa el propio mock como tx. */
interface PrismaMock {
  usuarios: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  notificaciones: { create: jest.Mock };
  $executeRaw: jest.Mock;
  $transaction: jest.Mock;
}

function crearPrismaMock(): PrismaMock {
  const prisma: PrismaMock = {
    usuarios: { findUnique: jest.fn(), update: jest.fn() },
    notificaciones: { create: jest.fn() },
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (operacion: unknown) =>
    (operacion as (tx: PrismaMock) => unknown)(prisma),
  );
  return prisma;
}

/** Correo simulado: el aviso de cambio de contraseña. */
interface CorreoMock {
  enviarAvisoCambioPassword: jest.Mock;
}

function crearCorreoMock(): CorreoMock {
  return { enviarAvisoCambioPassword: jest.fn().mockResolvedValue(undefined) };
}

/** Fila del perfil tal como la devuelve la consulta del servicio. */
function filaPerfil(overrides: Record<string, unknown> = {}) {
  return {
    id: 5n,
    nombre: 'José',
    apellido: 'Pérez',
    tipo_documento: 'CC',
    documento: '1029384756',
    telefono: '3001122334',
    correo: 'jose.perez@hotmail.com',
    rol: 'comerciante',
    estado: 'activa',
    creado_en: new Date('2026-09-15T14:30:00.000Z'),
    comerciantes: {
      actividad_comercial: 'Venta de frutas y verduras',
      categoria: 'formal',
    },
    organizadores_organizadores_usuario_idTousuarios: null,
    ...overrides,
  };
}

describe('PerfilService', () => {
  let service: PerfilService;
  let prisma: PrismaMock;
  let correo: CorreoMock;

  beforeEach(() => {
    prisma = crearPrismaMock();
    correo = crearCorreoMock();
    service = new PerfilService(prisma as unknown as PrismaService, correo);
  });

  describe('ver', () => {
    it('devuelve el perfil en las tres secciones de HU-04', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(filaPerfil());

      const perfil = await service.ver('5');

      expect(perfil.datosPersonales).toEqual({
        id: '5',
        nombre: 'José',
        apellido: 'Pérez',
        tipoDocumento: 'CC',
        documento: '1029384756',
        telefono: '3001122334',
      });
      expect(perfil.actividadComercial).toEqual({
        actividadComercial: 'Venta de frutas y verduras',
        categoria: 'formal',
      });
      expect(perfil.seguridad).toEqual({
        correo: 'jose.perez@hotmail.com',
        estado: 'activa',
        creadoEn: new Date('2026-09-15T14:30:00.000Z'),
      });
    });

    it('responde 404 si el usuario no existe o no tiene perfil comercial', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(
        filaPerfil({ comerciantes: null }),
      );

      await expect(service.ver('5')).rejects.toThrow(NotFoundException);
    });

    it('devuelve el perfil del organizador con su organización', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(
        filaPerfil({
          id: 7n,
          nombre: 'Luis',
          apellido: 'Álvarez',
          tipo_documento: 'CC',
          documento: '801234567',
          telefono: '3105551234',
          correo: 'luis.alvarez@agrovalle.org',
          rol: 'organizador',
          comerciantes: null,
          organizadores_organizadores_usuario_idTousuarios: {
            nombre_organizacion: 'Fundación Agroecológica del Valle',
            nit: '900123456-1',
            representante: 'Luis Álvarez',
            tipo_feria: 'Feria agroecológica',
            contacto: '3105551234',
            estado: 'pendiente_validacion',
            validado_en: null,
          },
        }),
      );

      const perfil = await service.ver('7');

      expect(perfil.actividadComercial).toBeUndefined();
      expect(perfil.organizacion).toEqual({
        nombreOrganizacion: 'Fundación Agroecológica del Valle',
        nit: '900123456-1',
        representante: 'Luis Álvarez',
        tipoFeria: 'Feria agroecológica',
        contacto: '3105551234',
        estado: 'pendiente_validacion',
        validadoEn: null,
      });
    });

    it('devuelve organización null si el organizador aún no la registra', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(
        filaPerfil({
          rol: 'organizador',
          comerciantes: null,
          organizadores_organizadores_usuario_idTousuarios: null,
        }),
      );

      const perfil = await service.ver('7');

      expect(perfil.organizacion).toBeNull();
    });

    it('responde 400 si el identificador no es numérico', async () => {
      await expect(service.ver('abc')).rejects.toThrow(BadRequestException);
    });
  });

  describe('actualizar', () => {
    it('actualiza los campos válidos y devuelve el perfil fresco', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(
        filaPerfil({ telefono: '3115550000' }),
      );
      const dto: ActualizarPerfilDto = {
        nombre: 'José Luis',
        telefono: '3115550000',
      };

      const perfil = await service.actualizar('5', dto);

      // Auditoría: primero se fija el actor, después el UPDATE auditado.
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.usuarios.update).toHaveBeenCalledWith({
        where: { id: 5n },
        data: { nombre: 'José Luis', telefono: '3115550000' },
      });
      expect(perfil.datosPersonales.telefono).toBe('3115550000');
    });

    it('permite limpiar el apellido enviándolo como null', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(
        filaPerfil({ apellido: null }),
      );

      await service.actualizar('5', { apellido: null });

      expect(prisma.usuarios.update).toHaveBeenCalledWith({
        where: { id: 5n },
        data: { apellido: null },
      });
    });

    it('responde 400 si el cuerpo no trae ningún campo', async () => {
      await expect(service.actualizar('5', {})).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.usuarios.update).not.toHaveBeenCalled();
    });
  });

  describe('cambiarPassword', () => {
    const DTO: CambiarPasswordDto = {
      passwordActual: 'Comerciante123',
      passwordNueva: 'NuevaClave456',
      confirmarPassword: 'NuevaClave456',
    };

    function usuarioConPassword(hash?: string) {
      return {
        id: 5n,
        nombre: 'José',
        correo: 'jose.perez@hotmail.com',
        password_hash: hash,
      };
    }

    it('verifica la actual, guarda el nuevo hash, notifica y avisa por correo', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(
        usuarioConPassword('hash-viejo'),
      );
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const respuesta = await service.cambiarPassword('5', DTO);

      expect(argon2.verify).toHaveBeenCalledWith(
        'hash-viejo',
        'Comerciante123',
      );
      expect(argon2.hash).toHaveBeenCalledWith(
        'NuevaClave456',
        expect.anything(),
      );
      // Auditoría + update + notificación dentro de la transacción.
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.usuarios.update).toHaveBeenCalledWith({
        where: { id: 5n },
        data: { password_hash: 'hash-de:NuevaClave456' },
      });
      expect(prisma.notificaciones.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          usuario_id: 5n,
          tipo: 'cambio_password',
          asunto: 'Contraseña actualizada',
        }),
      });
      expect(correo.enviarAvisoCambioPassword).toHaveBeenCalledWith(
        'jose.perez@hotmail.com',
        'José',
      );
      expect(respuesta.mensaje).toContain('actualizada correctamente');
    });

    it('responde 400 si la contraseña actual no coincide', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(
        usuarioConPassword('hash-viejo'),
      );
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.cambiarPassword('5', DTO)).rejects.toThrow(
        'La contraseña actual es incorrecta',
      );
      expect(prisma.usuarios.update).not.toHaveBeenCalled();
    });

    it('no revierte el cambio si falla el aviso por correo', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(
        usuarioConPassword('hash-viejo'),
      );
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      correo.enviarAvisoCambioPassword.mockRejectedValue(
        new Error('SMTP caído'),
      );

      const respuesta = await service.cambiarPassword('5', DTO);

      expect(respuesta.mensaje).toContain('actualizada correctamente');
      expect(prisma.usuarios.update).toHaveBeenCalled();
    });
  });
});
