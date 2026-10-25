import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { CoincideCon } from '../../common/validators/coincide-con.decorator';
import { TIPOS_DOCUMENTO, type TipoDocumento } from './crear-comerciante.dto';

/**
 * Cuerpo del registro de la cuenta de un organizador de feria.
 *
 * Crea únicamente la cuenta personal. La organización se registra después de
 * activar la cuenta, desde `POST /organizadores/mi-organizacion`.
 */
export class CrearOrganizadorDto {
  /** Nombres del organizador. */
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @Length(2, 150, {
    message: 'El nombre debe tener entre 2 y 150 caracteres',
  })
  nombre!: string;

  /** Apellidos del organizador. */
  @IsOptional()
  @IsString({ message: 'Los apellidos deben ser texto' })
  @Length(2, 150, {
    message: 'Los apellidos deben tener entre 2 y 150 caracteres',
  })
  apellido?: string;

  /** Tipo de documento de identidad. */
  @ApiProperty({ enum: TIPOS_DOCUMENTO, example: 'CC' })
  @IsIn([...TIPOS_DOCUMENTO], {
    message: 'El tipo de documento debe ser CC, CE, TI, PP o NIT',
  })
  tipoDocumento!: TipoDocumento;

  /** Número de documento. Único en el sistema. */
  @IsNotEmpty({ message: 'El documento es obligatorio' })
  @Matches(/^[0-9A-Za-z-]{5,30}$/, {
    message:
      'El documento debe tener entre 5 y 30 caracteres (letras, números o guion)',
  })
  documento!: string;

  /** Teléfono de contacto del organizador. */
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  @Matches(/^[+0-9][0-9\s()-]{6,29}$/, {
    message: 'El teléfono no es válido',
  })
  telefono!: string;

  /** Correo único; sirve para activación, recuperación y notificaciones. */
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @IsEmail({}, { message: 'El correo no es válido' })
  @MaxLength(150, {
    message: 'El correo no puede superar los 150 caracteres',
  })
  correo!: string;

  /** Contraseña: mínimo 8 caracteres y al menos un número. */
  @ApiProperty({ example: 'Organizador123' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @Length(8, 128, {
    message: 'La contraseña debe tener entre 8 y 128 caracteres',
  })
  @Matches(/\d/, { message: 'La contraseña debe incluir al menos un número' })
  password!: string;

  /** Confirmación de la contraseña (debe coincidir exactamente). */
  @ApiProperty({ example: 'Organizador123' })
  @CoincideCon('password', {
    message: 'La confirmación no coincide con la contraseña',
  })
  confirmarPassword!: string;
}
