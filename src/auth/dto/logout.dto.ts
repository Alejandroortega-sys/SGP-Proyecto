import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/** Cuerpo opcional de `POST /auth/logout`. */
export class LogoutDto {
  /**
   * Si es `true`, revoca todas las sesiones del usuario; si se omite o es
   * `false`, revoca solo la sesión del access token actual.
   */
  @ApiPropertyOptional({
    example: false,
    default: false,
    description: 'Revocar todas las sesiones del usuario, no solo la actual',
  })
  @IsOptional()
  @IsBoolean({ message: 'El campo «todas» debe ser true o false' })
  todas?: boolean;
}
