import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { fijarActorAuditoria } from '../common/auditoria';
import {
  leerGeoJson,
  puntoASql,
  validarPunto,
  type GeoJsonPoint,
} from '../common/geo';
import { parseIdBigint } from '../common/parse-id';
import {
  Prisma,
  type categoria_comercio,
  type estado_modulo,
  type tipo_zona,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  calcularAdvertenciasZona,
  exigeConfirmacion,
} from './advertencias';
import {
  ActualizarModuloDto,
  AdvertenciaModuloDto,
  CambiarEstadoModuloDto,
  CATEGORIAS_MODULO,
  CrearModuloDto,
  ListarModulosQueryDto,
  ListarModulosResponseDto,
  ModuloDetalleDto,
  ModuloEstadoResponseDto,
  ModuloHistorialItemDto,
  ModuloHistorialQueryDto,
  ModuloHistorialResponseDto,
  ModuloListadoDto,
  OpcionesModulosResponseDto,
  SECTOR_SIN_ZONA,
  ZonaContenedoraDto,
  ZonaContenedoraResponseDto,
} from './dto/modulos.dto';
import {
  calcularCambiosModulo,
  normalizarAccionAuditoria,
  parsearRegistroAuditoria,
} from './historial';
import {
  eliminarFoto,
  guardarFoto,
  validarFoto,
  type ArchivoFoto,
} from './foto';

/** Columnas comunes del listado y la ficha de un módulo. */
const CAMPOS_MODULO = Prisma.sql`
  m.id,
  m.codigo,
  m.categoria,
  m.titular_id,
  m.titular_nombre,
  m.actividad,
  m.foto_url,
  m.estado,
  m.registrado_por AS registrado_por_id,
  m.creado_en,
  ST_AsGeoJSON(m.ubicacion)::jsonb AS ubicacion,
  tu.nombre AS titular_usuario_nombre,
  tu.apellido AS titular_usuario_apellido,
  tu.correo AS titular_usuario_correo,
  rp.nombre AS registrado_por_nombre,
  rp.apellido AS registrado_por_apellido,
  rp.correo AS registrado_por_correo,
  zona.id AS zona_id,
  zona.nombre AS zona_nombre,
  zona.tipo AS zona_tipo,
  to_char(zona.horario_inicio, 'HH24:MI') AS zona_horario_inicio,
  to_char(zona.horario_fin, 'HH24:MI') AS zona_horario_fin,
  zona.aforo_maximo AS zona_aforo_maximo,
  COALESCE(
    (
      SELECT jsonb_agg(p.nombre ORDER BY p.nombre)
        FROM zona_productos zp
        JOIN productos p ON p.id = zp.producto_id
       WHERE zp.zona_id = zona.id
         AND p.activo = true
    ),
    '[]'::jsonb
  ) AS zona_productos
`;

/** FROM común con la zona activa que contiene el punto. */
const FROM_MODULO = Prisma.sql`
  FROM modulos m
  LEFT JOIN comerciantes c ON c.usuario_id = m.titular_id
  LEFT JOIN usuarios tu ON tu.id = c.usuario_id
  LEFT JOIN usuarios rp ON rp.id = m.registrado_por
  LEFT JOIN LATERAL (
    SELECT zi.id, zi.nombre, zi.tipo, zi.horario_inicio, zi.horario_fin, zi.aforo_maximo
      FROM zonas zi
     WHERE zi.activa
       AND ST_Contains(zi.geometria, m.ubicacion)
     ORDER BY
       CASE zi.tipo
         WHEN 'permitida' THEN 1
         WHEN 'alta_congestion' THEN 2
         ELSE 3
       END,
       zi.id
     LIMIT 1
  ) zona ON true
`;

interface FilaModulo {
  id: bigint | string;
  codigo: string;
  categoria: categoria_comercio;
  titular_id: bigint | string | null;
  titular_nombre: string | null;
  actividad: string;
  foto_url: string | null;
  estado: estado_modulo;
  registrado_por_id: bigint | string;
  creado_en: Date;
  ubicacion: unknown;
  titular_usuario_nombre: string | null;
  titular_usuario_apellido: string | null;
  titular_usuario_correo: string | null;
  registrado_por_nombre: string | null;
  registrado_por_apellido: string | null;
  registrado_por_correo: string | null;
  zona_id: bigint | string | null;
  zona_nombre: string | null;
  zona_tipo: tipo_zona | null;
  zona_horario_inicio: string | null;
  zona_horario_fin: string | null;
  zona_aforo_maximo: number | null;
  zona_productos: unknown;
}

interface FilaModuloActual {
  id: bigint | string;
  codigo: string;
  foto_url: string | null;
  estado: estado_modulo;
  titular_id: bigint | string | null;
  titular_nombre: string | null;
  ubicacion: unknown;
}

interface FilaZonaContenedora {
  id: bigint | string;
  nombre: string;
  tipo: tipo_zona;
  horario_inicio: string | null;
  horario_fin: string | null;
  aforo_maximo: number | null;
  productos: unknown;
}

interface FilaHistorial {
  id: bigint | string;
  accion: string;
  valor_anterior: unknown;
  valor_nuevo: unknown;
  actor_id: bigint | string | null;
  actor_nombre: string | null;
  actor_apellido: string | null;
  actor_correo: string | null;
  creado_en: Date;
}

interface FilaResumenModulo {
  id: bigint | string;
  codigo: string;
  estado: estado_modulo;
}

/**
 * Censo de módulos y puestos de comercio formal e informal (HU-13).
 *
 * El sector no es una columna del módulo: se deriva de la zona activa que
 * contiene el punto. Por eso todas las consultas usan `ST_Contains` y guardan
 * la zona como un dato calculado.
 */
@Injectable()
export class ModulosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista módulos con filtros por categoría, sector, estado y búsqueda.
   *
   * `sector` puede ser el nombre de una zona activa o `sin_zona`. La búsqueda
   * cubre código, actividad, nombre del titular y correo del comerciante.
   */
  async listar(dto: ListarModulosQueryDto = {}): Promise<ListarModulosResponseDto> {
    const pagina = dto.pagina ?? 1;
    const limite = dto.limite ?? 20;
    const offset = (pagina - 1) * limite;
    const condiciones: Prisma.Sql[] = [];

    if (dto.categoria !== undefined) {
      condiciones.push(
        Prisma.sql`m.categoria = ${dto.categoria}::categoria_comercio`,
      );
    }

    if (dto.estado !== undefined && dto.estado !== 'todos') {
      condiciones.push(Prisma.sql`m.estado = ${dto.estado}::estado_modulo`);
    }

    const sector = dto.sector?.trim();
    if (sector === SECTOR_SIN_ZONA) {
      condiciones.push(Prisma.sql`zona.id IS NULL`);
    } else if (sector) {
      condiciones.push(Prisma.sql`zona.nombre = ${sector}`);
    }

    const busqueda = dto.busqueda?.trim();
    if (busqueda) {
      const patron = `%${busqueda}%`;
      condiciones.push(Prisma.sql`(
        m.codigo ILIKE ${patron}
        OR m.actividad ILIKE ${patron}
        OR m.titular_nombre ILIKE ${patron}
        OR tu.nombre ILIKE ${patron}
        OR tu.apellido ILIKE ${patron}
        OR tu.correo ILIKE ${patron}
      )`);
    }

    const where =
      condiciones.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(condiciones, ' AND ')}`
        : Prisma.empty;

    const [filas, totalFilas] = await Promise.all([
      this.prisma.$queryRaw<FilaModulo[]>`
        SELECT ${CAMPOS_MODULO}
        ${FROM_MODULO}
        ${where}
        ORDER BY m.creado_en DESC, m.id DESC
        LIMIT ${limite} OFFSET ${offset}
      `,
      this.prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total
        ${FROM_MODULO}
        ${where}
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

  /** Opciones cerradas para los filtros del listado. */
  async opciones(): Promise<OpcionesModulosResponseDto> {
    const filas = await this.prisma.$queryRaw<{ nombre: string }[]>`
      SELECT DISTINCT nombre
        FROM zonas
       WHERE activa
       ORDER BY nombre ASC
    `;

    return {
      sectores: filas.map((fila) => fila.nombre),
      categorias: [...CATEGORIAS_MODULO],
    };
  }

  /**
   * Devuelve la zona activa que contiene un punto y sus advertencias.
   *
   * Es la consulta que usa el formulario antes de confirmar el censo.
   */
  async zonaContenedora(
    lat: number,
    lng: number,
  ): Promise<ZonaContenedoraResponseDto> {
    const zona = await this.buscarZona(lat, lng);
    const advertencias = calcularAdvertenciasZona(
      zona === null
        ? null
        : { id: zona.id.toString(), nombre: zona.nombre, tipo: zona.tipo },
    );

    return {
      zona: zona === null ? null : this.aZona(zona),
      sector: zona?.nombre ?? null,
      advertencias,
      requiereConfirmacion: exigeConfirmacion(advertencias),
    };
  }

  /** Ficha completa de un módulo, con su zona y advertencias vigentes. */
  async detalle(id: string): Promise<ModuloDetalleDto> {
    const moduloId = parseIdBigint(id);
    const filas = await this.prisma.$queryRaw<FilaModulo[]>`
      SELECT ${CAMPOS_MODULO}
      ${FROM_MODULO}
      WHERE m.id = ${moduloId}
    `;

    const fila = filas[0];
    if (!fila) {
      throw new NotFoundException('El módulo solicitado no existe');
    }

    return this.aDetalle(fila);
  }

  /** Crea un módulo y guarda su foto opcional en una transacción auditada. */
  async crear(
    idGestor: string,
    dto: CrearModuloDto,
    archivo?: ArchivoFoto,
  ): Promise<ModuloDetalleDto> {
    const actorId = parseIdBigint(idGestor);
    const punto = validarPunto(dto.ubicacion);
    const titular = await this.resolverTitularCreacion(dto);
    const [lat, lng] = [punto.coordinates[1], punto.coordinates[0]];
    const zona = await this.buscarZona(lat, lng);
    const advertencias = this.advertenciasDeZona(zona);

    if (exigeConfirmacion(advertencias) && dto.aceptaAdvertencia !== true) {
      throw this.errorZonaRestringida(zona, advertencias);
    }

    let fotoUrl: string | null = null;
    if (archivo) {
      const validada = validarFoto(archivo);
      fotoUrl = await guardarFoto(archivo, validada);
    }

    let moduloId: string;
    try {
      const filas = await this.prisma.$transaction(async (tx) => {
        await fijarActorAuditoria(tx, actorId);

        return tx.$queryRaw<{ id: bigint | string }[]>`
          INSERT INTO modulos (
            codigo,
            ubicacion,
            categoria,
            titular_id,
            titular_nombre,
            actividad,
            foto_url,
            estado,
            registrado_por
          )
          VALUES (
            'MOD-' || lpad(nextval('modulos_codigo_seq')::text, 4, '0'),
            ${puntoASql(punto)},
            ${dto.categoria}::categoria_comercio,
            ${titular.id},
            ${titular.nombre},
            ${dto.actividad.trim()},
            ${fotoUrl},
            'activo'::estado_modulo,
            ${actorId}
          )
          RETURNING id
        `;
      });

      const id = filas[0]?.id;
      if (id === undefined) {
        throw new Error('La base de datos no devolvió el módulo creado');
      }
      moduloId = id.toString();
    } catch (error) {
      await eliminarFoto(fotoUrl);
      throw error;
    }

    return this.detalle(moduloId);
  }

  /**
   * Edita un módulo. Si cambia la ubicación, vuelve a calcular la zona y exige
   * confirmación cuando cae en una zona restringida.
   */
  async actualizar(
    id: string,
    idGestor: string,
    dto: ActualizarModuloDto,
    archivo?: ArchivoFoto,
  ): Promise<ModuloDetalleDto> {
    const moduloId = parseIdBigint(id);
    const actorId = parseIdBigint(idGestor);
    const actuales = await this.prisma.$queryRaw<FilaModuloActual[]>`
      SELECT
        id,
        codigo,
        foto_url,
        estado,
        titular_id,
        titular_nombre,
        ST_AsGeoJSON(ubicacion)::jsonb AS ubicacion
      FROM modulos
      WHERE id = ${moduloId}
    `;

    const actual = actuales[0];
    if (!actual) {
      throw new NotFoundException('El módulo solicitado no existe');
    }

    const hayCampo =
      dto.categoria !== undefined ||
      dto.actividad !== undefined ||
      dto.ubicacion !== undefined ||
      dto.titularId !== undefined ||
      dto.titularNombre !== undefined ||
      archivo !== undefined;

    if (!hayCampo) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para actualizar el módulo',
      );
    }

    const campos: Prisma.Sql[] = [];
    let fotoNueva: string | null = null;

    if (dto.categoria !== undefined) {
      campos.push(Prisma.sql`categoria = ${dto.categoria}::categoria_comercio`);
    }
    if (dto.actividad !== undefined) {
      campos.push(Prisma.sql`actividad = ${dto.actividad.trim()}`);
    }

    if (dto.ubicacion !== undefined) {
      const punto = validarPunto(dto.ubicacion);
      const cambioUbicacion = !this.esMismaUbicacion(punto, actual.ubicacion);

      if (cambioUbicacion) {
        const [lat, lng] = [punto.coordinates[1], punto.coordinates[0]];
        const zona = await this.buscarZona(lat, lng);
        const advertencias = this.advertenciasDeZona(zona);

        if (exigeConfirmacion(advertencias) && dto.aceptaAdvertencia !== true) {
          throw this.errorZonaRestringida(zona, advertencias);
        }

        campos.push(Prisma.sql`ubicacion = ${puntoASql(punto)}`);
      }
    }

    if (dto.titularId !== undefined && dto.titularNombre !== undefined) {
      throw new BadRequestException(
        'Elija un comerciante registrado o un nombre de titular, no ambos',
      );
    }
    if (dto.titularId !== undefined) {
      const titularId = await this.validarComerciante(dto.titularId);
      campos.push(Prisma.sql`titular_id = ${titularId}`);
      campos.push(Prisma.sql`titular_nombre = NULL`);
    } else if (dto.titularNombre !== undefined) {
      campos.push(Prisma.sql`titular_id = NULL`);
      campos.push(Prisma.sql`titular_nombre = ${dto.titularNombre.trim()}`);
    }

    if (archivo) {
      const validada = validarFoto(archivo);
      fotoNueva = await guardarFoto(archivo, validada);
      campos.push(Prisma.sql`foto_url = ${fotoNueva}`);
    }

    if (campos.length === 0) {
      throw new BadRequestException(
        'No hay cambios efectivos para guardar en el módulo',
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await fijarActorAuditoria(tx, actorId);
        const filas = await tx.$queryRaw<{ id: bigint | string }[]>`
          UPDATE modulos
             SET ${Prisma.join(campos, ', ')}
           WHERE id = ${moduloId}
          RETURNING id
        `;
        if (!filas[0]) {
          throw new NotFoundException('El módulo solicitado no existe');
        }
      });
    } catch (error) {
      await eliminarFoto(fotoNueva);
      throw error;
    }

    if (fotoNueva !== null) {
      await eliminarFoto(actual.foto_url);
    }

    return this.detalle(moduloId.toString());
  }

  /** Baja lógica o reactivación de un módulo. Es idempotente. */
  async cambiarEstado(
    id: string,
    idGestor: string,
    dto: CambiarEstadoModuloDto,
  ): Promise<ModuloEstadoResponseDto> {
    const moduloId = parseIdBigint(id);
    const actorId = parseIdBigint(idGestor);
    const actuales = await this.prisma.$queryRaw<
      Array<{ id: bigint | string; codigo: string; estado: estado_modulo }>
    >`
      SELECT id, codigo, estado
        FROM modulos
       WHERE id = ${moduloId}
    `;

    const actual = actuales[0];
    if (!actual) {
      throw new NotFoundException('El módulo solicitado no existe');
    }

    const mensaje =
      dto.estado === 'baja' ? 'Módulo dado de baja.' : 'Módulo reactivado.';

    if (actual.estado === dto.estado) {
      return {
        id: actual.id.toString(),
        codigo: actual.codigo,
        estado: actual.estado,
        mensaje,
      };
    }

    await this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, actorId);
      await tx.$executeRaw`
        UPDATE modulos
           SET estado = ${dto.estado}::estado_modulo
         WHERE id = ${moduloId}
      `;
    });

    return {
      id: actual.id.toString(),
      codigo: actual.codigo,
      estado: dto.estado,
      mensaje,
    };
  }

  /** Historial paginado del módulo a partir de la tabla `auditoria`. */
  async historial(
    id: string,
    dto: ModuloHistorialQueryDto = {},
  ): Promise<ModuloHistorialResponseDto> {
    const moduloId = parseIdBigint(id);
    const pagina = dto.pagina ?? 1;
    const limite = dto.limite ?? 20;
    const offset = (pagina - 1) * limite;

    const [modulos, filas, totalFilas] = await Promise.all([
      this.prisma.$queryRaw<FilaResumenModulo[]>`
        SELECT id, codigo, estado
          FROM modulos
         WHERE id = ${moduloId}
      `,
      this.prisma.$queryRaw<FilaHistorial[]>`
        SELECT
          a.id,
          a.accion,
          a.valor_anterior,
          a.valor_nuevo,
          a.actor_id,
          u.nombre AS actor_nombre,
          u.apellido AS actor_apellido,
          u.correo AS actor_correo,
          a.creado_en
        FROM auditoria a
        LEFT JOIN usuarios u ON u.id = a.actor_id
        WHERE a.tabla = 'modulos'
          AND a.registro_id = ${moduloId}
        ORDER BY a.creado_en DESC, a.id DESC
        LIMIT ${limite} OFFSET ${offset}
      `,
      this.prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total
          FROM auditoria
         WHERE tabla = 'modulos'
           AND registro_id = ${moduloId}
      `,
    ]);

    const modulo = modulos[0];
    if (!modulo) {
      throw new NotFoundException('El módulo solicitado no existe');
    }

    const total = totalFilas[0]?.total ?? 0;
    const datos = filas.map((fila) => this.aHistorial(fila));

    return {
      modulo: {
        id: modulo.id.toString(),
        codigo: modulo.codigo,
        estado: modulo.estado,
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

  /** Busca la zona activa que contiene el punto. */
  private async buscarZona(
    lat: number,
    lng: number,
  ): Promise<FilaZonaContenedora | null> {
    const filas = await this.prisma.$queryRaw<FilaZonaContenedora[]>`
      SELECT
        z.id,
        z.nombre,
        z.tipo,
        to_char(z.horario_inicio, 'HH24:MI') AS horario_inicio,
        to_char(z.horario_fin, 'HH24:MI') AS horario_fin,
        z.aforo_maximo,
        COALESCE(
          (
            SELECT jsonb_agg(p.nombre ORDER BY p.nombre)
              FROM zona_productos zp
              JOIN productos p ON p.id = zp.producto_id
             WHERE zp.zona_id = z.id
               AND p.activo = true
          ),
          '[]'::jsonb
        ) AS productos
      FROM zonas z
      WHERE z.activa
        AND ST_Contains(
          z.geometria,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
        )
      ORDER BY
        CASE z.tipo
          WHEN 'permitida' THEN 1
          WHEN 'alta_congestion' THEN 2
          ELSE 3
        END,
        z.id
      LIMIT 1
    `;

    return filas[0] ?? null;
  }

  /** Convierte una fila de zona al DTO con restricciones. */
  private aZona(fila: FilaZonaContenedora): ZonaContenedoraDto {
    return {
      id: fila.id.toString(),
      nombre: fila.nombre,
      tipo: fila.tipo,
      horarioInicio: fila.horario_inicio,
      horarioFin: fila.horario_fin,
      aforoMaximo: fila.aforo_maximo,
      productos: this.listaProductos(fila.productos),
    };
  }

  /** Advertencias calculadas a partir de una fila de zona. */
  private advertenciasDeZona(
    zona: FilaZonaContenedora | null,
  ): AdvertenciaModuloDto[] {
    return calcularAdvertenciasZona(
      zona === null
        ? null
        : { id: zona.id.toString(), nombre: zona.nombre, tipo: zona.tipo },
    );
  }

  /** Error 422 con el detalle de la zona restringida. */
  private errorZonaRestringida(
    zona: FilaZonaContenedora | null,
    advertencias: AdvertenciaModuloDto[],
  ): UnprocessableEntityException {
    return new UnprocessableEntityException({
      statusCode: 422,
      error: 'Unprocessable Entity',
      message:
        'El punto está en una zona restringida. Confirma la advertencia para continuar.',
      requiereConfirmacion: true,
      advertencias,
      zona: zona === null ? null : this.aZona(zona),
    });
  }

  /** Valida y normaliza el titular de un alta. */
  private async resolverTitularCreacion(dto: CrearModuloDto): Promise<{
    id: bigint | null;
    nombre: string | null;
  }> {
    const tieneId = dto.titularId !== undefined;
    const tieneNombre = dto.titularNombre !== undefined;

    if (tieneId === tieneNombre) {
      throw new BadRequestException(
        'Debe indicar un comerciante registrado o un nombre de titular, exactamente uno',
      );
    }

    if (dto.titularId !== undefined) {
      return { id: await this.validarComerciante(dto.titularId), nombre: null };
    }

    return {
      id: null,
      nombre: dto.titularNombre?.trim() ?? null,
    };
  }

  /** Verifica que el comerciante exista y devuelve su id bigint. */
  private async validarComerciante(id: string): Promise<bigint> {
    const comercianteId = parseIdBigint(id);
    const comerciante = await this.prisma.comerciantes.findUnique({
      where: { usuario_id: comercianteId },
      select: { usuario_id: true },
    });

    if (!comerciante) {
      throw new BadRequestException(
        'El comerciante seleccionado como titular no existe',
      );
    }

    return comercianteId;
  }

  /** Compara dos puntos GeoJSON sin depender de la representación SQL. */
  private esMismaUbicacion(nuevo: GeoJsonPoint, actual: unknown): boolean {
    try {
      const puntoActual = leerGeoJson(actual, 'Point');
      if (!puntoActual || puntoActual.type !== 'Point') return false;
      return (
        puntoActual.coordinates[0] === nuevo.coordinates[0] &&
        puntoActual.coordinates[1] === nuevo.coordinates[1]
      );
    } catch {
      return false;
    }
  }

  /** Convierte una fila de módulo en la fila del listado. */
  private aListado(fila: FilaModulo): ModuloListadoDto {
    const ubicacion = leerGeoJson(fila.ubicacion, 'Point');
    if (!ubicacion || ubicacion.type !== 'Point') {
      throw new Error(
        `El módulo ${fila.id.toString()} no tiene una ubicación válida`,
      );
    }

    const zona = this.zonaDeFila(fila);

    return {
      id: fila.id.toString(),
      codigo: fila.codigo,
      categoria: fila.categoria,
      titular:
        fila.titular_id === null || fila.titular_usuario_nombre === null
          ? null
          : {
              id: fila.titular_id.toString(),
              nombre: fila.titular_usuario_nombre,
              apellido: fila.titular_usuario_apellido,
              correo: fila.titular_usuario_correo ?? '',
            },
      titularNombre: fila.titular_nombre,
      actividad: fila.actividad,
      fotoUrl: fila.foto_url,
      estado: fila.estado,
      sector: zona?.nombre ?? null,
      zonaContenedora: zona,
      ubicacion,
      creadoEn: fila.creado_en,
    };
  }

  /** Convierte una fila de módulo en la ficha completa. */
  private aDetalle(fila: FilaModulo): ModuloDetalleDto {
    const listado = this.aListado(fila);

    return {
      id: listado.id,
      codigo: listado.codigo,
      categoria: listado.categoria,
      titular: listado.titular,
      titularNombre: listado.titularNombre,
      actividad: listado.actividad,
      fotoUrl: listado.fotoUrl,
      estado: listado.estado,
      sector: listado.sector,
      zonaContenedora: listado.zonaContenedora,
      ubicacion: listado.ubicacion,
      creadoEn: listado.creadoEn,
      registradoPor:
        fila.registrado_por_nombre === null
          ? null
          : {
              id: fila.registrado_por_id.toString(),
              nombre: fila.registrado_por_nombre,
              apellido: fila.registrado_por_apellido,
              correo: fila.registrado_por_correo ?? '',
            },
      advertencias: this.advertenciasDeZona(
        this.filaZonaContenedora(fila),
      ),
    };
  }

  /** Zona de una fila de módulo, si el punto cae en una zona activa. */
  private zonaDeFila(fila: FilaModulo): ZonaContenedoraDto | null {
    if (
      fila.zona_id === null ||
      fila.zona_nombre === null ||
      fila.zona_tipo === null
    ) {
      return null;
    }

    return {
      id: fila.zona_id.toString(),
      nombre: fila.zona_nombre,
      tipo: fila.zona_tipo,
      horarioInicio: fila.zona_horario_inicio,
      horarioFin: fila.zona_horario_fin,
      aforoMaximo: fila.zona_aforo_maximo,
      productos: this.listaProductos(fila.zona_productos),
    };
  }

  /** Fila de zona mínima para reutilizar el cálculo de advertencias. */
  private filaZonaContenedora(
    fila: FilaModulo,
  ): FilaZonaContenedora | null {
    if (
      fila.zona_id === null ||
      fila.zona_nombre === null ||
      fila.zona_tipo === null
    ) {
      return null;
    }
    return {
      id: fila.zona_id,
      nombre: fila.zona_nombre,
      tipo: fila.zona_tipo,
      horario_inicio: fila.zona_horario_inicio,
      horario_fin: fila.zona_horario_fin,
      aforo_maximo: fila.zona_aforo_maximo,
      productos: fila.zona_productos,
    };
  }

  /** Convierte el JSONB de productos en una lista de nombres. */
  private listaProductos(valor: unknown): string[] {
    return Array.isArray(valor)
      ? valor.filter((item): item is string => typeof item === 'string')
      : [];
  }

  /** Convierte una fila de auditoría en un evento del historial. */
  private aHistorial(fila: FilaHistorial): ModuloHistorialItemDto {
    const anterior = parsearRegistroAuditoria(fila.valor_anterior);
    const nuevo = parsearRegistroAuditoria(fila.valor_nuevo);
    const accion = normalizarAccionAuditoria(fila.accion);
    const cambios: ModuloHistorialItemDto['cambios'] =
      accion === 'update' ? calcularCambiosModulo(anterior, nuevo) : [];

    return {
      id: fila.id.toString(),
      accion,
      creadoEn: fila.creado_en,
      actor:
        fila.actor_id === null || fila.actor_nombre === null
          ? null
          : {
              id: fila.actor_id.toString(),
              nombre: fila.actor_nombre,
              apellido: fila.actor_apellido,
              correo: fila.actor_correo ?? '',
            },
      cambios,
    };
  }
}
