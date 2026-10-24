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
import { categoria_comercio } from '../../generated/prisma/client';
import { CoincideCon } from '../../common/validators/coincide-con.decorator';

/** Tipos de documento de identidad aceptados para el registro. */
export const TIPOS_DOCUMENTO = ['CC', 'CE', 'TI', 'PP', 'NIT'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

/**
 * Cuerpo del registro de comerciante (HU-01).
 *
 * Cubre las tres secciones del perfil: datos personales, actividad comercial
 * y seguridad. El documento y el correo son únicos en el sistema; la BD los
 * garantiza con UNIQUE y el filtro global responde 409 si se duplican.
 */
export class CrearComercianteDto {
  /** Nombres del comerciante (datos personales). */
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @Length(2, 150, {
    message: 'El nombre debe tener entre 2 y 150 caracteres',
  })
  nombre!: string;

  /** Apellidos del comerciante (datos personales). */
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

  /**
   * Número de documento. Único e inmutable: solo puede cambiarse vía
   * gestor municipal (HU-04).
   */
  @IsNotEmpty({ message: 'El documento es obligatorio' })
  @Matches(/^[0-9A-Za-z-]{5,30}$/, {
    message:
      'El documento debe tener entre 5 y 30 caracteres (letras, números o guion)',
  })
  documento!: string;

  /** Teléfono de contacto del comerciante. */
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

  /** Contraseña: mínimo 8 caracteres y al menos un número (HU-01). */
  @ApiProperty({ example: 'Comerciante123' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @Length(8, 128, {
    message: 'La contraseña debe tener entre 8 y 128 caracteres',
  })
  @Matches(/\d/, { message: 'La contraseña debe incluir al menos un número' })
  password!: string;

  /** Confirmación de la contraseña (debe coincidir exactamente). */
  @ApiProperty({ example: 'Comerciante123' })
  @CoincideCon('password', {
    message: 'La confirmación no coincide con la contraseña',
  })
  confirmarPassword!: string;

  /** Actividad comercial que ejerce (perfil comercial). */
  @IsNotEmpty({ message: 'La actividad comercial es obligatoria' })
  @Length(3, 200, {
    message: 'La actividad comercial debe tener entre 3 y 200 caracteres',
  })
  actividadComercial!: string;

  /** Categoría del comercio: formal o informal. */
  @ApiProperty({ enum: categoria_comercio, example: 'formal' })
  @IsIn(['formal', 'informal'] as unknown as string[], {
    message: 'La categoría debe ser "formal" o "informal"',
  })
  categoria!: categoria_comercio;
}
