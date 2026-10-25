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
 * Cuerpo de `POST /auth/gestor/primer-acceso`.
 *
 * Confirma la contraseña temporal enviada por correo y define la contraseña
 * definitiva del gestor. La cuenta permanece en «pendiente_activacion» hasta
 * que este cambio se completa.
 */
export class PrimerAccesoGestorDto {
  /** Correo de la cuenta. */
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @IsEmail({}, { message: 'El correo no es válido' })
  @MaxLength(150, {
    message: 'El correo no puede superar los 150 caracteres',
  })
  correo!: string;

  /** Contraseña temporal recibida por correo. */
  @IsNotEmpty({ message: 'La contraseña temporal es obligatoria' })
  @IsString({ message: 'La contraseña temporal debe ser texto' })
  passwordActual!: string;

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
