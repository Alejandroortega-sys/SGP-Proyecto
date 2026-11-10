import {
  ConflictException,
  ForbiddenException,
  GoneException,
} from '@nestjs/common';
import type { ZonasService } from '../zonas/zonas.service';
import type { ModulosService } from '../modulos/modulos.service';
import type { PrismaService } from '../prisma/prisma.service';
import { AlmacenPrevisualizaciones } from './almacen-previsualizaciones';
import {
  ImportacionesService,
  type ArchivoImportacion,
} from './importaciones.service';

const POLIGONO = {
  type: 'Polygon',
  coordinates: [
    [
      [-76.2, 4.08],
      [-76.19, 4.08],
      [-76.19, 4.09],
      [-76.2, 4.09],
      [-76.2, 4.08],
    ],
  ],
};

function archivo(nombre: string, contenido: string): ArchivoImportacion {
  const buffer = Buffer.from(contenido, 'utf8');
  return {
    buffer,
    originalname: nombre,
    mimetype: nombre.endsWith('.csv') ? 'text/csv' : 'application/json',
    size: buffer.length,
  };
}

function geojson(features: Array<Record<string, unknown>>): string {
  return JSON.stringify({ type: 'FeatureCollection', features });
}

function feature(
  propiedades: Record<string, unknown>,
  geometria: unknown = POLIGONO,
): Record<string, unknown> {
  return { type: 'Feature', properties: propiedades, geometry: geometria };
}

function sqlDe(args: unknown[]): string {
  const strings = args[0];
  return Array.isArray(strings) ? strings.join('?') : '';
}

describe('ImportacionesService', () => {
  let prisma: {
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let zonas: { crear: jest.Mock };
  let modulos: { crear: jest.Mock };
  let almacen: AlmacenPrevisualizaciones;
  let servicio: ImportacionesService;
  let tx: { $executeRaw: jest.Mock; $queryRaw: jest.Mock };

  beforeEach(() => {
    tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    prisma = {
      $queryRaw: jest.fn(),
      $transaction: jest
        .fn()
        .mockImplementation((callback: (cliente: typeof tx) => unknown) =>
          callback(tx),
        ),
    };
    zonas = { crear: jest.fn() };
    modulos = { crear: jest.fn() };
    almacen = new AlmacenPrevisualizaciones();
    servicio = new ImportacionesService(
      prisma as unknown as PrismaService,
      zonas as unknown as ZonasService,
      modulos as unknown as ModulosService,
      almacen,
    );
  });

  function configurarZonasValidas(): void {
    prisma.$queryRaw.mockImplementation((...args: unknown[]) => {
      const sql = sqlDe(args);
      if (sql.includes('spatial_ref_sys')) {
        return Promise.resolve([{ srid: 4326 }]);
      }
      if (sql.includes('WITH entradas') && sql.includes('ST_IsValid')) {
        return Promise.resolve([
          { fila: 1, geometria: POLIGONO, valida: true, motivo: null },
        ]);
      }
      if (sql.includes('FROM productos')) {
        return Promise.resolve([
          { id: '1', nombre: 'Frutas frescas', activo: true },
        ]);
      }
      if (sql.includes('FROM zonas WHERE nombre')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });
  }

  it('previsualiza un GeoJSON válido y confirma solo una vez', async () => {
    configurarZonasValidas();
    zonas.crear.mockResolvedValue({ id: '10', nombre: 'Zona importada' });

    const preview = await servicio.previsualizarZonas(
      '1',
      archivo(
        'zonas.geojson',
        geojson([
          feature({
            nombre: 'Zona importada',
            tipo: 'permitida',
            productosPermitidos: 'Frutas frescas',
          }),
        ]),
      ),
    );

    expect(preview.resumen).toMatchObject({
      total: 1,
      validas: 1,
      rechazadas: 0,
    });
    expect(preview.sridOrigen).toBe(4326);
    expect(preview.filas[0]).toMatchObject({ estado: 'valida' });
    expect(preview.filas[0]?.geometria).toEqual(POLIGONO);

    const confirmacion = await servicio.confirmarZonas('1', preview.token);
    expect(confirmacion.resumen).toMatchObject({
      total: 1,
      importados: 1,
      rechazados: 0,
    });
    expect(confirmacion.importados[0]).toMatchObject({
      fila: 1,
      id: '10',
      nombre: 'Zona importada',
    });
    expect(confirmacion.reporte.disponible).toBe(false);

    const segunda = await servicio.confirmarZonas('1', preview.token);
    expect(segunda.importados).toHaveLength(1);
    expect(zonas.crear).toHaveBeenCalledTimes(1);
  });

  it('importa parcialmente cuando una feature es inválida y genera reporte', async () => {
    configurarZonasValidas();
    zonas.crear.mockResolvedValue({ id: '11', nombre: 'Zona válida' });

    const preview = await servicio.previsualizarZonas(
      '1',
      archivo(
        'zonas.geojson',
        geojson([
          feature({ nombre: 'Zona válida', tipo: 'permitida' }),
          feature({ nombre: '', tipo: 'permitida' }),
        ]),
      ),
    );

    expect(preview.resumen).toMatchObject({
      total: 2,
      validas: 1,
      rechazadas: 1,
    });
    expect(preview.filas[1]?.errores[0]).toMatch(/nombre/i);

    const confirmacion = await servicio.confirmarZonas('1', preview.token);
    expect(confirmacion.resumen).toMatchObject({
      importados: 1,
      rechazados: 1,
    });

    const reporte = await servicio.reporte('1', preview.token);
    expect(reporte.contenido).toContain('Reporte de importación de zonas');
    expect(reporte.contenido).toContain('Rechazados: 1');
    expect(reporte.contenido).toContain('nombre');
  });

  it('rechaza la confirmación de otro gestor y el token eliminado', async () => {
    configurarZonasValidas();

    const preview = await servicio.previsualizarZonas(
      '1',
      archivo(
        'zonas.geojson',
        geojson([feature({ nombre: 'Zona importada', tipo: 'permitida' })]),
      ),
    );

    await expect(
      servicio.confirmarZonas('2', preview.token),
    ).rejects.toBeInstanceOf(ForbiddenException);

    almacen.eliminar(preview.token);
    await expect(
      servicio.confirmarZonas('1', preview.token),
    ).rejects.toBeInstanceOf(GoneException);
  });

  it('no permite descargar el reporte antes de confirmar', async () => {
    configurarZonasValidas();

    const preview = await servicio.previsualizarZonas(
      '1',
      archivo(
        'zonas.geojson',
        geojson([feature({ nombre: 'Zona importada', tipo: 'permitida' })]),
      ),
    );

    await expect(servicio.reporte('1', preview.token)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  function configurarCsv(): void {
    prisma.$queryRaw.mockImplementation((...args: unknown[]) => {
      const sql = sqlDe(args);
      if (sql.includes('FROM usuarios u')) {
        return Promise.resolve([{ documento: '123', id: '4' }]);
      }
      if (sql.includes('WITH puntos')) {
        return Promise.resolve([
          {
            fila: 2,
            zona_id: '1',
            zona_nombre: 'Centro',
            zona_tipo: 'permitida',
            zona_horario_inicio: '06:00',
            zona_horario_fin: '18:00',
            zona_aforo_maximo: 40,
            zona_productos: ['Frutas frescas'],
          },
          {
            fila: 4,
            zona_id: '3',
            zona_nombre: 'Entorno Hospital',
            zona_tipo: 'restringida',
            zona_horario_inicio: '06:00',
            zona_horario_fin: '18:00',
            zona_aforo_maximo: 5,
            zona_productos: ['Frutas frescas'],
          },
        ]);
      }
      return Promise.resolve([]);
    });
  }

  const CSV =
    'categoria,actividad,latitud,longitud,titular_documento,titular_nombre\n' +
    'informal,Empanadas válidas,4.08,-76.19,123,\n' +
    'otra,Empanadas inválidas,4.08,-76.19,,\n' +
    'formal,Empanadas restringidas,4.09,-76.19,,Nelson\n';

  it('previsualiza un CSV parcial y respeta la zona restringida', async () => {
    configurarCsv();
    modulos.crear.mockImplementation(
      (_actor: string, dto: { actividad: string; aceptaAdvertencia?: boolean }) =>
        Promise.resolve({
          id: dto.actividad === 'Empanadas válidas' ? '20' : '21',
          codigo: dto.actividad === 'Empanadas válidas' ? 'MOD-0020' : 'MOD-0021',
          actividad: dto.actividad,
        }),
    );

    const preview = await servicio.previsualizarModulos(
      '1',
      archivo('modulos.csv', CSV),
    );

    expect(preview.resumen).toMatchObject({
      total: 3,
      validas: 2,
      rechazadas: 1,
      advertencias: 1,
    });
    expect(preview.filas[0]?.datos.titularId).toBe('4');
    expect(preview.filas[2]?.requiereConfirmacion).toBe(true);

    const sinConfirmar = await servicio.confirmarModulos(
      '1',
      preview.token,
      false,
    );
    expect(sinConfirmar.resumen).toMatchObject({
      importados: 1,
      rechazados: 2,
    });
    expect(modulos.crear).toHaveBeenCalledTimes(1);
  });

  it('importa las filas restringidas cuando se confirma la advertencia', async () => {
    configurarCsv();
    modulos.crear.mockResolvedValue({
      id: '20',
      codigo: 'MOD-0020',
      actividad: 'Empanadas',
    });

    const preview = await servicio.previsualizarModulos(
      '1',
      archivo('modulos.csv', CSV),
    );

    const confirmacion = await servicio.confirmarModulos(
      '1',
      preview.token,
      true,
    );

    expect(confirmacion.resumen).toMatchObject({
      total: 3,
      importados: 2,
      rechazados: 1,
      conAdvertencia: 1,
    });
    expect(modulos.crear).toHaveBeenCalledTimes(2);
    expect(modulos.crear).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ aceptaAdvertencia: true }),
    );
  });

  it('rechaza un CSV con formato incorrecto antes de crear el token', async () => {
    await expect(
      servicio.previsualizarModulos(
        '1',
        archivo('modulos.csv', 'sin delimitador\nvalor\n'),
      ),
    ).rejects.toThrow(/delimitador/i);
  });

  it('valida la extensión y el tamaño del archivo', async () => {
    await expect(
      servicio.previsualizarModulos(
        '1',
        archivo('modulos.txt', 'categoria,actividad\n'),
      ),
    ).rejects.toThrow(/\.csv/i);

    const grande = archivo('modulos.csv', 'x');
    grande.size = 11 * 1024 * 1024;
    await expect(
      servicio.previsualizarModulos('1', grande),
    ).rejects.toThrow(/10 MB/i);
  });
});
