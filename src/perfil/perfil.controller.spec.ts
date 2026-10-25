import 'reflect-metadata';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import type { PerfilResponseDto } from './dto/ver-perfil.dto';
import { PerfilController } from './perfil.controller';
import type { PerfilService } from './perfil.service';

/** Comerciante activo, como lo deja `JwtAuthGuard` en request.usuario. */
const COMERCIANTE: UsuarioAutenticado = {
  id: '5',
  nombre: 'José',
  apellido: 'Pérez',
  correo: 'jose.perez@hotmail.com',
  rol: 'comerciante',
  perfil: null,
  estado: 'activa',
};

const ORGANIZADOR: UsuarioAutenticado = {
  id: '7',
  nombre: 'Luis',
  apellido: 'Álvarez',
  correo: 'luis.alvarez@agrovalle.org',
  rol: 'organizador',
  perfil: null,
  estado: 'activa',
};

const PERFIL_ORGANIZADOR: PerfilResponseDto = {
  datosPersonales: {
    id: '7',
    nombre: 'Luis',
    apellido: 'Álvarez',
    tipoDocumento: 'CC',
    documento: '801234567',
    telefono: '3105551234',
  },
  organizacion: {
    nombreOrganizacion: 'Fundación Agroecológica del Valle',
    nit: '900123456-1',
    representante: 'Luis Álvarez',
    tipoFeria: 'Feria agroecológica',
    contacto: '3105551234',
    estado: 'pendiente_validacion',
    validadoEn: null,
  },
  seguridad: {
    correo: 'luis.alvarez@agrovalle.org',
    estado: 'activa',
    creadoEn: new Date('2026-09-15T14:30:00.000Z'),
  },
};

const PERFIL: PerfilResponseDto = {
  datosPersonales: {
    id: '5',
    nombre: 'José',
    apellido: 'Pérez',
    tipoDocumento: 'CC',
    documento: '1029384756',
    telefono: '3001122334',
  },
  actividadComercial: {
    actividadComercial: 'Venta de frutas y verduras',
    categoria: 'formal',
  },
  seguridad: {
    correo: 'jose.perez@hotmail.com',
    estado: 'activa',
    creadoEn: new Date('2026-09-15T14:30:00.000Z'),
  },
};

/** Service simulado: cada método se programa por caso. */
interface PerfilServiceMock {
  ver: jest.Mock;
  actualizar: jest.Mock;
  cambiarPassword: jest.Mock;
}

function crearServiceMock(): PerfilServiceMock {
  return {
    ver: jest.fn().mockResolvedValue(PERFIL),
    actualizar: jest.fn().mockResolvedValue(PERFIL),
    cambiarPassword: jest
      .fn()
      .mockResolvedValue({ mensaje: 'Contraseña actualizada' }),
  };
}

describe('PerfilController', () => {
  it('permite comerciantes y organizadores a nivel de clase', () => {
    // RolesGuard (global) lee estos metadatos: gestor → 403.
    const roles = Reflect.getMetadata(ROLES_KEY, PerfilController);
    expect(roles).toEqual(['comerciante', 'organizador']);
  });

  it('GET /perfil devuelve el perfil del comerciante autenticado', async () => {
    const service = crearServiceMock();
    const controller = new PerfilController(
      service as unknown as PerfilService,
    );

    const respuesta = await controller.ver(COMERCIANTE);

    expect(service.ver).toHaveBeenCalledWith('5');
    expect(respuesta).toBe(PERFIL);
  });

  it('GET /perfil devuelve la organización del organizador autenticado', async () => {
    const service = crearServiceMock();
    service.ver.mockResolvedValue(PERFIL_ORGANIZADOR);
    const controller = new PerfilController(
      service as unknown as PerfilService,
    );

    const respuesta = await controller.ver(ORGANIZADOR);

    expect(service.ver).toHaveBeenCalledWith('7');
    expect(respuesta.organizacion?.nombreOrganizacion).toBe(
      'Fundación Agroecológica del Valle',
    );
  });

  it('PATCH /perfil delega la actualización con el id del comerciante', async () => {
    const service = crearServiceMock();
    const controller = new PerfilController(
      service as unknown as PerfilService,
    );
    const dto: ActualizarPerfilDto = { telefono: '3115550000' };

    await controller.actualizar(COMERCIANTE, dto);

    expect(service.actualizar).toHaveBeenCalledWith('5', dto);
  });

  it('PATCH /perfil/password delega el cambio con el id del comerciante', async () => {
    const service = crearServiceMock();
    const controller = new PerfilController(
      service as unknown as PerfilService,
    );
    const dto: CambiarPasswordDto = {
      passwordActual: 'Comerciante123',
      passwordNueva: 'NuevaClave456',
      confirmarPassword: 'NuevaClave456',
    };

    await controller.cambiarPassword(COMERCIANTE, dto);

    expect(service.cambiarPassword).toHaveBeenCalledWith('5', dto);
  });
});
