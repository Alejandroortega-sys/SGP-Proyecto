import PDFDocument from 'pdfkit';

/** Datos que imprime el recibo del pago simulado (HU-36). */
export interface DatosRecibo {
  numeroCobro: string;
  permisoNumero: string;
  titular: string;
  valor: string;
  pagadoEn: Date;
}

/** Formatea el valor NUMERIC(12,2) como pesos colombianos legibles. */
function formatoCOP(valor: string): string {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) {
    return `$ ${valor}`;
  }
  return `$ ${numero.toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Construye el PDF del recibo del pago simulado (HU-36, tareas 1245 y 1247).
 *
 * El recibo deja visible en dos puntos que el pago es simulado: nunca se
 * registran datos de tarjeta ni transacciones reales (AGENTS §9.12).
 */
export function construirReciboPdf(datos: DatosRecibo): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A5',
      margins: { top: 40, bottom: 40, left: 46, right: 46 },
      info: {
        Title: `Recibo del cobro ${datos.numeroCobro}`,
        Author: 'Plataforma SGP Tuluá',
      },
    });

    const trozos: Buffer[] = [];
    doc.on('data', (trozo: Buffer) => trozos.push(trozo));
    doc.on('end', () => resolve(Buffer.concat(trozos)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(14).fillColor('#1f2937');
    doc.text('RECIBO DE PAGO DE USO DE SUELO', { align: 'center' });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).fillColor('#6b7280');
    doc.text('Alcaldía de Tuluá · Plataforma de Gestión del Espacio Público', {
      align: 'center',
    });
    doc.moveDown(1.4);

    doc.font('Helvetica').fontSize(10).fillColor('#374151');
    const fila = (etiqueta: string, valor: string): void => {
      doc.font('Helvetica-Bold').text(`${etiqueta}: `, { continued: true });
      doc.font('Helvetica').text(valor);
      doc.moveDown(0.55);
    };

    fila('Recibo', `COB-${datos.numeroCobro}`);
    fila('Permiso', datos.permisoNumero);
    fila('Titular', datos.titular);
    fila(
      'Fecha del pago',
      datos.pagadoEn.toLocaleString('es-CO', {
        dateStyle: 'long',
        timeStyle: 'short',
      }),
    );

    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827');
    doc.text(`Valor pagado: ${formatoCOP(datos.valor)}`, { align: 'center' });
    doc.moveDown(1.4);

    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#b45309');
    doc.text(
      'PAGO SIMULADO: no se realizó ninguna transacción real ni se ' +
        'solicitaron datos de tarjeta.',
      { align: 'center' },
    );
    doc.moveDown(0.6);
    doc.font('Helvetica').fontSize(8).fillColor('#9ca3af');
    doc.text(
      'Este recibo acredita el estado «pagado» del cobro asociado al permiso ' +
        'dentro de la plataforma de pruebas.',
      { align: 'center' },
    );

    doc.end();
  });
}
