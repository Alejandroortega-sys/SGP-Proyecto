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
import {
  HistorialZonaQueryDto,
  ZonaHistorialResponseDto,
  ZonaVersionItemDto,
} from './dto/historial.dto';
import {
  ACCIONES_VERSION_ZONA,
  calcularCambiosZona,
  parsearProductosVersion,
  type AccionVersionZona,
  type SnapshotZona,
} from './historial';
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

interface FilaResumenHistorialZona {
  id: bigint | string;
  nombre: string;
  activa: boolean;
}

interface FilaVersionZona {
  id: bigint | string;
  version: number;
  accion: string;
  nombre: string;
  tipo: tipo_zona;
  horario_inicio: string | null;
  horario_fin: string | null;
  aforo_maximo: number | null;
  activa: boolean;
  geometria: unknown;
  productos: unknown;
  vertices: number;
  area_m2: number | string | null;
  actor_id: bigint | string | null;
  actor_nombre: string | null;
  actor_apellido: string | null;
  actor_correo: string | null;
  creado_en: Date;
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
      await this.registrarVersion(tx, zonaId, actorId, 'creacion');
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
        // Solo cambiaron los productos: se toca la zona para que el trigger
        // actualice `actualizado_en` y la versión tenga una fecha coherente.
        const filas = await tx.$queryRaw<FilaZonaDetalle[]>`
          UPDATE zonas
          SET actualizado_en = now()
          WHERE id = ${zonaId}
          RETURNING ${CAMPOS_DETALLE}
        `;
        fila = filas[0];
      }

      if (!fila) {
        throw new NotFoundException('La zona solicitada no existe');
      }

      if (productos !== undefined) {
        await this.reemplazarProductos(tx, zonaId, productos);
      }

      await this.registrarVersion(tx, zonaId, actorId, 'edicion');

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

      const actuales = await tx.$queryRaw<FilaEstadoZona[]>`
        SELECT id, nombre, activa, actualizado_en
        FROM zonas
        WHERE id = ${zonaId}
        FOR UPDATE
      `;
      const actual = actuales[0];
      if (!actual) {
        throw new NotFoundException('La zona solicitada no existe');
      }

      // Idempotencia real: si el estado no cambia, no se crea una versión ni
      // se registra un cambio de auditoría inexistente.
      if (actual.activa === dto.activa) {
        return {
          id: actual.id.toString(),
          nombre: actual.nombre,
          activa: actual.activa,
          actualizadoEn: actual.actualizado_en,
          mensaje: actual.activa ? 'Zona activada.' : 'Zona desactivada.',
        };
      }

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

      await this.registrarVersion(
        tx,
        zonaId,
        actorId,
        fila.activa ? 'activacion' : 'desactivacion',
      );

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
   * Historial paginado de versiones de una zona.
   *
   * Cada versión es un snapshot completo (geometría, clasificación,
   * restricciones, productos, estado y actor). Los cambios se calculan
   * comparando con la versión inmediatamente anterior; por eso se consulta una
   * fila extra fuera de la página.
   */
  async historial(
    id: string,
    dto: HistorialZonaQueryDto = {},
  ): Promise<ZonaHistorialResponseDto> {
    const zonaId = parseIdBigint(id);
    const pagina = dto.pagina ?? 1;
    const limite = dto.limite ?? 20;
    const offset = (pagina - 1) * limite;
    const siguiente = limite + 1;

    const [zonas, filas, totalFilas] = await Promise.all([
      this.prisma.$queryRaw<FilaResumenHistorialZona[]>`
        SELECT id, nombre, activa
        FROM zonas
        WHERE id = ${zonaId}
      `,
      this.prisma.$queryRaw<FilaVersionZona[]>`
        SELECT
          v.id,
          v.version,
          v.accion,
          v.nombre,
          v.tipo,
          to_char(v.horario_inicio, 'HH24:MI') AS horario_inicio,
          to_char(v.horario_fin, 'HH24:MI') AS horario_fin,
          v.aforo_maximo,
          v.activa,
          ST_AsGeoJSON(v.geometria)::jsonb AS geometria,
          v.productos,
          ST_NPoints(v.geometria)::int AS vertices,
          ST_Area(v.geometria::geography)::float8 AS area_m2,
          v.actor_id,
          u.nombre AS actor_nombre,
          u.apellido AS actor_apellido,
          u.correo AS actor_correo,
          v.creado_en
        FROM zona_versiones v
        LEFT JOIN usuarios u ON u.id = v.actor_id
        WHERE v.zona_id = ${zonaId}
        ORDER BY v.version DESC
        LIMIT ${siguiente} OFFSET ${offset}
      `,
      this.prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total
        FROM zona_versiones
        WHERE zona_id = ${zonaId}
      `,
    ]);

    const zona = zonas[0];
    if (!zona) {
      throw new NotFoundException('La zona solicitada no existe');
    }

    const total = totalFilas[0]?.total ?? 0;
    const datos: ZonaVersionItemDto[] = filas
      .slice(0, limite)
      .map((fila, indice) => {
        const actual = this.aSnapshotVersion(fila);
        const filaAnterior = filas[indice + 1];
        const anterior = filaAnterior
          ? this.aSnapshotVersion(filaAnterior)
          : null;
        return this.aVersionZona(fila, actual, anterior);
      });

    return {
      zona: {
        id: zona.id.toString(),
        nombre: zona.nombre,
        activa: zona.activa,
      },
      datos,
      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas: total === 0 ? 0 : Math.ceil(total / limite),
      },
    };
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

  /** Registra una versión inmutable dentro de la transacción del cambio. */
  private async registrarVersion(
    tx: Prisma.TransactionClient,
    zonaId: bigint,
    actorId: bigint,
    accion: AccionVersionZona,
  ): Promise<void> {
    await tx.$queryRaw`
      SELECT fn_registrar_version_zona(${zonaId}, ${accion}, ${actorId})
    `;
  }

  /** Convierte una fila de `zona_versiones` en un snapshot tipado. */
  private aSnapshotVersion(fila: FilaVersionZona): SnapshotZona {
    const geometria = leerGeoJson(fila.geometria, 'Polygon');
    if (!geometria || geometria.type !== 'Polygon') {
      throw new Error(
        `La versión ${fila.version} de la zona ${fila.id.toString()} no tiene un polígono válido`,
      );
    }

    return {
      version: fila.version,
      accion: this.aAccionVersion(fila.accion),
      nombre: fila.nombre,
      tipo: fila.tipo,
      horarioInicio: fila.horario_inicio,
      horarioFin: fila.horario_fin,
      aforoMaximo: fila.aforo_maximo,
      activa: fila.activa,
      geometria,
      productosPermitidos: parsearProductosVersion(fila.productos),
      resumenGeometria: {
        vertices: fila.vertices,
        areaM2:
          fila.area_m2 === null || fila.area_m2 === undefined
            ? null
            : Number(fila.area_m2),
      },
    };
  }

  /** Convierte una fila y su versión anterior al DTO del historial. */
  private aVersionZona(
    fila: FilaVersionZona,
    actual: SnapshotZona,
    anterior: SnapshotZona | null,
  ): ZonaVersionItemDto {
    return {
      version: actual.version,
      accion: actual.accion,
      creadoEn: fila.creado_en,
      actor:
        fila.actor_id === null
          ? null
          : {
              id: fila.actor_id.toString(),
              nombre: fila.actor_nombre ?? 'Gestor',
              apellido: fila.actor_apellido,
              correo: fila.actor_correo ?? '',
            },
      cambios: calcularCambiosZona(anterior, actual),
      estado: {
        nombre: actual.nombre,
        tipo: actual.tipo,
        horarioInicio: actual.horarioInicio,
        horarioFin: actual.horarioFin,
        aforoMaximo: actual.aforoMaximo,
        activa: actual.activa,
        geometria: actual.geometria,
        productosPermitidos: actual.productosPermitidos,
        resumenGeometria: actual.resumenGeometria,
      },
    };
  }

  /** Valida y normaliza la acción almacenada en una versión. */
  private aAccionVersion(valor: string): AccionVersionZona {
    if (ACCIONES_VERSION_ZONA.includes(valor as AccionVersionZona)) {
      return valor as AccionVersionZona;
    }
    throw new Error(`Acción de versión de zona desconocida: ${valor}`);
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
