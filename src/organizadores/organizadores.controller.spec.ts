import 'reflect-metadata';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { CrearOrganizacionDto } from './dto/crear-organizacion.dto';
import { OrganizacionResponseDto } from './dto/organizacion-response.dto';
import { OrganizadoresController } from './organizadores.controller';
import type { OrganizadoresService } from './organizadores.service';

const ORGANIZADOR: UsuarioAutenticado = {
  id: '7',
  nombre: 'Luis',
  apellido: 'Álvarez',
  correo: 'luis.alvarez@agrovalle.org',
  rol: 'organizador',
  perfil: null,
  estado: 'activa',
};

const ORGANIZACION: OrganizacionResponseDto = {
  usuarioId: '7',
  nombreOrganizacion: 'Fundación Agroecológica del Valle',
  nit: '900123456-1',
  representante: 'Luis Álvarez',
  tipoFeria: 'Feria agroecológica',
  contacto: '3105551234',
  estado: 'pendiente_validacion',
  validadoEn: null,
};

describe('OrganizadoresController', () => {
  it('está restringido al rol organizador a nivel de clase', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, OrganizadoresController);
    expect(roles).toEqual(['organizador']);
  });

  it('delega la creación con el id del organizador en bigint', async () => {
    const crear = jest.fn().mockResolvedValue(ORGANIZACION);
    const controller = new OrganizadoresController({
      crear,
    } as unknown as OrganizadoresService);
    const dto: CrearOrganizacionDto = {
      nombreOrganizacion: 'Fundación Agroecológica del Valle',
      nit: '900123456-1',
      representante: 'Luis Álvarez',
      tipoFeria: 'Feria agroecológica',
    };

    const respuesta = await controller.crear(ORGANIZADOR, dto);

    expect(crear).toHaveBeenCalledWith(7n, dto);
    expect(respuesta).toBe(ORGANIZACION);
  });

  it('delega la consulta y la actualización', async () => {
    const ver = jest.fn().mockResolvedValue(ORGANIZACION);
    const actualizar = jest.fn().mockResolvedValue(ORGANIZACION);
    const controller = new OrganizadoresController({
      ver,
      actualizar,
    } as unknown as OrganizadoresService);

    await controller.ver(ORGANIZADOR);
    await controller.actualizar(ORGANIZADOR, { contacto: '3115550000' });

    expect(ver).toHaveBeenCalledWith(7n);
    expect(actualizar).toHaveBeenCalledWith(7n, {
      contacto: '3115550000',
    });
  });
});
