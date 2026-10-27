import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parseIdBigint } from '../common/parse-id';
import { Prisma, rol_usuario } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CambiarEstadoProductoDto,
  CrearProductoDto,
  ListarProductosResponseDto,
  ProductoResponseDto,
} from './dto/productos.dto';

/** Columnas del producto que se exponen al frontend. */
const SELECT_PRODUCTO = {
  id: true,
  nombre: true,
  activo: true,
} satisfies Prisma.productosSelect;

type FilaProducto = Prisma.productosGetPayload<{
  select: typeof SELECT_PRODUCTO;
}>;

/**
 * Catálogo maestro de productos del espacio público.
 *
 * - Los gestores ven todos los productos para poder administrarlos.
 * - Comerciantes y organizadores solo ven los activos, que son los únicos
 *   que pueden usarse en solicitudes y ferias.
 *
 * La tabla `productos` no tiene trigger de auditoría; las reglas de unicidad
 * las garantiza la base de datos (`productos_nombre_key`) y el filtro global
 * las traduce a `409`.
 */
@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista los productos visibles según el rol del usuario autenticado.
   *
   * @param rol Rol recargado de la BD por `JwtAuthGuard`.
   */
  async listar(rol: rol_usuario): Promise<ListarProductosResponseDto> {
    const filas = await this.prisma.productos.findMany({
      where: rol === 'gestor' ? {} : { activo: true },
      orderBy: { nombre: 'asc' },
      select: SELECT_PRODUCTO,
    });

    return { datos: filas.map((fila) => this.mapear(fila)) };
  }

  /**
   * Crea un producto activo.
   *
   * @throws ConflictException si ya existe un producto con el mismo nombre.
   */
  async crear(dto: CrearProductoDto): Promise<ProductoResponseDto> {
    const nombre = dto.nombre.trim();

    const existente = await this.prisma.productos.findUnique({
      where: { nombre },
      select: { id: true },
    });
    if (existente) {
      throw new ConflictException('Ya existe un producto con ese nombre');
    }

    const creado = await this.prisma.productos.create({
      data: { nombre },
      select: SELECT_PRODUCTO,
    });

    return this.mapear(creado);
  }

  /**
   * Activa o desactiva un producto.
   *
   * @throws NotFoundException si el producto no existe.
   */
  async cambiarEstado(
    id: string,
    dto: CambiarEstadoProductoDto,
  ): Promise<ProductoResponseDto> {
    const productoId = parseIdBigint(id);

    const existente = await this.prisma.productos.findUnique({
      where: { id: productoId },
      select: { id: true },
    });
    if (!existente) {
      throw new NotFoundException('El producto solicitado no existe');
    }

    const actualizado = await this.prisma.productos.update({
      where: { id: productoId },
      data: { activo: dto.activo },
      select: SELECT_PRODUCTO,
    });

    return this.mapear(actualizado);
  }

  /** Convierte la fila de Prisma al DTO de respuesta. */
  private mapear(fila: FilaProducto): ProductoResponseDto {
    return {
      id: fila.id.toString(),
      nombre: fila.nombre,
      activo: fila.activo,
    };
  }
}
