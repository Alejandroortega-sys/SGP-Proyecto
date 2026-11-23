import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { access } from 'node:fs/promises';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import {
  eliminarArchivoPrivado,
  guardarArchivoPrivado,
  limiteBytesArchivo,
  maxArchivos,
  resolverRutaArchivoPrivado,
} from '../common/almacenamiento-archivos';
import { fijarActorAuditoria } from '../common/auditoria';
import { parseIdBigint } from '../common/parse-id';
import { CorreoService } from '../correo/correo.service';
import {
  Prisma,
  type estado_feria,
  type tipo_zona,
} from '../generated/prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  mimePorRuta,
  nombreArchivoSeguro,
  validarDocumento,
} from '../solicitudes/documentos';
import {
  buscarConflicto,
  diasInclusive,
  sumarDias,
  sugerirFechasLibres,
  type RangoFechas,
} from './agenda';
import {
  AgendaFeriaDto,
  ConsultarAgendaFeriaQueryDto,
  ConsultarDisponibilidadFeriaQueryDto,
  DisponibilidadFeriaDto,
  DocumentoFeriaDto,
  FeriaDetalleDto,
  FeriaListadoDto,
  ListarFeriasResponseDto,
  ListarMisFeriasQueryDto,
  OpcionesFeriaDto,
  ProductoFeriaDto,
  RadicarFeriaDatosDto,
  RadicarFeriaFormDto,
  RadicarFeriaResponseDto,
  RangoFeriaDto,
  ZonaFeriaDto,
} from './dto/ferias.dto';
import {
  ESTADOS_FERIA_ACTIVA,
  hoyBogotaISO,
  validarFechasFeria,
  validarPuestosContraAforo,
} from './reglas';

interface FilaZona {
  id: bigint | string;
  nombre: string;
  tipo: tipo_zona;
  activa: boolean;
  aforo_maximo: number | null;
  horario_inicio: string | null;
  horario_fin: string | null;
  productos: string[] | null;
}

interface FilaOcupada {
  id: bigint | string;
  fecha_inicio: string | Date;
  fecha_fin: string | Date;
}

interface FilaFeriaRadicada {
  id: bigint;
  numero_radicado: string;
  estado: estado_feria;
}

interface FilaFeriaListado {
  id: bigint;
  numero_radicado: string;
  nombre: string;
  tipo_feria: string;
  fecha_inicio: Date | string;
  fecha_fin: Date | string;
  numero_puestos: number;
  estado: estado_feria;
  radicada_en: Date;
  zonas: {
    id: bigint;
    nombre: string;
    tipo: tipo_zona;
    aforo_maximo: number | null;
    horario_inicio: Date | string | null;
    horario_fin: Date | string | null;
    zona_productos: { productos: { nombre: string } }[];
  };
}

interface FilaFeriaDetalle extends FilaFeriaListado {
  feria_productos: { productos: { id: bigint; nombre: string } }[];
  feria_documentos: {
    id: bigint;
    tipo_documento: string;
    nombre_original: string | null;
    mime_type: string | null;
    tamano_bytes: number | null;
    cargado_en: Date;
  }[];
}

const SELECT_FERIA_LISTADO = {
  id: true,
  numero_radicado: true,
  nombre: true,
  tipo_feria: true,
  fecha_inicio: true,
  fecha_fin: true,
  numero_puestos: true,
  estado: true,
  radicada_en: true,
  zonas: {
    select: {
      id: true,
      nombre: true,
      tipo: true,
      aforo_maximo: true,
      horario_inicio: true,
      horario_fin: true,
      zona_productos: {
        select: { productos: { select: { nombre: true } } },
      },
    },
  },
} satisfies Prisma.feriasSelect;

const SELECT_FERIA_DETALLE = {
  ...SELECT_FERIA_LISTADO,
  feria_productos: {
    select: { productos: { select: { id: true, nombre: true } } },
  },
  feria_documentos: {
    orderBy: { cargado_en: 'asc' },
    select: {
      id: true,
      tipo_documento: true,
      nombre_original: true,
      mime_type: true,
      tamano_bytes: true,
      cargado_en: true,
    },
  },
} satisfies Prisma.feriasSelect;

/**
 * Radicación y consulta de ferias agroecológicas (HU-21).
 *
 * La feria ocupa una zona completa durante un rango de fechas. La detección de
 * cruces es compartida con HU-22 y se apoya en la restricción EXCLUDE de la
 * base de datos como última barrera ante peticiones concurrentes.
 */
@Injectable()
export class FeriasService {
  private readonly logger = new Logger(FeriasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /** Zonas activas con aforo y productos, más el catálogo de productos. */
  async opciones(): Promise<OpcionesFeriaDto> {
    const [zonas, productos] = await Promise.all([
      this.prisma.$queryRaw<FilaZona[]>`
        SELECT
          z.id,
          z.nombre,
          z.tipo,
          z.activa,
          z.aforo_maximo,
          to_char(z.horario_inicio, 'HH24:MI') AS horario_inicio,
          to_char(z.horario_fin, 'HH24:MI') AS horario_fin,
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
        WHERE z.activa = true
          AND z.aforo_maximo IS NOT NULL
          AND z.aforo_maximo > 0
        ORDER BY z.nombre ASC
      `,
      this.prisma.productos.findMany({
        where: { activo: true },
        orderBy: { nombre: 'asc' },
        select: { id: true, nombre: true },
      }),
    ]);

    return {
      zonas: zonas.map((zona) => this.aZona(zona)),
      productos: productos.map((producto) => ({
        id: producto.id.toString(),
        nombre: producto.nombre,
      })),
    };
  }

  /** Agenda de una zona: rangos ocupados por ferias activas. */
  async agenda(dto: ConsultarAgendaFeriaQueryDto): Promise<AgendaFeriaDto> {
    const zonaId = parseIdBigint(dto.zonaId);
    const zona = await this.obtenerZona(zonaId);
    const desde = dto.desde ?? hoyBogotaISO();
    const hasta = dto.hasta ?? sumarDias(desde, 90);

    if (hasta < desde) {
      throw new BadRequestException(
        'La fecha final de la agenda debe ser igual o posterior a la inicial',
      );
    }

    const ocupados = await this.consultarOcupados(zonaId, desde, hasta);

    return {
      zonaId: zona.id.toString(),
      desde,
      hasta,
      ocupados: ocupados.map((fila) => this.aRango(fila)),
    };
  }

  /**
   * Disponibilidad de una zona para un rango y número de puestos.
   *
   * Devuelve el conflicto y hasta tres fechas alternativas sin exponer datos
   * de otros organizadores.
   */
  async disponibilidad(
    dto: ConsultarDisponibilidadFeriaQueryDto,
  ): Promise<DisponibilidadFeriaDto> {
    const zonaId = parseIdBigint(dto.zonaId);
    const evaluacion = await this.evaluar(zonaId, {
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      numeroPuestos: dto.numeroPuestos ?? 1,
    });

    return {
      disponible: evaluacion.disponible,
      zona: evaluacion.zona,
      aforo: evaluacion.aforo,
      conflicto: evaluacion.conflicto,
      sugerencias: evaluacion.sugerencias,
      motivo: evaluacion.motivo,
    };
  }

  /** Lista las ferias del organizador autenticado. */
  async listarMias(
    idUsuario: string,
    dto: ListarMisFeriasQueryDto,
  ): Promise<ListarFeriasResponseDto> {
    const organizadorId = parseIdBigint(idUsuario);
    const pagina = dto.pagina ?? 1;
    const limite = dto.limite ?? 20;
    const where: Prisma.feriasWhereInput = {
      organizador_id: organizadorId,
      ...(dto.estado ? { estado: dto.estado } : {}),
    };

    const [filas, total] = await Promise.all([
      this.prisma.ferias.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: [{ radicada_en: 'desc' }, { id: 'desc' }],
        select: SELECT_FERIA_LISTADO,
      }),
      this.prisma.ferias.count({ where }),
    ]);

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

  /** Detalle de una feria propia con productos y adjuntos. */
  async detalle(idUsuario: string, idFeria: string): Promise<FeriaDetalleDto> {
    const organizadorId = parseIdBigint(idUsuario);
    const feriaId = parseIdBigint(idFeria);

    const feria = await this.prisma.ferias.findFirst({
      where: { id: feriaId, organizador_id: organizadorId },
      select: SELECT_FERIA_DETALLE,
    });

    if (!feria) {
      throw new NotFoundException('La feria no existe o no te pertenece');
    }

    return this.aDetalle(feria);
  }

  /**
   * Radica una feria con sus adjuntos opcionales.
   *
   * @throws BadRequestException si los datos, productos o adjuntos no son válidos.
   * @throws ForbiddenException si la organización no está activa.
   * @throws ConflictException si hay un cruce de agenda o aforo insuficiente.
   */
  async radicar(
    usuario: UsuarioAutenticado,
    form: RadicarFeriaFormDto,
    archivos: Express.Multer.File[] = [],
  ): Promise<RadicarFeriaResponseDto> {
    const organizadorId = parseIdBigint(usuario.id);
    const datos = await this.parsearDatos(form.datos);
    const listaArchivos = archivos ?? [];

    await this.validarOrganizacionActiva(organizadorId);

    if (listaArchivos.length > maxArchivos()) {
      throw new BadRequestException(
        `Puedes adjuntar como máximo ${maxArchivos()} documentos`,
      );
    }

    const documentos = listaArchivos.map((archivo) => ({
      archivo: {
        buffer: archivo.buffer,
        mimetype: archivo.mimetype,
        size: archivo.size,
        originalname: archivo.originalname,
      },
      validado: validarDocumento(
        {
          buffer: archivo.buffer,
          mimetype: archivo.mimetype,
          size: archivo.size,
          originalname: archivo.originalname,
        },
        limiteBytesArchivo(),
      ),
    }));

    const evaluacion = await this.evaluar(parseIdBigint(datos.zonaId), {
      fechaInicio: datos.fechaInicio,
      fechaFin: datos.fechaFin,
      numeroPuestos: datos.numeroPuestos,
    });

    if (!evaluacion.disponible) {
      if (!evaluacion.aforo.suficiente) {
        throw new BadRequestException(evaluacion.motivo);
      }
      if (evaluacion.conflicto) {
        throw new ConflictException({
          message: evaluacion.motivo,
          conflicto: evaluacion.conflicto,
          sugerencias: evaluacion.sugerencias,
        });
      }
      throw new ConflictException(evaluacion.motivo);
    }

    const productos = await this.validarProductos(
      datos.productoIds,
      evaluacion.zona.productosPermitidos,
    );

    const rutasGuardadas: string[] = [];
    let insercion: FilaFeriaRadicada;

    try {
      insercion = await this.prisma.$transaction(async (tx) => {
        await fijarActorAuditoria(tx, organizadorId);

        // Serializa las radicaciones concurrentes de la misma zona. La
        // restricción EXCLUDE sigue siendo la última barrera.
        await tx.$queryRaw`
          SELECT id FROM zonas WHERE id = ${parseIdBigint(datos.zonaId)} FOR UPDATE
        `;

        const conflictos = await this.consultarOcupados(
          parseIdBigint(datos.zonaId),
          datos.fechaInicio,
          datos.fechaFin,
          tx,
        );
        if (conflictos.length > 0) {
          const sugerencias = await this.sugerencias(
            parseIdBigint(datos.zonaId),
            datos.fechaInicio,
            datos.fechaFin,
            tx,
          );
          throw new ConflictException({
            message: this.mensajeConflicto(this.aRango(conflictos[0])),
            conflicto: this.aRango(conflictos[0]),
            sugerencias,
          });
        }

        const filas = await tx.$queryRaw<FilaFeriaRadicada[]>`
          INSERT INTO ferias (
            organizador_id,
            nombre,
            tipo_feria,
            zona_id,
            fecha_inicio,
            fecha_fin,
            numero_puestos,
            estado
          )
          VALUES (
            ${organizadorId},
            ${datos.nombre},
            ${datos.tipoFeria},
            ${parseIdBigint(datos.zonaId)},
            ${datos.fechaInicio}::date,
            ${datos.fechaFin}::date,
            ${datos.numeroPuestos},
            'radicada'
          )
          RETURNING id, numero_radicado, estado
        `;
        const fila = filas[0];
        if (!fila) {
          throw new Error('No se pudo crear la feria');
        }

        await tx.feria_productos.createMany({
          data: productos.map((producto) => ({
            feria_id: fila.id,
            producto_id: producto.id,
          })),
        });

        for (const documento of documentos) {
          const ruta = await guardarArchivoPrivado(
            documento.archivo.buffer,
            documento.validado.extension,
            `ferias/${fila.id.toString()}`,
          );
          rutasGuardadas.push(ruta);

          await tx.feria_documentos.create({
            data: {
              feria_id: fila.id,
              tipo_documento: 'Documento del evento',
              archivo_url: ruta,
              nombre_original: nombreArchivoSeguro(
                documento.archivo.originalname ?? 'documento',
              ),
              mime_type: documento.validado.mimetype,
              tamano_bytes: documento.validado.bytes,
            },
          });
        }

        await this.notificaciones.crearAvisoFeria(tx, {
          usuarioId: organizadorId,
          feriaId: fila.id,
          tipo: 'feria_radicada',
          asunto: `Feria ${fila.numero_radicado}: radicada`.slice(0, 200),
          cuerpo:
            `Tu feria «${datos.nombre}» quedó radicada con el número ` +
            `${fila.numero_radicado} para ${evaluacion.zona.nombre}, ` +
            `del ${datos.fechaInicio} al ${datos.fechaFin}.`,
        });

        return fila;
      });
    } catch (error) {
      await Promise.all(
        rutasGuardadas.map((ruta) => eliminarArchivoPrivado(ruta)),
      );

      if (this.esErrorDeCruce(error) && !(error instanceof ConflictException)) {
        const sugerencias = await this.sugerencias(
          parseIdBigint(datos.zonaId),
          datos.fechaInicio,
          datos.fechaFin,
        );
        throw new ConflictException({
          message:
            'La zona ya está ocupada por otra feria en esas fechas. La base de datos rechazó el cruce.',
          sugerencias,
        });
      }

      throw error;
    }

    let correoEnviado = true;
    let mensajeCorreo: string | null = null;

    try {
      await this.correo.enviarConfirmacionFeria(
        usuario.correo,
        usuario.nombre,
        {
          numeroRadicado: insercion.numero_radicado,
          nombre: datos.nombre,
          tipoFeria: datos.tipoFeria,
          zona: evaluacion.zona.nombre,
          fechaInicio: datos.fechaInicio,
          fechaFin: datos.fechaFin,
          numeroPuestos: datos.numeroPuestos,
          productos: productos.map((producto) => producto.nombre),
          documentos: documentos.map(
            (documento) => documento.archivo.originalname ?? 'documento',
          ),
        },
      );
    } catch (error) {
      correoEnviado = false;
      mensajeCorreo =
        'La feria quedó radicada, pero no pudimos enviar el correo de confirmación.';
      this.logger.error(
        `No se pudo enviar la confirmación de ${insercion.numero_radicado}: ${String(error)}`,
      );
    }

    return {
      id: insercion.id.toString(),
      numeroRadicado: insercion.numero_radicado,
      estado: insercion.estado,
      mensaje: 'Feria radicada correctamente.',
      correoEnviado,
      mensajeCorreo,
    };
  }

  /** Devuelve la información de descarga de un adjunto. */
  async descargarDocumento(
    usuario: UsuarioAutenticado,
    idFeria: string,
    idDocumento: string,
  ): Promise<{ ruta: string; nombreOriginal: string; mimeType: string }> {
    const feriaId = parseIdBigint(idFeria);
    const documentoId = parseIdBigint(idDocumento);

    const where: Prisma.feria_documentosWhereInput = {
      id: documentoId,
      feria_id: feriaId,
    };
    if (usuario.rol === 'organizador') {
      where.ferias = { organizador_id: parseIdBigint(usuario.id) };
    }

    const documento = await this.prisma.feria_documentos.findFirst({
      where,
      select: {
        archivo_url: true,
        nombre_original: true,
        mime_type: true,
      },
    });

    if (!documento) {
      throw new NotFoundException('El documento no existe o no tienes acceso');
    }

    const ruta = resolverRutaArchivoPrivado(documento.archivo_url);
    try {
      await access(ruta);
    } catch {
      throw new NotFoundException(
        'El archivo del documento no está disponible',
      );
    }

    return {
      ruta,
      nombreOriginal: nombreArchivoSeguro(documento.nombre_original),
      mimeType: documento.mime_type ?? mimePorRuta(documento.archivo_url),
    };
  }

  /** Parsea y valida el JSON de datos del formulario. */
  private async parsearDatos(datos: string): Promise<RadicarFeriaDatosDto> {
    let crudo: unknown;
    try {
      crudo = JSON.parse(datos) as unknown;
    } catch {
      throw new BadRequestException(
        'El campo «datos» no contiene un JSON válido',
      );
    }

    const dto = plainToInstance(RadicarFeriaDatosDto, crudo);
    const errores = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errores.length > 0) {
      const mensajes = errores.flatMap((error) =>
        Object.values(error.constraints ?? {}),
      );
      throw new BadRequestException(mensajes);
    }

    return dto;
  }

  /** Exige una organización registrada y activa. */
  private async validarOrganizacionActiva(usuarioId: bigint): Promise<void> {
    const organizacion = await this.prisma.organizadores.findUnique({
      where: { usuario_id: usuarioId },
      select: { estado: true },
    });

    if (!organizacion) {
      throw new ForbiddenException(
        'Debes registrar tu organización antes de solicitar una feria.',
      );
    }
    if (organizacion.estado !== 'activa') {
      throw new ForbiddenException(
        'Tu organización debe estar activa para solicitar ferias. La Alcaldía debe validarla primero.',
      );
    }
  }

  /** Valida productos activos y permitidos por la zona. */
  private async validarProductos(
    ids: string[],
    productosZona: string[],
  ): Promise<{ id: bigint; nombre: string }[]> {
    const identificadores = ids.map((id) => parseIdBigint(id));
    const productos = await this.prisma.productos.findMany({
      where: { id: { in: identificadores }, activo: true },
      select: { id: true, nombre: true },
    });

    if (productos.length !== identificadores.length) {
      throw new BadRequestException(
        'Uno o más productos no existen o están inactivos',
      );
    }

    if (productosZona.length > 0) {
      const permitidos = new Set(productosZona);
      const noPermitidos = productos
        .filter((producto) => !permitidos.has(producto.nombre))
        .map((producto) => producto.nombre);

      if (noPermitidos.length > 0) {
        throw new BadRequestException(
          `Los siguientes productos no están permitidos en la zona: ${noPermitidos.join(', ')}`,
        );
      }
    }

    return productos;
  }

  /**
   * Evalúa fechas, aforo y cruces de agenda de una zona.
   *
   * Es la única fuente de verdad para la disponibilidad que muestran el
   * selector de fechas y la radicación.
   */
  private async evaluar(
    zonaId: bigint,
    datos: Pick<
      RadicarFeriaDatosDto,
      'fechaInicio' | 'fechaFin' | 'numeroPuestos'
    >,
  ): Promise<{
    disponible: boolean;
    zona: ZonaFeriaDto;
    aforo: { solicitado: number; maximo: number | null; suficiente: boolean };
    conflicto: RangoFeriaDto | null;
    sugerencias: RangoFeriaDto[];
    motivo: string | null;
  }> {
    const erroresFechas = validarFechasFeria(datos.fechaInicio, datos.fechaFin);
    if (erroresFechas.length > 0) {
      throw new BadRequestException(erroresFechas);
    }

    const zona = await this.obtenerZona(zonaId);
    const errorAforo = validarPuestosContraAforo(
      datos.numeroPuestos,
      zona.aforoMaximo,
    );
    const suficiente =
      zona.aforoMaximo !== null && datos.numeroPuestos <= zona.aforoMaximo;

    if (errorAforo) {
      return {
        disponible: false,
        zona,
        aforo: {
          solicitado: datos.numeroPuestos,
          maximo: zona.aforoMaximo,
          suficiente,
        },
        conflicto: null,
        sugerencias: [],
        motivo: errorAforo,
      };
    }

    if (!zona.admiteFerias) {
      return {
        disponible: false,
        zona,
        aforo: {
          solicitado: datos.numeroPuestos,
          maximo: zona.aforoMaximo,
          suficiente,
        },
        conflicto: null,
        sugerencias: [],
        motivo: 'La zona no está activa para ferias.',
      };
    }

    const ocupados = await this.consultarOcupados(
      zonaId,
      datos.fechaInicio,
      datos.fechaFin,
    );
    const conflicto = buscarConflicto(
      { fechaInicio: datos.fechaInicio, fechaFin: datos.fechaFin },
      ocupados.map((fila) => this.aRango(fila)),
    );

    if (conflicto) {
      const sugerencias = await this.sugerencias(
        zonaId,
        datos.fechaInicio,
        datos.fechaFin,
      );
      return {
        disponible: false,
        zona,
        aforo: {
          solicitado: datos.numeroPuestos,
          maximo: zona.aforoMaximo,
          suficiente,
        },
        conflicto,
        sugerencias,
        motivo: this.mensajeConflicto(conflicto),
      };
    }

    return {
      disponible: true,
      zona,
      aforo: {
        solicitado: datos.numeroPuestos,
        maximo: zona.aforoMaximo,
        suficiente,
      },
      conflicto: null,
      sugerencias: [],
      motivo: null,
    };
  }

  /** Obtiene una zona activa con sus productos permitidos. */
  private async obtenerZona(zonaId: bigint): Promise<ZonaFeriaDto> {
    const filas = await this.prisma.$queryRaw<FilaZona[]>`
      SELECT
        z.id,
        z.nombre,
        z.tipo,
        z.activa,
        z.aforo_maximo,
        to_char(z.horario_inicio, 'HH24:MI') AS horario_inicio,
        to_char(z.horario_fin, 'HH24:MI') AS horario_fin,
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
      WHERE z.id = ${zonaId}
    `;

    const zona = filas[0];
    if (!zona) {
      throw new NotFoundException('La zona solicitada no existe');
    }

    return this.aZona(zona);
  }

  /** Consulta los rangos ocupados por ferias activas en una zona. */
  private async consultarOcupados(
    zonaId: bigint,
    desde: string,
    hasta: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<FilaOcupada[]> {
    return tx.$queryRaw<FilaOcupada[]>`
      SELECT id, fecha_inicio, fecha_fin
        FROM ferias
       WHERE zona_id = ${zonaId}
         AND estado IN (${Prisma.join(ESTADOS_FERIA_ACTIVA)})
         AND daterange(fecha_inicio, fecha_fin, '[]')
             && daterange(${desde}::date, ${hasta}::date, '[]')
       ORDER BY fecha_inicio ASC
    `;
  }

  /** Calcula alternativas libres dentro de los próximos 90 días. */
  private async sugerencias(
    zonaId: bigint,
    fechaInicio: string,
    fechaFin: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<RangoFeriaDto[]> {
    const duracion = diasInclusive(fechaInicio, fechaFin);
    const hasta = sumarDias(fechaInicio, 90 + Math.max(0, duracion - 1));
    const ocupados = await this.consultarOcupados(
      zonaId,
      fechaInicio,
      hasta,
      tx,
    );

    return sugerirFechasLibres(
      { fechaInicio, fechaFin },
      ocupados.map((fila) => this.aRango(fila)),
    ).map((sugerencia) => ({
      fechaInicio: sugerencia.fechaInicio,
      fechaFin: sugerencia.fechaFin,
    }));
  }

  /** Mensaje legible de un cruce de agenda. */
  private mensajeConflicto(rango: RangoFechas): string {
    return (
      `La zona ya está ocupada por otra feria entre el ${rango.fechaInicio} ` +
      `y el ${rango.fechaFin}. Elige otras fechas o usa una de las sugerencias.`
    );
  }

  /** Convierte una fila de zona al DTO. */
  private aZona(zona: FilaZona): ZonaFeriaDto {
    return {
      id: zona.id.toString(),
      nombre: zona.nombre,
      tipo: zona.tipo,
      aforoMaximo: zona.aforo_maximo,
      horarioInicio: zona.horario_inicio,
      horarioFin: zona.horario_fin,
      productosPermitidos: zona.productos ?? [],
      activa: zona.activa,
      admiteFerias:
        zona.activa && zona.aforo_maximo !== null && zona.aforo_maximo > 0,
    };
  }

  /** Convierte una fila ocupada al rango ISO. */
  private aRango(fila: FilaOcupada): RangoFeriaDto {
    return {
      fechaInicio: this.aFechaISO(fila.fecha_inicio),
      fechaFin: this.aFechaISO(fila.fecha_fin),
    };
  }

  /** Convierte una fecha DATE de PostgreSQL a `YYYY-MM-DD`. */
  private aFechaISO(valor: Date | string): string {
    if (valor instanceof Date) return valor.toISOString().slice(0, 10);
    return String(valor).slice(0, 10);
  }

  /** Convierte una hora TIME de Prisma a `HH:MM`. */
  private aHora(valor: Date | string | null): string | null {
    if (!valor) return null;
    if (valor instanceof Date) {
      const horas = String(valor.getUTCHours()).padStart(2, '0');
      const minutos = String(valor.getUTCMinutes()).padStart(2, '0');
      return `${horas}:${minutos}`;
    }
    return String(valor).slice(0, 5);
  }

  /** Convierte una fila de listado al DTO. */
  private aListado(fila: FilaFeriaListado): FeriaListadoDto {
    return {
      id: fila.id.toString(),
      numeroRadicado: fila.numero_radicado,
      nombre: fila.nombre,
      tipoFeria: fila.tipo_feria,
      estado: fila.estado,
      fechaInicio: this.aFechaISO(fila.fecha_inicio),
      fechaFin: this.aFechaISO(fila.fecha_fin),
      numeroPuestos: fila.numero_puestos,
      radicadaEn: fila.radicada_en,
      zona: {
        id: fila.zonas.id.toString(),
        nombre: fila.zonas.nombre,
        tipo: fila.zonas.tipo,
        aforoMaximo: fila.zonas.aforo_maximo,
        horarioInicio: this.aHora(fila.zonas.horario_inicio),
        horarioFin: this.aHora(fila.zonas.horario_fin),
        productosPermitidos: fila.zonas.zona_productos.map(
          (item) => item.productos.nombre,
        ),
        activa: true,
        admiteFerias:
          fila.zonas.aforo_maximo !== null && fila.zonas.aforo_maximo > 0,
      },
    };
  }

  /** Convierte una fila de detalle al DTO. */
  private aDetalle(fila: FilaFeriaDetalle): FeriaDetalleDto {
    const base = this.aListado(fila);
    const productos: ProductoFeriaDto[] = fila.feria_productos.map((item) => ({
      id: item.productos.id.toString(),
      nombre: item.productos.nombre,
    }));
    const documentos: DocumentoFeriaDto[] = fila.feria_documentos.map(
      (documento) => ({
        id: documento.id.toString(),
        tipoDocumento: documento.tipo_documento,
        nombreOriginal: documento.nombre_original,
        mimeType: documento.mime_type,
        tamanoBytes: documento.tamano_bytes,
        cargadoEn: documento.cargado_en,
        url: `/ferias/${base.id}/documentos/${documento.id.toString()}/archivo`,
      }),
    );

    return {
      id: base.id,
      numeroRadicado: base.numeroRadicado,
      nombre: base.nombre,
      tipoFeria: base.tipoFeria,
      estado: base.estado,
      fechaInicio: base.fechaInicio,
      fechaFin: base.fechaFin,
      numeroPuestos: base.numeroPuestos,
      radicadaEn: base.radicadaEn,
      zona: base.zona,
      productos,
      documentos,
    };
  }

  /** Detecta el error de exclusión de la restricción de agenda. */
  private esErrorDeCruce(error: unknown): boolean {
    const texto = String((error as Error)?.message ?? error);
    return (
      texto.includes('ferias_zona_id_daterange_excl') || texto.includes('23P01')
    );
  }
}
