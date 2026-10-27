import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
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
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import {
  CambiarEstadoProductoDto,
  CrearProductoDto,
  ListarProductosResponseDto,
  ProductoResponseDto,
} from './dto/productos.dto';
import { ProductosService } from './productos.service';

/**
 * Catálogo de productos del espacio público.
 *
 * Cualquier usuario autenticado puede consultar el catálogo. Los gestores
 * ven también los productos inactivos para administrarlos; comerciantes y
 * organizadores solo ven los activos. Crear y cambiar el estado es exclusivo
 * de los gestores (`revisor` y `administrador`).
 *
 * Los guards son globales (`JwtAuthGuard` y `RolesGuard` en `AppModule`).
 */
@ApiTags('productos')
@ApiBearerAuth()
@Controller('productos')
export class ProductosController {
  constructor(private readonly productos: ProductosService) {}

  /**
   * Lista los productos visibles para el usuario autenticado.
   */
  @ApiOperation({
    summary: 'Listar productos',
    description:
      'Devuelve el catálogo de productos activos para comerciantes y ' +
      'organizadores. Los gestores reciben también los productos inactivos ' +
      'para poder administrarlos. El resultado se ordena alfabéticamente por ' +
      'nombre.',
  })
  @ApiOkResponse({ type: ListarProductosResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @Get()
  listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<ListarProductosResponseDto> {
    return this.productos.listar(usuario.rol);
  }

  /**
   * Crea un producto del catálogo.
   */
  @ApiOperation({
    summary: 'Crear producto',
    description:
      'Crea un producto activo. Solo los gestores (revisor y administrador) ' +
      'pueden usar este endpoint. El nombre debe ser único.',
  })
  @ApiCreatedResponse({ type: ProductoResponseDto })
  @ApiBadRequestResponse({ description: 'El nombre no cumple las reglas' })
  @ApiConflictResponse({
    description: 'Ya existe un producto con ese nombre',
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({ description: 'El rol del usuario no es gestor' })
  @Roles('gestor')
  @Post()
  crear(@Body() dto: CrearProductoDto): Promise<ProductoResponseDto> {
    return this.productos.crear(dto);
  }

  /**
   * Activa o desactiva un producto.
   */
  @ApiOperation({
    summary: 'Activar o desactivar un producto',
    description:
      'Cambia el estado lógico del producto. Solo los gestores (revisor y ' +
      'administrador) pueden usar este endpoint. No elimina el producto.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador del producto',
    example: '1',
  })
  @ApiOkResponse({ type: ProductoResponseDto })
  @ApiBadRequestResponse({
    description: 'Identificador o cuerpo inválidos',
  })
  @ApiNotFoundResponse({ description: 'El producto no existe' })
  @ApiUnauthorizedResponse({
    description: 'Falta el token de acceso o es inválido/expirado',
  })
  @ApiForbiddenResponse({ description: 'El rol del usuario no es gestor' })
  @Roles('gestor')
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  cambiarEstado(
    @Param('id') id: string,
    @Body() dto: CambiarEstadoProductoDto,
  ): Promise<ProductoResponseDto> {
    return this.productos.cambiarEstado(id, dto);
  }
}
