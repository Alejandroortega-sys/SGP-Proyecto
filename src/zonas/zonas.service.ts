import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { fijarActorAuditoria } from '../common/auditoria';
import {
  leerGeoJson,
  poligonoASql,
  sqlGeoJson,
  sqlGeoJsonSimplificado,
} from '../common/geo';
import { parseIdBigint } from '../common/parse-id';
import { Prisma, tipo_zona } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActualizarZonaDto,
  CambiarEstadoZonaDto,
  CrearZonaDto,
  ListarZonasGeoJsonQueryDto,
  ListarZonasQueryDto,
  ListarZonasResponseDto,
  ProductoPermitidoDto,
  ZonaDetalleDto,
  ZonaEstadoResponseDto,
  ZonaFeatureCollectionDto,
  ZonaListadoItemDto,
} from './dto/zonas.dto';
import { opcionesGeometriaZoom } from './geometria-zoom';

/** Columnas comunes del detalle de una zona. */
const CAMPOS_DETALLE = Prisma.sql`
  id,
  nombre,
  tipo,
  to_char(horario_inicio, 'HH24:MI') AS horario_inicio,
  to_char(horario_fin, 'HH24:MI') AS horario_fin,
  aforo_maximo,
  activa,
  creado_por,
  creado_en,
  actualizado_en,
  ${sqlGeoJson('geometria')} AS geometria
`;

interface FilaZonaDetalle {
  id: bigint | string;
  nombre: string;
  tipo: tipo_zona;
  horario_inicio: string | null;
  horario_fin: string | null;
  aforo_maximo: number | null;
  activa: boolean;
  creado_por: bigint | null;
  creado_en: Date;
  actualizado_en: Date;
  geometria: unknown;
}

interface FilaZonaListado {
  id: bigint | string;
  nombre: string;
  tipo: tipo_zona;
  horario_inicio: string | null;
  horario_fin: string | null;
  aforo_maximo: number | null;
  activa: boolean;
  total_espacios: number;
  total_modulos: number;
  creado_en: Date;
  actualizado_en: Date;
}

interface FilaZonaGeoJson {
  id: bigint | string;
  nombre: string;
  tipo: tipo_zona;
  horario_inicio: string | null;
  horario_fin: string | null;
  aforo_maximo: number | null;
  geometria: unknown;
  productos: string[];
}

interface FilaEstadoZona {
  id: bigint | string;
  nombre: string;
  activa: boolean;
  actualizado_en: Date;
}

/**
 * Zonas normativas del espacio público.
 *
 * - Los gestores (revisor y administrador) pueden consultar el listado y el
 *   detalle.
 * - Solo el administrador crea, edita y cambia el estado.
 * - La validación topológica y de solapes la hace `fn_validar_zona` en la BD;
 *   el servicio solo valida la estructura GeoJSON antes de escribir.
 * - Todas las escrituras fijan `app.actor_id` para que `fn_auditoria` registre
 *   al gestor responsable.
 */
@Injectable()
export class ZonasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista zonas con filtros y conteos de espacios/módulos.
   *
   * No selecciona la geometría. El conteo de módulos es espacial porque
   * `modulos` no tiene `zona_id`.
   */
  async listar(dto: ListarZonasQueryDto): Promise<ListarZonasResponseDto> {
    const pagina = dto.pagina ?? 1;
    const limite = dto.limite ?? 20;
    const offset = (pagina - 1) * limite;

    const condiciones: Prisma.Sql[] = [];
    if (dto.tipo !== undefined) {
      condiciones.push(Prisma.sql`z.tipo = ${dto.tipo}::tipo_zona`);
    }
    if (dto.activo !== undefined) {
      condiciones.push(Prisma.sql`z.activa = ${dto.activo}`);
    }
    const busqueda = dto.busqueda?.trim();
    if (busqueda) {
      condiciones.push(Prisma.sql`z.nombre ILIKE ${`%${busqueda}%`}`);
    }

    const where =
      condiciones.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(condiciones, ' AND ')}`
        : Prisma.empty;

    const [filas, totalFilas] = await Promise.all([
      this.prisma.$queryRaw<FilaZonaListado[]>`
        SELECT
          z.id,
          z.nombre,
          z.tipo,
          to_char(z.horario_inicio, 'HH24:MI') AS horario_inicio,
          to_char(z.horario_fin, 'HH24:MI') AS horario_fin,
          z.aforo_maximo,
          z.activa,
          (SELECT COUNT(*)
             FROM espacios_temporales e
            WHERE e.zona_id = z.id)::int AS total_espacios,
          (SELECT COUNT(*)
             FROM modulos m
            WHERE ST_Contains(z.geometria, m.ubicacion))::int AS total_modulos,
          z.creado_en,
          z.actualizado_en
        FROM zonas z
        ${where}
        ORDER BY z.nombre ASC, z.id ASC
        LIMIT ${limite} OFFSET ${offset}
      `,
      this.prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total FROM zonas z ${where}
      `,
    ]);

    const total = totalFilas[0]?.total ?? 0;

    return {
      datos: filas.map((fila) => this.aListado(fila)),
      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas: total === 0 ? 0 : Math.ceil(total / limite),
      },
    };
  }

  /**
   * Devuelve el detalle de una zona con geometría GeoJSON y productos.
   *
   * @throws NotFoundException si la zona no existe.
   */
  async detalle(id: string): Promise<ZonaDetalleDto> {
    const zonaId = parseIdBigint(id);
    const filas = await this.prisma.$queryRaw<FilaZonaDetalle[]>`
      SELECT ${CAMPOS_DETALLE}
      FROM zonas
      WHERE id = ${zonaId}
    `;
    const fila = filas[0];
    if (!fila) {
      throw new NotFoundException('La zona solicitada no existe');
    }
    const productos = await this.obtenerProductos(this.prisma, zonaId);
    return this.aDetalle(fila, productos);
  }

  /**
   * Crea una zona y sus productos permitidos en una sola transacción.
   */
  async crear(idGestor: string, dto: CrearZonaDto): Promise<ZonaDetalleDto> {
    const actorId = parseIdBigint(idGestor);
    this.validarHorarios(dto.horarioInicio, dto.horarioFin);
    const geometria = poligonoASql(dto.geometria);
    const productos = await this.resolverProductos(dto.productosPermitidos);

    return this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, actorId);

      const filas = await tx.$queryRaw<FilaZonaDetalle[]>`
        INSERT INTO zonas (
          nombre,
          tipo,
          geometria,
          horario_inicio,
          horario_fin,
          aforo_maximo,
          creado_por
        )
        VALUES (
          ${dto.nombre.trim()},
          ${dto.tipo}::tipo_zona,
          ${geometria},
          ${dto.horarioInicio ?? null}::time,
          ${dto.horarioFin ?? null}::time,
          ${dto.aforoMaximo ?? null},
          ${actorId}
        )
        RETURNING ${CAMPOS_DETALLE}
      `;

      const fila = filas[0];
      if (!fila) {
        throw new Error('La base de datos no devolvió la zona creada');
      }

      const zonaId = parseIdBigint(fila.id.toString());
      await this.reemplazarProductos(tx, zonaId, productos);
      return this.aDetalle(fila, productos);
    });
  }

  /**
   * Edita los campos enviados de una zona. Si se envía
   * `productosPermitidos`, reemplaza la lista completa.
   */
  async actualizar(
    id: string,
    idGestor: string,
    dto: ActualizarZonaDto,
  ): Promise<ZonaDetalleDto> {
    const zonaId = parseIdBigint(id);
    const actorId = parseIdBigint(idGestor);

    this.validarHorarios(dto.horarioInicio, dto.horarioFin);

    const hayCampos =
      dto.nombre !== undefined ||
      dto.tipo !== undefined ||
      dto.geometria !== undefined ||
      dto.horarioInicio !== undefined ||
      dto.horarioFin !== undefined ||
      dto.aforoMaximo !== undefined ||
      dto.productosPermitidos !== undefined;

    if (!hayCampos) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para actualizar la zona',
      );
    }

    const productos =
      dto.productosPermitidos !== undefined
        ? await this.resolverProductos(dto.productosPermitidos)
        : undefined;

    const campos: Prisma.Sql[] = [];
    if (dto.nombre !== undefined) {
      campos.push(Prisma.sql`nombre = ${dto.nombre.trim()}`);
    }
    if (dto.tipo !== undefined) {
      campos.push(Prisma.sql`tipo = ${dto.tipo}::tipo_zona`);
    }
    if (dto.geometria !== undefined) {
      campos.push(Prisma.sql`geometria = ${poligonoASql(dto.geometria)}`);
    }
    if (dto.horarioInicio !== undefined) {
      campos.push(Prisma.sql`horario_inicio = ${dto.horarioInicio}::time`);
    }
    if (dto.horarioFin !== undefined) {
      campos.push(Prisma.sql`horario_fin = ${dto.horarioFin}::time`);
    }
    if (dto.aforoMaximo !== undefined) {
      campos.push(Prisma.sql`aforo_maximo = ${dto.aforoMaximo}`);
    }

    return this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, actorId);

      let fila: FilaZonaDetalle | undefined;

      if (campos.length > 0) {
        const filas = await tx.$queryRaw<FilaZonaDetalle[]>`
          UPDATE zonas
          SET ${Prisma.join(campos, ', ')}
          WHERE id = ${zonaId}
          RETURNING ${CAMPOS_DETALLE}
        `;
        fila = filas[0];
      } else {
        const filas = await tx.$queryRaw<FilaZonaDetalle[]>`
          SELECT ${CAMPOS_DETALLE}
          FROM zonas
          WHERE id = ${zonaId}
        `;
        fila = filas[0];
      }

      if (!fila) {
        throw new NotFoundException('La zona solicitada no existe');
      }

      if (productos !== undefined) {
        await this.reemplazarProductos(tx, zonaId, productos);
      }

      const productosFinales =
        productos ?? (await this.obtenerProductos(tx, zonaId));

      return this.aDetalle(fila, productosFinales);
    });
  }

  /**
   * Activa o desactiva una zona. La operación es idempotente.
   */
  async cambiarEstado(
    id: string,
    idGestor: string,
    dto: CambiarEstadoZonaDto,
  ): Promise<ZonaEstadoResponseDto> {
    const zonaId = parseIdBigint(id);
    const actorId = parseIdBigint(idGestor);

    return this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, actorId);

      const filas = await tx.$queryRaw<FilaEstadoZona[]>`
        UPDATE zonas
        SET activa = ${dto.activa}
        WHERE id = ${zonaId}
        RETURNING id, nombre, activa, actualizado_en
      `;

      const fila = filas[0];
      if (!fila) {
        throw new NotFoundException('La zona solicitada no existe');
      }

      return {
        id: fila.id.toString(),
        nombre: fila.nombre,
        activa: fila.activa,
        actualizadoEn: fila.actualizado_en,
        mensaje: fila.activa ? 'Zona activada.' : 'Zona desactivada.',
      };
    });
  }

  /**
   * FeatureCollection público con las zonas activas.
   *
   * La geometría se genera con `ST_AsGeoJSON` y los nombres de productos se
   * agregan en la misma consulta para evitar N+1. Si se recibe `zoom`, el
   * polígono se simplifica con `ST_SimplifyPreserveTopology` para reducir el
   * peso de la respuesta en escalas alejadas.
   */
  async geojson(
    dto: ListarZonasGeoJsonQueryDto = {},
  ): Promise<ZonaFeatureCollectionDto> {
    const geometria = sqlGeoJsonSimplificado(
      'geometria',
      opcionesGeometriaZoom(dto.zoom),
    );

    const filas = await this.prisma.$queryRaw<FilaZonaGeoJson[]>`
      SELECT
        z.id,
        z.nombre,
        z.tipo,
        to_char(z.horario_inicio, 'HH24:MI') AS horario_inicio,
        to_char(z.horario_fin, 'HH24:MI') AS horario_fin,
        z.aforo_maximo,
        ${geometria} AS geometria,
        COALESCE(
          (SELECT jsonb_agg(p.nombre ORDER BY p.nombre)
             FROM zona_productos zp
             JOIN productos p ON p.id = zp.producto_id
            WHERE zp.zona_id = z.id
              AND p.activo = true),
          '[]'::jsonb
        ) AS productos
      FROM zonas z
      WHERE z.activa = true
      ORDER BY z.nombre ASC, z.id ASC
    `;

    return {
      type: 'FeatureCollection',
      features: filas.map((fila) => {
        const geometria = leerGeoJson(fila.geometria, 'Polygon');
        if (!geometria || geometria.type !== 'Polygon') {
          throw new Error(
            `La zona ${fila.id.toString()} no tiene un polígono válido`,
          );
        }

        return {
          type: 'Feature',
          geometry: geometria,
          properties: {
            id: fila.id.toString(),
            nombre: fila.nombre,
            tipo: fila.tipo,
            horarios: {
              inicio: fila.horario_inicio,
              fin: fila.horario_fin,
            },
            aforo: fila.aforo_maximo,
            productos: fila.productos,
          },
        };
      }),
    };
  }

  /** Valida que los horarios vengan juntos y en orden. */
  private validarHorarios(inicio?: string | null, fin?: string | null): void {
    const inicioDefinido = inicio !== undefined;
    const finDefinido = fin !== undefined;

    if (inicioDefinido !== finDefinido) {
      throw new BadRequestException(
        'Los horarios de inicio y fin deben enviarse juntos',
      );
    }
    if (!inicioDefinido) {
      return;
    }

    const inicioNulo = inicio === null;
    const finNulo = fin === null;
    if (inicioNulo !== finNulo) {
      throw new BadRequestException(
        'Los horarios de inicio y fin deben ser ambos nulos o ambos textos',
      );
    }
    if (inicio === null || inicio === undefined) {
      return;
    }
    if (fin === null || fin === undefined) {
      return;
    }
    if (fin <= inicio) {
      throw new BadRequestException(
        'El horario de fin debe ser posterior al horario de inicio',
      );
    }
  }

  /** Resuelve y valida los productos permitidos. */
  private async resolverProductos(
    ids?: string[] | null,
  ): Promise<ProductoPermitidoDto[]> {
    if (!ids || ids.length === 0) {
      return [];
    }

    const unicos = [...new Set(ids)];
    const productos = await this.prisma.productos.findMany({
      where: { id: { in: unicos.map((id) => parseIdBigint(id)) } },
      select: { id: true, nombre: true, activo: true },
      orderBy: { nombre: 'asc' },
    });

    if (productos.length !== unicos.length) {
      throw new BadRequestException(
        'Uno o más productos permitidos no existen en el catálogo',
      );
    }

    const inactivo = productos.find((producto) => !producto.activo);
    if (inactivo) {
      throw new BadRequestException(
        `El producto "${inactivo.nombre}" está inactivo y no puede asignarse a una zona`,
      );
    }

    return productos.map((producto) => ({
      id: producto.id.toString(),
      nombre: producto.nombre,
      activo: producto.activo,
    }));
  }

  /** Reemplaza las asociaciones de productos de una zona. */
  private async reemplazarProductos(
    tx: Prisma.TransactionClient,
    zonaId: bigint,
    productos: ProductoPermitidoDto[],
  ): Promise<void> {
    await tx.zona_productos.deleteMany({ where: { zona_id: zonaId } });
    if (productos.length === 0) {
      return;
    }

    await tx.zona_productos.createMany({
      data: productos.map((producto) => ({
        zona_id: zonaId,
        producto_id: BigInt(producto.id),
      })),
    });
  }

  /** Consulta los productos permitidos de una zona. */
  private async obtenerProductos(
    prisma: Prisma.TransactionClient,
    zonaId: bigint,
  ): Promise<ProductoPermitidoDto[]> {
    const filas = await prisma.zona_productos.findMany({
      where: { zona_id: zonaId },
      select: {
        productos: { select: { id: true, nombre: true, activo: true } },
      },
    });

    return filas
      .map((fila) => ({
        id: fila.productos.id.toString(),
        nombre: fila.productos.nombre,
        activo: fila.productos.activo,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  /** Convierte una fila del listado al DTO. */
  private aListado(fila: FilaZonaListado): ZonaListadoItemDto {
    return {
      id: fila.id.toString(),
      nombre: fila.nombre,
      tipo: fila.tipo,
      horarioInicio: fila.horario_inicio,
      horarioFin: fila.horario_fin,
      aforoMaximo: fila.aforo_maximo,
      activa: fila.activa,
      totalEspacios: fila.total_espacios,
      totalModulos: fila.total_modulos,
      creadoEn: fila.creado_en,
      actualizadoEn: fila.actualizado_en,
    };
  }

  /** Convierte una fila de detalle al DTO, normalizando la geometría. */
  private aDetalle(
    fila: FilaZonaDetalle,
    productos: ProductoPermitidoDto[],
  ): ZonaDetalleDto {
    const geometria = leerGeoJson(fila.geometria, 'Polygon');
    if (!geometria || geometria.type !== 'Polygon') {
      throw new Error(
        `La zona ${fila.id.toString()} no tiene un polígono válido`,
      );
    }

    return {
      id: fila.id.toString(),
      nombre: fila.nombre,
      tipo: fila.tipo,
      horarioInicio: fila.horario_inicio,
      horarioFin: fila.horario_fin,
      aforoMaximo: fila.aforo_maximo,
      activa: fila.activa,
      creadoPor: fila.creado_por?.toString() ?? null,
      creadoEn: fila.creado_en,
      actualizadoEn: fila.actualizado_en,
      geometria,
      productosPermitidos: productos,
    };
  }
}
