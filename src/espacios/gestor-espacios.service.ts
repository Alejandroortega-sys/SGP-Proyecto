import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
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
  type estado_espacio,
  type tipo_espacio,
  type tipo_zona,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  calcularDisponibilidad,
  type BloqueoDisponibilidad,
  type PermisoDisponibilidad,
  type SolicitudDisponibilidad,
} from './disponibilidad';
import {
  ActualizarBloqueoDto,
  ActualizarEspacioDto,
  BloqueoEspacioGestorDto,
  CambiarEstadoEspacioDto,
  CrearBloqueoDto,
  CrearEspacioDto,
  DetalleEspacioGestorQueryDto,
  EspacioAsignacionResponseDto,
  EspacioEstadoResponseDto,
  EspacioGestorDetalleDto,
  EspacioGestorListadoDto,
  HistorialEspacioItemDto,
  HistorialEspacioResponseDto,
  ListarBloqueosResponseDto,
  ListarEspaciosGestorQueryDto,
  ListarEspaciosGestorResponseDto,
  MovimientoEspacioDto,
  OpcionesEspaciosGestorResponseDto,
  ZonaEspacioGestorDto,
  ZonaOpcionEspacioDto,
} from './dto/gestor-espacios.dto';
import { ESTADOS_ESPACIO, TIPOS_ESPACIO, textoOpcional } from './dto/espacios.dto';

interface FilaEspacioGestor {
  id: bigint | string;
  nombre: string;
  tipo: tipo_espacio;
  sector: string | null;
  dimensiones: string | null;
  actividad_permitida: string | null;
  horario_inicio: string | null;
  horario_fin: string | null;
  estado: estado_espacio;
  asignacion_manual: boolean;
  creado_en: Date;
  creado_por: bigint | string | null;
  creado_por_nombre: string | null;
  creado_por_apellido: string | null;
  zona_id: bigint | string | null;
  zona_nombre: string | null;
  zona_tipo: tipo_zona | null;
  zona_activa: boolean | null;
  zona_horario_inicio: string | null;
  zona_horario_fin: string | null;
  zona_aforo_maximo: number | null;
  zona_productos: unknown;
  ubicacion: unknown;
  bloqueo_inicio: string | Date | null;
  bloqueo_fin: string | Date | null;
  bloqueo_motivo: string | null;
  bloqueo_activo: boolean | null;
  permiso_numero: string | null;
  permiso_inicio: string | Date | null;
  permiso_fin: string | Date | null;
  permiso_hora_inicio: string | null;
  permiso_hora_fin: string | null;
  solicitud_numero: string | null;
  solicitud_inicio: string | Date | null;
  solicitud_fin: string | Date | null;
  solicitud_hora_inicio: string | null;
  solicitud_hora_fin: string | null;
  total_bloqueos: number;
  total_filas?: number;
  tiene_permisos: boolean;
  tiene_solicitudes: boolean;
}

interface FilaEspacioActual {
  id: bigint | string;
  nombre: string;
  estado: estado_espacio;
  asignacion_manual: boolean;
  zona_id: bigint | string | null;
  zona_nombre: string | null;
  sector: string | null;
  ubicacion: unknown;
}

interface FilaZonaContenedora {
  id: bigint | string;
  nombre: string;
  tipo: tipo_zona;
}

interface FilaBloqueo {
  id: bigint | string;
  fecha_inicio: string | Date;
  fecha_fin: string | Date;
  motivo: string | null;
  activo: boolean;
  creado_por: bigint | string;
  creado_por_nombre: string | null;
  creado_por_apellido: string | null;
  creado_en: Date;
}

interface FilaOcupacion {
  bloqueo: boolean;
  permiso: boolean;
  solicitud: boolean;
}

interface FilaHistorial {
  id: bigint | string;
  tabla: string;
  accion: string;
  valor_anterior: unknown;
  valor_nuevo: unknown;
  actor_id: bigint | string | null;
  actor_nombre: string | null;
  actor_apellido: string | null;
  actor_correo: string | null;
  creado_en: Date;
}

interface OpcionesConsulta {
  fecha: string | null;
  id?: bigint;
  busqueda?: string;
  tipo?: tipo_espacio;
  estado?: estado_espacio | 'todos';
  sector?: string;
  zonaId?: string;
  asignacionManual?: boolean;
  pagina?: number;
  limite?: number;
}

/** Columnas comunes del listado y la ficha administrativa. */
const CAMPOS_ESPACIO = Prisma.sql`
  e.id,
  e.nombre,
  e.tipo,
  e.sector,
  e.dimensiones,
  e.actividad_permitida,
  to_char(e.horario_inicio, 'HH24:MI') AS horario_inicio,
  to_char(e.horario_fin, 'HH24:MI') AS horario_fin,
  e.estado,
  e.asignacion_manual,
  e.creado_en,
  e.creado_por,
  up.nombre AS creado_por_nombre,
  up.apellido AS creado_por_apellido,
  z.id AS zona_id,
  z.nombre AS zona_nombre,
  z.tipo AS zona_tipo,
  z.activa AS zona_activa,
  to_char(z.horario_inicio, 'HH24:MI') AS zona_horario_inicio,
  to_char(z.horario_fin, 'HH24:MI') AS zona_horario_fin,
  z.aforo_maximo AS zona_aforo_maximo,
  COALESCE(
    (
      SELECT jsonb_agg(pr.nombre ORDER BY pr.nombre)
        FROM zona_productos zp
        JOIN productos pr ON pr.id = zp.producto_id
       WHERE zp.zona_id = z.id
         AND pr.activo = true
    ),
    '[]'::jsonb
  ) AS zona_productos,
  ST_AsGeoJSON(e.ubicacion)::jsonb AS ubicacion,
  b.fecha_inicio AS bloqueo_inicio,
  b.fecha_fin AS bloqueo_fin,
  b.motivo AS bloqueo_motivo,
  b.activo AS bloqueo_activo,
  p.numero AS permiso_numero,
  p.fecha_inicio AS permiso_inicio,
  p.fecha_fin AS permiso_fin,
  to_char(p.hora_inicio, 'HH24:MI') AS permiso_hora_inicio,
  to_char(p.hora_fin, 'HH24:MI') AS permiso_hora_fin,
  s.numero_radicado AS solicitud_numero,
  s.fecha_inicio AS solicitud_inicio,
  s.fecha_fin AS solicitud_fin,
  to_char(s.hora_inicio, 'HH24:MI') AS solicitud_hora_inicio,
  to_char(s.hora_fin, 'HH24:MI') AS solicitud_hora_fin,
  (
    SELECT COUNT(*)::int
      FROM espacio_bloqueos b2
     WHERE b2.espacio_id = e.id
  ) AS total_bloqueos,
  EXISTS (
    SELECT 1 FROM permisos p2 WHERE p2.espacio_id = e.id
  ) AS tiene_permisos,
  EXISTS (
    SELECT 1 FROM solicitudes s2 WHERE s2.espacio_id = e.id
  ) AS tiene_solicitudes
`;

/**
 * Administración municipal de espacios temporales y bloqueos (HU-15).
 *
 * La escritura exige gestor (revisor o administrador). La validación de
 * solapes de bloqueos queda también en la restricción EXCLUDE de la BD; aquí
 * se comprueba antes para responder con mensajes claros.
 */
@Injectable()
export class GestorEspaciosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Listado paginado del catálogo administrativo. */
  async listar(
    dto: ListarEspaciosGestorQueryDto = {},
  ): Promise<ListarEspaciosGestorResponseDto> {
    const pagina = dto.pagina ?? 1;
    const limite = dto.limite ?? 20;
    const filas = await this.obtenerFilas({
      fecha: dto.fecha ?? null,
      busqueda: dto.busqueda,
      tipo: dto.tipo,
      estado: dto.estado,
      sector: dto.sector,
      zonaId: dto.zonaId,
      asignacionManual: dto.asignacionManual,
      pagina,
      limite,
    });

    const total = filas[0]?.total_filas ?? 0;
    return {
      datos: filas.map((fila) => this.aListado(fila)),
      pagina,
      limite,
      total,
      totalPaginas: total === 0 ? 0 : Math.ceil(total / limite),
    };
  }

  /** Opciones cerradas para los filtros del catálogo. */
  async opciones(): Promise<OpcionesEspaciosGestorResponseDto> {
    const [zonas, sectores] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{ id: bigint | string; nombre: string; tipo: tipo_zona }>
      >`
        SELECT id, nombre, tipo
          FROM zonas
         WHERE activa = true
         ORDER BY nombre ASC, id ASC
      `,
      this.prisma.$queryRaw<{ valor: string }[]>`
        SELECT DISTINCT btrim(sector) AS valor
          FROM espacios_temporales
         WHERE sector IS NOT NULL
           AND btrim(sector) <> ''
         ORDER BY valor ASC
      `,
    ]);

    return {
      tipos: [...TIPOS_ESPACIO],
      estados: [...ESTADOS_ESPACIO],
      zonas: zonas.map(
        (zona): ZonaOpcionEspacioDto => ({
          id: zona.id.toString(),
          nombre: zona.nombre,
          tipo: zona.tipo,
        }),
      ),
      sectores: sectores.map((fila) => fila.valor),
    };
  }

  /** Zona activa que contiene un punto y su nombre de sector sugerido. */
  async zonaContenedora(
    lat: number,
    lng: number,
  ): Promise<{ zona: ZonaOpcionEspacioDto | null; sector: string | null }> {
    const zona = await this.buscarZona({
      type: 'Point',
      coordinates: [lng, lat],
    });
    return {
      zona:
        zona === null
          ? null
          : { id: zona.id.toString(), nombre: zona.nombre, tipo: zona.tipo },
      sector: zona?.nombre ?? null,
    };
  }

  /** Ficha administrativa con todos los bloqueos. */
  async detalle(
    id: string,
    dto: DetalleEspacioGestorQueryDto = {},
  ): Promise<EspacioGestorDetalleDto> {
    const espacioId = parseIdBigint(id);
    const [filas, bloqueos] = await Promise.all([
      this.obtenerFilas({ fecha: dto.fecha ?? null, id: espacioId }),
      this.consultarBloqueos(espacioId, dto.fecha ?? null),
    ]);
    const fila = filas[0];
    if (!fila) {
      throw new NotFoundException('El espacio solicitado no existe');
    }

    return Object.assign({}, this.aListado(fila), {
      bloqueos,
      puedeEliminar: !fila.tiene_permisos && !fila.tiene_solicitudes,
      creadoPor: this.nombreActor(
        fila.creado_por_nombre,
        fila.creado_por_apellido,
      ),
      bloqueoVigente: bloqueos.some((bloqueo) => bloqueo.activo),
      permisoVigente: fila.permiso_numero !== null,
      solicitudVigente: fila.solicitud_numero !== null,
    });
  }

  /** Crea un espacio y detecta la zona activa que contiene el punto. */
  async crear(
    idGestor: string,
    dto: CrearEspacioDto,
  ): Promise<EspacioGestorDetalleDto> {
    const actorId = parseIdBigint(idGestor);
    this.validarHorario(dto.horarioInicio, dto.horarioFin);
    const punto = validarPunto(dto.ubicacion);
    const zona = await this.buscarZona(punto);

    const id = await this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, actorId);
      const filas = await tx.$queryRaw<{ id: bigint | string }[]>`
        INSERT INTO espacios_temporales (
          nombre,
          tipo,
          sector,
          dimensiones,
          zona_id,
          ubicacion,
          actividad_permitida,
          horario_inicio,
          horario_fin,
          estado,
          asignacion_manual,
          creado_por
        )
        VALUES (
          ${dto.nombre.trim()},
          ${dto.tipo}::tipo_espacio,
          ${this.sectorInicial(dto.sector, zona?.nombre)},
          ${this.textoOpcionalSql(dto.dimensiones)},
          ${zona?.id ?? null},
          ${puntoASql(punto)},
          ${this.textoOpcionalSql(dto.actividadPermitida)},
          ${dto.horarioInicio ?? null}::time,
          ${dto.horarioFin ?? null}::time,
          ${dto.estado ?? 'disponible'}::estado_espacio,
          false,
          ${actorId}
        )
        RETURNING id
      `;
      const creado = filas[0];
      if (!creado) {
        throw new Error('La base de datos no devolvió el espacio creado');
      }
      return creado.id.toString();
    });

    return this.detalle(id);
  }

  /** Edita los campos enviados del espacio. */
  async actualizar(
    id: string,
    idGestor: string,
    dto: ActualizarEspacioDto,
  ): Promise<EspacioGestorDetalleDto> {
    const espacioId = parseIdBigint(id);
    const actorId = parseIdBigint(idGestor);
    this.validarHorario(dto.horarioInicio, dto.horarioFin);

    const hayCampos =
      dto.nombre !== undefined ||
      dto.tipo !== undefined ||
      dto.sector !== undefined ||
      dto.dimensiones !== undefined ||
      dto.actividadPermitida !== undefined ||
      dto.ubicacion !== undefined ||
      dto.horarioInicio !== undefined ||
      dto.horarioFin !== undefined ||
      dto.estado !== undefined;

    if (!hayCampos) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para actualizar el espacio',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, actorId);
      const actuales = await tx.$queryRaw<FilaEspacioActual[]>`
        SELECT
          e.id,
          e.nombre,
          e.estado,
          e.asignacion_manual,
          e.zona_id,
          z.nombre AS zona_nombre,
          e.sector,
          ST_AsGeoJSON(e.ubicacion)::jsonb AS ubicacion
        FROM espacios_temporales e
        LEFT JOIN zonas z ON z.id = e.zona_id
        WHERE e.id = ${espacioId}
        FOR UPDATE OF e
      `;
      const actual = actuales[0];
      if (!actual) {
        throw new NotFoundException('El espacio solicitado no existe');
      }

      if (dto.estado !== undefined && dto.estado !== actual.estado) {
        if (actual.asignacion_manual) {
          throw new ConflictException(
            'El espacio tiene una asignación manual. Libérala antes de cambiar el estado.',
          );
        }
      }

      const campos: Prisma.Sql[] = [];
      let recalcular = false;

      if (dto.nombre !== undefined) {
        campos.push(Prisma.sql`nombre = ${dto.nombre.trim()}`);
      }
      if (dto.tipo !== undefined) {
        campos.push(Prisma.sql`tipo = ${dto.tipo}::tipo_espacio`);
      }
      if (dto.sector !== undefined) {
        campos.push(Prisma.sql`sector = ${this.textoOpcionalSql(dto.sector)}`);
      }
      if (dto.dimensiones !== undefined) {
        campos.push(
          Prisma.sql`dimensiones = ${this.textoOpcionalSql(dto.dimensiones)}`,
        );
      }
      if (dto.actividadPermitida !== undefined) {
        campos.push(
          Prisma.sql`actividad_permitida = ${this.textoOpcionalSql(dto.actividadPermitida)}`,
        );
      }

      if (dto.ubicacion !== undefined) {
        const punto = validarPunto(dto.ubicacion);
        const zona = await this.buscarZona(punto, tx);
        campos.push(Prisma.sql`ubicacion = ${puntoASql(punto)}`);
        campos.push(Prisma.sql`zona_id = ${zona?.id ?? null}`);
        if (
          dto.sector === undefined &&
          (actual.sector === null ||
            actual.sector.trim() === '' ||
            actual.sector === actual.zona_nombre)
        ) {
          campos.push(
            Prisma.sql`sector = ${this.textoOpcionalSql(zona?.nombre ?? null)}`,
          );
        }
      }

      if (dto.horarioInicio !== undefined || dto.horarioFin !== undefined) {
        campos.push(Prisma.sql`horario_inicio = ${dto.horarioInicio ?? null}::time`);
        campos.push(Prisma.sql`horario_fin = ${dto.horarioFin ?? null}::time`);
      }

      if (dto.estado !== undefined) {
        campos.push(
          Prisma.sql`estado = ${dto.estado}::estado_espacio`,
        );
        if (dto.estado === 'disponible') recalcular = true;
      }

      if (campos.length === 0) {
        throw new BadRequestException(
          'No hay cambios efectivos para guardar en el espacio',
        );
      }

      await tx.$executeRaw`
        UPDATE espacios_temporales
           SET ${Prisma.join(campos, ', ')}
         WHERE id = ${espacioId}
      `;

      if (recalcular) {
        await tx.$executeRaw`SELECT fn_recalcular_estado_espacio(${espacioId})`;
      }
    });

    return this.detalle(espacioId.toString());
  }

  /** Borra el espacio solo si no tiene permisos ni solicitudes asociadas. */
  async eliminar(id: string, idGestor: string): Promise<void> {
    const espacioId = parseIdBigint(id);
    const actorId = parseIdBigint(idGestor);

    await this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, actorId);
      const espacios = await tx.$queryRaw<
        Array<{ id: bigint | string; nombre: string }>
      >`
        SELECT id, nombre
          FROM espacios_temporales
         WHERE id = ${espacioId}
         FOR UPDATE
      `;
      const espacio = espacios[0];
      if (!espacio) {
        throw new NotFoundException('El espacio solicitado no existe');
      }

      const relaciones = await tx.$queryRaw<
        Array<{ permisos: number; solicitudes: number }>
      >`
        SELECT
          (SELECT COUNT(*)::int FROM permisos p WHERE p.espacio_id = ${espacioId}) AS permisos,
          (SELECT COUNT(*)::int FROM solicitudes s WHERE s.espacio_id = ${espacioId}) AS solicitudes
      `;
      const total = relaciones[0];
      if (total && (total.permisos > 0 || total.solicitudes > 0)) {
        throw new ConflictException(
          'No se puede eliminar un espacio con permisos o solicitudes asociadas. ' +
            'Conserva el registro para no romper el historial.',
        );
      }

      await tx.$executeRaw`DELETE FROM espacios_temporales WHERE id = ${espacioId}`;
    });
  }

  /** Fija el estado manual disponible o mantenimiento. */
  async cambiarEstado(
    id: string,
    idGestor: string,
    dto: CambiarEstadoEspacioDto,
  ): Promise<EspacioEstadoResponseDto> {
    const espacioId = parseIdBigint(id);
    const actorId = parseIdBigint(idGestor);

    return this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, actorId);
      const actual = await this.bloquearEspacio(tx, espacioId);

      if (actual.asignacion_manual) {
        throw new ConflictException(
          'El espacio tiene una asignación manual. Libérala antes de cambiar el estado.',
        );
      }

      await tx.$executeRaw`
        UPDATE espacios_temporales
           SET estado = ${dto.estado}::estado_espacio
         WHERE id = ${espacioId}
      `;

      if (dto.estado === 'disponible') {
        await tx.$executeRaw`SELECT fn_recalcular_estado_espacio(${espacioId})`;
      }

      const final = await this.leerEstado(tx, espacioId);
      return {
        id: final.id.toString(),
        nombre: final.nombre,
        estado: final.estado,
        asignacionManual: final.asignacion_manual,
        mensaje:
          final.estado === 'mantenimiento'
            ? 'Espacio puesto en mantenimiento.'
            : final.estado === 'bloqueado'
              ? 'El espacio quedó bloqueado por un bloqueo vigente.'
              : final.estado === 'asignado'
                ? 'El espacio quedó asignado por un permiso o solicitud vigente.'
                : 'Espacio disponible.',
      };
    });
  }

  /** Asignación manual hasta que el gestor la libere. */
  async asignar(
    id: string,
    idGestor: string,
    dto: MovimientoEspacioDto = {},
  ): Promise<EspacioAsignacionResponseDto> {
    const espacioId = parseIdBigint(id);
    const actorId = parseIdBigint(idGestor);

    return this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, actorId);
      const actual = await this.bloquearEspacio(tx, espacioId);

      if (actual.estado === 'mantenimiento') {
        throw new ConflictException(
          'El espacio está en mantenimiento. Retíralo antes de asignarlo.',
        );
      }
      if (actual.asignacion_manual) {
        return {
          id: actual.id.toString(),
          nombre: actual.nombre,
          estado: actual.estado,
          asignacionManual: true,
          mensaje: 'El espacio ya tiene una asignación manual.',
        };
      }

      const ocupacion = await this.consultarOcupacionHoy(tx, espacioId);
      if (ocupacion.bloqueo) {
        throw new ConflictException(
          'El espacio tiene un bloqueo vigente hoy. No se puede asignar.',
        );
      }
      if (ocupacion.permiso || ocupacion.solicitud) {
        throw new ConflictException(
          'El espacio ya está ocupado por un permiso o una solicitud aprobada. ' +
            'La asignación debe gestionarse desde el trámite.',
        );
      }

      await tx.$executeRaw`
        UPDATE espacios_temporales
           SET estado = 'asignado'::estado_espacio,
               asignacion_manual = true
         WHERE id = ${espacioId}
      `;
      const final = await this.leerEstado(tx, espacioId);

      return {
        id: final.id.toString(),
        nombre: final.nombre,
        estado: final.estado,
        asignacionManual: final.asignacion_manual,
        mensaje: dto.motivo
          ? `Espacio asignado manualmente. Motivo: ${dto.motivo}.`
          : 'Espacio asignado manualmente.',
      };
    });
  }

  /** Libera una asignación manual y recalcula el estado. */
  async liberar(
    id: string,
    idGestor: string,
    dto: MovimientoEspacioDto = {},
  ): Promise<EspacioAsignacionResponseDto> {
    const espacioId = parseIdBigint(id);
    const actorId = parseIdBigint(idGestor);

    return this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, actorId);
      const actual = await this.bloquearEspacio(tx, espacioId);

      if (!actual.asignacion_manual) {
        throw new ConflictException(
          'El espacio no tiene una asignación manual. ' +
            'Si está ocupado por un permiso o solicitud, gestiona el trámite correspondiente.',
        );
      }

      await tx.$executeRaw`
        UPDATE espacios_temporales
           SET asignacion_manual = false
         WHERE id = ${espacioId}
      `;
      await tx.$executeRaw`SELECT fn_recalcular_estado_espacio(${espacioId})`;
      const final = await this.leerEstado(tx, espacioId);

      return {
        id: final.id.toString(),
        nombre: final.nombre,
        estado: final.estado,
        asignacionManual: final.asignacion_manual,
        mensaje: dto.motivo
          ? `Espacio liberado. Motivo: ${dto.motivo}.`
          : 'Espacio liberado.',
      };
    });
  }

  /** Lista los bloqueos registrados de un espacio. */
  async listarBloqueos(
    id: string,
    fecha?: string | null,
  ): Promise<ListarBloqueosResponseDto> {
    const espacioId = parseIdBigint(id);
    await this.verificarExistencia(espacioId);
    return { datos: await this.consultarBloqueos(espacioId, fecha ?? null) };
  }

  /** Crea un bloqueo evitando solapes con bloqueos, permisos y solicitudes. */
  async crearBloqueo(
    id: string,
    idGestor: string,
    dto: CrearBloqueoDto,
  ): Promise<BloqueoEspacioGestorDto> {
    const espacioId = parseIdBigint(id);
    const actorId = parseIdBigint(idGestor);
    this.validarFechas(dto.fechaInicio, dto.fechaFin);

    const bloqueoId = await this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, actorId);
      const espacio = await this.bloquearEspacio(tx, espacioId);
      if (espacio.asignacion_manual) {
        throw new ConflictException(
          'El espacio tiene una asignación manual. Libérala antes de crear un bloqueo.',
        );
      }
      await this.validarConflictosBloqueo(
        tx,
        espacioId,
        dto.fechaInicio,
        dto.fechaFin,
      );

      const filas = await tx.$queryRaw<{ id: bigint | string }[]>`
        INSERT INTO espacio_bloqueos (
          espacio_id,
          fecha_inicio,
          fecha_fin,
          motivo,
          creado_por
        )
        VALUES (
          ${espacioId},
          ${dto.fechaInicio}::date,
          ${dto.fechaFin}::date,
          ${this.textoOpcionalSql(dto.motivo)},
          ${actorId}
        )
        RETURNING id
      `;
      const creado = filas[0];
      if (!creado) {
        throw new Error('La base de datos no devolvió el bloqueo creado');
      }
      return creado.id.toString();
    });

    return this.obtenerBloqueo(espacioId, bloqueoId);
  }

  /** Edita un bloqueo existente y vuelve a validar conflictos. */
  async actualizarBloqueo(
    id: string,
    bloqueoId: string,
    idGestor: string,
    dto: ActualizarBloqueoDto,
  ): Promise<BloqueoEspacioGestorDto> {
    const espacioId = parseIdBigint(id);
    const bloqueo = parseIdBigint(bloqueoId);
    const actorId = parseIdBigint(idGestor);

    if (
      dto.fechaInicio === undefined &&
      dto.fechaFin === undefined &&
      dto.motivo === undefined
    ) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para actualizar el bloqueo',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, actorId);
      const espacio = await this.bloquearEspacio(tx, espacioId);
      if (espacio.asignacion_manual) {
        throw new ConflictException(
          'El espacio tiene una asignación manual. Libérala antes de editar un bloqueo.',
        );
      }

      const actuales = await tx.$queryRaw<
        Array<{ fecha_inicio: string | Date; fecha_fin: string | Date }>
      >`
        SELECT fecha_inicio, fecha_fin
          FROM espacio_bloqueos
         WHERE id = ${bloqueo}
           AND espacio_id = ${espacioId}
         FOR UPDATE
      `;
      const actual = actuales[0];
      if (!actual) {
        throw new NotFoundException('El bloqueo solicitado no existe');
      }

      const inicio = dto.fechaInicio ?? this.aFechaISO(actual.fecha_inicio);
      const fin = dto.fechaFin ?? this.aFechaISO(actual.fecha_fin);
      this.validarFechas(inicio, fin);
      await this.validarConflictosBloqueo(tx, espacioId, inicio, fin, bloqueo);

      await tx.$executeRaw`
        UPDATE espacio_bloqueos
           SET fecha_inicio = ${inicio}::date,
               fecha_fin = ${fin}::date,
               motivo = ${dto.motivo !== undefined ? this.textoOpcionalSql(dto.motivo) : Prisma.sql`motivo`}
         WHERE id = ${bloqueo}
           AND espacio_id = ${espacioId}
      `;
    });

    return this.obtenerBloqueo(espacioId, bloqueoId);
  }

  /** Elimina un bloqueo; el trigger recalcula el estado del espacio. */
  async eliminarBloqueo(
    id: string,
    bloqueoId: string,
    idGestor: string,
  ): Promise<void> {
    const espacioId = parseIdBigint(id);
    const bloqueo = parseIdBigint(bloqueoId);
    const actorId = parseIdBigint(idGestor);

    await this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, actorId);
      await this.bloquearEspacio(tx, espacioId);
      const eliminados = await tx.$executeRaw`
        DELETE FROM espacio_bloqueos
         WHERE id = ${bloqueo}
           AND espacio_id = ${espacioId}
      `;
      if (eliminados === 0) {
        throw new NotFoundException('El bloqueo solicitado no existe');
      }
    });
  }

  /** Historial de auditoría del espacio y de sus bloqueos. */
  async historial(
    id: string,
    pagina = 1,
    limite = 20,
  ): Promise<HistorialEspacioResponseDto> {
    const espacioId = parseIdBigint(id);
    const offset = (pagina - 1) * limite;

    const [espacios, filas, totalFilas] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{ id: bigint | string; nombre: string; estado: estado_espacio }>
      >`
        SELECT id, nombre, estado
          FROM espacios_temporales
         WHERE id = ${espacioId}
      `,
      this.prisma.$queryRaw<FilaHistorial[]>`
        SELECT
          a.id,
          a.tabla,
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
        WHERE (a.tabla = 'espacios_temporales' AND a.registro_id = ${espacioId})
           OR (a.tabla = 'espacio_bloqueos' AND a.registro_id = ${espacioId})
        ORDER BY a.creado_en DESC, a.id DESC
        LIMIT ${limite} OFFSET ${offset}
      `,
      this.prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total
          FROM auditoria a
         WHERE (a.tabla = 'espacios_temporales' AND a.registro_id = ${espacioId})
            OR (a.tabla = 'espacio_bloqueos' AND a.registro_id = ${espacioId})
      `,
    ]);

    const espacio = espacios[0];
    if (!espacio) {
      throw new NotFoundException('El espacio solicitado no existe');
    }

    const total = totalFilas[0]?.total ?? 0;
    return {
      espacio: {
        id: espacio.id.toString(),
        nombre: espacio.nombre,
        estado: espacio.estado,
      },
      datos: filas.map((fila) => this.aHistorial(fila)),
      pagina,
      limite,
      total,
      totalPaginas: total === 0 ? 0 : Math.ceil(total / limite),
    };
  }

  /** Consulta las filas con geometría, bloqueo y ocupación efectiva. */
  private async obtenerFilas(
    opciones: OpcionesConsulta,
  ): Promise<FilaEspacioGestor[]> {
    const { fecha, id } = opciones;
    const fechaSql = fecha
      ? Prisma.sql`${fecha}::date`
      : Prisma.sql`CURRENT_DATE`;

    const condiciones: Prisma.Sql[] = [];
    if (id !== undefined) condiciones.push(Prisma.sql`e.id = ${id}`);
    if (opciones.tipo !== undefined) {
      condiciones.push(Prisma.sql`e.tipo = ${opciones.tipo}::tipo_espacio`);
    }
    if (opciones.estado !== undefined && opciones.estado !== 'todos') {
      condiciones.push(
        Prisma.sql`e.estado = ${opciones.estado}::estado_espacio`,
      );
    }
    if (opciones.sector?.trim()) {
      condiciones.push(Prisma.sql`e.sector = ${opciones.sector.trim()}`);
    }
    if (opciones.zonaId !== undefined) {
      condiciones.push(Prisma.sql`e.zona_id = ${parseIdBigint(opciones.zonaId)}`);
    }
    if (opciones.asignacionManual !== undefined) {
      condiciones.push(
        Prisma.sql`e.asignacion_manual = ${opciones.asignacionManual}`,
      );
    }
    const busqueda = opciones.busqueda?.trim();
    if (busqueda) {
      const patron = `%${busqueda}%`;
      condiciones.push(Prisma.sql`(
        e.nombre ILIKE ${patron}
        OR e.sector ILIKE ${patron}
        OR e.actividad_permitida ILIKE ${patron}
        OR z.nombre ILIKE ${patron}
      )`);
    }

    const where =
      condiciones.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(condiciones, ' AND ')}`
        : Prisma.empty;
    const paginacion =
      opciones.limite !== undefined
        ? Prisma.sql`LIMIT ${opciones.limite} OFFSET ${(opciones.pagina ?? 1) - 1}`
        : Prisma.empty;

    return this.prisma.$queryRaw<FilaEspacioGestor[]>`
      SELECT
        ${CAMPOS_ESPACIO},
        COUNT(*) OVER()::int AS total_filas
      FROM espacios_temporales e
      LEFT JOIN usuarios up ON up.id = e.creado_por
      LEFT JOIN zonas z ON z.id = e.zona_id
      LEFT JOIN LATERAL (
        SELECT
          b.fecha_inicio,
          b.fecha_fin,
          b.motivo,
          (${fechaSql} BETWEEN b.fecha_inicio AND b.fecha_fin) AS activo
        FROM espacio_bloqueos b
        WHERE b.espacio_id = e.id
        ORDER BY
          (${fechaSql} BETWEEN b.fecha_inicio AND b.fecha_fin) DESC,
          b.fecha_inicio DESC
        LIMIT 1
      ) b ON true
      LEFT JOIN LATERAL (
        SELECT
          p.numero,
          p.fecha_inicio,
          p.fecha_fin,
          s.hora_inicio,
          s.hora_fin
        FROM permisos p
        JOIN solicitudes s ON s.id = p.solicitud_id
        WHERE p.espacio_id = e.id
          AND p.estado = 'vigente'
          AND ${fechaSql} BETWEEN p.fecha_inicio AND p.fecha_fin
        ORDER BY p.fecha_inicio DESC
        LIMIT 1
      ) p ON true
      LEFT JOIN LATERAL (
        SELECT
          s.numero_radicado,
          s.fecha_inicio,
          s.fecha_fin,
          s.hora_inicio,
          s.hora_fin
        FROM solicitudes s
        WHERE s.espacio_id = e.id
          AND s.estado = 'aprobada'
          AND ${fechaSql} BETWEEN s.fecha_inicio AND s.fecha_fin
        ORDER BY s.fecha_inicio DESC
        LIMIT 1
      ) s ON true
      ${where}
      ORDER BY e.nombre ASC, e.id ASC
      ${paginacion}
    `;
  }

  private async consultarBloqueos(
    espacioId: bigint,
    fecha: string | null,
  ): Promise<BloqueoEspacioGestorDto[]> {
    const fechaSql = fecha
      ? Prisma.sql`${fecha}::date`
      : Prisma.sql`CURRENT_DATE`;
    const filas = await this.prisma.$queryRaw<FilaBloqueo[]>`
      SELECT
        b.id,
        b.fecha_inicio,
        b.fecha_fin,
        b.motivo,
        (${fechaSql} BETWEEN b.fecha_inicio AND b.fecha_fin) AS activo,
        b.creado_por,
        u.nombre AS creado_por_nombre,
        u.apellido AS creado_por_apellido,
        b.creado_en
      FROM espacio_bloqueos b
      LEFT JOIN usuarios u ON u.id = b.creado_por
      WHERE b.espacio_id = ${espacioId}
      ORDER BY b.fecha_inicio DESC, b.id DESC
    `;
    return filas.map((fila) => this.aBloqueo(fila));
  }

  private async obtenerBloqueo(
    espacioId: bigint,
    bloqueoId: string,
  ): Promise<BloqueoEspacioGestorDto> {
    const filas = await this.prisma.$queryRaw<FilaBloqueo[]>`
      SELECT
        b.id,
        b.fecha_inicio,
        b.fecha_fin,
        b.motivo,
        (CURRENT_DATE BETWEEN b.fecha_inicio AND b.fecha_fin) AS activo,
        b.creado_por,
        u.nombre AS creado_por_nombre,
        u.apellido AS creado_por_apellido,
        b.creado_en
      FROM espacio_bloqueos b
      LEFT JOIN usuarios u ON u.id = b.creado_por
      WHERE b.id = ${parseIdBigint(bloqueoId)}
        AND b.espacio_id = ${espacioId}
    `;
    const fila = filas[0];
    if (!fila) {
      throw new NotFoundException('El bloqueo solicitado no existe');
    }
    return this.aBloqueo(fila);
  }

  private async buscarZona(
    punto: GeoJsonPoint,
    cliente: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<FilaZonaContenedora | null> {
    const [lng, lat] = punto.coordinates;
    const filas = await cliente.$queryRaw<FilaZonaContenedora[]>`
      SELECT z.id, z.nombre, z.tipo
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

  private async bloquearEspacio(
    tx: Prisma.TransactionClient,
    espacioId: bigint,
  ): Promise<FilaEspacioActual> {
    const filas = await tx.$queryRaw<FilaEspacioActual[]>`
      SELECT
        e.id,
        e.nombre,
        e.estado,
        e.asignacion_manual,
        e.zona_id,
        z.nombre AS zona_nombre,
        e.sector,
        ST_AsGeoJSON(e.ubicacion)::jsonb AS ubicacion
      FROM espacios_temporales e
      LEFT JOIN zonas z ON z.id = e.zona_id
      WHERE e.id = ${espacioId}
      FOR UPDATE OF e
    `;
    const fila = filas[0];
    if (!fila) {
      throw new NotFoundException('El espacio solicitado no existe');
    }
    return fila;
  }

  private async leerEstado(
    tx: Prisma.TransactionClient,
    espacioId: bigint,
  ): Promise<FilaEspacioActual> {
    const filas = await tx.$queryRaw<FilaEspacioActual[]>`
      SELECT
        e.id,
        e.nombre,
        e.estado,
        e.asignacion_manual,
        e.zona_id,
        z.nombre AS zona_nombre,
        e.sector,
        ST_AsGeoJSON(e.ubicacion)::jsonb AS ubicacion
      FROM espacios_temporales e
      LEFT JOIN zonas z ON z.id = e.zona_id
      WHERE e.id = ${espacioId}
    `;
    const fila = filas[0];
    if (!fila) {
      throw new NotFoundException('El espacio solicitado no existe');
    }
    return fila;
  }

  private async verificarExistencia(espacioId: bigint): Promise<void> {
    const filas = await this.prisma.$queryRaw<{ id: bigint | string }[]>`
      SELECT id FROM espacios_temporales WHERE id = ${espacioId}
    `;
    if (!filas[0]) {
      throw new NotFoundException('El espacio solicitado no existe');
    }
  }

  private async consultarOcupacionHoy(
    tx: Prisma.TransactionClient,
    espacioId: bigint,
  ): Promise<FilaOcupacion> {
    const filas = await tx.$queryRaw<FilaOcupacion[]>`
      SELECT
        EXISTS (
          SELECT 1 FROM espacio_bloqueos b
           WHERE b.espacio_id = ${espacioId}
             AND CURRENT_DATE BETWEEN b.fecha_inicio AND b.fecha_fin
        ) AS bloqueo,
        EXISTS (
          SELECT 1 FROM permisos p
           WHERE p.espacio_id = ${espacioId}
             AND p.estado = 'vigente'
             AND CURRENT_DATE BETWEEN p.fecha_inicio AND p.fecha_fin
        ) AS permiso,
        EXISTS (
          SELECT 1 FROM solicitudes s
           WHERE s.espacio_id = ${espacioId}
             AND s.estado = 'aprobada'
             AND CURRENT_DATE BETWEEN s.fecha_inicio AND s.fecha_fin
        ) AS solicitud
    `;
    return filas[0] ?? { bloqueo: false, permiso: false, solicitud: false };
  }

  private async validarConflictosBloqueo(
    tx: Prisma.TransactionClient,
    espacioId: bigint,
    inicio: string,
    fin: string,
    excluirBloqueo?: bigint,
  ): Promise<void> {
    const exclusion =
      excluirBloqueo !== undefined
        ? Prisma.sql`AND b.id <> ${excluirBloqueo}`
        : Prisma.empty;

    const bloqueos = await tx.$queryRaw<{ id: bigint | string }[]>`
      SELECT b.id
        FROM espacio_bloqueos b
       WHERE b.espacio_id = ${espacioId}
         ${exclusion}
         AND daterange(b.fecha_inicio, b.fecha_fin, '[]')
             && daterange(${inicio}::date, ${fin}::date, '[]')
       LIMIT 1
    `;
    if (bloqueos[0]) {
      throw new ConflictException(
        'Ya existe un bloqueo que se cruza con esas fechas.',
      );
    }

    const permisos = await tx.$queryRaw<{ numero: string }[]>`
      SELECT p.numero
        FROM permisos p
       WHERE p.espacio_id = ${espacioId}
         AND p.estado = 'vigente'
         AND daterange(p.fecha_inicio, p.fecha_fin, '[]')
             && daterange(${inicio}::date, ${fin}::date, '[]')
       LIMIT 1
    `;
    if (permisos[0]) {
      throw new ConflictException(
        `No se puede bloquear: el permiso ${permisos[0].numero} ocupa esas fechas.`,
      );
    }

    const solicitudes = await tx.$queryRaw<{ numero_radicado: string }[]>`
      SELECT s.numero_radicado
        FROM solicitudes s
       WHERE s.espacio_id = ${espacioId}
         AND s.estado = 'aprobada'
         AND daterange(s.fecha_inicio, s.fecha_fin, '[]')
             && daterange(${inicio}::date, ${fin}::date, '[]')
       LIMIT 1
    `;
    if (solicitudes[0]) {
      throw new ConflictException(
        `No se puede bloquear: la solicitud aprobada ${solicitudes[0].numero_radicado} ocupa esas fechas.`,
      );
    }
  }

  private validarHorario(
    inicio: string | null | undefined,
    fin: string | null | undefined,
  ): void {
    const tieneInicio = inicio !== undefined;
    const tieneFin = fin !== undefined;
    if (tieneInicio !== tieneFin) {
      throw new BadRequestException(
        'Las horas de inicio y fin deben enviarse juntas',
      );
    }
    if (inicio === undefined && fin === undefined) return;
    if ((inicio === null) !== (fin === null)) {
      throw new BadRequestException(
        'Debe indicar ambas horas o dejar ambas vacías',
      );
    }
    if (inicio !== undefined && fin !== undefined && inicio !== null && fin !== null && fin <= inicio) {
      throw new BadRequestException(
        'La hora de fin debe ser posterior a la hora de inicio',
      );
    }
  }

  private validarFechas(inicio: string, fin: string): void {
    if (!this.esFechaValida(inicio) || !this.esFechaValida(fin)) {
      throw new BadRequestException('Las fechas del bloqueo no son válidas');
    }
    if (fin < inicio) {
      throw new BadRequestException(
        'La fecha de fin debe ser igual o posterior a la fecha de inicio',
      );
    }
  }

  private esFechaValida(fecha: string): boolean {
    const valor = new Date(`${fecha}T00:00:00.000Z`);
    return (
      !Number.isNaN(valor.getTime()) &&
      valor.toISOString().slice(0, 10) === fecha
    );
  }

  private sectorInicial(
    sector: string | null | undefined,
    nombreZona: string | null | undefined,
  ): string | null {
    if (sector !== undefined) return this.textoOpcional(sector);
    return this.textoOpcional(nombreZona ?? null);
  }

  private textoOpcional(valor: string | null | undefined): string | null {
    if (valor === undefined || valor === null) return null;
    const texto = valor.trim();
    return texto.length > 0 ? texto : null;
  }

  private textoOpcionalSql(valor: string | null | undefined): Prisma.Sql {
    const texto = this.textoOpcional(valor);
    return texto === null ? Prisma.sql`NULL` : Prisma.sql`${texto}`;
  }

  private nombreActor(
    nombre: string | null,
    apellido: string | null,
  ): string {
    return [nombre, apellido].filter(Boolean).join(' ') || 'No disponible';
  }

  private aListado(fila: FilaEspacioGestor): EspacioGestorListadoDto {
    const ubicacion = leerGeoJson(fila.ubicacion, 'Point');
    if (!ubicacion || ubicacion.type !== 'Point') {
      throw new Error(
        `El espacio ${String(fila.id)} no tiene una ubicación válida: ${JSON.stringify(fila.ubicacion)}`,
      );
    }

    const disponibilidad = calcularDisponibilidad({
      estado: fila.estado,
      bloqueo: this.bloqueo(fila),
      permiso: this.permiso(fila),
      solicitud: this.solicitud(fila),
    });

    return {
      id: fila.id.toString(),
      nombre: fila.nombre,
      tipo: fila.tipo,
      sector: textoOpcional(fila.sector),
      dimensiones: textoOpcional(fila.dimensiones),
      actividadPermitida: textoOpcional(fila.actividad_permitida),
      estado: fila.estado,
      estadoEfectivo: disponibilidad.estadoEfectivo,
      disponible: disponibilidad.disponible,
      motivoEstado: disponibilidad.motivoEstado,
      asignacionManual: fila.asignacion_manual,
      ubicacion,
      horario: this.horario(fila),
      horarioPropio: {
        inicio: fila.horario_inicio,
        fin: fila.horario_fin,
      },
      zona: this.zona(fila),
      totalBloqueos: fila.total_bloqueos,
      tienePermisos: fila.tiene_permisos,
      tieneSolicitudes: fila.tiene_solicitudes,
      creadoEn: fila.creado_en,
    };
  }

  private aBloqueo(fila: FilaBloqueo): BloqueoEspacioGestorDto {
    return {
      id: fila.id.toString(),
      fechaInicio: this.aFechaISO(fila.fecha_inicio),
      fechaFin: this.aFechaISO(fila.fecha_fin),
      motivo: textoOpcional(fila.motivo),
      activo: fila.activo,
      creadoPorId: fila.creado_por.toString(),
      creadoPorNombre: this.nombreActor(
        fila.creado_por_nombre,
        fila.creado_por_apellido,
      ),
      creadoEn: fila.creado_en,
    };
  }

  private aHistorial(fila: FilaHistorial): HistorialEspacioItemDto {
    return {
      id: fila.id.toString(),
      tabla: fila.tabla,
      accion: this.normalizarAccion(fila.accion),
      creadoEn: fila.creado_en,
      actorId: fila.actor_id === null ? null : fila.actor_id.toString(),
      actorNombre: fila.actor_nombre,
      actorApellido: fila.actor_apellido,
      actorCorreo: fila.actor_correo,
      valorAnterior: fila.valor_anterior,
      valorNuevo: fila.valor_nuevo,
    };
  }

  private normalizarAccion(accion: string): 'insert' | 'update' | 'delete' {
    const valor = accion.toLowerCase();
    if (valor === 'insert' || valor === 'update' || valor === 'delete') {
      return valor;
    }
    return 'update';
  }

  private horario(fila: FilaEspacioGestor): {
    inicio: string | null;
    fin: string | null;
  } {
    if (fila.horario_inicio && fila.horario_fin) {
      return { inicio: fila.horario_inicio, fin: fila.horario_fin };
    }
    return {
      inicio: fila.zona_horario_inicio,
      fin: fila.zona_horario_fin,
    };
  }

  private zona(fila: FilaEspacioGestor): ZonaEspacioGestorDto | null {
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
      activa: fila.zona_activa ?? true,
      horarioInicio: fila.zona_horario_inicio,
      horarioFin: fila.zona_horario_fin,
      aforoMaximo: fila.zona_aforo_maximo,
      productos: this.listaProductos(fila.zona_productos),
    };
  }

  private listaProductos(valor: unknown): string[] {
    return Array.isArray(valor)
      ? valor.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private bloqueo(fila: FilaEspacioGestor): BloqueoDisponibilidad | null {
    if (fila.bloqueo_inicio === null || fila.bloqueo_fin === null) {
      return null;
    }
    return {
      fechaInicio: this.aFechaISO(fila.bloqueo_inicio),
      fechaFin: this.aFechaISO(fila.bloqueo_fin),
      motivo: textoOpcional(fila.bloqueo_motivo),
      activo: fila.bloqueo_activo === true,
    };
  }

  private permiso(fila: FilaEspacioGestor): PermisoDisponibilidad | null {
    if (
      !fila.permiso_numero ||
      fila.permiso_inicio === null ||
      fila.permiso_fin === null
    ) {
      return null;
    }
    return {
      numero: fila.permiso_numero,
      fechaInicio: this.aFechaISO(fila.permiso_inicio),
      fechaFin: this.aFechaISO(fila.permiso_fin),
      horaInicio: fila.permiso_hora_inicio,
      horaFin: fila.permiso_hora_fin,
    };
  }

  private solicitud(fila: FilaEspacioGestor): SolicitudDisponibilidad | null {
    if (
      !fila.solicitud_numero ||
      fila.solicitud_inicio === null ||
      fila.solicitud_fin === null
    ) {
      return null;
    }
    return {
      numeroRadicado: fila.solicitud_numero,
      fechaInicio: this.aFechaISO(fila.solicitud_inicio),
      fechaFin: this.aFechaISO(fila.solicitud_fin),
      horaInicio: fila.solicitud_hora_inicio,
      horaFin: fila.solicitud_hora_fin,
    };
  }

  private aFechaISO(valor: string | Date): string {
    if (valor instanceof Date) {
      return valor.toISOString().slice(0, 10);
    }
    return valor.slice(0, 10);
  }
}
