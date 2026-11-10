import {
  detectarDelimitador,
  leerCsvModulos,
  MAX_FILAS_IMPORTACION,
  normalizarEncabezado,
} from './csv';
import { ErrorFormatoImportacion } from './errores';

function csv(texto: string): Buffer {
  return Buffer.from(texto, 'utf8');
}

describe('Importador CSV de módulos', () => {
  it('normaliza encabezados con tildes, mayúsculas y espacios', () => {
    expect(normalizarEncabezado(' Categoría ')).toBe('categoria');
    expect(normalizarEncabezado('Titular Documento')).toBe('titular_documento');
  });

  it('detecta coma y punto y coma', () => {
    expect(detectarDelimitador('a,b,c')).toBe(',');
    expect(detectarDelimitador('a;b;c')).toBe(';');
  });

  it('lee un CSV con BOM, comillas y saltos internos', () => {
    const contenido = csv(
      '\uFEFFcategoria,actividad,latitud,longitud,titular_nombre\r\n' +
        'informal,"Venta de empanadas, arepas",4.0885,-76.1955,"Nelson ""Mina"""\r\n' +
        'formal,"Texto\nen dos líneas",4.09,-76.19,Ana\r\n',
    );

    const leido = leerCsvModulos(contenido);

    expect(leido.delimitador).toBe(',');
    expect(leido.filas).toHaveLength(2);
    expect(leido.filas[0]).toMatchObject({
      fila: 2,
      valores: {
        categoria: 'informal',
        actividad: 'Venta de empanadas, arepas',
        titular_nombre: 'Nelson "Mina"',
      },
    });
    expect(leido.filas[1]?.valores.actividad).toContain('\n');
  });

  it('lee punto y coma y conserva la coma decimal', () => {
    const leido = leerCsvModulos(
      csv(
        'categoria;actividad;latitud;longitud;titular_nombre\n' +
          'formal;Artesanías;4,0885;-76,1955;Ana\n',
      ),
    );

    expect(leido.delimitador).toBe(';');
    expect(leido.filas[0]?.valores.latitud).toBe('4,0885');
  });

  it('ignora filas vacías e informa columnas extra', () => {
    const leido = leerCsvModulos(
      csv(
        'categoria,actividad,latitud,longitud,titular_nombre,observacion\n' +
          '\n' +
          'informal,Empanadas,4.08,-76.19,Nelson,sin novedad\n',
      ),
    );

    expect(leido.filas).toHaveLength(1);
    expect(leido.columnasExtra).toEqual(['observacion']);
  });

  it('rechaza encabezados faltantes', () => {
    expect(() =>
      leerCsvModulos(csv('categoria,actividad,titular_nombre\ninformal,Empanadas,Nelson\n')),
    ).toThrow(ErrorFormatoImportacion);
  });

  it('rechaza encabezados duplicados', () => {
    expect(() =>
      leerCsvModulos(
        csv(
          'categoria,categoria,actividad,latitud,longitud,titular_nombre\n' +
            'informal,informal,Empanadas,4.08,-76.19,Nelson\n',
        ),
      ),
    ).toThrow(/repite la columna/i);
  });

  it('rechaza comillas sin cerrar', () => {
    expect(() =>
      leerCsvModulos(
        csv(
          'categoria,actividad,latitud,longitud,titular_nombre\n' +
            'informal,"Empanadas,4.08,-76.19,Nelson\n',
        ),
      ),
    ).toThrow(/comillas/i);
  });

  it('rechaza archivos sin delimitador y sin filas', () => {
    expect(() => leerCsvModulos(csv('categoria\ninformal\n'))).toThrow(
      /delimitador/i,
    );
    expect(() =>
      leerCsvModulos(
        csv('categoria,actividad,latitud,longitud,titular_nombre\n'),
      ),
    ).toThrow(/no contiene filas/i);
  });

  it('rechaza más de 5000 filas', () => {
    const filas = Array.from(
      { length: MAX_FILAS_IMPORTACION + 1 },
      () => 'informal,Empanadas,4.08,-76.19,Nelson',
    ).join('\n');

    expect(() =>
      leerCsvModulos(
        csv(
          `categoria,actividad,latitud,longitud,titular_nombre\n${filas}\n`,
        ),
      ),
    ).toThrow(/5000 filas/i);
  });

  it('rechaza contenido que no sea UTF-8', () => {
    const latin1 = Buffer.from([
      0x63, 0x61, 0x74, 0x65, 0x67, 0x6f, 0x72, 0x69, 0x61, 0x2c, 0xff,
    ]);

    expect(() => leerCsvModulos(latin1)).toThrow(/UTF-8/i);
  });
});
