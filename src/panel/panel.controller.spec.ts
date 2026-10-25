import 'reflect-metadata';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { PanelService } from './panel.service';
import type { PanelIndicadoresDto } from './dto/panel-response.dto';
import { PanelController } from './panel.controller';

/** Gestor activo, como lo deja `JwtAuthGuard` en request.usuario. */
const GESTOR: UsuarioAutenticado = {
  id: '1',
  nombre: 'Carlos',
  apellido: 'Ramírez',
  correo: 'admin@tulua.gov.co',
  rol: 'gestor',
  perfil: 'administrador',
  estado: 'activa',
};

const INDICADORES: PanelIndicadoresDto = {
  usuarios: {
    estados: {
      total: 8,
      pendientesActivacion: 1,
      activas: 6,
      suspendidas: 1,
      inactivas: 0,
    },
    roles: { comerciante: 4, organizador: 2, gestor: 2 },
  },
  solicitudes: {
    total: 4,
    porEstado: {
      borrador: 1,
      radicada: 1,
      en_revision: 0,
      devuelta: 0,
      aprobada: 1,
      rechazada: 1,
      cancelada: 0,
    },
  },
  permisos: {
    total: 1,
    porEstado: { vigente: 1, suspendido: 0, revocado: 0, vencido: 0 },
  },
  ferias: {
    total: 2,
    porEstado: {
      radicada: 1,
      aprobada: 1,
      rechazada: 0,
      cancelada: 0,
      realizada: 0,
    },
  },
};

/** Service simulado: devuelve indicadores fijos. */
function crearServiceMock(): PanelService {
  return { resumen: jest.fn().mockResolvedValue(INDICADORES) } as unknown as PanelService;
}

describe('PanelController', () => {
  it('está restringido al rol gestor a nivel de clase', () => {
    // RolesGuard (global) lee estos metadatos: sin token → 401, otro rol → 403.
    const roles = Reflect.getMetadata(ROLES_KEY, PanelController);
    expect(roles).toEqual(['gestor']);
  });

  it('devuelve los datos del gestor autenticado y los indicadores', async () => {
    const controller = new PanelController(crearServiceMock());

    const respuesta = await controller.resumen(GESTOR);

    expect(respuesta.gestor).toEqual({
      id: '1',
      nombre: 'Carlos',
      apellido: 'Ramírez',
      correo: 'admin@tulua.gov.co',
      perfil: 'administrador',
    });
    expect(respuesta.indicadores).toBe(INDICADORES);
  });

  it('omite el apellido cuando el gestor no lo tiene', async () => {
    const controller = new PanelController(crearServiceMock());
    const sinApellido: UsuarioAutenticado = { ...GESTOR, apellido: undefined };

    const respuesta = await controller.resumen(sinApellido);

    expect(respuesta.gestor.apellido).toBeUndefined();
    expect(respuesta.gestor).not.toHaveProperty('apellido', '');
  });

  it('usa el perfil revisor si el gestor no trae perfil', async () => {
    const controller = new PanelController(crearServiceMock());
    const sinPerfil: UsuarioAutenticado = { ...GESTOR, perfil: null };

    const respuesta = await controller.resumen(sinPerfil);

    expect(respuesta.gestor.perfil).toBe('revisor');
  });
});
