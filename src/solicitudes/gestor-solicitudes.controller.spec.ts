import 'reflect-metadata';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { GestorSolicitudesController } from './gestor-solicitudes.controller';
import type { SolicitudesService } from './solicitudes.service';

const GESTOR: UsuarioAutenticado = {
  id: '1',
  nombre: 'Laura',
  apellido: 'Martínez',
  correo: 'admin@tulua.gov.co',
  rol: 'gestor',
  perfil: 'administrador',
  estado: 'activa',
};

describe('GestorSolicitudesController', () => {
  it('restringe el cambio de estado al rol gestor', () => {
    expect(Reflect.getMetadata(ROLES_KEY, GestorSolicitudesController)).toEqual(
      ['gestor'],
    );
  });

  it('delega el cambio de estado con el usuario, el id y el DTO', async () => {
    const cambiarEstado = jest.fn().mockResolvedValue({ id: '12' });
    const controller = new GestorSolicitudesController({
      cambiarEstado,
    } as unknown as SolicitudesService);
    const dto = { estado: 'en_revision' as const };

    await controller.cambiarEstado(GESTOR, '12', dto);

    expect(cambiarEstado).toHaveBeenCalledWith(GESTOR, '12', dto);
  });
});
