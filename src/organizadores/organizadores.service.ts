import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { fijarActorAuditoria } from '../common/auditoria';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActualizarOrganizacionDto } from './dto/actualizar-organizacion.dto';
import { CambiarEstadoOrganizacionDto } from './dto/cambiar-estado-organizacion.dto';
import { CrearOrganizacionDto } from './dto/crear-organizacion.dto';
import { ListarOrganizacionesQueryDto } from './dto/listar-organizaciones-query.dto';
import { ListarOrganizacionesResponseDto } from './dto/listar-organizaciones-response.dto';
import {
  OrganizacionGestorResponseDto,
  OrganizacionResponseDto,
} from './dto/organizacion-response.dto';

/**
 * Columnas de la organización para las respuestas del propio organizador.
 * `validado_por` se selecciona solo para la auditoría: no se expone en el DTO.
 */
const SELECT_ORGANIZACION_PROPIA = {
  usuario_id: true,
  nombre_organizacion: true,
  nit: true,
  representante: true,
  tipo_feria: true,
  contacto: true,
  estado: true,
  validado_por: true,
  validado_en: true,
} satisfies Prisma.organizadoresSelect;

type FilaOrganizacion = Prisma.organizadoresGetPayload<{
  select: typeof SELECT_ORGANIZACION_PROPIA;
}>;

/** Columnas de la organización que puede ver el gestor. */
const SELECT_ORGANIZACION_GESTOR = {
  ...SELECT_ORGANIZACION_PROPIA,
} satisfies Prisma.organizadoresSelect;

/** Columnas de la cuenta del organizador en el panel del gestor. */
const SELECT_ORGANIZADOR_GESTOR = {
  id: true,
  nombre: true,
  apellido: true,
  correo: true,
  telefono: true,
  rol: true,
  creado_en: true,
  organizadores_organizadores_usuario_idTousuarios: {
    select: SELECT_ORGANIZACION_GESTOR,
  },
} satisfies Prisma.usuariosSelect;

type FilaOrganizadorGestor = Prisma.usuariosGetPayload<{
  select: typeof SELECT_ORGANIZADOR_GESTOR;
}>;

/**
 * Registro y mantenimiento de la organización de un organizador de feria.
 *
 * El modelo es 1:1 (`organizadores.usuario_id` es PK), así que cada
 * organizador tiene como máximo una organización. La organización nace en
 * `pendiente_validacion` (valor por defecto de la BD) y solo el gestor
 * administrador puede activarla o suspenderla.
 *
 * La tabla `organizadores` no tiene trigger de auditoría: los cambios se
 * registran manualmente en `auditoria`, fijando `app.actor_id` dentro de la
 * transacción, igual que se hace con `comerciantes` y `gestores`.
 */
@Injectable()
export class OrganizadoresService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra la organización del organizador autenticado.
   *
   * Valida que el NIT y el nombre de la organización sean únicos antes de
   * insertar. El NIT también está protegido por `UNIQUE` en la BD; la
   * unicidad del nombre se comprueba sin distinguir mayúsculas.
   *
   * @throws ConflictException si el organizador ya tiene organización o si
   *   el NIT/nombre ya están registrados.
   */
  async crear(
    idUsuario: bigint,
    dto: CrearOrganizacionDto,
  ): Promise<OrganizacionResponseDto> {
    const nombreOrganizacion = dto.nombreOrganizacion.trim();
    const nit = dto.nit.trim();

    const [existente, mismoNombre, mismoNit] = await Promise.all([
      this.prisma.organizadores.findUnique({
        where: { usuario_id: idUsuario },
        select: { usuario_id: true },
      }),
      this.prisma.organizadores.findFirst({
        where: {
          nombre_organizacion: {
            equals: nombreOrganizacion,
            mode: 'insensitive',
          },
        },
        select: { usuario_id: true },
      }),
      this.prisma.organizadores.findUnique({
        where: { nit },
        select: { usuario_id: true },
      }),
    ]);

    if (existente) {
      throw new ConflictException(
        'El organizador ya tiene una organización registrada. Use ' +
          '`PATCH /organizadores/mi-organizacion` para actualizarla.',
      );
    }
    if (mismoNombre) {
      throw new ConflictException('Ya existe una organización con ese nombre.');
    }
    if (mismoNit) {
      throw new ConflictException('Ya existe una organización con ese NIT.');
    }

    const creada = await this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, idUsuario);

      const fila = await tx.organizadores.create({
        data: {
          usuario_id: idUsuario,
          nombre_organizacion: nombreOrganizacion,
          nit,
          representante: dto.representante.trim(),
          tipo_feria: dto.tipoFeria.trim(),
          contacto: dto.contacto?.trim() || null,
          // estado: la BD aplica «pendiente_validacion» por defecto.
        },
        select: SELECT_ORGANIZACION_PROPIA,
      });

      await tx.notificaciones.create({
        data: {
          usuario_id: idUsuario,
          tipo: 'registro_organizacion',
          asunto: 'Organización registrada',
          cuerpo:
            `La organización «${fila.nombre_organizacion}» quedó registrada ` +
            'y está pendiente de validación por el gestor municipal.',
          canal: 'app',
        },
      });

      await this.registrarAuditoria(tx, 'insert', fila, null, idUsuario);

      return fila;
    });

    return this.mapearPropia(
      creada,
      'Organización registrada en estado «Pendiente de validación».',
    );
  }

  /** Devuelve la organización del organizador autenticado. */
  async ver(idUsuario: bigint): Promise<OrganizacionResponseDto> {
    const organizacion = await this.prisma.organizadores.findUnique({
      where: { usuario_id: idUsuario },
      select: SELECT_ORGANIZACION_PROPIA,
    });

    if (!organizacion) {
      throw new NotFoundException(
        'El organizador aún no ha registrado una organización.',
      );
    }

    return this.mapearPropia(organizacion);
  }

  /**
   * Actualiza parcialmente la organización del organizador autenticado.
   *
   * No permite cambiar el estado ni los datos de validación: esos campos solo
   * los modifica el gestor municipal.
   */
  async actualizar(
    idUsuario: bigint,
    dto: ActualizarOrganizacionDto,
  ): Promise<OrganizacionResponseDto> {
    const anterior = await this.prisma.organizadores.findUnique({
      where: { usuario_id: idUsuario },
      select: SELECT_ORGANIZACION_PROPIA,
    });

    if (!anterior) {
      throw new NotFoundException(
        'El organizador aún no ha registrado una organización.',
      );
    }

    const datos: Prisma.organizadoresUncheckedUpdateInput = {};

    if (dto.nombreOrganizacion !== undefined) {
      const nombre = dto.nombreOrganizacion.trim();
      const repetido = await this.prisma.organizadores.findFirst({
        where: {
          nombre_organizacion: { equals: nombre, mode: 'insensitive' },
          usuario_id: { not: idUsuario },
        },
        select: { usuario_id: true },
      });
      if (repetido) {
        throw new ConflictException(
          'Ya existe otra organización con ese nombre.',
        );
      }
      datos.nombre_organizacion = nombre;
    }

    if (dto.nit !== undefined) {
      const nit = dto.nit.trim();
      const repetido = await this.prisma.organizadores.findUnique({
        where: { nit },
        select: { usuario_id: true },
      });
      if (repetido && repetido.usuario_id !== idUsuario) {
        throw new ConflictException('Ya existe otra organización con ese NIT.');
      }
      datos.nit = nit;
    }

    if (dto.representante !== undefined) {
      datos.representante = dto.representante.trim();
    }
    if (dto.tipoFeria !== undefined) {
      datos.tipo_feria = dto.tipoFeria.trim();
    }
    if (dto.contacto !== undefined) {
      datos.contacto = dto.contacto.trim() || null;
    }

    if (Object.keys(datos).length === 0) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para actualizar ' +
          '(nombreOrganizacion, nit, representante, tipoFeria o contacto).',
      );
    }

    const actualizada = await this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, idUsuario);

      const fila = await tx.organizadores.update({
        where: { usuario_id: idUsuario },
        data: datos,
        select: SELECT_ORGANIZACION_PROPIA,
      });

      await this.registrarAuditoria(tx, 'update', fila, anterior, idUsuario);

      return fila;
    });

    return this.mapearPropia(actualizada, 'Organización actualizada.');
  }

  /**
   * Lista las organizaciones para el gestor municipal.
   *
   * Solo incluye cuentas con rol organizador que ya hayan registrado su
   * organización. La búsqueda se aplica por palabras sobre los datos del
   * organizador y de la organización.
   */
  async listar(
    dto: ListarOrganizacionesQueryDto,
  ): Promise<ListarOrganizacionesResponseDto> {
    const pagina = dto.pagina ?? 1;
    const limite = dto.limite ?? 20;
    const where = this.construirFiltros(dto);

    const [filas, total] = await Promise.all([
      this.prisma.usuarios.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: [{ creado_en: 'desc' }, { id: 'desc' }],
        select: SELECT_ORGANIZADOR_GESTOR,
      }),
      this.prisma.usuarios.count({ where }),
    ]);

    return {
      datos: filas.map((fila) => this.mapearGestor(fila)),
      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas: total === 0 ? 0 : Math.ceil(total / limite),
      },
    };
  }

  /** Devuelve el detalle de una organización para el gestor municipal. */
  async detalle(idOrganizador: bigint): Promise<OrganizacionGestorResponseDto> {
    const fila = await this.prisma.usuarios.findUnique({
      where: { id: idOrganizador },
      select: SELECT_ORGANIZADOR_GESTOR,
    });

    if (
      !fila ||
      fila.rol !== 'organizador' ||
      !fila.organizadores_organizadores_usuario_idTousuarios
    ) {
      throw new NotFoundException('La organización solicitada no existe.');
    }

    return this.mapearGestor(fila);
  }

  /**
   * Activa o suspende una organización.
   *
   * Solo se permite desde el perfil administrador (lo aplica el guard del
   * controlador). El estado y los datos de validación quedan auditados con el
   * gestor como actor; el organizador recibe una notificación interna.
   *
   * @throws NotFoundException si la cuenta no existe o no es un organizador
   *   con organización registrada.
   * @throws ConflictException si la organización ya está en ese estado.
   */
  async cambiarEstado(
    idOrganizador: bigint,
    dto: CambiarEstadoOrganizacionDto,
    idGestor: bigint,
  ): Promise<OrganizacionGestorResponseDto> {
    const resultado = await this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, idGestor);

      const fila = await tx.usuarios.findUnique({
        where: { id: idOrganizador },
        select: SELECT_ORGANIZADOR_GESTOR,
      });

      if (
        !fila ||
        fila.rol !== 'organizador' ||
        !fila.organizadores_organizadores_usuario_idTousuarios
      ) {
        throw new NotFoundException('La organización solicitada no existe.');
      }

      const anterior = fila.organizadores_organizadores_usuario_idTousuarios;

      if (anterior.estado === dto.estado) {
        throw new ConflictException(
          `La organización ya se encuentra en estado «${dto.estado}».`,
        );
      }

      const actualizada = await tx.organizadores.update({
        where: { usuario_id: idOrganizador },
        data: {
          estado: dto.estado,
          validado_por: idGestor,
          validado_en: new Date(),
        },
        select: SELECT_ORGANIZACION_PROPIA,
      });

      await this.registrarAuditoria(
        tx,
        'update',
        actualizada,
        anterior,
        idGestor,
      );

      const accion = dto.estado === 'activa' ? 'activada' : 'suspendida';
      await tx.notificaciones.create({
        data: {
          usuario_id: idOrganizador,
          tipo: 'estado_organizacion',
          asunto:
            dto.estado === 'activa'
              ? 'Organización activa'
              : 'Organización suspendida',
          cuerpo:
            `La organización «${actualizada.nombre_organizacion}» fue ` +
            `${accion} por el gestor municipal.` +
            (dto.motivo ? ` Motivo: ${dto.motivo.trim()}` : ''),
          canal: 'app',
        },
      });

      return {
        fila,
        actualizada,
      };
    });

    return this.mapearGestor({
      ...resultado.fila,
      organizadores_organizadores_usuario_idTousuarios: resultado.actualizada,
    });
  }

  /** Construye el `where` del listado de organizaciones. */
  private construirFiltros(
    dto: ListarOrganizacionesQueryDto,
  ): Prisma.usuariosWhereInput {
    const condiciones: Prisma.usuariosWhereInput[] = [
      { rol: 'organizador' },
      {
        organizadores_organizadores_usuario_idTousuarios: {
          isNot: null,
        },
      },
    ];

    if (dto.estado) {
      condiciones.push({
        organizadores_organizadores_usuario_idTousuarios: {
          is: { estado: dto.estado },
        },
      });
    }

    const terminos = (dto.busqueda ?? '')
      .trim()
      .split(/\s+/)
      .filter((termino) => termino.length > 0);

    for (const termino of terminos) {
      condiciones.push({
        OR: [
          { nombre: { contains: termino, mode: 'insensitive' } },
          { apellido: { contains: termino, mode: 'insensitive' } },
          { correo: { contains: termino, mode: 'insensitive' } },
          {
            organizadores_organizadores_usuario_idTousuarios: {
              is: {
                nombre_organizacion: {
                  contains: termino,
                  mode: 'insensitive',
                },
              },
            },
          },
          {
            organizadores_organizadores_usuario_idTousuarios: {
              is: { nit: { contains: termino, mode: 'insensitive' } },
            },
          },
          {
            organizadores_organizadores_usuario_idTousuarios: {
              is: {
                representante: {
                  contains: termino,
                  mode: 'insensitive',
                },
              },
            },
          },
        ],
      });
    }

    return { AND: condiciones };
  }

  /** Convierte una fila de organización en la respuesta del organizador. */
  private mapearPropia(
    fila: FilaOrganizacion,
    mensaje?: string,
  ): OrganizacionResponseDto {
    return {
      usuarioId: fila.usuario_id.toString(),
      nombreOrganizacion: fila.nombre_organizacion,
      nit: fila.nit,
      representante: fila.representante,
      tipoFeria: fila.tipo_feria,
      contacto: fila.contacto,
      estado: fila.estado,
      validadoEn: fila.validado_en,
      ...(mensaje ? { mensaje } : {}),
    };
  }

  /** Convierte una fila de usuario con organización en la respuesta del gestor. */
  private mapearGestor(
    fila: FilaOrganizadorGestor,
  ): OrganizacionGestorResponseDto {
    const organizacion = fila.organizadores_organizadores_usuario_idTousuarios!;

    return {
      usuarioId: fila.id.toString(),
      nombre: fila.nombre,
      apellido: fila.apellido,
      correo: fila.correo,
      telefono: fila.telefono,
      nombreOrganizacion: organizacion.nombre_organizacion,
      nit: organizacion.nit,
      representante: organizacion.representante,
      tipoFeria: organizacion.tipo_feria,
      contacto: organizacion.contacto,
      estado: organizacion.estado,
      validadoPor: organizacion.validado_por?.toString() ?? null,
      validadoEn: organizacion.validado_en,
      creadoEn: fila.creado_en,
    };
  }

  /**
   * Registra el cambio de `organizadores` en la tabla `auditoria`.
   *
   * La tabla no tiene trigger, así que se imita a `fn_auditoria` con SQL
   * parametrizado. Se usa `now()` de PostgreSQL para la fecha del registro.
   */
  private async registrarAuditoria(
    tx: Prisma.TransactionClient,
    accion: 'insert' | 'update',
    fila: FilaOrganizacion,
    anterior: FilaOrganizacion | null,
    idActor: bigint,
  ): Promise<void> {
    const valorNuevo = this.valorAuditoria(fila);
    const valorAnterior = anterior ? this.valorAuditoria(anterior) : null;

    await tx.$executeRaw`
      INSERT INTO auditoria
        (tabla, registro_id, accion, valor_anterior, valor_nuevo, actor_id)
      VALUES (
        'organizadores',
        ${fila.usuario_id},
        ${accion},
        ${valorAnterior ? JSON.stringify(valorAnterior) : null}::jsonb,
        ${JSON.stringify(valorNuevo)}::jsonb,
        ${idActor}
      )
    `;
  }

  /** Valores de la organización que se guardan en la auditoría. */
  private valorAuditoria(fila: FilaOrganizacion): Record<string, unknown> {
    return {
      usuario_id: fila.usuario_id.toString(),
      nombre_organizacion: fila.nombre_organizacion,
      nit: fila.nit,
      representante: fila.representante,
      tipo_feria: fila.tipo_feria,
      contacto: fila.contacto,
      estado: fila.estado,
      validado_por: fila.validado_por?.toString() ?? null,
      validado_en: fila.validado_en?.toISOString() ?? null,
    };
  }
}
