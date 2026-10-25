import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

/**
 * Cuerpo de `POST /organizadores/mi-organizacion`.
 *
 * Registra la organización del organizador autenticado. El estado no se envía:
 * la base de datos aplica `pendiente_validacion` por defecto.
 */
export class CrearOrganizacionDto {
  /** Nombre de la organización. Único en el sistema (sin distinguir mayúsculas). */
  @IsNotEmpty({ message: 'El nombre de la organización es obligatorio' })
  @Length(3, 200, {
    message: 'El nombre de la organización debe tener entre 3 y 200 caracteres',
  })
  nombreOrganizacion!: string;

  /** NIT de la organización. Único en el sistema. */
  @IsNotEmpty({ message: 'El NIT es obligatorio' })
  @Matches(/^[0-9]{8,10}(-[0-9])?$/, {
    message:
      'El NIT debe tener entre 8 y 10 dígitos y, opcionalmente, un guion y el dígito de verificación',
  })
  nit!: string;

  /** Representante legal de la organización. */
  @IsNotEmpty({ message: 'El representante es obligatorio' })
  @Length(3, 150, {
    message: 'El representante debe tener entre 3 y 150 caracteres',
  })
  representante!: string;

  /** Tipo de feria que organiza. */
  @IsNotEmpty({ message: 'El tipo de feria es obligatorio' })
  @Length(3, 100, {
    message: 'El tipo de feria debe tener entre 3 y 100 caracteres',
  })
  tipoFeria!: string;

  /** Datos de contacto de la organización (teléfono o correo). */
  @IsOptional()
  @IsString({ message: 'El contacto debe ser texto' })
  @Length(3, 150, {
    message: 'El contacto debe tener entre 3 y 150 caracteres',
  })
  contacto?: string;
}
