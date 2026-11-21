import 'reflect-metadata';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Response } from 'express';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';

const COMERCIANTE: UsuarioAutenticado = {
  id: '3',
  nombre: 'María',
  apellido: 'Gómez',
  correo: 'maria.gomez@gmail.com',
  rol: 'comerciante',
  perfil: null,
  estado: 'activa',
};

type MetodoSolicitudes =
  | 'listarMias'
  | 'requisitos'
  | 'disponibilidad'
  | 'radicar'
  | 'cargarDocumento'
  | 'listarRequisitosSolicitud'
  | 'descargarDocumento'
  | 'detalle';

function rolesDe(metodo: MetodoSolicitudes): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(
    SolicitudesController.prototype,
    metodo,
  );
  return Reflect.getMetadata(ROLES_KEY, descriptor?.value);
}

interface ServiceMock {
  listarMias: jest.Mock;
  requisitos: jest.Mock;
  consultarDisponibilidad: jest.Mock;
  radicar: jest.Mock;
  cargarDocumentoSolicitud: jest.Mock;
  listarRequisitosSolicitud: jest.Mock;
  descargarDocumento: jest.Mock;
  detalle: jest.Mock;
}

function crearMock(): { service: SolicitudesService; mock: ServiceMock } {
  const mock: ServiceMock = {
    listarMias: jest.fn(),
    requisitos: jest.fn(),
    consultarDisponibilidad: jest.fn(),
    radicar: jest.fn(),
    cargarDocumentoSolicitud: jest.fn(),
    listarRequisitosSolicitud: jest.fn(),
    descargarDocumento: jest.fn(),
    detalle: jest.fn(),
  };
  return { service: mock as unknown as SolicitudesService, mock };
}

describe('SolicitudesController', () => {
  it('restringe la consulta y la radicación al comerciante', () => {
    for (const metodo of [
      'listarMias',
      'requisitos',
      'disponibilidad',
      'radicar',
      'cargarDocumento',
      'listarRequisitosSolicitud',
      'detalle',
    ] as const) {
      expect(rolesDe(metodo)).toEqual(['comerciante']);
    }
  });

  it('permite la descarga al dueño y a los gestores', () => {
    expect(rolesDe('descargarDocumento')).toEqual(['comerciante', 'gestor']);
  });

  it('delega el listado con el usuario y los filtros', async () => {
    const { service, mock } = crearMock();
    const controller = new SolicitudesController(service);
    const dto = { pagina: 1, limite: 10 };

    mock.listarMias.mockResolvedValue({
      datos: [],
      paginacion: { pagina: 1, limite: 10, total: 0, totalPaginas: 0 },
    });

    await controller.listarMias(COMERCIANTE, dto);

    expect(mock.listarMias).toHaveBeenCalledWith('3', dto);
  });

  it('delega los requisitos y la disponibilidad', async () => {
    const { service, mock } = crearMock();
    const controller = new SolicitudesController(service);
    const query = { actividad: 'Artesanías' };
    const disponibilidad = {
      espacioId: '1',
      fechaInicio: '2026-12-01',
      fechaFin: '2026-12-10',
      horaInicio: '08:00',
      horaFin: '12:00',
    };

    mock.requisitos.mockResolvedValue({ actividad: 'Artesanías', requisitos: [] });
    mock.consultarDisponibilidad.mockResolvedValue({
      disponible: true,
      motivo: null,
      espacio: { id: '1', nombre: 'Espacio' },
    });

    await controller.requisitos(query);
    await controller.disponibilidad(COMERCIANTE, disponibilidad);

    expect(mock.requisitos).toHaveBeenCalledWith(query);
    expect(mock.consultarDisponibilidad).toHaveBeenCalledWith('3', disponibilidad);
  });

  it('delega la radicación con usuario, formulario y archivos', async () => {
    const { service, mock } = crearMock();
    const controller = new SolicitudesController(service);
    const form = { datos: '{}' };
    const archivos = [] as Express.Multer.File[];

    mock.radicar.mockResolvedValue({
      id: '12',
      numeroRadicado: 'SOL-2026-00012',
      estado: 'radicada',
      mensaje: 'ok',
      correoEnviado: true,
      mensajeCorreo: null,
    });

    await controller.radicar(COMERCIANTE, form, archivos);

    expect(mock.radicar).toHaveBeenCalledWith(COMERCIANTE, form, archivos);
  });

  it('delega la carga y la consulta de requisitos documentales', async () => {
    const { service, mock } = crearMock();
    const controller = new SolicitudesController(service);
    const form = { requisitoId: '1' };
    const archivo = { originalname: 'cedula.pdf' } as Express.Multer.File;
    const respuesta = {
      mensaje: 'ok',
      estadoSolicitud: 'radicada',
      volvioARevision: false,
      requisito: {},
      faltantes: [],
    };

    mock.cargarDocumentoSolicitud.mockResolvedValue(respuesta);
    mock.listarRequisitosSolicitud.mockResolvedValue({
      solicitudId: '12',
      numeroRadicado: 'SOL-2026-00012',
      estado: 'radicada',
      actividad: 'Artesanías',
      puedeCargar: true,
      motivoBloqueo: null,
      faltantes: [],
      requisitos: [],
      otrosDocumentos: [],
    });

    await controller.cargarDocumento(COMERCIANTE, '12', form, archivo);
    await controller.listarRequisitosSolicitud(COMERCIANTE, '12');

    expect(mock.cargarDocumentoSolicitud).toHaveBeenCalledWith(
      COMERCIANTE,
      '12',
      form,
      archivo,
    );
    expect(mock.listarRequisitosSolicitud).toHaveBeenCalledWith('3', '12');
  });

  it('delega el detalle al servicio', async () => {
    const { service, mock } = crearMock();
    const controller = new SolicitudesController(service);

    mock.detalle.mockResolvedValue({ id: '12' });
    await controller.detalle(COMERCIANTE, '12');

    expect(mock.detalle).toHaveBeenCalledWith('3', '12');
  });

  it('entrega el archivo con los encabezados de descarga', async () => {
    const { service, mock } = crearMock();
    const controller = new SolicitudesController(service);
    const directorio = await mkdtemp(join(tmpdir(), 'sgp-doc-'));
    const ruta = join(directorio, 'documento.pdf');
    await writeFile(ruta, '%PDF-1.4 prueba');

    const setHeader = jest.fn();
    const response = { setHeader } as unknown as Response;

    mock.descargarDocumento.mockResolvedValue({
      ruta,
      nombreOriginal: 'cedula.pdf',
      mimeType: 'application/pdf',
    });

    const archivo = await controller.descargarDocumento(
      COMERCIANTE,
      '12',
      '2',
      response,
    );

    expect(archivo).toBeDefined();
    expect(setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      `attachment; filename="cedula.pdf"; filename*=UTF-8''cedula.pdf`,
    );

    await rm(directorio, { recursive: true, force: true });
  });
});
