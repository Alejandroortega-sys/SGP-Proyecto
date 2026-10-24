import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * Cuerpo de la solicitud de recuperación de contraseña.
 *
 * La respuesta es siempre el mismo mensaje genérico: no se revela si el
 * correo corresponde a una cuenta registrada y activa (anti-enumeración).
 */
export class SolicitarRecuperacionDto {
  /** Correo de la cuenta cuya contraseña se quiere recuperar. */
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @IsEmail({}, { message: 'El correo no es válido' })
  @MaxLength(150, {
    message: 'El correo no puede superar los 150 caracteres',
  })
  correo!: string;
}
