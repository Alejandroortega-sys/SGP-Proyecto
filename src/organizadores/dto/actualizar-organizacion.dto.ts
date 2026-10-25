import { PartialType } from '@nestjs/swagger';
import { CrearOrganizacionDto } from './crear-organizacion.dto';

/**
 * Cuerpo de `PATCH /organizadores/mi-organizacion`.
 *
 * Todos los campos son opcionales, pero debe enviarse al menos uno. El estado,
 * el validador y la fecha de validación no se pueden modificar desde aquí.
 */
export class ActualizarOrganizacionDto extends PartialType(
  CrearOrganizacionDto,
) {}
