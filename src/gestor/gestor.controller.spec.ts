import 'reflect-metadata';
import { PERFIL_GESTOR_KEY } from '../auth/decorators/perfil-gestor.decorator';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import type {
  CambiarEstadoUsuarioDto,
  UsuarioEstadoActualizadoDto,
} from './dto/cambiar-estado-usuario.dto';
import type { CrearGestorDto, GestorCreadoDto } from './dto/crear-gestor.dto';
import type { ListarComerciantesQueryDto } from './dto/listar-comerciantes-query.dto';
import type { ListarComerciantesResponseDto } from './dto/listar-comerciantes-response.dto';
import type { ListarUsuariosQueryDto } from './dto/listar-usuarios-query.dto';
import type { ListarUsuariosResponseDto } from './dto/listar-usuarios-response.dto';
import type { UsuarioDetalleResponseDto } from './dto/usuario-detalle-response.dto';
import { GestorController } from './gestor.controller';
import { GestorService } from './gestor.service';

/** Gestor administrador, como lo deja `JwtAuthGuard` en request.usuario. */
const GESTOR: UsuarioAutenticado = {
  id: '1',
  nombre: 'Carlos',
  apellido: 'Ramírez',
  correo: 'admin@tulua.gov.co',
  rol: 'gestor',
  perfil: 'administrador',
  estado: 'activa',
};

const COMERCIANTES: ListarComerciantesResponseDto = {
  datos: [],
  paginacion: { pagina: 1, limite: 20, total: 0, totalPaginas: 0 },
};

const USUARIOS: ListarUsuariosResponseDto = {
  datos: [],
  paginacion: { pagina: 1, limite: 20, total: 0, totalPaginas: 0 },
};

const DETALLE = {
  usuario: { id: '5' },
} as unknown as UsuarioDetalleResponseDto;

const ESTADO: UsuarioEstadoActualizadoDto = {
  id: '5',
  nombre: 'José',
  correo: 'jose.perez@hotmail.com',
  estadoAnterior: 'activa',
  estado: 'suspendida',
  mensaje: 'Cuenta suspendida. El cambio quedó registrado en la auditoría.',
};

const CREADO: GestorCreadoDto = {
  id: '9',
  nombre: 'Ana',
  apellido: 'López',
  correo: 'ana.lopez@tulua.gov.co',
  perfil: 'revisor',
  estado: 'pendiente_activacion',
  mensaje:
    'Cuenta de gestor creada. Enviamos la contraseña temporal al correo; ' +
    'debe cambiarla en el primer inicio de sesión.',
};

/** Crea el controlador con un servicio simulado y expone los mocks. */
function crearController(): {
  controller: GestorController;
  crearGestor: jest.Mock;
  listarUsuarios: jest.Mock;
  listarComerciantes: jest.Mock;
  obtenerUsuario: jest.Mock;
  cambiarEstado: jest.Mock;
} {
  const crearGestor = jest.fn().mockResolvedValue(CREADO);
  const listarUsuarios = jest.fn().mockResolvedValue(USUARIOS);
  const listarComerciantes = jest.fn().mockResolvedValue(COMERCIANTES);
  const obtenerUsuario = jest.fn().mockResolvedValue(DETALLE);
  const cambiarEstado = jest.fn().mockResolvedValue(ESTADO);

  const servicio = {
    crearGestor,
    listarUsuarios,
    listarComerciantes,
    obtenerUsuario,
    cambiarEstado,
  } as unknown as GestorService;

  return {
    controller: new GestorController(servicio),
    crearGestor,
    listarUsuarios,
    listarComerciantes,
    obtenerUsuario,
    cambiarEstado,
  };
}

describe('GestorController', () => {
  it('está restringido al rol gestor a nivel de clase', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, GestorController);
    expect(roles).toEqual(['gestor']);
  });

  it('restringe la creación de gestores al perfil administrador', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      GestorController.prototype,
      'crearGestor',
    );
    const perfiles = Reflect.getMetadata(PERFIL_GESTOR_KEY, descriptor?.value);
    expect(perfiles).toEqual(['administrador']);
  });

  it('restringe el cambio de estado al perfil administrador', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      GestorController.prototype,
      'cambiarEstado',
    );
    const perfiles = Reflect.getMetadata(PERFIL_GESTOR_KEY, descriptor?.value);
    expect(perfiles).toEqual(['administrador']);
  });

  it('delega la creación de gestores en el servicio', async () => {
    const { controller, crearGestor } = crearController();
    const dto: CrearGestorDto = {
      nombre: 'Ana',
      apellido: 'López',
      correo: 'ana.lopez@tulua.gov.co',
      perfil: 'revisor',
    };

    const respuesta = await controller.crearGestor(dto, GESTOR);

    expect(crearGestor).toHaveBeenCalledWith(dto, 1n);
    expect(respuesta).toBe(CREADO);
  });

  it('delega el listado general con el perfil del gestor', async () => {
    const { controller, listarUsuarios } = crearController();
    const dto: ListarUsuariosQueryDto = { rol: 'organizador' };

    const respuesta = await controller.listarUsuarios(dto, GESTOR);

    expect(listarUsuarios).toHaveBeenCalledWith(dto, 'administrador');
    expect(respuesta).toBe(USUARIOS);
  });

  it('delega el listado de comerciantes en el servicio', async () => {
    const { controller, listarComerciantes } = crearController();
    const dto: ListarComerciantesQueryDto = {
      busqueda: 'José',
      pagina: 2,
      limite: 10,
    };

    const respuesta = await controller.listarComerciantes(dto);

    expect(listarComerciantes).toHaveBeenCalledWith(dto);
    expect(respuesta).toBe(COMERCIANTES);
  });

  it('convierte el identificador del detalle a bigint y pasa el perfil', async () => {
    const { controller, obtenerUsuario } = crearController();

    const respuesta = await controller.obtenerUsuario('5', GESTOR);

    expect(obtenerUsuario).toHaveBeenCalledWith(5n, 'administrador');
    expect(respuesta).toBe(DETALLE);
  });

  it('convierte los identificadores del cambio de estado a bigint', async () => {
    const { controller, cambiarEstado } = crearController();
    const dto: CambiarEstadoUsuarioDto = { estado: 'suspendida' };

    const respuesta = await controller.cambiarEstado('5', dto, GESTOR);

    expect(cambiarEstado).toHaveBeenCalledWith(5n, dto, 1n);
    expect(respuesta).toBe(ESTADO);
  });
});
