import { Module } from '@nestjs/common';
import { CorreoService } from './correo.service';

/**
 * Envío de correos de la plataforma (códigos de activación, avisos).
 *
 * Si no hay SMTP configurado (desarrollo), el código se registra en el log
 * en lugar de enviarse; ver `CorreoService` y docs/uso_db.md.
 */
@Module({
  providers: [CorreoService],
  exports: [CorreoService],
})
export class CorreoModule {}
