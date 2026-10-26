import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { perfil_gestor } from '../generated/prisma/client';

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
   * Envía un correo con el transportador SMTP configurado.
   *
   * Sin SMTP (desarrollo), el contenido se registra en el log para poder
   * probar el flujo; en producción se considera un error.
   *
   * @param destino Correo del destinatario.
   * @param asunto Asunto del correo.
   * @param texto Cuerpo en texto plano.
   * @param html Cuerpo en HTML.
   * @param respaldoLog Mensaje que se registra en desarrollo sin SMTP.
   */
  private async enviar(
    destino: string,
    asunto: string,
    texto: string,
    html: string,
    respaldoLog: string,
  ): Promise<void> {
    if (!this.transporter) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('El servidor de correo (SMTP) no está configurado');
      }
      // Respaldo de desarrollo: sin SMTP el contenido queda visible en el log.
      this.logger.warn(respaldoLog);
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
      this.logger.log(`Correo enviado a ${destino}: ${asunto}`);
    } catch (error) {
      this.logger.error(
        `Fallo enviando "${asunto}" a ${destino}: ${String(error)}`,
      );
      throw error;
    }
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

    await this.enviar(
      destino,
      asunto,
      texto,
      html,
      `SMTP no configurado: el código de activación de ${destino} es ${codigo} ` +
        `(vigente ${expiraEnMinutos} minutos)`,
    );
  }

  /**
   * Envía las credenciales temporales de un gestor recién creado.
   *
   * No hay código de seguridad: el correo incluye una contraseña temporal y
   * el enlace al login. El gestor debe cambiarla en su primer inicio de
   * sesión; mientras no lo haga, la cuenta permanece pendiente de activación.
   *
   * @param destino Correo institucional del gestor.
   * @param nombre Nombre del gestor.
   * @param perfil Perfil asignado (revisor o administrador).
   * @param passwordTemporal Contraseña temporal generada por GestorService.
   * @param urlAcceso URL del login del frontend.
   * @throws Error si no hay SMTP en producción o si el envío falla.
   */
  async enviarCredencialesGestor(
    destino: string,
    nombre: string,
    perfil: perfil_gestor,
    passwordTemporal: string,
    urlAcceso: string,
  ): Promise<void> {
    const etiquetaPerfil =
      perfil === 'administrador' ? 'administrador' : 'revisor';
    const asunto = 'Tu cuenta de gestor municipal en SGP Tuluá';
    const texto =
      `Hola ${nombre},\n\n` +
      `Se creó tu cuenta de gestor municipal con perfil ${etiquetaPerfil}.\n\n` +
      `Contraseña temporal: ${passwordTemporal}\n\n` +
      `Ingresa en ${urlAcceso} con tu correo y esta contraseña. En el primer ` +
      `inicio de sesión deberás cambiarla obligatoriamente; mientras no lo ` +
      `hagas, la cuenta permanecerá en estado pendiente de activación.\n\n` +
      `Si no esperabas esta cuenta, comunícate con la Secretaría de Gobierno.\n\n` +
      `Secretaría de Gobierno — Municipio de Tuluá`;
    const html =
      `<p>Hola <strong>${nombre}</strong>,</p>` +
      `<p>Se creó tu cuenta de gestor municipal con perfil ` +
      `<strong>${etiquetaPerfil}</strong>.</p>` +
      `<p>Contraseña temporal:</p>` +
      `<p style="font-size:20px;letter-spacing:3px;font-weight:bold;">` +
      `${passwordTemporal}</p>` +
      `<p>Ingresa en <a href="${urlAcceso}">${urlAcceso}</a> con tu correo y ` +
      `esta contraseña. En el primer inicio de sesión deberás cambiarla ` +
      `obligatoriamente; mientras no lo hagas, la cuenta permanecerá en ` +
      `estado pendiente de activación.</p>` +
      `<p>Si no esperabas esta cuenta, comunícate con la Secretaría de ` +
      `Gobierno.</p>` +
      `<p>Secretaría de Gobierno — Municipio de Tuluá</p>`;

    await this.enviar(
      destino,
      asunto,
      texto,
      html,
      `SMTP no configurado: credenciales del gestor ${destino} ` +
        `(perfil ${etiquetaPerfil}, contraseña temporal ${passwordTemporal}, ` +
        `acceso ${urlAcceso})`,
    );
  }

  /**
   * Envía el código numérico para restablecer la contraseña.
   *
   * @param destino Correo de la cuenta.
   * @param nombre Nombre del usuario (para personalizar el mensaje).
   * @param codigo Código de 6 dígitos generado por UsuariosService.
   * @param expiraEnMinutos Vigencia del código, en minutos.
   * @throws Error si no hay SMTP en producción o si el envío falla.
   */
  async enviarCodigoRecuperacion(
    destino: string,
    nombre: string,
    codigo: string,
    expiraEnMinutos: number,
  ): Promise<void> {
    const asunto = 'Recupera tu contraseña en SGP Tuluá';
    const texto =
      `Hola ${nombre},\n\n` +
      `Recibimos una solicitud para restablecer la contraseña de tu cuenta.\n\n` +
      `Tu código de verificación es: ${codigo}\n\n` +
      `El código expira en ${expiraEnMinutos} minutos.\n\n` +
      `Si no fuiste tú quien lo solicitó, ignora este correo: tu contraseña ` +
      `no cambiará.\n\n` +
      `Secretaría de Gobierno — Municipio de Tuluá`;
    const html =
      `<p>Hola <strong>${nombre}</strong>,</p>` +
      `<p>Recibimos una solicitud para restablecer la contraseña de tu ` +
      `cuenta. Tu código de verificación es:</p>` +
      `<p style="font-size:28px;letter-spacing:8px;font-weight:bold;">${codigo}</p>` +
      `<p>El código expira en ${expiraEnMinutos} minutos.</p>` +
      `<p>Si no fuiste tú quien lo solicitó, ignora este correo: tu ` +
      `contraseña no cambiará.</p>` +
      `<p>Secretaría de Gobierno — Municipio de Tuluá</p>`;

    await this.enviar(
      destino,
      asunto,
      texto,
      html,
      `SMTP no configurado: el código de recuperación de ${destino} es ${codigo} ` +
        `(vigente ${expiraEnMinutos} minutos)`,
    );
  }

  /**
   * Envía el aviso de suspensión o inactivación de una cuenta.
   *
   * El motivo es opcional y lo proporciona el gestor administrador. No se
   * guarda en una columna nueva de la base de datos: solo viaja en el correo.
   *
   * @param destino Correo del titular de la cuenta.
   * @param nombre Nombre del titular (para personalizar el mensaje).
   * @param estado Estado nuevo: `suspendida` o `inactiva`.
   * @param motivo Motivo opcional informado por el administrador.
   * @throws Error si no hay SMTP en producción o si el envío falla.
   */
  async enviarAvisoEstadoCuenta(
    destino: string,
    nombre: string,
    estado: 'suspendida' | 'inactiva',
    motivo?: string,
  ): Promise<void> {
    const accion = estado === 'suspendida' ? 'suspendida' : 'desactivada';
    const asunto =
      estado === 'suspendida'
        ? 'Tu cuenta de SGP Tuluá fue suspendida'
        : 'Tu cuenta de SGP Tuluá fue desactivada';
    const detalleMotivo = motivo
      ? `Motivo informado por la Alcaldía: ${motivo}`
      : 'Comunícate con la Secretaría de Gobierno para conocer el motivo y solicitar la reactivación.';
    const texto =
      `Hola ${nombre},\n\n` +
      `Te informamos que tu cuenta en SGP Tuluá fue ${accion}.\n\n` +
      `${detalleMotivo}\n\n` +
      `Si tienes dudas, comunícate con la Secretaría de Gobierno del ` +
      `Municipio de Tuluá.\n\n` +
      `Secretaría de Gobierno — Municipio de Tuluá`;
    const html =
      `<p>Hola <strong>${nombre}</strong>,</p>` +
      `<p>Te informamos que tu cuenta en SGP Tuluá fue ` +
      `<strong>${accion}</strong>.</p>` +
      `<p>${detalleMotivo}</p>` +
      `<p>Si tienes dudas, comunícate con la Secretaría de Gobierno del ` +
      `Municipio de Tuluá.</p>` +
      `<p>Secretaría de Gobierno — Municipio de Tuluá</p>`;

    await this.enviar(
      destino,
      asunto,
      texto,
      html,
      `SMTP no configurado: aviso de cuenta ${accion} para ${destino}` +
        (motivo ? ` (motivo: ${motivo})` : ''),
    );
  }

  /**
   * Envía el aviso de que la contraseña fue cambiada desde el perfil (HU-04).
   *
   * No incluye la nueva contraseña ni datos sensibles: solo informa del
   * cambio para que el titular pueda actuar si no lo solicitó.
   *
   * @param destino Correo de la cuenta cuyo password cambió.
   * @param nombre Nombre del usuario (para personalizar el mensaje).
   * @throws Error si no hay SMTP en producción o si el envío falla.
   */
  async enviarAvisoCambioPassword(
    destino: string,
    nombre: string,
  ): Promise<void> {
    const asunto = 'Tu contraseña de SGP Tuluá fue cambiada';
    const texto =
      `Hola ${nombre},\n\n` +
      `Te confirmamos que la contraseña de tu cuenta fue actualizada desde ` +
      `tu perfil en la plataforma SGP Tuluá.\n\n` +
      `Si no fuiste tú quien hizo el cambio, comunícate de inmediato con la ` +
      `Secretaría de Gobierno y usa el enlace de recuperación de contraseña ` +
      `para restablecerla.\n\n` +
      `Secretaría de Gobierno — Municipio de Tuluá`;
    const html =
      `<p>Hola <strong>${nombre}</strong>,</p>` +
      `<p>Te confirmamos que la contraseña de tu cuenta fue actualizada ` +
      `desde tu perfil en la plataforma SGP Tuluá.</p>` +
      `<p>Si no fuiste tú quien hizo el cambio, comunícate de inmediato con ` +
      `la Secretaría de Gobierno y usa el enlace de recuperación de ` +
      `contraseña para restablecerla.</p>` +
      `<p>Secretaría de Gobierno — Municipio de Tuluá</p>`;

    await this.enviar(
      destino,
      asunto,
      texto,
      html,
      `SMTP no configurado: aviso de cambio de contraseña de ${destino} ` +
        '(el cambio ya quedó aplicado; esto es solo el aviso por correo)',
    );
  }
}
