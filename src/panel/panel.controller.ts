import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { GestorPanelDto, PanelResponseDto } from './dto/panel-response.dto';
import { PanelService } from './panel.service';

/**
 * Panel administrativo del gestor municipal.
 *
 * Punto de entrada exclusivo para el rol «gestor» (HU-03/HU-06): tras
 * iniciar sesión en `POST /auth/login`, el gestor recibe un JWT con vigencia
 * de 30 minutos y accede a este panel para consultar el estado general de la
 * plataforma. El resto de roles recibe 403 y una petición sin token, 401.
 *
 * Los guards no se declaran aquí porque son globales: `JwtAuthGuard` valida
 * el token y `RolesGuard` aplica el `@Roles('gestor')` de la clase.
 */
@ApiTags('panel')
@ApiBearerAuth()
@Roles('gestor')
@Controller('panel')
export class PanelController {
  constructor(private readonly panel: PanelService) {}

  /**
   * Devuelve los datos del gestor autenticado y un resumen de indicadores
   * de la plataforma: usuarios por estado y rol, solicitudes por estado del
   * trámite, permisos digitales y calendario de ferias.
   */
  @ApiOperation({
    summary: 'Resumen del panel administrativo',
    description:
      'Acceso exclusivo del rol «gestor». Devuelve los datos del gestor ' +
      'autenticado (perfil revisor o administrador) junto con los conteos ' +
      'de usuarios por estado y rol, solicitudes por estado del trámite, ' +
      'permisos digitales por vigencia y ferias del calendario.',
  })
  @ApiOkResponse({
    type: PanelResponseDto,
    description: 'Resumen del panel para el gestor autenticado',
  })
  @ApiUnauthorizedResponse({
    description:
      'Falta el token de acceso o es inválido/expirado (el del gestor vence a los 30 minutos)',
  })
  @ApiForbiddenResponse({
    description:
      'El rol del usuario (comerciante u organizador) no tiene permiso ' +
      'para el panel administrativo',
  })
  @Get()
  async resumen(
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<PanelResponseDto> {
    const gestor: GestorPanelDto = {
      id: usuario.id,
      nombre: usuario.nombre,
      ...(usuario.apellido ? { apellido: usuario.apellido } : {}),
      correo: usuario.correo,
      perfil: usuario.perfil ?? 'revisor',
    };

    return { gestor, indicadores: await this.panel.resumen() };
  }
}
