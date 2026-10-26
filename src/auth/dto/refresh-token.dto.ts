import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Cuerpo de `POST /auth/refresh`. */
export class RefreshTokenDto {
  /** Refresh token recibido en el login o en un refresh anterior. */
  @ApiProperty({ example: '9f8c1b...' })
  @IsNotEmpty({ message: 'El refresh token es obligatorio' })
  @IsString({ message: 'El refresh token debe ser texto' })
  @MaxLength(255, {
    message: 'El refresh token no puede superar los 255 caracteres',
  })
  refreshToken!: string;
}
