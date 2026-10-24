import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

/**
 * Cuerpo de la activación de cuenta: el comerciante ingresa el código
 * numérico de 6 dígitos que recibió por correo.
 */
export class ActivarCuentaDto {
  /** Correo de la cuenta registrada. */
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @IsEmail({}, { message: 'El correo no es válido' })
  correo!: string;

  /** Código de activación de 6 dígitos enviado por correo. */
  @Matches(/^\d{6}$/, {
    message: 'El código debe ser numérico y de 6 dígitos',
  })
  codigo!: string;
}
