import { celdaCsv, generarReporteCsv } from './reporte';

describe('Reporte CSV de importación', () => {
  it('escapa comillas, comas y saltos de línea', () => {
    expect(celdaCsv('texto, con coma')).toBe('"texto, con coma"');
    expect(celdaCsv('dice "hola"')).toBe('"dice ""hola"""');
    expect(celdaCsv('dos\nlíneas')).toBe('"dos\nlíneas"');
  });

  it('evita que una celda se interprete como fórmula', () => {
    expect(celdaCsv('=1+1')).toBe("'=1+1");
    expect(celdaCsv('+SUMA(A1)')).toBe("'+SUMA(A1)");
    expect(celdaCsv('-2+3')).toBe("'-2+3");
    expect(celdaCsv('@comando')).toBe("'@comando");
  });

  it('genera el reporte de zonas con BOM, resumen y rechazadas', () => {
    const contenido = generarReporteCsv({
      tipo: 'zonas',
      archivo: 'zonas.geojson',
      fecha: new Date('2026-11-09T15:30:00.000Z'),
      total: 3,
      importados: 2,
      rechazados: 1,
      filas: [
        {
          fila: 2,
          motivo: 'La geometría no es válida',
          datos: { nombre: 'Zona "nueva"', tipo: 'permitida' },
        },
      ],
    });

    expect(contenido.charCodeAt(0)).toBe(0xfeff);
    expect(contenido).toContain('Reporte de importación de zonas');
    expect(contenido).toContain('Importados: 2');
    expect(contenido).toContain('fila,nombre,tipo,motivo');
    expect(contenido).toContain('2,"Zona ""nueva""",permitida,');
  });

  it('genera el reporte de módulos con sus columnas', () => {
    const contenido = generarReporteCsv({
      tipo: 'modulos',
      archivo: 'modulos.csv',
      fecha: new Date('2026-11-09T15:30:00.000Z'),
      total: 1,
      importados: 0,
      rechazados: 1,
      filas: [
        {
          fila: 4,
          motivo: 'La latitud debe ser un número entre -90 y 90.',
          datos: {
            categoria: 'informal',
            actividad: 'Empanadas',
            latitud: null,
            longitud: -76.19,
            titular_documento: null,
            titular_nombre: 'Nelson',
          },
        },
      ],
    });

    expect(contenido).toContain(
      'fila,categoria,actividad,latitud,longitud,titular_documento,titular_nombre,motivo',
    );
    expect(contenido).toContain(
      '4,informal,Empanadas,,-76.19,,Nelson,La latitud debe ser un número entre -90 y 90.',
    );
  });
});
