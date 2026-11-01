import 'reflect-metadata';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { EspaciosController } from './espacios.controller';
import { EspaciosService } from './espacios.service';

type MetodoEspacios = 'listar' | 'detalle';

function metadatosDelMetodo(clave: string, metodo: MetodoEspacios): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(
    EspaciosController.prototype,
    metodo,
  );
  return Reflect.getMetadata(clave, descriptor?.value);
}

interface EspaciosServiceMock {
  listar: jest.Mock;
  detalle: jest.Mock;
}

function crearServiceMock(): {
  service: EspaciosService;
  mock: EspaciosServiceMock;
} {
  const mock: EspaciosServiceMock = {
    listar: jest.fn(),
    detalle: jest.fn(),
  };
  return { service: mock as unknown as EspaciosService, mock };
}

describe('EspaciosController', () => {
  it('restringe la consulta al rol comerciante', () => {
    expect(Reflect.getMetadata(ROLES_KEY, EspaciosController)).toEqual([
      'comerciante',
    ]);
    for (const metodo of ['listar', 'detalle'] as const) {
      expect(metadatosDelMetodo(IS_PUBLIC_KEY, metodo)).toBeUndefined();
    }
  });

  it('delega el listado con la query recibida', async () => {
    const { service, mock } = crearServiceMock();
    const controller = new EspaciosController(service);
    const dto = { incluirNoDisponibles: true, fecha: '2026-10-31' };

    mock.listar.mockResolvedValue({ datos: [], total: 0, disponibles: 0, noDisponibles: 0 });
    await controller.listar(dto);

    expect(mock.listar).toHaveBeenCalledWith(dto);
  });

  it('delega la ficha con el id y la fecha', async () => {
    const { service, mock } = crearServiceMock();
    const controller = new EspaciosController(service);

    mock.detalle.mockResolvedValue({ id: '1' });
    await controller.detalle('1', { fecha: '2026-10-31' });

    expect(mock.detalle).toHaveBeenCalledWith('1', { fecha: '2026-10-31' });
  });
});
