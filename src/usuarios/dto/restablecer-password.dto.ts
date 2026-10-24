import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { CoincideCon } from '../../common/validators/coincide-con.decorator';

/**
 * Cuerpo del restablecimiento de contraseña.
 *
 * Confirma el código de recuperación enviado por correo y define la
 * contraseña nueva, que debe cumplir la misma política del registro
 * (mínimo 8 caracteres y al menos un número).
 */
export class RestablecerPasswordDto {
  /** Correo de la cuenta. */
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @IsEmail({}, { message: 'El correo no es válido' })
  @MaxLength(150, {
    message: 'El correo no puede superar los 150 caracteres',
  })
  correo!: string;

  /** Código de 6 dígitos enviado por correo. */
  @Matches(/^\d{6}$/, {
    message: 'El código debe ser numérico y de 6 dígitos',
  })
  codigo!: string;

  /** Contraseña nueva: mínimo 8 caracteres y al menos un número. */
  @ApiProperty({ example: 'NuevaClave456' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @IsString({ message: 'La contraseña debe ser texto' })
  @Length(8, 128, {
    message: 'La contraseña debe tener entre 8 y 128 caracteres',
  })
  @Matches(/\d/, { message: 'La contraseña debe incluir al menos un número' })
  password!: string;

  /** Confirmación de la contraseña nueva (debe coincidir exactamente). */
  @ApiProperty({ example: 'NuevaClave456' })
  @CoincideCon('password', {
    message: 'La confirmación no coincide con la contraseña',
  })
  confirmarPassword!: string;
}
