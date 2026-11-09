import 'reflect-metadata';
import { PERFIL_GESTOR_KEY } from '../auth/decorators/perfil-gestor.decorator';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { ModulosController } from './modulos.controller';
import { ModulosService } from './modulos.service';

const REVISOR: UsuarioAutenticado = {
  id: '2',
  nombre: 'Ana',
  apellido: 'López',
  correo: 'revisor@tulua.gov.co',
  rol: 'gestor',
  perfil: 'revisor',
  estado: 'activa',
};

interface ServiceMock {
  listar: jest.Mock;
  opciones: jest.Mock;
  zonaContenedora: jest.Mock;
  detalle: jest.Mock;
  historial: jest.Mock;
  crear: jest.Mock;
  actualizar: jest.Mock;
  cambiarEstado: jest.Mock;
}

function crearService(): { service: ModulosService; mock: ServiceMock } {
  const mock: ServiceMock = {
    listar: jest.fn(),
    opciones: jest.fn(),
    zonaContenedora: jest.fn(),
    detalle: jest.fn(),
    historial: jest.fn(),
    crear: jest.fn(),
    actualizar: jest.fn(),
    cambiarEstado: jest.fn(),
  };
  return { service: mock as unknown as ModulosService, mock };
}

describe('ModulosController', () => {
  it('restringe todo el controlador al rol gestor y permite ambos perfiles', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ModulosController)).toEqual([
      'gestor',
    ]);
    expect(
      Reflect.getMetadata(PERFIL_GESTOR_KEY, ModulosController),
    ).toBeUndefined();
  });

  it('delega listado, opciones, zona y ficha', async () => {
    const { service, mock } = crearService();
    const controller = new ModulosController(service);

    await controller.listar({ pagina: 1, limite: 20 });
    await controller.opciones();
    await controller.zonaContenedora({ lat: 4.08, lng: -76.19 });
    await controller.detalle('7');
    await controller.historial('7', { pagina: 1, limite: 20 });

    expect(mock.listar).toHaveBeenCalledWith({ pagina: 1, limite: 20 });
    expect(mock.opciones).toHaveBeenCalled();
    expect(mock.zonaContenedora).toHaveBeenCalledWith(4.08, -76.19);
    expect(mock.detalle).toHaveBeenCalledWith('7');
    expect(mock.historial).toHaveBeenCalledWith('7', {
      pagina: 1,
      limite: 20,
    });
  });

  it('pasa el gestor revisor a las escrituras y adapta la foto', async () => {
    const { service, mock } = crearService();
    const controller = new ModulosController(service);
    const crear = {
      categoria: 'informal' as const,
      actividad: 'Empanadas',
      ubicacion: { type: 'Point' as const, coordinates: [-76.19, 4.08] as [number, number] },
    };

    await controller.crear(REVISOR, crear);
    await controller.actualizar('7', REVISOR, { actividad: 'Otra' });
    await controller.cambiarEstado('7', REVISOR, { estado: 'baja' });

    expect(mock.crear).toHaveBeenCalledWith('2', crear, undefined);
    expect(mock.actualizar).toHaveBeenCalledWith('7', '2', { actividad: 'Otra' }, undefined);
    expect(mock.cambiarEstado).toHaveBeenCalledWith('7', '2', {
      estado: 'baja',
    });
  });
});
