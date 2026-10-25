import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

/**
 * Cuerpo de `PATCH /perfil`: actualización parcial de los datos personales
 * del comerciante autenticado. Todos los campos son opcionales pero debe
 * enviarse al menos uno.
 *
 * **Campos bloqueados** (documento, tipoDocumento, actividadComercial,
 * categoria, correo, estado): no se declaran a propósito. El `ValidationPipe`
 * global usa `forbidNonWhitelisted`, así que si el comerciante los envía
 * recibe 400 con «la propiedad no debería existir». Su corrección corresponde
 * a un gestor municipal vía `PATCH /usuarios/:id/comerciante` (HU-04).
 */
export class ActualizarPerfilDto {
  /** Nombres del comerciante (datos personales). */
  @IsOptional()
  @IsNotEmpty({ message: 'El nombre no puede quedar vacío' })
  @Length(2, 150, {
    message: 'El nombre debe tener entre 2 y 150 caracteres',
  })
  nombre?: string;

  /** Apellidos del comerciante; `null` los limpia. */
  @IsOptional()
  @IsString({ message: 'Los apellidos deben ser texto' })
  @Length(2, 150, {
    message: 'Los apellidos deben tener entre 2 y 150 caracteres',
  })
  apellido?: string | null;

  /** Teléfono de contacto (misma validación que el registro). */
  @IsOptional()
  @Matches(/^[+0-9][0-9\s()-]{6,29}$/, {
    message: 'El teléfono no es válido',
  })
  telefono?: string;
}
