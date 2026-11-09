import { BadRequestException } from '@nestjs/common';
import {
  detectarFormatoFoto,
  MAX_BYTES_FOTO_POR_DEFECTO,
  validarFoto,
  type ArchivoFoto,
} from './foto';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x10, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP'),
  Buffer.from('VP8 '),
]);

function archivo(
  buffer: Buffer,
  mimetype = 'image/png',
  size = buffer.length,
): ArchivoFoto {
  return {
    buffer,
    mimetype,
    size,
    originalname: 'foto.png',
  };
}

describe('validación de fotos del censo', () => {
  it('detecta el formato real por firma binaria', () => {
    expect(detectarFormatoFoto(JPG)).toBe('jpg');
    expect(detectarFormatoFoto(PNG)).toBe('png');
    expect(detectarFormatoFoto(WEBP)).toBe('webp');
    expect(detectarFormatoFoto(Buffer.from('texto plano'))).toBeNull();
  });

  it('acepta JPG, PNG y WebP válidos', () => {
    expect(validarFoto(archivo(JPG, 'image/jpeg'), 1024)).toMatchObject({
      formato: 'jpg',
      mimetype: 'image/jpeg',
      extension: '.jpg',
    });
    expect(validarFoto(archivo(PNG, 'image/png'), 1024)).toMatchObject({
      formato: 'png',
      extension: '.png',
    });
    expect(validarFoto(archivo(WEBP, 'image/webp'), 1024)).toMatchObject({
      formato: 'webp',
      extension: '.webp',
    });
  });

  it('rechaza un MIME no permitido', () => {
    expect(() => validarFoto(archivo(PNG, 'image/gif'), 1024)).toThrow(
      BadRequestException,
    );
  });

  it('rechaza un archivo cuya firma no corresponde a la imagen declarada', () => {
    expect(() => validarFoto(archivo(JPG, 'image/png'), 1024)).toThrow(
      new BadRequestException(
        'El tipo declarado de la foto no coincide con el contenido real del archivo',
      ),
    );
  });

  it('rechaza archivos vacíos y mayores al límite', () => {
    expect(() => validarFoto(archivo(Buffer.alloc(0), 'image/png'), 1024)).toThrow(
      'La foto del puesto está vacía',
    );

    const grande = Buffer.concat([PNG, Buffer.alloc(2048)]);
    expect(() => validarFoto(archivo(grande, 'image/png'), 1024)).toThrow(
      /superar/,
    );
  });

  it('expone el límite por defecto de 5 MB', () => {
    expect(MAX_BYTES_FOTO_POR_DEFECTO).toBe(5 * 1024 * 1024);
  });
});
