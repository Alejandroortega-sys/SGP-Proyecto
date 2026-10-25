import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActualizarOrganizacionDto } from './dto/actualizar-organizacion.dto';
import { CambiarEstadoOrganizacionDto } from './dto/cambiar-estado-organizacion.dto';
import { CrearOrganizacionDto } from './dto/crear-organizacion.dto';
import { OrganizadoresService } from './organizadores.service';

const FECHA = new Date('2026-09-15T14:30:00.000Z');

const FILA_ORGANIZACION = {
  usuario_id: 7n,
  nombre_organizacion: 'Fundación Agroecológica del Valle',
  nit: '900123456-1',
  representante: 'Luis Álvarez',
  tipo_feria: 'Feria agroecológica',
  contacto: '3105551234',
  estado: 'pendiente_validacion',
  validado_por: null,
  validado_en: null,
};

const FILA_USUARIO = {
  id: 7n,
  nombre: 'Luis',
  apellido: 'Álvarez',
  correo: 'luis.alvarez@agrovalle.org',
  telefono: '3105551234',
  rol: 'organizador',
  creado_en: FECHA,
  organizadores_organizadores_usuario_idTousuarios: FILA_ORGANIZACION,
};

interface PrismaMock {
  organizadores: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  usuarios: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
  notificaciones: { create: jest.Mock };
  $executeRaw: jest.Mock;
  $transaction: jest.Mock;
}

function crearPrismaMock(): PrismaMock {
  const prisma: PrismaMock = {
    organizadores: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    usuarios: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    notificaciones: { create: jest.fn() },
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (operacion: unknown) =>
    (operacion as (tx: PrismaMock) => unknown)(prisma),
  );
  return prisma;
}

const DTO_CREACION: CrearOrganizacionDto = {
  nombreOrganizacion: 'Fundación Agroecológica del Valle',
  nit: '900123456-1',
  representante: 'Luis Álvarez',
  tipoFeria: 'Feria agroecológica',
  contacto: '3105551234',
};

describe('OrganizadoresService', () => {
  let prisma: PrismaMock;
  let service: OrganizadoresService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    prisma.notificaciones.create.mockResolvedValue(undefined);
    prisma.$executeRaw.mockResolvedValue(1);
    service = new OrganizadoresService(prisma as unknown as PrismaService);
  });

  describe('crear', () => {
    it('crea la organización sin enviar estado y registra auditoría y aviso', async () => {
      prisma.organizadores.findUnique
        .mockResolvedValueOnce(null) // no tiene organización
        .mockResolvedValueOnce(null); // NIT libre
      prisma.organizadores.findFirst.mockResolvedValue(null); // nombre libre
      prisma.organizadores.create.mockResolvedValue(FILA_ORGANIZACION);

      const resultado = await service.crear(7n, DTO_CREACION);

      const { data } = prisma.organizadores.create.mock.calls[0][0];
      expect(data).toEqual({
        usuario_id: 7n,
        nombre_organizacion: 'Fundación Agroecológica del Valle',
        nit: '900123456-1',
        representante: 'Luis Álvarez',
        tipo_feria: 'Feria agroecológica',
        contacto: '3105551234',
      });
      expect(data.estado).toBeUndefined();
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.notificaciones.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          usuario_id: 7n,
          tipo: 'registro_organizacion',
          canal: 'app',
        }),
      });
      expect(resultado).toMatchObject({
        usuarioId: '7',
        estado: 'pendiente_validacion',
      });
      expect(resultado.mensaje).toContain('Pendiente de validación');
    });

    it('rechaza si el organizador ya tiene una organización', async () => {
      prisma.organizadores.findUnique.mockResolvedValue({ usuario_id: 7n });
      prisma.organizadores.findFirst.mockResolvedValue(null);

      await expect(service.crear(7n, DTO_CREACION)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.organizadores.create).not.toHaveBeenCalled();
    });

    it('rechaza un nombre de organización duplicado sin distinguir mayúsculas', async () => {
      prisma.organizadores.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      prisma.organizadores.findFirst.mockResolvedValue({ usuario_id: 8n });

      await expect(service.crear(7n, DTO_CREACION)).rejects.toThrow(
        'Ya existe una organización con ese nombre',
      );
      expect(prisma.organizadores.create).not.toHaveBeenCalled();
    });

    it('rechaza un NIT duplicado', async () => {
      prisma.organizadores.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ usuario_id: 8n });
      prisma.organizadores.findFirst.mockResolvedValue(null);

      await expect(service.crear(7n, DTO_CREACION)).rejects.toThrow(
        'Ya existe una organización con ese NIT',
      );
      expect(prisma.organizadores.create).not.toHaveBeenCalled();
    });
  });

  describe('ver', () => {
    it('devuelve la organización del organizador', async () => {
      prisma.organizadores.findUnique.mockResolvedValue(FILA_ORGANIZACION);

      const resultado = await service.ver(7n);

      expect(resultado).toMatchObject({
        usuarioId: '7',
        nombreOrganizacion: 'Fundación Agroecológica del Valle',
        nit: '900123456-1',
        estado: 'pendiente_validacion',
      });
    });

    it('responde 404 si aún no la ha registrado', async () => {
      prisma.organizadores.findUnique.mockResolvedValue(null);

      await expect(service.ver(7n)).rejects.toThrow(NotFoundException);
    });
  });

  describe('actualizar', () => {
    it('actualiza los campos válidos y audita con el organizador', async () => {
      prisma.organizadores.findUnique
        .mockResolvedValueOnce(FILA_ORGANIZACION) // organización actual
        .mockResolvedValueOnce(FILA_ORGANIZACION); // NIT de la misma organización
      prisma.organizadores.findFirst.mockResolvedValue(null);
      prisma.organizadores.update.mockResolvedValue({
        ...FILA_ORGANIZACION,
        nombre_organizacion: 'Fundación Agroecológica del Valle Renovada',
        contacto: '3115550000',
      });

      const dto: ActualizarOrganizacionDto = {
        nombreOrganizacion: 'Fundación Agroecológica del Valle Renovada',
        contacto: '3115550000',
      };
      const resultado = await service.actualizar(7n, dto);

      expect(prisma.organizadores.update).toHaveBeenCalledWith({
        where: { usuario_id: 7n },
        data: {
          nombre_organizacion: 'Fundación Agroecológica del Valle Renovada',
          contacto: '3115550000',
        },
        select: expect.anything(),
      });
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(resultado.nombreOrganizacion).toBe(
        'Fundación Agroecológica del Valle Renovada',
      );
    });

    it('rechaza un nombre que ya usa otra organización', async () => {
      prisma.organizadores.findUnique.mockResolvedValue(FILA_ORGANIZACION);
      prisma.organizadores.findFirst.mockResolvedValue({ usuario_id: 8n });

      await expect(
        service.actualizar(7n, { nombreOrganizacion: 'Otra' }),
      ).rejects.toThrow('Ya existe otra organización con ese nombre');
      expect(prisma.organizadores.update).not.toHaveBeenCalled();
    });

    it('responde 400 si no envía ningún campo', async () => {
      prisma.organizadores.findUnique.mockResolvedValue(FILA_ORGANIZACION);

      await expect(service.actualizar(7n, {})).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.organizadores.update).not.toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('devuelve las organizaciones paginadas', async () => {
      prisma.usuarios.findMany.mockResolvedValue([FILA_USUARIO]);
      prisma.usuarios.count.mockResolvedValue(1);

      const resultado = await service.listar({ pagina: 1, limite: 20 });

      expect(resultado.datos).toHaveLength(1);
      expect(resultado.datos[0]).toMatchObject({
        usuarioId: '7',
        nombre: 'Luis',
        nombreOrganizacion: 'Fundación Agroecológica del Valle',
        estado: 'pendiente_validacion',
      });
      expect(resultado.paginacion).toEqual({
        pagina: 1,
        limite: 20,
        total: 1,
        totalPaginas: 1,
      });
    });

    it('filtra por estado y búsqueda', async () => {
      prisma.usuarios.findMany.mockResolvedValue([]);
      prisma.usuarios.count.mockResolvedValue(0);

      await service.listar({
        estado: 'pendiente_validacion',
        busqueda: 'Agrovalle',
      });

      const { where } = prisma.usuarios.findMany.mock.calls[0][0];
      expect(where.AND).toEqual(
        expect.arrayContaining([
          { rol: 'organizador' },
          {
            organizadores_organizadores_usuario_idTousuarios: {
              is: { estado: 'pendiente_validacion' },
            },
          },
        ]),
      );
    });
  });

  describe('detalle', () => {
    it('devuelve el detalle de una organización', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(FILA_USUARIO);

      const resultado = await service.detalle(7n);

      expect(resultado).toMatchObject({
        usuarioId: '7',
        correo: 'luis.alvarez@agrovalle.org',
        nit: '900123456-1',
      });
    });

    it('responde 404 si la cuenta no es un organizador con organización', async () => {
      prisma.usuarios.findUnique.mockResolvedValue({
        ...FILA_USUARIO,
        rol: 'comerciante',
        organizadores_organizadores_usuario_idTousuarios: null,
      });

      await expect(service.detalle(7n)).rejects.toThrow(NotFoundException);
    });
  });

  describe('cambiarEstado', () => {
    const DTO: CambiarEstadoOrganizacionDto = {
      estado: 'activa',
      motivo: 'Documentación verificada',
    };

    it('activa la organización, audita con el gestor y notifica', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(FILA_USUARIO);
      prisma.organizadores.update.mockResolvedValue({
        ...FILA_ORGANIZACION,
        estado: 'activa',
        validado_por: 1n,
        validado_en: FECHA,
      });

      const resultado = await service.cambiarEstado(7n, DTO, 1n);

      expect(prisma.organizadores.update).toHaveBeenCalledWith({
        where: { usuario_id: 7n },
        data: {
          estado: 'activa',
          validado_por: 1n,
          validado_en: expect.any(Date),
        },
        select: expect.anything(),
      });
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.notificaciones.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          usuario_id: 7n,
          tipo: 'estado_organizacion',
          asunto: 'Organización activa',
          cuerpo: expect.stringContaining('Documentación verificada'),
        }),
      });
      expect(resultado).toMatchObject({
        estado: 'activa',
        validadoPor: '1',
      });
    });

    it('rechaza cambiar al mismo estado', async () => {
      prisma.usuarios.findUnique.mockResolvedValue({
        ...FILA_USUARIO,
        organizadores_organizadores_usuario_idTousuarios: {
          ...FILA_ORGANIZACION,
          estado: 'activa',
        },
      });

      await expect(
        service.cambiarEstado(7n, { estado: 'activa' }, 1n),
      ).rejects.toThrow(ConflictException);
      expect(prisma.organizadores.update).not.toHaveBeenCalled();
    });

    it('responde 404 si la organización no existe', async () => {
      prisma.usuarios.findUnique.mockResolvedValue(null);

      await expect(service.cambiarEstado(7n, DTO, 1n)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
