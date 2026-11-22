import 'reflect-metadata';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { GestorSolicitudesController } from './gestor-solicitudes.controller';
import type { RevisionSolicitudesService } from './revision-solicitudes.service';
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

function crearControlador() {
  const cambiarEstado = jest.fn().mockResolvedValue({ id: '12' });
  const revision = {
    listar: jest.fn().mockResolvedValue({ datos: [] }),
    opciones: jest.fn().mockResolvedValue({ sectores: [], actividades: [] }),
    detalle: jest.fn().mockResolvedValue({ id: '12' }),
    tomarRevision: jest.fn().mockResolvedValue({ estado: 'en_revision' }),
    renovarRevision: jest.fn().mockResolvedValue({ expiraEn: new Date() }),
    liberarRevision: jest.fn().mockResolvedValue({ liberado: true }),
    verificarRequisito: jest.fn().mockResolvedValue({ mensaje: 'ok' }),
  };
  const controller = new GestorSolicitudesController(
    { cambiarEstado } as unknown as SolicitudesService,
    revision as unknown as RevisionSolicitudesService,
  );
  return { controller, revision, cambiarEstado };
}

describe('GestorSolicitudesController', () => {
  it('restringe el controlador al rol gestor', () => {
    expect(Reflect.getMetadata(ROLES_KEY, GestorSolicitudesController)).toEqual(
      ['gestor'],
    );
  });

  it('delega el cambio de estado con el usuario, el id y el DTO', async () => {
    const { controller, cambiarEstado } = crearControlador();
    const dto = { estado: 'en_revision' as const };

    await controller.cambiarEstado(GESTOR, '12', dto);

    expect(cambiarEstado).toHaveBeenCalledWith(GESTOR, '12', dto);
  });

  it('delega la bandeja con filtros', async () => {
    const { controller, revision } = crearControlador();
    const dto = { estado: 'radicada' as const };

    await controller.listar(GESTOR, dto);

    expect(revision.listar).toHaveBeenCalledWith(GESTOR, dto);
  });

  it('delega las opciones de filtros', async () => {
    const { controller, revision } = crearControlador();

    await controller.opciones();

    expect(revision.opciones).toHaveBeenCalled();
  });

  it('delega el detalle', async () => {
    const { controller, revision } = crearControlador();

    await controller.detalle(GESTOR, '12');

    expect(revision.detalle).toHaveBeenCalledWith(GESTOR, '12');
  });

  it('delega la toma, renovación y liberación del bloqueo', async () => {
    const { controller, revision } = crearControlador();

    await controller.tomarRevision(GESTOR, '12');
    await controller.renovarRevision(GESTOR, '12');
    await controller.liberarRevision(GESTOR, '12');

    expect(revision.tomarRevision).toHaveBeenCalledWith(GESTOR, '12');
    expect(revision.renovarRevision).toHaveBeenCalledWith(GESTOR, '12');
    expect(revision.liberarRevision).toHaveBeenCalledWith(
      GESTOR,
      '12',
      undefined,
    );
  });

  it('delega la verificación de un requisito', async () => {
    const { controller, revision } = crearControlador();
    const dto = { estado: 'cumple' as const };

    await controller.verificarRequisito(GESTOR, '12', '1', dto);

    expect(revision.verificarRequisito).toHaveBeenCalledWith(
      GESTOR,
      '12',
      '1',
      dto,
    );
  });
});
