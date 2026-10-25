import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { CoincideCon } from '../../common/validators/coincide-con.decorator';

/**
 * Cuerpo de `PATCH /perfil/password`: cambio de contraseña desde el perfil
 * (HU-04). Exige la contraseña actual como prueba de identidad y la nueva
 * debe cumplir la misma política del registro (mín. 8 caracteres con al
 * menos un número). El cambio se confirma con un aviso por correo.
 */
export class CambiarPasswordDto {
  /** Contraseña vigente de la cuenta (prueba de identidad, HU-04). */
  @ApiProperty({ example: 'Comerciante123' })
  @IsNotEmpty({ message: 'La contraseña actual es obligatoria' })
  @MaxLength(128, {
    message: 'La contraseña actual no puede superar los 128 caracteres',
  })
  passwordActual!: string;

  /** Contraseña nueva: mínimo 8 caracteres y al menos un número (HU-01). */
  @ApiProperty({ example: 'NuevaClave456' })
  @IsNotEmpty({ message: 'La contraseña nueva es obligatoria' })
  @Length(8, 128, {
    message: 'La contraseña nueva debe tener entre 8 y 128 caracteres',
  })
  @Matches(/\d/, {
    message: 'La contraseña nueva debe incluir al menos un número',
  })
  passwordNueva!: string;

  /** Confirmación de la contraseña nueva (debe coincidir exactamente). */
  @ApiProperty({ example: 'NuevaClave456' })
  @CoincideCon('passwordNueva', {
    message: 'La confirmación no coincide con la contraseña nueva',
  })
  confirmarPassword!: string;
}
