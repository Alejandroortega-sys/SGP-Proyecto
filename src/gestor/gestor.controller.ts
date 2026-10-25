import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PerfilGestor } from '../auth/decorators/perfil-gestor.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { parseIdBigint } from '../common/parse-id';
import {
  CambiarEstadoUsuarioDto,
  UsuarioEstadoActualizadoDto,
} from './dto/cambiar-estado-usuario.dto';
import { CrearGestorDto, GestorCreadoDto } from './dto/crear-gestor.dto';
import { ListarComerciantesQueryDto } from './dto/listar-comerciantes-query.dto';
import { ListarComerciantesResponseDto } from './dto/listar-comerciantes-response.dto';
import { ListarUsuariosQueryDto } from './dto/listar-usuarios-query.dto';
import { ListarUsuariosResponseDto } from './dto/listar-usuarios-response.dto';
import { UsuarioDetalleResponseDto } from './dto/usuario-detalle-response.dto';
import { GestorService } from './gestor.service';

/**
 * Administración de cuentas desde el panel del gestor municipal.
 *
 * El gestor inicia sesión con `POST /auth/login` (JWT de 30 minutos) y usa
 * estos endpoints para consultar cuentas, revisar detalles y, si su perfil
 * es `administrador`, crear gestores y activar, suspender o inactivar
 * cuentas.
 *
 * Los guards son globales: `JwtAuthGuard` valida el token y recarga el
 * usuario, `RolesGuard` aplica el `@Roles('gestor')` de la clase y
 * `PerfilGestorGuard` aplica `@PerfilGestor('administrador')` en los
 * endpoints exclusivos del administrador.
 */
@ApiTags('gestor')
@ApiBearerAuth()
@Roles('gestor')
@Controller('gestor')
export class GestorController {
  constructor(private readonly gestor: GestorService) {}

  /**
   * Crea un gestor con perfil revisor o administrador. Solo administrador.
   */
  @ApiOperation({
    summary: 'Crear un gestor (administrador)',
    description:
      'Acceso exclusivo de gestores con perfil «administrador». Crea una ' +
      'cuenta con rol gestor y el perfil indicado. La cuenta nace en ' +
      '«pendiente_activacion», recibe una contraseña temporal por correo y ' +
      'debe cambiarla en su primer inicio de sesión antes de poder usar la ' +
      'plataforma. La creación queda registrada en la auditoría con el ' +
      'administrador como actor.',
  })
  @ApiCreatedResponse({
    type: GestorCreadoDto,
    description: 'Cuenta de gestor creada y credenciales temporales enviadas',
  })
  @ApiBadRequestResponse({
    description: 'Los datos enviados no cumplen las validaciones del DTO',
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({
    description: 'El rol no es gestor o el perfil no es administrador',
  })
  @ApiConflictResponse({
    description: 'El correo ya está registrado en otra cuenta',
  })
  @ApiServiceUnavailableResponse({
    description:
      'La cuenta fue creada, pero no se pudo enviar el correo con la ' +
      'contraseña temporal',
  })
  @PerfilGestor('administrador')
  @Post('gestores')
  crearGestor(
    @Body() dto: CrearGestorDto,
    @UsuarioActual() gestor: UsuarioAutenticado,
  ): Promise<GestorCreadoDto> {
    return this.gestor.crearGestor(dto, parseIdBigint(gestor.id));
  }

  /**
   * Lista todas las cuentas. El administrador ve cualquier rol; el revisor
   * solo comerciantes y organizadores.
   */
  @ApiOperation({
    summary: 'Listar cuentas con búsqueda, filtros y paginación',
    description:
      'El administrador puede listar cualquier cuenta y filtrar por rol, ' +
      'estado y perfil de gestor. El revisor solo puede consultar y filtrar ' +
      'comerciantes y organizadores; si intenta pedir otro rol o un perfil ' +
      'de gestor recibe 403. La búsqueda cubre nombre, apellido, correo, ' +
      'documento, actividad comercial y nombre de la organización.',
  })
  @ApiOkResponse({
    type: ListarUsuariosResponseDto,
    description: 'Página de cuentas que cumplen los filtros',
  })
  @ApiBadRequestResponse({
    description:
      'Algún parámetro de búsqueda, filtro o paginación no es válido',
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({
    description:
      'El rol no es gestor o el revisor intentó consultar un rol no permitido',
  })
  @Get('usuarios')
  listarUsuarios(
    @Query() dto: ListarUsuariosQueryDto,
    @UsuarioActual() gestor: UsuarioAutenticado,
  ): Promise<ListarUsuariosResponseDto> {
    return this.gestor.listarUsuarios(dto, gestor.perfil);
  }

  /**
   * Lista los comerciantes con su estado, datos de contacto y conteo de
   * solicitudes y permisos.
   */
  @ApiOperation({
    summary: 'Listar comerciantes con búsqueda, filtros y paginación',
    description:
      'Acceso para gestores con perfil revisor o administrador. Busca por ' +
      'nombre, apellido, correo, documento o actividad comercial (cada ' +
      'palabra debe aparecer en alguno de esos campos), filtra por estado de ' +
      'la cuenta y categoría del comercio, y pagina los resultados con ' +
      '`pagina` y `limite` (máximo 100).',
  })
  @ApiOkResponse({
    type: ListarComerciantesResponseDto,
    description: 'Página de comerciantes que cumplen los filtros',
  })
  @ApiBadRequestResponse({
    description:
      'Algún parámetro de búsqueda, filtro o paginación no es válido',
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({
    description: 'El rol del usuario no es gestor',
  })
  @Get('comerciantes')
  listarComerciantes(
    @Query() dto: ListarComerciantesQueryDto,
  ): Promise<ListarComerciantesResponseDto> {
    return this.gestor.listarComerciantes(dto);
  }

  /**
   * Devuelve el detalle de una cuenta con sus solicitudes y permisos
   * registrados en la base de datos.
   */
  @ApiOperation({
    summary: 'Ver el detalle de un usuario con sus solicitudes y permisos',
    description:
      'El administrador puede consultar cualquier cuenta. El revisor solo ' +
      'puede consultar comerciantes y organizadores. Devuelve los datos de ' +
      'la cuenta, su perfil según el rol, todas sus solicitudes y todos sus ' +
      'permisos ordenados del más reciente al más antiguo, junto con los ' +
      'totales. No expone el hash de la contraseña ni el token QR.',
  })
  @ApiOkResponse({
    type: UsuarioDetalleResponseDto,
    description: 'Detalle de la cuenta con sus solicitudes y permisos',
  })
  @ApiBadRequestResponse({
    description: 'El identificador no es un número válido',
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({
    description:
      'El rol no es gestor o el revisor intentó consultar una cuenta de gestor',
  })
  @ApiNotFoundResponse({
    description: 'La cuenta solicitada no existe',
  })
  @Get('usuarios/:id')
  obtenerUsuario(
    @Param('id') id: string,
    @UsuarioActual() gestor: UsuarioAutenticado,
  ): Promise<UsuarioDetalleResponseDto> {
    return this.gestor.obtenerUsuario(parseIdBigint(id), gestor.perfil);
  }

  /**
   * Activa, suspende o inactiva una cuenta. Solo administrador.
   */
  @ApiOperation({
    summary: 'Activar, suspender o inactivar una cuenta (administrador)',
    description:
      'Acceso exclusivo de gestores con perfil «administrador». Cambia el ' +
      'estado de cualquier cuenta a `activa`, `suspendida` o `inactiva`. El ' +
      'administrador no puede cambiar el estado de su propia cuenta. Para ' +
      'desactivar a otro administrador deben existir al menos dos ' +
      'administradores activos. Los gestores en «pendiente_activacion» ' +
      'deben completar el cambio de contraseña antes de que se les modifique ' +
      'el estado. Al activar se limpian el bloqueo y los intentos fallidos ' +
      'del login. El cambio se ejecuta en una transacción y queda registrado ' +
      'en `auditoria` con el gestor como actor (trigger `fn_auditoria`).',
  })
  @ApiOkResponse({
    type: UsuarioEstadoActualizadoDto,
    description: 'Estado actualizado y cambio auditado',
  })
  @ApiBadRequestResponse({
    description:
      'El identificador no es numérico o el estado solicitado no es válido',
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({
    description:
      'El rol no es gestor, el perfil no es administrador o se intentó ' +
      'cambiar la propia cuenta',
  })
  @ApiNotFoundResponse({
    description: 'La cuenta solicitada no existe',
  })
  @ApiConflictResponse({
    description:
      'La cuenta ya está en ese estado, el gestor no completó el primer ' +
      'acceso o se intenta dejar el sistema sin administradores activos',
  })
  @PerfilGestor('administrador')
  @Patch('usuarios/:id/estado')
  cambiarEstado(
    @Param('id') id: string,
    @Body() dto: CambiarEstadoUsuarioDto,
    @UsuarioActual() gestor: UsuarioAutenticado,
  ): Promise<UsuarioEstadoActualizadoDto> {
    return this.gestor.cambiarEstado(
      parseIdBigint(id),
      dto,
      parseIdBigint(gestor.id),
    );
  }
}
