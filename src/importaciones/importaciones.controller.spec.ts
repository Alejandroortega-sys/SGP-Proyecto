import 'reflect-metadata';
import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { PERFIL_GESTOR_KEY } from '../auth/decorators/perfil-gestor.decorator';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { ImportacionesController } from './importaciones.controller';
import { ImportacionesService } from './importaciones.service';

const ADMIN: UsuarioAutenticado = {
  id: '1',
  nombre: 'Laura',
  apellido: 'Martínez',
  correo: 'admin@tulua.gov.co',
  rol: 'gestor',
  perfil: 'administrador',
  estado: 'activa',
};

const REVISOR: UsuarioAutenticado = {
  id: '2',
  nombre: 'Ana',
  apellido: 'López',
  correo: 'revisor@tulua.gov.co',
  rol: 'gestor',
  perfil: 'revisor',
  estado: 'activa',
};

type MetodoImportaciones =
  | 'srids'
  | 'previsualizarZonas'
  | 'confirmarZonas'
  | 'previsualizarModulos'
  | 'confirmarModulos'
  | 'descargarReporte';

function metadatos(clave: string, metodo: MetodoImportaciones): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(
    ImportacionesController.prototype,
    metodo,
  );
  return Reflect.getMetadata(clave, descriptor?.value);
}

interface ServiceMock {
  srids: jest.Mock;
  previsualizarZonas: jest.Mock;
  confirmarZonas: jest.Mock;
  previsualizarModulos: jest.Mock;
  confirmarModulos: jest.Mock;
  reporte: jest.Mock;
}

function crearServicio(): { servicio: ImportacionesService; mock: ServiceMock } {
  const mock: ServiceMock = {
    srids: jest.fn(),
    previsualizarZonas: jest.fn(),
    confirmarZonas: jest.fn(),
    previsualizarModulos: jest.fn(),
    confirmarModulos: jest.fn(),
    reporte: jest.fn(),
  };
  return {
    servicio: mock as unknown as ImportacionesService,
    mock,
  };
}

function archivoMulter(): Express.Multer.File {
  const buffer = Buffer.from('{}', 'utf8');
  return {
    fieldname: 'archivo',
    originalname: 'zonas.geojson',
    encoding: '7bit',
    mimetype: 'application/geo+json',
    size: buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as never,
  };
}

describe('ImportacionesController', () => {
  it('restringe todo el controlador al rol gestor', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ImportacionesController)).toEqual([
      'gestor',
    ]);
  });

  it('restringe las zonas al administrador y deja los módulos a ambos perfiles', () => {
    for (const metodo of [
      'previsualizarZonas',
      'confirmarZonas',
    ] as const) {
      expect(metadatos(PERFIL_GESTOR_KEY, metodo)).toEqual(['administrador']);
    }

    for (const metodo of [
      'previsualizarModulos',
      'confirmarModulos',
    ] as const) {
      expect(metadatos(PERFIL_GESTOR_KEY, metodo)).toBeUndefined();
    }
  });

  it('delega la lista de SRID y la previsualización de zonas', async () => {
    const { servicio, mock } = crearServicio();
    const controller = new ImportacionesController(servicio);
    const respuesta = { token: 'token' };
    mock.srids.mockResolvedValue({ comunes: [], permiteOtro: true });
    mock.previsualizarZonas.mockResolvedValue(respuesta);

    await controller.srids();
    await controller.previsualizarZonas(
      ADMIN,
      { sridOrigen: 3857 },
      archivoMulter(),
    );

    expect(mock.srids).toHaveBeenCalled();
    expect(mock.previsualizarZonas).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({
        buffer: expect.any(Buffer) as Buffer,
        originalname: 'zonas.geojson',
        mimetype: 'application/geo+json',
      }),
      3857,
    );
  });

  it('delega las confirmaciones con el perfil y la aceptación', async () => {
    const { servicio, mock } = crearServicio();
    const controller = new ImportacionesController(servicio);
    mock.confirmarZonas.mockResolvedValue({});
    mock.confirmarModulos.mockResolvedValue({});

    await controller.confirmarZonas(REVISOR, { token: 'token-zonas' });
    await controller.confirmarModulos(REVISOR, {
      token: 'token-modulos',
      aceptaAdvertencia: true,
    });

    expect(mock.confirmarZonas).toHaveBeenCalledWith('2', 'token-zonas');
    expect(mock.confirmarModulos).toHaveBeenCalledWith(
      '2',
      'token-modulos',
      true,
    );
  });

  it('delega la previsualización de módulos', async () => {
    const { servicio, mock } = crearServicio();
    const controller = new ImportacionesController(servicio);
    mock.previsualizarModulos.mockResolvedValue({});

    await controller.previsualizarModulos(REVISOR, archivoMulter());

    expect(mock.previsualizarModulos).toHaveBeenCalledWith(
      '2',
      expect.objectContaining({ originalname: 'zonas.geojson' }),
    );
  });

  it('devuelve el reporte como archivo CSV descargable', async () => {
    const { servicio, mock } = crearServicio();
    const controller = new ImportacionesController(servicio);
    const setHeader = jest.fn();
    const respuesta = { setHeader } as unknown as Response;
    mock.reporte.mockResolvedValue({
      contenido: 'contenido',
      nombreArchivo: 'reporte.csv',
    });

    const archivo = await controller.descargarReporte(
      ADMIN,
      'token',
      respuesta,
    );

    expect(mock.reporte).toHaveBeenCalledWith('1', 'token');
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/csv; charset=utf-8',
    );
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="reporte.csv"',
    );
    expect(archivo).toBeInstanceOf(StreamableFile);

    const partes: Buffer[] = [];
    for await (const parte of archivo.getStream()) {
      partes.push(Buffer.from(parte as Uint8Array));
    }
    expect(Buffer.concat(partes).toString('utf8')).toBe('contenido');
  });
});
