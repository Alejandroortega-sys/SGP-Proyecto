import { IsEmail, IsNotEmpty } from 'class-validator';

/**
 * Cuerpo del reenvío del código de activación. La respuesta es siempre
 * genérica para no revelar si el correo tiene cuenta registrada.
 */
export class ReenviarCodigoDto {
  /** Correo de la cuenta pendiente de activación. */
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @IsEmail({}, { message: 'El correo no es válido' })
  correo!: string;
}
