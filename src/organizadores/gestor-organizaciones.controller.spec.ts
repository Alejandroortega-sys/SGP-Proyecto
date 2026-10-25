import 'reflect-metadata';
import { PERFIL_GESTOR_KEY } from '../auth/decorators/perfil-gestor.decorator';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { CambiarEstadoOrganizacionDto } from './dto/cambiar-estado-organizacion.dto';
import { ListarOrganizacionesResponseDto } from './dto/listar-organizaciones-response.dto';
import { OrganizacionGestorResponseDto } from './dto/organizacion-response.dto';
import { GestorOrganizacionesController } from './gestor-organizaciones.controller';
import type { OrganizadoresService } from './organizadores.service';

const GESTOR: UsuarioAutenticado = {
  id: '1',
  nombre: 'Laura',
  apellido: 'Martínez',
  correo: 'admin@tulua.gov.co',
  rol: 'gestor',
  perfil: 'administrador',
  estado: 'activa',
};

const LISTADO: ListarOrganizacionesResponseDto = {
  datos: [],
  paginacion: { pagina: 1, limite: 20, total: 0, totalPaginas: 0 },
};

const DETALLE: OrganizacionGestorResponseDto = {
  usuarioId: '7',
  nombre: 'Luis',
  apellido: 'Álvarez',
  correo: 'luis.alvarez@agrovalle.org',
  telefono: '3105551234',
  nombreOrganizacion: 'Fundación Agroecológica del Valle',
  nit: '900123456-1',
  representante: 'Luis Álvarez',
  tipoFeria: 'Feria agroecológica',
  contacto: '3105551234',
  estado: 'pendiente_validacion',
  validadoPor: null,
  validadoEn: null,
  creadoEn: new Date('2026-09-15T14:30:00.000Z'),
};

describe('GestorOrganizacionesController', () => {
  it('está restringido al rol gestor a nivel de clase', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      GestorOrganizacionesController,
    );
    expect(roles).toEqual(['gestor']);
  });

  it('restringe el cambio de estado al perfil administrador', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      GestorOrganizacionesController.prototype,
      'cambiarEstado',
    );
    const perfiles = Reflect.getMetadata(PERFIL_GESTOR_KEY, descriptor?.value);
    expect(perfiles).toEqual(['administrador']);
  });

  it('delega el listado y el detalle', async () => {
    const listar = jest.fn().mockResolvedValue(LISTADO);
    const detalle = jest.fn().mockResolvedValue(DETALLE);
    const controller = new GestorOrganizacionesController({
      listar,
      detalle,
    } as unknown as OrganizadoresService);

    await controller.listar({ estado: 'pendiente_validacion' });
    await controller.detalle('7');

    expect(listar).toHaveBeenCalledWith({ estado: 'pendiente_validacion' });
    expect(detalle).toHaveBeenCalledWith(7n);
  });

  it('delega el cambio de estado con el gestor autenticado', async () => {
    const cambiarEstado = jest.fn().mockResolvedValue(DETALLE);
    const controller = new GestorOrganizacionesController({
      cambiarEstado,
    } as unknown as OrganizadoresService);
    const dto: CambiarEstadoOrganizacionDto = { estado: 'activa' };

    const respuesta = await controller.cambiarEstado('7', dto, GESTOR);

    expect(cambiarEstado).toHaveBeenCalledWith(7n, dto, 1n);
    expect(respuesta).toBe(DETALLE);
  });
});
