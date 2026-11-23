import 'reflect-metadata';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { FeriasController } from './ferias.controller';
import type { FeriasService } from './ferias.service';

const ORGANIZADOR: UsuarioAutenticado = {
  id: '7',
  nombre: 'Luis',
  apellido: 'Álvarez',
  correo: 'luis.alvarez@agrovalle.org',
  rol: 'organizador',
  perfil: null,
  estado: 'activa',
};

describe('FeriasController', () => {
  it('restringe los endpoints del organizador y permite al gestor descargar', () => {
    const metodo = (nombre: string): object =>
      Object.getOwnPropertyDescriptor(FeriasController.prototype, nombre)
        ?.value as object;

    expect(Reflect.getMetadata(ROLES_KEY, metodo('radicar'))).toEqual([
      'organizador',
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, metodo('listarMias'))).toEqual([
      'organizador',
    ]);
    expect(
      Reflect.getMetadata(ROLES_KEY, metodo('descargarDocumento')),
    ).toEqual(['organizador', 'gestor']);
  });

  it('delega la radicación con el usuario autenticado', async () => {
    const radicar = jest.fn().mockResolvedValue({ id: '12' });
    const controller = new FeriasController({
      radicar,
    } as unknown as FeriasService);
    const form = { datos: '{}' };

    const respuesta = await controller.radicar(ORGANIZADOR, form, []);

    expect(radicar).toHaveBeenCalledWith(ORGANIZADOR, form, []);
    expect(respuesta).toEqual({ id: '12' });
  });

  it('delega las consultas de agenda y disponibilidad', async () => {
    const agenda = jest.fn().mockResolvedValue({ zonaId: '4' });
    const disponibilidad = jest.fn().mockResolvedValue({ disponible: true });
    const controller = new FeriasController({
      agenda,
      disponibilidad,
    } as unknown as FeriasService);

    const consultaAgenda = { zonaId: '4' };
    const consultaDisponibilidad = {
      zonaId: '4',
      fechaInicio: '2099-02-10',
      fechaFin: '2099-02-12',
    };

    await controller.agenda(consultaAgenda);
    await controller.disponibilidad(consultaDisponibilidad);

    expect(agenda).toHaveBeenCalledWith(consultaAgenda);
    expect(disponibilidad).toHaveBeenCalledWith(consultaDisponibilidad);
  });
});
