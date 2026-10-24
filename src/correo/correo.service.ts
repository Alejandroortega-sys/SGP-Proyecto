import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

/**
 * Servicio de envío de correos vía SMTP (nodemailer).
 *
 * Comportamiento según configuración:
 * - `MAIL_HOST` definido → envía el correo con el SMTP configurado.
 * - `MAIL_HOST` vacío (desarrollo) → escribe el contenido en el log para
 *   poder probar el flujo sin servidor de correo. En producción esto se
 *   considera un error y la operación falla.
 *
 * Variables de entorno (ver .env.example): MAIL_HOST, MAIL_PORT, MAIL_SECURE,
 * MAIL_USER, MAIL_PASSWORD y MAIL_FROM.
 */
@Injectable()
export class CorreoService {
  private readonly logger = new Logger(CorreoService.name);
  private readonly transporter: Transporter | null;
  private readonly remitente: string;

  constructor(config: ConfigService) {
    this.remitente =
      config.get<string>('MAIL_FROM') ?? 'SGP Tulua <no-reply@sgptulua.gov.co>';

    const host = config.get<string>('MAIL_HOST');
    if (host) {
      const usuario = config.get<string>('MAIL_USER');
      this.transporter = createTransport({
        host,
        port: config.get<number>('MAIL_PORT') ?? 587,
        // Con true se usa TLS desde el inicio del puerto 465.
        secure: config.get<string>('MAIL_SECURE')?.toLowerCase() === 'true',
        auth: usuario
          ? {
              user: usuario,
              pass: config.get<string>('MAIL_PASSWORD') ?? '',
            }
          : undefined,
      });
    } else {
      this.transporter = null;
    }
  }

  /** Indica si hay un SMTP real configurado. */
  get smtpConfigurado(): boolean {
    return this.transporter !== null;
  }

  /**
   * Envía el código numérico de activación de la cuenta.
   *
   * @param destino Correo del comerciante recién registrado.
   * @param nombre Nombre del comerciante (para personalizar el mensaje).
   * @param codigo Código de 6 dígitos generado por UsuariosService.
   * @param expiraEnMinutos Vigencia del código, en minutos.
   * @throws Error si no hay SMTP en producción o si el envío falla.
   */
  async enviarCodigoActivacion(
    destino: string,
    nombre: string,
    codigo: string,
    expiraEnMinutos: number,
  ): Promise<void> {
    const asunto = 'Activa tu cuenta en SGP Tuluá';
    const texto =
      `Hola ${nombre},\n\n` +
      `Tu código de activación es: ${codigo}\n\n` +
      `Ingrésalo en la plataforma para activar tu cuenta. El código expira ` +
      `en ${expiraEnMinutos} minutos.\n\n` +
      `Si no solicitaste esta cuenta, ignora este correo.\n\n` +
      `Secretaría de Gobierno — Municipio de Tuluá`;
    const html =
      `<p>Hola <strong>${nombre}</strong>,</p>` +
      `<p>Tu código de activación es:</p>` +
      `<p style="font-size:28px;letter-spacing:8px;font-weight:bold;">${codigo}</p>` +
      `<p>Ingrésalo en la plataforma para activar tu cuenta. El código ` +
      `expira en ${expiraEnMinutos} minutos.</p>` +
      `<p>Si no solicitaste esta cuenta, ignora este correo.</p>` +
      `<p>Secretaría de Gobierno — Municipio de Tuluá</p>`;

    if (!this.transporter) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('El servidor de correo (SMTP) no está configurado');
      }
      // Respaldo de desarrollo: sin SMTP el código queda visible en el log.
      this.logger.warn(
        `SMTP no configurado: el código de activación de ${destino} es ${codigo} ` +
          `(vigente ${expiraEnMinutos} minutos)`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.remitente,
        to: destino,
        subject: asunto,
        text: texto,
        html,
      });
      this.logger.log(`Código de activación enviado a ${destino}`);
    } catch (error) {
      this.logger.error(
        `Fallo enviando el código de activación a ${destino}: ${String(error)}`,
      );
      throw error;
    }
  }
}
