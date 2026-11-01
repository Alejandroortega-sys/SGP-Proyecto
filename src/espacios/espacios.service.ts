import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { leerGeoJson } from '../common/geo';
import { parseIdBigint } from '../common/parse-id';
import type {
  estado_espacio,
  tipo_espacio,
  tipo_zona,
} from '../generated/prisma/client';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  calcularDisponibilidad,
  cubreHorario,
  seCruzaHorario,
  type BloqueoDisponibilidad,
  type PermisoDisponibilidad,
  type SolicitudDisponibilidad,
} from './disponibilidad';
import {
  DetalleEspacioQueryDto,
  EspacioDetalleDto,
  EspacioListadoDto,
  ListarEspaciosQueryDto,
  ListarEspaciosResponseDto,
  OpcionesEspaciosResponseDto,
  textoOpcional,
  ZonaRestriccionesDto,
  ZonaResumenEspacioDto,
} from './dto/espacios.dto';

interface FilaEspacio {
  id: bigint | string;
  nombre: string;
  tipo: tipo_espacio;
  sector: string | null;
  dimensiones: string | null;
  actividad_permitida: string | null;
  horario_inicio: string | null;
  horario_fin: string | null;
  estado: estado_espacio;
  creado_en: Date;
  zona_id: bigint | string | null;
  zona_nombre: string | null;
  zona_tipo: tipo_zona | null;
  zona_activa: boolean | null;
  zona_horario_inicio: string | null;
  zona_horario_fin: string | null;
  zona_aforo_maximo: number | null;
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
  productos: string[];
}

/** Opciones de filtrado de la consulta. */
interface OpcionesConsultaEspacios {
  fecha: string | null;
  id?: bigint;
  sector?: string;
  actividad?: string;
  horaInicio?: string;
  horaFin?: string;
}

/**
 * Consulta de espacios temporales para comerciantes (HU-09).
 *
 * El estado efectivo no se limita al enum `estado` de la tabla: también se
 * cruzan los bloqueos de fechas, los permisos vigentes y las solicitudes
 * aprobadas. Así un espacio ocupado o bloqueado nunca se presenta como
 * disponible, aunque su fila siga marcada como `disponible` (la transición de
 * estado automática pertenece al Sprint 3).
 */
@Injectable()
export class EspaciosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista los espacios. Por defecto solo devuelve los disponibles; con
   * `incluirNoDisponibles` devuelve todos para consultar su estado.
   */
  async listar(dto: ListarEspaciosQueryDto = {}): Promise<ListarEspaciosResponseDto> {
    this.validarRangoHorario(dto);

    const filas = await this.obtenerFilas({
      fecha: dto.fecha ?? null,
      sector: dto.sector,
      actividad: dto.actividad,
      horaInicio: dto.horaInicio,
      horaFin: dto.horaFin,
    });

    // Con filtro horario solo entran los espacios cuyo horario permitido cubre
    // el rango solicitado. Así el resultado y el conteo son coherentes.
    const filasEnHorario = filas.filter((fila) =>
      cubreHorario(this.horario(fila), dto.horaInicio ?? null, dto.horaFin ?? null),
    );
    const todos = filasEnHorario.map((fila) =>
      this.aListado(fila, dto.horaInicio, dto.horaFin),
    );
    const disponibles = todos.filter((espacio) => espacio.disponible).length;
    const datos = dto.incluirNoDisponibles
      ? todos
      : todos.filter((espacio) => espacio.disponible);

    return {
      datos,
      total: datos.length,
      disponibles,
      noDisponibles: todos.length - disponibles,
    };
  }

  /**
   * Devuelve las opciones distintas de sector y actividad para el panel de
   * filtros. Se calculan sobre todos los espacios registrados, no solo sobre
   * los disponibles, para que las opciones no desaparezcan al filtrar.
   */
  async opciones(): Promise<OpcionesEspaciosResponseDto> {
    const [sectores, actividades] = await Promise.all([
      this.prisma.$queryRaw<{ valor: string }[]>`
        SELECT DISTINCT btrim(sector) AS valor
          FROM espacios_temporales
         WHERE sector IS NOT NULL
           AND btrim(sector) <> ''
         ORDER BY valor ASC
      `,
      this.prisma.$queryRaw<{ valor: string }[]>`
        SELECT DISTINCT btrim(actividad_permitida) AS valor
          FROM espacios_temporales
         WHERE actividad_permitida IS NOT NULL
           AND btrim(actividad_permitida) <> ''
         ORDER BY valor ASC
      `,
    ]);

    return {
      sectores: sectores.map((fila) => fila.valor),
      actividades: actividades.map((fila) => fila.valor),
    };
  }

  /**
   * Devuelve la ficha completa de un espacio, incluidas las restricciones de
   * su zona. Funciona para espacios disponibles y no disponibles.
   */
  async detalle(
    id: string,
    dto: DetalleEspacioQueryDto = {},
  ): Promise<EspacioDetalleDto> {
    const espacioId = parseIdBigint(id);
    const filas = await this.obtenerFilas({
      fecha: dto.fecha ?? null,
      id: espacioId,
    });
    const fila = filas[0];
    if (!fila) {
      throw new NotFoundException('El espacio solicitado no existe');
    }
    return this.aDetalle(fila);
  }

  /** Valida que el rango horario venga completo, con fecha y en orden. */
  private validarRangoHorario(dto: ListarEspaciosQueryDto): void {
    const tieneInicio = dto.horaInicio !== undefined;
    const tieneFin = dto.horaFin !== undefined;

    if (tieneInicio !== tieneFin) {
      throw new BadRequestException(
        'Las horas de inicio y fin deben enviarse juntas',
      );
    }
    if (!tieneInicio) return;

    if (!dto.fecha) {
      throw new BadRequestException(
        'Debe enviar la fecha para consultar un rango horario',
      );
    }
    if (dto.horaFin! <= dto.horaInicio!) {
      throw new BadRequestException(
        'La hora de fin debe ser posterior a la hora de inicio',
      );
    }
  }

  /** Consulta las filas con la geometría y los cruces de disponibilidad. */
  private async obtenerFilas(
    opciones: OpcionesConsultaEspacios,
  ): Promise<FilaEspacio[]> {
    const { fecha, id, sector, actividad, horaInicio, horaFin } = opciones;
    const fechaSql = fecha
      ? Prisma.sql`${fecha}::date`
      : Prisma.sql`CURRENT_DATE`;

    const condiciones: Prisma.Sql[] = [];
    if (id) condiciones.push(Prisma.sql`e.id = ${id}`);
    if (sector) condiciones.push(Prisma.sql`e.sector = ${sector}`);
    if (actividad) {
      condiciones.push(Prisma.sql`e.actividad_permitida = ${actividad}`);
    }
    const where =
      condiciones.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(condiciones, ' AND ')}`
        : Prisma.empty;

    const filtraHora = Boolean(horaInicio && horaFin);
    const condicionHoraPermiso = filtraHora
      ? Prisma.sql`AND (${horaInicio}::time < s.hora_fin AND ${horaFin}::time > s.hora_inicio)`
      : Prisma.empty;
    const condicionHoraSolicitud = filtraHora
      ? Prisma.sql`AND (${horaInicio}::time < s.hora_fin AND ${horaFin}::time > s.hora_inicio)`
      : Prisma.empty;

    return this.prisma.$queryRaw<FilaEspacio[]>`
      SELECT
        e.id,
        e.nombre,
        e.tipo,
        e.sector,
        e.dimensiones,
        e.actividad_permitida,
        to_char(e.horario_inicio, 'HH24:MI') AS horario_inicio,
        to_char(e.horario_fin, 'HH24:MI') AS horario_fin,
        e.estado,
        e.creado_en,
        z.id AS zona_id,
        z.nombre AS zona_nombre,
        z.tipo AS zona_tipo,
        z.activa AS zona_activa,
        to_char(z.horario_inicio, 'HH24:MI') AS zona_horario_inicio,
        to_char(z.horario_fin, 'HH24:MI') AS zona_horario_fin,
        z.aforo_maximo AS zona_aforo_maximo,
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
        COALESCE(
          (
            SELECT jsonb_agg(pr.nombre ORDER BY pr.nombre)
              FROM zona_productos zp
              JOIN productos pr ON pr.id = zp.producto_id
             WHERE zp.zona_id = z.id
               AND pr.activo = true
          ),
          '[]'::jsonb
        ) AS productos
      FROM espacios_temporales e
      LEFT JOIN zonas z ON z.id = e.zona_id
      LEFT JOIN LATERAL (
        SELECT
          fecha_inicio,
          fecha_fin,
          motivo,
          (${fechaSql} BETWEEN fecha_inicio AND fecha_fin) AS activo
        FROM espacio_bloqueos
        WHERE espacio_id = e.id
        ORDER BY
          (${fechaSql} BETWEEN fecha_inicio AND fecha_fin) DESC,
          fecha_inicio DESC
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
          ${condicionHoraPermiso}
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
          ${condicionHoraSolicitud}
        ORDER BY s.fecha_inicio DESC
        LIMIT 1
      ) s ON true
      ${where}
      ORDER BY e.nombre ASC, e.id ASC
    `;
  }

  /** Convierte una fila al DTO del listado. */
  private aListado(
    fila: FilaEspacio,
    horaInicio?: string,
    horaFin?: string,
  ): EspacioListadoDto {
    const disponibilidad = this.calcular(fila, horaInicio, horaFin);
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
      ubicacion: this.leerUbicacion(fila),
      horario: this.horario(fila),
      zona: this.zonaResumen(fila),
    };
  }

  /** Convierte una fila al DTO de la ficha completa. */
  private aDetalle(fila: FilaEspacio): EspacioDetalleDto {
    const listado = this.aListado(fila);
    return {
      id: listado.id,
      nombre: listado.nombre,
      tipo: listado.tipo,
      sector: listado.sector,
      dimensiones: listado.dimensiones,
      actividadPermitida: listado.actividadPermitida,
      estado: listado.estado,
      estadoEfectivo: listado.estadoEfectivo,
      disponible: listado.disponible,
      motivoEstado: listado.motivoEstado,
      ubicacion: listado.ubicacion,
      horario: listado.horario,
      bloqueo: this.bloqueo(fila),
      permiso: this.permiso(fila),
      zona: this.zonaRestricciones(fila),
      creadoEn: fila.creado_en,
    };
  }

  /** Calcula la disponibilidad cruzando estado, bloqueos y ocupaciones. */
  private calcular(
    fila: FilaEspacio,
    horaInicio?: string,
    horaFin?: string,
  ) {
    let permiso = this.permiso(fila);
    let solicitud = this.solicitud(fila);

    // El SQL ya filtra por horario, pero se repite la comprobación en memoria
    // para que el servicio sea consistente y fácil de probar de forma aislada.
    if (horaInicio && horaFin) {
      if (
        permiso?.horaInicio &&
        permiso.horaFin &&
        !seCruzaHorario(
          horaInicio,
          horaFin,
          permiso.horaInicio,
          permiso.horaFin,
        )
      ) {
        permiso = null;
      }
      if (
        solicitud?.horaInicio &&
        solicitud.horaFin &&
        !seCruzaHorario(
          horaInicio,
          horaFin,
          solicitud.horaInicio,
          solicitud.horaFin,
        )
      ) {
        solicitud = null;
      }
    }

    return calcularDisponibilidad({
      estado: fila.estado,
      bloqueo: this.bloqueo(fila),
      permiso,
      solicitud,
    });
  }

  /** Normaliza la geometría de la ubicación como Point GeoJSON. */
  private leerUbicacion(fila: FilaEspacio) {
    const ubicacion = leerGeoJson(fila.ubicacion, 'Point');
    if (!ubicacion || ubicacion.type !== 'Point') {
      throw new Error(
        `El espacio ${fila.id.toString()} no tiene una ubicación válida`,
      );
    }
    return ubicacion;
  }

  /** Horario del espacio; si no tiene, hereda el de su zona. */
  private horario(fila: FilaEspacio) {
    if (fila.horario_inicio && fila.horario_fin) {
      return { inicio: fila.horario_inicio, fin: fila.horario_fin };
    }
    return {
      inicio: fila.zona_horario_inicio,
      fin: fila.zona_horario_fin,
    };
  }

  /** Resumen de la zona asociada. */
  private zonaResumen(fila: FilaEspacio): ZonaResumenEspacioDto | null {
    if (fila.zona_id === null || fila.zona_nombre === null || fila.zona_tipo === null) {
      return null;
    }
    return {
      id: fila.zona_id.toString(),
      nombre: fila.zona_nombre,
      tipo: fila.zona_tipo,
    };
  }

  /** Restricciones completas de la zona asociada. */
  private zonaRestricciones(fila: FilaEspacio): ZonaRestriccionesDto | null {
    const resumen = this.zonaResumen(fila);
    if (!resumen) return null;
    return {
      id: resumen.id,
      nombre: resumen.nombre,
      tipo: resumen.tipo,
      activa: fila.zona_activa ?? true,
      horarioInicio: fila.zona_horario_inicio,
      horarioFin: fila.zona_horario_fin,
      aforoMaximo: fila.zona_aforo_maximo,
      productos: fila.productos ?? [],
    };
  }

  /** Bloqueo más relevante (activo primero) del espacio. */
  private bloqueo(fila: FilaEspacio): BloqueoDisponibilidad | null {
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

  /** Permiso vigente que cubre la fecha consultada. */
  private permiso(fila: FilaEspacio): PermisoDisponibilidad | null {
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

  /** Solicitud aprobada que cubre la fecha consultada. */
  private solicitud(fila: FilaEspacio): SolicitudDisponibilidad | null {
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

  /** Convierte una fecha de `pg` a `YYYY-MM-DD`. */
  private aFechaISO(valor: string | Date): string {
    if (valor instanceof Date) {
      return valor.toISOString().slice(0, 10);
    }
    return valor.slice(0, 10);
  }
}
