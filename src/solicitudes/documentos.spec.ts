import { BadRequestException } from '@nestjs/common';
import { resolve } from 'node:path';
import {
  agruparVersionesDocumento,
  detectarFormatoDocumento,
  estadoRequisitoDocumental,
  mimePorRuta,
  nombreArchivoSeguro,
  puedeCargarDocumentos,
  resolverRutaDocumento,
  validarDocumento,
} from './documentos';

const PDF = Buffer.from('%PDF-1.4\ncontenido de prueba');
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function archivo(buffer: Buffer, mimetype: string, size = buffer.length) {
  return { buffer, mimetype, size, originalname: 'documento' };
}

describe('documentos de solicitud', () => {
  it('detecta el formato real por la firma binaria', () => {
    expect(detectarFormatoDocumento(PDF)).toBe('pdf');
    expect(detectarFormatoDocumento(JPG)).toBe('jpg');
    expect(detectarFormatoDocumento(PNG)).toBe('png');
    expect(detectarFormatoDocumento(Buffer.from('texto'))).toBeNull();
  });

  it('acepta un PDF válido', () => {
    const validado = validarDocumento(archivo(PDF, 'application/pdf'));
    expect(validado).toMatchObject({
      formato: 'pdf',
      extension: '.pdf',
      mimetype: 'application/pdf',
    });
  });

  it('rechaza formatos no permitidos, vacíos o demasiado grandes', () => {
    expect(() => validarDocumento(archivo(PDF, 'text/plain'))).toThrow(
      BadRequestException,
    );
    expect(() =>
      validarDocumento({ buffer: Buffer.alloc(0), mimetype: 'application/pdf', size: 0 }),
    ).toThrow('El documento está vacío');
    expect(() =>
      validarDocumento(archivo(PDF, 'application/pdf', 6 * 1024 * 1024)),
    ).toThrow('no puede superar');
  });

  it('rechaza un MIME que no coincide con el contenido', () => {
    expect(() => validarDocumento(archivo(PDF, 'image/png'))).toThrow(
      'El tipo declarado del documento no coincide',
    );
  });

  it('limpia nombres de archivo peligrosos', () => {
    expect(nombreArchivoSeguro('../../etc/passwd.pdf')).toBe('passwd.pdf');
    expect(nombreArchivoSeguro('mi "documento"\n.pdf')).toBe('mi _documento__.pdf');
  });

  it('resuelve rutas dentro del directorio privado', () => {
    const raiz = resolve('uploads-privados');
    expect(resolverRutaDocumento('solicitudes/1/archivo.pdf', raiz)).toBe(
      resolve(raiz, 'solicitudes/1/archivo.pdf'),
    );
    expect(() => resolverRutaDocumento('../fuera.pdf', raiz)).toThrow(
      BadRequestException,
    );
  });

  it('infiere el MIME por la extensión almacenada', () => {
    expect(mimePorRuta('solicitudes/1/a.pdf')).toBe('application/pdf');
    expect(mimePorRuta('solicitudes/1/a.png')).toBe('image/png');
    expect(mimePorRuta('solicitudes/1/a.jpg')).toBe('image/jpeg');
    expect(mimePorRuta('solicitudes/1/a.bin')).toBe('application/octet-stream');
  });

  it('solo permite cargar documentos en radicada o devuelta', () => {
    expect(puedeCargarDocumentos('radicada')).toBe(true);
    expect(puedeCargarDocumentos('devuelta')).toBe(true);
    for (const estado of [
      'borrador',
      'en_revision',
      'aprobada',
      'rechazada',
      'cancelada',
    ]) {
      expect(puedeCargarDocumentos(estado)).toBe(false);
    }
  });

  it('traduce el estado del documento al estado del requisito', () => {
    expect(estadoRequisitoDocumental(null, false)).toBe('faltante');
    expect(estadoRequisitoDocumental('pendiente', true)).toBe('cargado');
    expect(estadoRequisitoDocumental('validado', true)).toBe('cumple');
    expect(estadoRequisitoDocumental('observado', true)).toBe('no_cumple');
  });

  it('agrupa versiones y deja como actual la que no fue reemplazada', () => {
    const filas = [
      {
        id: 5n,
        reemplaza_a: null,
        cargado_en: new Date('2026-11-20T10:00:00.000Z'),
      },
      {
        id: 8n,
        reemplaza_a: 5n,
        cargado_en: new Date('2026-11-22T10:00:00.000Z'),
      },
    ];

    const grupo = agruparVersionesDocumento(filas);

    expect(grupo.actual?.id).toBe(8n);
    expect(grupo.versiones.map((version) => version.fila.id)).toEqual([
      8n,
      5n,
    ]);
    expect(grupo.versiones.map((version) => version.numeroVersion)).toEqual([
      2, 1,
    ]);
    expect(grupo.versiones.map((version) => version.esActual)).toEqual([
      true,
      false,
    ]);
  });
});
