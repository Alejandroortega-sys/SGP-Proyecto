import 'reflect-metadata';
import { PERFIL_GESTOR_KEY } from '../auth/decorators/perfil-gestor.decorator';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { ProductosController } from './productos.controller';
import { ProductosService } from './productos.service';

const COMERCIANTE: UsuarioAutenticado = {
  id: '4',
  nombre: 'José',
  apellido: 'Pérez',
  correo: 'jose.perez@hotmail.com',
  rol: 'comerciante',
  perfil: null,
  estado: 'activa',
};

type MetodoProductos = 'listar' | 'crear' | 'cambiarEstado';

/**
 * Lee los metadatos que `SetMetadata` guarda en la función del método.
 */
function metadatosDelMetodo(clave: string, metodo: MetodoProductos): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(
    ProductosController.prototype,
    metodo,
  );
  return Reflect.getMetadata(clave, descriptor?.value);
}

interface ProductosServiceMock {
  listar: jest.Mock;
  crear: jest.Mock;
  cambiarEstado: jest.Mock;
}

function crearServiceMock(): {
  service: ProductosService;
  mock: ProductosServiceMock;
} {
  const mock: ProductosServiceMock = {
    listar: jest.fn().mockResolvedValue({ datos: [] }),
    crear: jest.fn(),
    cambiarEstado: jest.fn(),
  };
  return { service: mock as unknown as ProductosService, mock };
}

describe('ProductosController', () => {
  it('permite que cualquier rol autenticado consulte el catálogo', () => {
    expect(metadatosDelMetodo(ROLES_KEY, 'listar')).toBeUndefined();
  });

  it('restringe la creación y el cambio de estado al rol gestor', () => {
    expect(metadatosDelMetodo(ROLES_KEY, 'crear')).toEqual(['gestor']);
    expect(metadatosDelMetodo(ROLES_KEY, 'cambiarEstado')).toEqual(['gestor']);
  });

  it('lista los productos con el rol del usuario autenticado', async () => {
    const { service, mock } = crearServiceMock();
    const controller = new ProductosController(service);

    await controller.listar(COMERCIANTE);

    expect(mock.listar).toHaveBeenCalledWith('comerciante');
  });

  it('delega la creación al servicio', async () => {
    const { service, mock } = crearServiceMock();
    const controller = new ProductosController(service);
    const dto = { nombre: 'Frutas frescas' };

    await controller.crear(dto);

    expect(mock.crear).toHaveBeenCalledWith(dto);
  });

  it('delega el cambio de estado al servicio', async () => {
    const { service, mock } = crearServiceMock();
    const controller = new ProductosController(service);
    const dto = { activo: false };

    await controller.cambiarEstado('6', dto);

    expect(mock.cambiarEstado).toHaveBeenCalledWith('6', dto);
  });

  it('no exige un perfil de gestor concreto (revisor o administrador)', () => {
    expect(
      Reflect.getMetadata(PERFIL_GESTOR_KEY, ProductosController),
    ).toBeUndefined();
    expect(metadatosDelMetodo(PERFIL_GESTOR_KEY, 'crear')).toBeUndefined();
    expect(
      metadatosDelMetodo(PERFIL_GESTOR_KEY, 'cambiarEstado'),
    ).toBeUndefined();
  });
});
