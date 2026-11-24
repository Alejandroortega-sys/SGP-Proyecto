import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

/** Datos que imprime el carné digital (HU-32). */
export interface DatosCarne {
  numero: string;
  titular: string;
  categoria: string;
  espacio: string | null;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  urlVerificacion: string;
}

/** Color del estado del permiso: siempre visible, nunca solo el color. */
const COLOR_ESTADO: Record<string, string> = {
  vigente: '#15803d',
  suspendido: '#b45309',
  revocado: '#b91c1c',
  vencido: '#b91c1c',
};

/** Etiqueta legible del estado del permiso. */
const ETIQUETA_ESTADO: Record<string, string> = {
  vigente: 'VIGENTE',
  suspendido: 'SUSPENDIDO',
  revocado: 'REVOCADO',
  vencido: 'VENCIDO',
};

/** Tamaño carné (horizontal): ~105 × 74 mm en puntos. */
const ANCHO = 320;
const ALTO = 226;

/**
 * Construye el PDF del carné digital con el código QR (HU-32, tareas 1219
 * y 1221).
 *
 * El QR codifica la URL pública de verificación (`/verificar/<qrToken>`)
 * para que cualquier app de escaneo abra directo el resultado (HU-33). El
 * estado se imprime con color **y** texto para no depender solo del color
 * (WCAG).
 */
export async function construirCarnePdf(datos: DatosCarne): Promise<Buffer> {
  const qr = await QRCode.toBuffer(datos.urlVerificacion, {
    type: 'png',
    margin: 1,
    width: 220,
    errorCorrectionLevel: 'M',
  });

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: [ANCHO, ALTO],
      margins: { top: 14, bottom: 14, left: 16, right: 16 },
      info: {
        Title: `Carné digital ${datos.numero}`,
        Author: 'Plataforma SGP Tuluá',
      },
    });

    const trozos: Buffer[] = [];
    doc.on('data', (trozo: Buffer) => trozos.push(trozo));
    doc.on('end', () => resolve(Buffer.concat(trozos)));
    doc.on('error', reject);

    // Encabezado.
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1f2937');
    doc.text('PERMISO DE USO DEL ESPACIO PÚBLICO', { characterSpacing: 0.5 });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(8).fillColor('#6b7280');
    doc.text('Alcaldía de Tuluá · Plataforma de Gestión del Espacio Público');
    doc.moveDown(1);

    // Número del permiso.
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#111827');
    doc.text(datos.numero);

    // Estado con color y texto (visible también en impresión en B/N).
    const color = COLOR_ESTADO[datos.estado] ?? '#374151';
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(color);
    doc.text(
      `● ${ETIQUETA_ESTADO[datos.estado] ?? datos.estado.toUpperCase()}`,
    );
    doc.moveDown(0.8);

    // Datos del titular y la vigencia.
    doc.font('Helvetica').fontSize(8.5).fillColor('#374151');
    doc.text(`Titular: ${datos.titular}`, { lineGap: 1.5 });
    doc.text(`Categoría autorizada: ${datos.categoria}`);
    doc.text(`Espacio: ${datos.espacio ?? 'No asignado'}`);
    doc.text(
      `Vigencia: del ${datos.fechaInicio} al ${datos.fechaFin} (inclusive)`,
    );

    // QR a la derecha.
    const margenQr = 16;
    const anchoQr = 118;
    doc.image(qr, ANCHO - margenQr - anchoQr, ALTO / 2 - anchoQr / 2 + 8, {
      width: anchoQr,
    });
    doc.font('Helvetica').fontSize(6.5).fillColor('#6b7280');
    doc.text(
      'Escanee para verificar',
      ANCHO - margenQr - anchoQr,
      ALTO / 2 + anchoQr / 2 + 12,
      { width: anchoQr, align: 'center' },
    );

    // Pie con aviso de verificación ciudadana.
    doc.font('Helvetica').fontSize(6.5).fillColor('#9ca3af');
    doc.text(
      'Cualquier ciudadano puede verificar este permiso escaneando el código ' +
        'o visitando la sección «Verificar permiso» de la plataforma.',
      16,
      ALTO - 26,
      { width: ANCHO - 32, lineGap: 1 },
    );

    doc.end();
  });
}
