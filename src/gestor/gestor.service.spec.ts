import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { CorreoService } from '../correo/correo.service';
import type {
  estado_usuario,
  perfil_gestor,
  rol_usuario,
} from '../generated/prisma/client';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GestorService } from './gestor.service';

const FECHA = new Date('2026-09-15T14:30:00.000Z');

const CONFIG = {
  get: (clave: string) =>
    clave === 'FRONTEND_URL' ? 'http://localhost:3001' : undefined,
} as unknown as ConfigService;

function crearCorreoMock(): {
  correo: CorreoService;
  enviarCredencialesGestor: jest.Mock;
} {
  const enviarCredencialesGestor = jest.fn().mockResolvedValue(undefined);
  return {
    correo: { enviarCredencialesGestor } as unknown as CorreoService,
    enviarCredencialesGestor,
  };
}

function crearService(
  prisma: PrismaService,
  correo?: CorreoService,
): GestorService {
  return new GestorService(prisma, correo ?? crearCorreoMock().correo, CONFIG);
}

/** Fila mínima que devuelve el listado de comerciantes. */
const FILA_LISTADO = {
  id: 5n,
  nombre: 'José',
  apellido: 'Pérez',
  tipo_documento: 'CC',
  documento: '1029384756',
  correo: 'jose.perez@hotmail.com',
  telefono: '3001122334',
  estado: 'activa',
  creado_en: FECHA,
  comerciantes: {
    actividad_comercial: 'Venta de frutas y verduras',
    categoria: 'formal',
    _count: { solicitudes: 3, permisos: 1 },
  },
};

/** Fila mínima del listado general para un organizador. */
const FILA_USUARIO_ORGANIZADOR = {
  id: 7n,
  nombre: 'Luis',
  apellido: 'Álvarez',
  correo: 'luis.alvarez@agrovalle.org',
  documento: null,
  telefono: null,
  rol: 'organizador',
  estado: 'activa',
  creado_en: FECHA,
  gestores_gestores_usuario_idTousuarios: null,
  comerciantes: null,
  organizadores_organizadores_usuario_idTousuarios: {
    nombre_organizacion: 'Fundación Agroecológica del Valle',
  },
};

/** Fila mínima del listado general para un gestor. */
const FILA_USUARIO_GESTOR = {
  id: 1n,
  nombre: 'Laura',
  apellido: 'Martínez',
  correo: 'admin@tulua.gov.co',
  documento: null,
  telefono: null,
  rol: 'gestor',
  estado: 'activa',
  creado_en: FECHA,
  gestores_gestores_usuario_idTousuarios: { perfil: 'administrador' },
  comerciantes: null,
  organizadores_organizadores_usuario_idTousuarios: null,
};

/** Fila mínima que devuelve el detalle de un comerciante. */
const FILA_DETALLE = {
  id: 5n,
  nombre: 'José',
  apellido: 'Pérez',
  tipo_documento: 'CC',
  documento: '1029384756',
  telefono: '3001122334',
  correo: 'jose.perez@hotmail.com',
  rol: 'comerciante',
  estado: 'activa',
  creado_en: FECHA,
  actualizado_en: FECHA,
  gestores_gestores_usuario_idTousuarios: null,
  organizadores_organizadores_usuario_idTousuarios: null,
  comerciantes: {
    actividad_comercial: 'Venta de frutas y verduras',
    categoria: 'formal',
    actualizado_en: FECHA,
    solicitudes: [
      {
        id: 12n,
        numero_radicado: 'SOL-2026-00012',
        estado: 'aprobada',
        actividad: 'Venta de frutas y verduras',
        fecha_inicio: FECHA,
        fecha_fin: FECHA,
        hora_inicio: new Date('1970-01-01T08:00:00.000Z'),
        hora_fin: new Date('1970-01-01T18:00:00.000Z'),
        radicada_en: FECHA,
        decidida_en: FECHA,
        motivo_rechazo: null,
        creado_en: FECHA,
        espacios_temporales: { nombre: 'Espacio móvil Calle 30 - A' },
        permisos: { numero: 'PER-2026-00007', estado: 'vigente' },
      },
    ],
    permisos: [
      {
        id: 7n,
        numero: 'PER-2026-00007',
        categoria_autorizada: 'Venta de frutas y verduras',
        fecha_inicio: FECHA,
        fecha_fin: FECHA,
        estado: 'vigente',
        emitido_en: FECHA,
        espacios_temporales: { nombre: 'Espacio móvil Calle 30 - A' },
        solicitudes: { numero_radicado: 'SOL-2026-00012' },
        cobros: {
          valor: { toString: () => '25000.00' },
          estado: 'pagado',
          pagado_en: FECHA,
        },
      },
    ],
  },
};

/** Fila de detalle para un organizador. */
const FILA_DETALLE_ORGANIZADOR = {
  ...FILA_DETALLE,
  id: 7n,
  nombre: 'Luis',
  apellido: 'Álvarez',
  correo: 'luis.alvarez@agrovalle.org',
  rol: 'organizador',
  comerciantes: null,
  organizadores_organizadores_usuario_idTousuarios: {
    nombre_organizacion: 'Fundación Agroecológica del Valle',
    nit: '900123456-1',
    representante: 'Luis Álvarez',
    tipo_feria: 'Feria agroecológica',
    contacto: '3105551234',
    estado: 'activa',
    validado_en: FECHA,
  },
};

/** Fila de detalle para un gestor. */
const FILA_DETALLE_GESTOR = {
  ...FILA_DETALLE,
  id: 1n,
  nombre: 'Laura',
  apellido: 'Martínez',
  correo: 'admin@tulua.gov.co',
  rol: 'gestor',
  comerciantes: null,
  gestores_gestores_usuario_idTousuarios: {
    perfil: 'administrador',
    creado_por: 1n,
  },
};

/** Crea un Prisma simulado con las operaciones usadas por el servicio. */
function crearPrisma(): {
  prisma: PrismaService;
  usuarios: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  notificaciones: { create: jest.Mock };
  queryRaw: jest.Mock;
  executeRaw: jest.Mock;
  transaction: jest.Mock;
} {
  const usuarios = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const notificaciones = { create: jest.fn().mockResolvedValue(undefined) };
  const queryRaw = jest.fn().mockResolvedValue([]);
  const executeRaw = jest.fn().mockResolvedValue(1);
  const transaction = jest.fn(
    async (callback: (cliente: unknown) => Promise<unknown>) =>
      callback(prisma),
  );
  const prisma = {
    usuarios,
    notificaciones,
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
    $transaction: transaction,
  } as unknown as PrismaService;

  return {
    prisma,
    usuarios,
    notificaciones,
    queryRaw,
    executeRaw,
    transaction,
  };
}

/** Crea un objetivo para el cambio de estado. */
function usuarioEstado(
  estado: estado_usuario,
  rol: rol_usuario = 'comerciante',
  perfil: perfil_gestor | null = null,
) {
  return {
    id: 5n,
    nombre: 'José',
    correo: 'jose.perez@hotmail.com',
    rol,
    estado,
    gestores_gestores_usuario_idTousuarios: perfil ? { perfil } : null,
  };
}

describe('GestorService', () => {
  describe('crearGestor', () => {
    it('crea la cuenta, el perfil, la auditoría y envía la contraseña temporal', async () => {
      const { prisma, usuarios, executeRaw } = crearPrisma();
      const { correo, enviarCredencialesGestor } = crearCorreoMock();
      const creado = {
        id: 9n,
        nombre: 'Ana',
        apellido: 'López',
        correo: 'ana.lopez@tulua.gov.co',
        estado: 'pendiente_activacion',
        gestores_gestores_usuario_idTousuarios: { perfil: 'revisor' },
      };
      usuarios.create.mockResolvedValue(creado);
      const service = crearService(prisma, correo);

      const respuesta = await service.crearGestor(
        {
          nombre: ' Ana ',
          apellido: ' López ',
          correo: ' Ana.Lopez@Tulua.gov.co ',
          perfil: 'revisor',
        },
        1n,
      );

      expect(usuarios.create).toHaveBeenCalledWith({
        data: {
          rol: 'gestor',
          nombre: 'Ana',
          apellido: 'López',
          correo: 'ana.lopez@tulua.gov.co',
          password_hash: expect.any(String),
          estado: 'pendiente_activacion',
          gestores_gestores_usuario_idTousuarios: {
            create: { perfil: 'revisor', creado_por: 1n },
          },
        },
        select: expect.any(Object),
      });
      // Una llamada es fijarActorAuditoria y otra el INSERT manual en auditoria.
      expect(executeRaw).toHaveBeenCalledTimes(2);
      expect(enviarCredencialesGestor).toHaveBeenCalledWith(
        'ana.lopez@tulua.gov.co',
        'Ana',
        'revisor',
        expect.stringMatching(/^.{8,}$/),
        'http://localhost:3001/login',
      );
      expect(respuesta).toEqual({
        id: '9',
        nombre: 'Ana',
        apellido: 'López',
        correo: 'ana.lopez@tulua.gov.co',
        perfil: 'revisor',
        estado: 'pendiente_activacion',
        mensaje:
          'Cuenta de gestor creada. Enviamos la contraseña temporal al correo; ' +
          'debe cambiarla en el primer inicio de sesión.',
      });
      expect(respuesta).not.toHaveProperty('password');
    });

    it('responde 503 si la cuenta se creó pero el correo falla', async () => {
      const { prisma, usuarios } = crearPrisma();
      const { correo, enviarCredencialesGestor } = crearCorreoMock();
      usuarios.create.mockResolvedValue({
        id: 9n,
        nombre: 'Ana',
        apellido: null,
        correo: 'ana.lopez@tulua.gov.co',
        estado: 'pendiente_activacion',
        gestores_gestores_usuario_idTousuarios: { perfil: 'administrador' },
      });
      enviarCredencialesGestor.mockRejectedValueOnce(new Error('SMTP caído'));
      const service = crearService(prisma, correo);

      await expect(
        service.crearGestor(
          {
            nombre: 'Ana',
            correo: 'ana.lopez@tulua.gov.co',
            perfil: 'administrador',
          },
          1n,
        ),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('listarComerciantes', () => {
    it('aplica búsqueda por palabras, filtros y paginación', async () => {
      const { prisma, usuarios } = crearPrisma();
      usuarios.findMany.mockResolvedValue([FILA_LISTADO]);
      usuarios.count.mockResolvedValue(1);
      const service = crearService(prisma);

      const respuesta = await service.listarComerciantes({
        busqueda: 'José Pérez',
        estado: 'activa',
        categoria: 'formal',
        pagina: 2,
        limite: 10,
      });

      const args = usuarios.findMany.mock
        .calls[0]?.[0] as Prisma.usuariosFindManyArgs;
      expect(args.skip).toBe(10);
      expect(args.take).toBe(10);
      expect(args.orderBy).toEqual([{ creado_en: 'desc' }, { id: 'desc' }]);

      const where = args.where as Prisma.usuariosWhereInput;
      expect(where.AND).toHaveLength(5);
      const serializado = JSON.stringify(where);
      expect(serializado).toContain('José');
      expect(serializado).toContain('Pérez');
      expect(serializado).toContain('actividad_comercial');

      const condiciones = where.AND as Prisma.usuariosWhereInput[];
      const condicionCorreo = condiciones
        .flatMap((condicion) =>
          Array.isArray(condicion.OR) ? condicion.OR : [],
        )
        .find((condicion) => 'correo' in condicion);
      expect(condicionCorreo).toEqual({
        correo: { contains: 'José', mode: 'insensitive' },
      });

      expect(respuesta).toEqual({
        datos: [
          {
            id: '5',
            nombre: 'José',
            apellido: 'Pérez',
            tipoDocumento: 'CC',
            documento: '1029384756',
            correo: 'jose.perez@hotmail.com',
            telefono: '3001122334',
            estado: 'activa',
            categoria: 'formal',
            actividadComercial: 'Venta de frutas y verduras',
            totalSolicitudes: 3,
            totalPermisos: 1,
            creadoEn: FECHA,
          },
        ],
        paginacion: {
          pagina: 2,
          limite: 10,
          total: 1,
          totalPaginas: 1,
        },
      });
    });

    it('devuelve una página vacía sin registros', async () => {
      const { prisma, usuarios } = crearPrisma();
      usuarios.findMany.mockResolvedValue([]);
      usuarios.count.mockResolvedValue(0);
      const service = crearService(prisma);

      const respuesta = await service.listarComerciantes({});

      expect(respuesta.datos).toEqual([]);
      expect(respuesta.paginacion).toEqual({
        pagina: 1,
        limite: 20,
        total: 0,
        totalPaginas: 0,
      });
    });
  });

  describe('listarUsuarios', () => {
    it('el administrador lista cualquier rol y mapea el perfil', async () => {
      const { prisma, usuarios } = crearPrisma();
      usuarios.findMany.mockResolvedValue([
        FILA_USUARIO_GESTOR,
        FILA_USUARIO_ORGANIZADOR,
      ]);
      usuarios.count.mockResolvedValue(2);
      const service = crearService(prisma);

      const respuesta = await service.listarUsuarios({}, 'administrador');

      const args = usuarios.findMany.mock
        .calls[0]?.[0] as Prisma.usuariosFindManyArgs;
      expect((args.where as Prisma.usuariosWhereInput).AND).toEqual([]);
      expect(respuesta.datos).toEqual([
        expect.objectContaining({
          id: '1',
          rol: 'gestor',
          perfil: 'administrador',
          nombreOrganizacion: null,
        }),
        expect.objectContaining({
          id: '7',
          rol: 'organizador',
          perfil: null,
          nombreOrganizacion: 'Fundación Agroecológica del Valle',
        }),
      ]);
      expect(respuesta.paginacion.total).toBe(2);
    });

    it('el revisor queda limitado a comerciantes y organizadores', async () => {
      const { prisma, usuarios } = crearPrisma();
      usuarios.findMany.mockResolvedValue([FILA_USUARIO_ORGANIZADOR]);
      usuarios.count.mockResolvedValue(1);
      const service = crearService(prisma);

      await service.listarUsuarios({}, 'revisor');

      const args = usuarios.findMany.mock
        .calls[0]?.[0] as Prisma.usuariosFindManyArgs;
      const where = args.where as Prisma.usuariosWhereInput;
      expect(where.AND).toEqual(
        expect.arrayContaining([
          { rol: { in: ['comerciante', 'organizador'] } },
        ]),
      );
    });

    it('el revisor puede filtrar por organizador', async () => {
      const { prisma, usuarios } = crearPrisma();
      usuarios.findMany.mockResolvedValue([FILA_USUARIO_ORGANIZADOR]);
      usuarios.count.mockResolvedValue(1);
      const service = crearService(prisma);

      await service.listarUsuarios({ rol: 'organizador' }, 'revisor');

      const args = usuarios.findMany.mock
        .calls[0]?.[0] as Prisma.usuariosFindManyArgs;
      const where = args.where as Prisma.usuariosWhereInput;
      expect(where.AND).toEqual(
        expect.arrayContaining([{ rol: 'organizador' }]),
      );
    });

    it('el revisor no puede filtrar por gestor ni por perfil', async () => {
      const { prisma } = crearPrisma();
      const service = crearService(prisma);

      await expect(
        service.listarUsuarios({ rol: 'gestor' }, 'revisor'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.listarUsuarios({ perfil: 'administrador' }, 'revisor'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('el administrador puede filtrar por perfil de gestor', async () => {
      const { prisma, usuarios } = crearPrisma();
      usuarios.findMany.mockResolvedValue([FILA_USUARIO_GESTOR]);
      usuarios.count.mockResolvedValue(1);
      const service = crearService(prisma);

      await service.listarUsuarios(
        { perfil: 'administrador' },
        'administrador',
      );

      const args = usuarios.findMany.mock
        .calls[0]?.[0] as Prisma.usuariosFindManyArgs;
      const where = args.where as Prisma.usuariosWhereInput;
      expect(where.AND).toEqual(
        expect.arrayContaining([
          {
            gestores_gestores_usuario_idTousuarios: {
              is: { perfil: 'administrador' },
            },
          },
        ]),
      );
    });
  });

  describe('obtenerUsuario', () => {
    it('devuelve solicitudes, permisos y totales del comerciante', async () => {
      const { prisma, usuarios } = crearPrisma();
      usuarios.findUnique.mockResolvedValue(FILA_DETALLE);
      const service = crearService(prisma);

      const respuesta = await service.obtenerUsuario(5n, 'administrador');

      expect(respuesta.usuario).toMatchObject({
        id: '5',
        nombre: 'José',
        rol: 'comerciante',
        estado: 'activa',
        perfilComercial: {
          actividadComercial: 'Venta de frutas y verduras',
          categoria: 'formal',
        },
        perfilGestor: null,
        organizacion: null,
      });
      expect(respuesta.solicitudes).toHaveLength(1);
      expect(respuesta.permisos).toHaveLength(1);
      expect(respuesta.totales).toEqual({ solicitudes: 1, permisos: 1 });
    });

    it('el revisor puede consultar un organizador', async () => {
      const { prisma, usuarios } = crearPrisma();
      usuarios.findUnique.mockResolvedValue(FILA_DETALLE_ORGANIZADOR);
      const service = crearService(prisma);

      const respuesta = await service.obtenerUsuario(7n, 'revisor');

      expect(respuesta.usuario.rol).toBe('organizador');
      expect(respuesta.usuario.organizacion?.nombreOrganizacion).toBe(
        'Fundación Agroecológica del Valle',
      );
    });

    it('el revisor no puede consultar un gestor', async () => {
      const { prisma, usuarios } = crearPrisma();
      usuarios.findUnique.mockResolvedValue(FILA_DETALLE_GESTOR);
      const service = crearService(prisma);

      await expect(service.obtenerUsuario(1n, 'revisor')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('el administrador puede consultar un gestor', async () => {
      const { prisma, usuarios } = crearPrisma();
      usuarios.findUnique.mockResolvedValue(FILA_DETALLE_GESTOR);
      const service = crearService(prisma);

      const respuesta = await service.obtenerUsuario(1n, 'administrador');

      expect(respuesta.usuario.perfilGestor).toEqual({
        perfil: 'administrador',
        creadoPor: '1',
      });
    });

    it('responde 404 si la cuenta no existe', async () => {
      const { prisma, usuarios } = crearPrisma();
      usuarios.findUnique.mockResolvedValue(null);
      const service = crearService(prisma);

      await expect(service.obtenerUsuario(5n, 'administrador')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cambiarEstado', () => {
    function prepararEstado(
      objetivo: ReturnType<typeof usuarioEstado>,
      administradoresActivos = 2,
    ) {
      const { prisma, usuarios, queryRaw, executeRaw } = crearPrisma();
      usuarios.findUnique.mockResolvedValue(objetivo);
      usuarios.count.mockResolvedValue(administradoresActivos);
      usuarios.update.mockImplementation(
        ({ data }: { data: { estado: estado_usuario } }) =>
          Promise.resolve({
            id: objetivo.id,
            nombre: objetivo.nombre,
            correo: objetivo.correo,
            estado: data.estado,
          }),
      );
      return { prisma, usuarios, queryRaw, executeRaw };
    }

    it('no permite cambiar el estado de la propia cuenta', async () => {
      const { prisma, usuarios } = prepararEstado(usuarioEstado('activa'));

      await expect(
        crearService(prisma).cambiarEstado(5n, { estado: 'suspendida' }, 5n),
      ).rejects.toThrow(ForbiddenException);
      expect(usuarios.update).not.toHaveBeenCalled();
    });

    it('no permite modificar un gestor pendiente de primer acceso', async () => {
      const { prisma, usuarios } = prepararEstado(
        usuarioEstado('pendiente_activacion', 'gestor', 'revisor'),
      );

      await expect(
        crearService(prisma).cambiarEstado(5n, { estado: 'activa' }, 1n),
      ).rejects.toThrow(ConflictException);
      expect(usuarios.update).not.toHaveBeenCalled();
    });

    it('exige otro administrador activo para desactivar a un administrador', async () => {
      const { prisma } = prepararEstado(
        usuarioEstado('activa', 'gestor', 'administrador'),
        1,
      );

      await expect(
        crearService(prisma).cambiarEstado(5n, { estado: 'suspendida' }, 1n),
      ).rejects.toThrow(ConflictException);
    });

    it('permite desactivar a otro administrador si hay dos activos', async () => {
      const { prisma, usuarios } = prepararEstado(
        usuarioEstado('activa', 'gestor', 'administrador'),
        2,
      );

      const respuesta = await crearService(prisma).cambiarEstado(
        5n,
        { estado: 'suspendida' },
        1n,
      );

      expect(usuarios.update).toHaveBeenCalled();
      expect(respuesta.estadoAnterior).toBe('activa');
      expect(respuesta.estado).toBe('suspendida');
    });

    it('permite desactivar a un revisor sin revisar administradores', async () => {
      const { prisma, usuarios } = prepararEstado(
        usuarioEstado('activa', 'gestor', 'revisor'),
      );

      await crearService(prisma).cambiarEstado(
        5n,
        { estado: 'suspendida' },
        1n,
      );

      expect(usuarios.count).not.toHaveBeenCalled();
      expect(usuarios.update).toHaveBeenCalled();
    });

    it('limpia el bloqueo al activar una cuenta', async () => {
      const { prisma, usuarios } = prepararEstado(usuarioEstado('suspendida'));

      await crearService(prisma).cambiarEstado(5n, { estado: 'activa' }, 1n);

      expect(usuarios.update).toHaveBeenCalledWith({
        where: { id: 5n },
        data: {
          estado: 'activa',
          intentos_fallidos: 0,
          bloqueado_hasta: null,
        },
        select: {
          id: true,
          nombre: true,
          correo: true,
          estado: true,
        },
      });
    });

    it('responde 404 si la cuenta no existe', async () => {
      const { prisma, usuarios } = crearPrisma();
      usuarios.findUnique.mockResolvedValue(null);

      await expect(
        crearService(prisma).cambiarEstado(5n, { estado: 'suspendida' }, 1n),
      ).rejects.toThrow(NotFoundException);
    });

    it('responde 409 si la cuenta ya está en ese estado', async () => {
      const { prisma } = prepararEstado(usuarioEstado('suspendida'));

      await expect(
        crearService(prisma).cambiarEstado(5n, { estado: 'suspendida' }, 1n),
      ).rejects.toThrow(ConflictException);
    });
  });
});
