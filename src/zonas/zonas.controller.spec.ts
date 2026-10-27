import 'reflect-metadata';
import { PERFIL_GESTOR_KEY } from '../auth/decorators/perfil-gestor.decorator';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import {
  LIMITE_ZONAS_GEOJSON,
  VENTANA_ZONAS_GEOJSON_MS,
  ZonasController,
} from './zonas.controller';
import { ZonasService } from './zonas.service';

const ADMIN: UsuarioAutenticado = {
  id: '1',
  nombre: 'Laura',
  apellido: 'Martínez',
  correo: 'admin@tulua.gov.co',
  rol: 'gestor',
  perfil: 'administrador',
  estado: 'activa',
};

type MetodoZonas =
  'geojson' | 'listar' | 'detalle' | 'crear' | 'cambiarEstado' | 'actualizar';

function metadatosDelMetodo(clave: string, metodo: MetodoZonas): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(
    ZonasController.prototype,
    metodo,
  );
  return Reflect.getMetadata(clave, descriptor?.value);
}

interface ZonasServiceMock {
  listar: jest.Mock;
  detalle: jest.Mock;
  crear: jest.Mock;
  actualizar: jest.Mock;
  cambiarEstado: jest.Mock;
  geojson: jest.Mock;
}

function crearServiceMock(): {
  service: ZonasService;
  mock: ZonasServiceMock;
} {
  const mock: ZonasServiceMock = {
    listar: jest.fn(),
    detalle: jest.fn(),
    crear: jest.fn(),
    actualizar: jest.fn(),
    cambiarEstado: jest.fn(),
    geojson: jest.fn(),
  };
  return { service: mock as unknown as ZonasService, mock };
}

describe('ZonasController', () => {
  it('expone el GeoJSON como público y sin restricción de rol', () => {
    expect(metadatosDelMetodo(IS_PUBLIC_KEY, 'geojson')).toBe(true);
    expect(metadatosDelMetodo(ROLES_KEY, 'geojson')).toBeUndefined();
  });

  it('restringe listado y detalle al rol gestor', () => {
    expect(metadatosDelMetodo(ROLES_KEY, 'listar')).toEqual(['gestor']);
    expect(metadatosDelMetodo(ROLES_KEY, 'detalle')).toEqual(['gestor']);
  });

  it('restringe las escrituras al gestor administrador', () => {
    for (const metodo of ['crear', 'actualizar', 'cambiarEstado'] as const) {
      expect(metadatosDelMetodo(ROLES_KEY, metodo)).toEqual(['gestor']);
      expect(metadatosDelMetodo(PERFIL_GESTOR_KEY, metodo)).toEqual([
        'administrador',
      ]);
    }
  });

  it('configura 60 peticiones por minuto para el GeoJSON', () => {
    expect(LIMITE_ZONAS_GEOJSON).toBe(60);
    expect(VENTANA_ZONAS_GEOJSON_MS).toBe(60_000);
  });

  it('delega el listado y el detalle', async () => {
    const { service, mock } = crearServiceMock();
    const controller = new ZonasController(service);
    const query = { pagina: 1, limite: 20 };

    await controller.listar(query);
    await controller.detalle('1');

    expect(mock.listar).toHaveBeenCalledWith(query);
    expect(mock.detalle).toHaveBeenCalledWith('1');
  });

  it('pasa el gestor autenticado a las escrituras', async () => {
    const { service, mock } = crearServiceMock();
    const controller = new ZonasController(service);
    const crear = {
      nombre: 'Centro',
      tipo: 'permitida' as const,
      geometria: {
        type: 'Polygon' as const,
        coordinates: [],
      },
    };

    await controller.crear(ADMIN, crear);
    await controller.actualizar('1', ADMIN, { nombre: 'Centro nuevo' });
    await controller.cambiarEstado('1', ADMIN, { activa: false });

    expect(mock.crear).toHaveBeenCalledWith('1', crear);
    expect(mock.actualizar).toHaveBeenCalledWith('1', '1', {
      nombre: 'Centro nuevo',
    });
    expect(mock.cambiarEstado).toHaveBeenCalledWith('1', '1', {
      activa: false,
    });
  });

  it('delega el GeoJSON público', async () => {
    const { service, mock } = crearServiceMock();
    const controller = new ZonasController(service);

    await controller.geojson();

    expect(mock.geojson).toHaveBeenCalledTimes(1);
  });
});
