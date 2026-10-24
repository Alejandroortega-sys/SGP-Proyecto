import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validador de coincidencia entre dos campos del mismo DTO.
 *
 * Se usa para la confirmación de contraseña: `confirmarPassword` debe ser
 * idéntico a `password`. La validación ocurre en el `ValidationPipe` global,
 * por lo que una no coincidencia responde 400 automáticamente.
 */
@ValidatorConstraint({ name: 'coincideCon', async: false })
class CoincideConValidador implements ValidatorConstraintInterface {
  validate(valor: unknown, args: ValidationArguments): boolean {
    const [propiedadRelacionada] = args.constraints as [string];
    const relacionado = (args.object as Record<string, unknown>)[propiedadRelacionada];
    return valor === relacionado;
  }

  defaultMessage(args: ValidationArguments): string {
    const [propiedadRelacionada] = args.constraints as [string];
    return `El campo "${args.property}" no coincide con "${propiedadRelacionada}"`;
  }
}

/**
 * Compara la propiedad decorada con otra propiedad del mismo objeto.
 *
 * @param propiedad Nombre de la propiedad contra la que se compara.
 * @param opciones Mensaje y opciones estándar de class-validator.
 */
export function CoincideCon(
  propiedad: string,
  opciones?: ValidationOptions,
): PropertyDecorator {
  return (objetivo: object, nombrePropiedad: string | symbol) => {
    registerDecorator({
      name: 'coincideCon',
      target: objetivo.constructor,
      propertyName: String(nombrePropiedad),
      constraints: [propiedad],
      options: opciones,
      validator: CoincideConValidador,
    });
  };
}
