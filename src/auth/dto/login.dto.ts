import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Cuerpo del inicio de sesión.
 *
 * No se imponen reglas de longitud a la contraseña para no sustituir el 401
 * de credenciales inválidas por un 400 de validación (y para no revelar
 * pistas sobre las contraseñas registradas).
 */
export class LoginDto {
  /** Correo de la cuenta (se normaliza a minúsculas). */
  @ApiProperty({ example: 'maria.gomez@gmail.com' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @IsEmail({}, { message: 'El correo no es válido' })
  @MaxLength(150, {
    message: 'El correo no puede superar los 150 caracteres',
  })
  correo!: string;

  /** Contraseña de la cuenta. */
  @ApiProperty({ example: 'Comerciante123' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @IsString({ message: 'La contraseña debe ser texto' })
  password!: string;
}
