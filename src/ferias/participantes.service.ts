import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { fijarActorAuditoria } from '../common/auditoria';
import { parseIdBigint } from '../common/parse-id';
import {
  Prisma,
  type estado_feria,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActualizarParticipanteFeriaDto,
  CrearParticipanteFeriaDto,
  EnviarListadoParticipantesResponseDto,
  ListadoParticipantesFeriaDto,
  ListadoParticipantesGestorDto,
  ParticipanteFeriaDto,
  type OrganizadorParticipantesDto,
} from './dto/participantes.dto';
import type { ProductoFeriaDto } from './dto/ferias.dto';

interface FilaFeriaParticipantes {
  id: bigint;
  numero_radicado: string;
  nombre: string;
  estado: estado_feria;
  fecha_inicio: Date | string;
  fecha_fin: Date | string;
  numero_puestos: number;
  organizador_id: bigint;
  participantes_enviados_en: Date | null;
  zonas: { id: bigint; nombre: string };
  organizadores: {
    nombre_organizacion: string;
    nit: string;
    usuarios_organizadores_usuario_idTousuarios: {
      id: bigint;
      nombre: string;
      apellido: string | null;
      correo: string;
    };
  };
}

interface FilaParticipante {
  id: bigint;
  nombre_vendedor: string;
  documento: string | null;
  creado_en: Date;
  actualizado_en: Date;
  feria_vendedor_productos: {
    productos: { id: bigint; nombre: string };
  }[];
}

const SELECT_FERIA_PARTICIPANTES = {
  id: true,
  numero_radicado: true,
  nombre: true,
  estado: true,
  fecha_inicio: true,
  fecha_fin: true,
  numero_puestos: true,
  organizador_id: true,
  participantes_enviados_en: true,
  zonas: { select: { id: true, nombre: true } },
  organizadores: {
    select: {
      nombre_organizacion: true,
      nit: true,
      usuarios_organizadores_usuario_idTousuarios: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          correo: true,
        },
      },
    },
  },
} satisfies Prisma.feriasSelect;

const SELECT_PARTICIPANTE = {
  id: true,
  nombre_vendedor: true,
  documento: true,
  creado_en: true,
  actualizado_en: true,
  feria_vendedor_productos: {
    select: {
      productos: { select: { id: true, nombre: true } },
    },
  },
} satisfies Prisma.feria_vendedoresSelect;

type ClientePrisma = Prisma.TransactionClient | PrismaService;

/**
 * Participantes (vendedores) de una feria aprobada (HU-23).
 *
 * Solo el organizador dueño gestiona la lista mientras la feria está aprobada
 * y el listado final no se ha enviado. El gestor consulta el listado final.
 */
@Injectable()
export class ParticipantesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Listado y cupo para el organizador dueño de la feria. */
  async listar(
    idUsuario: string,
    idFeria: string,
  ): Promise<ListadoParticipantesFeriaDto> {
    const organizadorId = parseIdBigint(idUsuario);
    const feriaId = parseIdBigint(idFeria);
    const feria = await this.prisma.ferias.findFirst({
      where: { id: feriaId },
      select: SELECT_FERIA_PARTICIPANTES,
    });

    if (!feria || feria.organizador_id !== organizadorId) {
      throw new NotFoundException('La feria no existe o no te pertenece');
    }

    return this.construirListado(feria);
  }

  /** Crea un participante o reactiva uno retirado con el mismo documento. */
  async crear(
    idUsuario: string,
    idFeria: string,
    dto: CrearParticipanteFeriaDto,
  ): Promise<ParticipanteFeriaDto> {
    const organizadorId = parseIdBigint(idUsuario);
    const feriaId = parseIdBigint(idFeria);

    return this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, organizadorId);
      const feria = await this.bloquearFeria(tx, feriaId, organizadorId);
      this.validarFeriaGestionable(feria);

      const productos = await this.validarProductos(
        dto.productoIds,
        feria.zonas.id,
        tx,
      );
      const ocupados = await tx.feria_vendedores.count({
        where: { feria_id: feriaId, activo: true },
      });

      if (ocupados >= feria.numero_puestos) {
        throw new ConflictException(
          `La feria alcanzó su cupo aprobado de ${feria.numero_puestos} participantes. Retira uno para agregar otro.`,
        );
      }

      let participanteId: bigint;
      const documento = dto.documento ?? null;
      const existente = documento
        ? await tx.feria_vendedores.findUnique({
            where: {
              feria_id_documento: { feria_id: feriaId, documento },
            },
            select: { id: true, activo: true },
          })
        : null;

      if (existente?.activo) {
        throw new ConflictException(
          'El vendedor ya está registrado en esta feria',
        );
      }

      if (existente) {
        participanteId = existente.id;
        await tx.feria_vendedores.update({
          where: { id: existente.id },
          data: {
            nombre_vendedor: dto.nombre,
            producto_principal: productos[0]?.nombre ?? null,
            activo: true,
            eliminado_en: null,
          },
        });
        await tx.feria_vendedor_productos.deleteMany({
          where: { vendedor_id: existente.id },
        });
      } else {
        const creado = await tx.feria_vendedores.create({
          data: {
            feria_id: feriaId,
            nombre_vendedor: dto.nombre,
            documento,
            producto_principal: productos[0]?.nombre ?? null,
          },
          select: { id: true },
        });
        participanteId = creado.id;
      }

      await tx.feria_vendedor_productos.createMany({
        data: productos.map((producto) => ({
          vendedor_id: participanteId,
          producto_id: producto.id,
        })),
      });

      const fila = await tx.feria_vendedores.findUniqueOrThrow({
        where: { id: participanteId },
        select: SELECT_PARTICIPANTE,
      });

      return this.aParticipante(fila);
    });
  }

  /** Actualiza nombre, documento y productos de un participante activo. */
  async actualizar(
    idUsuario: string,
    idFeria: string,
    idParticipante: string,
    dto: ActualizarParticipanteFeriaDto,
  ): Promise<ParticipanteFeriaDto> {
    const organizadorId = parseIdBigint(idUsuario);
    const feriaId = parseIdBigint(idFeria);
    const participanteId = parseIdBigint(idParticipante);

    if (
      dto.nombre === undefined &&
      dto.documento === undefined &&
      dto.productoIds === undefined
    ) {
      throw new BadRequestException(
        'Debes enviar al menos un campo para actualizar el participante',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, organizadorId);
      const feria = await this.bloquearFeria(tx, feriaId, organizadorId);
      this.validarFeriaGestionable(feria);

      const participante = await tx.feria_vendedores.findFirst({
        where: {
          id: participanteId,
          feria_id: feriaId,
          activo: true,
        },
        select: { id: true, documento: true },
      });

      if (!participante) {
        throw new NotFoundException('El participante no existe');
      }

      const productos = dto.productoIds
        ? await this.validarProductos(dto.productoIds, feria.zonas.id, tx)
        : null;

      if (
        dto.documento !== undefined &&
        dto.documento !== null &&
        dto.documento !== participante.documento
      ) {
        const duplicado = await tx.feria_vendedores.findUnique({
          where: {
            feria_id_documento: {
              feria_id: feriaId,
              documento: dto.documento,
            },
          },
          select: { id: true, activo: true },
        });

        if (duplicado && duplicado.id !== participanteId) {
          throw new ConflictException(
            duplicado.activo
              ? 'El vendedor ya está registrado en esta feria'
              : 'El documento pertenece a un participante retirado. Regístralo de nuevo para reactivarlo.',
          );
        }
      }

      await tx.feria_vendedores.update({
        where: { id: participanteId },
        data: {
          ...(dto.nombre !== undefined
            ? { nombre_vendedor: dto.nombre }
            : {}),
          ...(dto.documento !== undefined ? { documento: dto.documento } : {}),
          ...(productos
            ? { producto_principal: productos[0]?.nombre ?? null }
            : {}),
        },
      });

      if (productos) {
        await tx.feria_vendedor_productos.deleteMany({
          where: { vendedor_id: participanteId },
        });
        await tx.feria_vendedor_productos.createMany({
          data: productos.map((producto) => ({
            vendedor_id: participanteId,
            producto_id: producto.id,
          })),
        });
      }

      const fila = await tx.feria_vendedores.findUniqueOrThrow({
        where: { id: participanteId },
        select: SELECT_PARTICIPANTE,
      });

      return this.aParticipante(fila);
    });
  }

  /** Baja lógica: el participante deja de aparecer y libera cupo. */
  async eliminar(
    idUsuario: string,
    idFeria: string,
    idParticipante: string,
  ): Promise<void> {
    const organizadorId = parseIdBigint(idUsuario);
    const feriaId = parseIdBigint(idFeria);
    const participanteId = parseIdBigint(idParticipante);

    await this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, organizadorId);
      const feria = await this.bloquearFeria(tx, feriaId, organizadorId);
      this.validarFeriaGestionable(feria);

      const participante = await tx.feria_vendedores.findFirst({
        where: {
          id: participanteId,
          feria_id: feriaId,
          activo: true,
        },
        select: { id: true },
      });

      if (!participante) {
        throw new NotFoundException('El participante no existe');
      }

      await tx.feria_vendedores.update({
        where: { id: participanteId },
        data: { activo: false, eliminado_en: new Date() },
      });
    });
  }

  /** Envía y bloquea el listado final de participantes. */
  async enviar(
    idUsuario: string,
    idFeria: string,
  ): Promise<EnviarListadoParticipantesResponseDto> {
    const organizadorId = parseIdBigint(idUsuario);
    const feriaId = parseIdBigint(idFeria);

    return this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, organizadorId);
      const feria = await this.bloquearFeria(tx, feriaId, organizadorId);

      if (feria.estado !== 'aprobada') {
        throw new ConflictException(
          'Solo se puede enviar el listado de una feria aprobada',
        );
      }
      if (feria.participantes_enviados_en) {
        throw new ConflictException(
          'El listado final de participantes ya fue enviado',
        );
      }

      const totalParticipantes = await tx.feria_vendedores.count({
        where: { feria_id: feriaId, activo: true },
      });

      if (totalParticipantes === 0) {
        throw new BadRequestException(
          'Agrega al menos un participante antes de enviar el listado final',
        );
      }

      const enviadoEn = new Date();
      await tx.ferias.update({
        where: { id: feriaId },
        data: { participantes_enviados_en: enviadoEn },
      });

      return {
        feriaId: feriaId.toString(),
        enviadoEn,
        totalParticipantes,
        mensaje: 'Listado final enviado correctamente.',
      };
    });
  }

  /** Listado final visible para el gestor; solo después del envío. */
  async listarGestor(idFeria: string): Promise<ListadoParticipantesGestorDto> {
    const feriaId = parseIdBigint(idFeria);
    const feria = await this.prisma.ferias.findFirst({
      where: { id: feriaId },
      select: SELECT_FERIA_PARTICIPANTES,
    });

    if (!feria) {
      throw new NotFoundException('La feria no existe');
    }
    if (!feria.participantes_enviados_en) {
      throw new ConflictException(
        'El organizador aún no ha enviado el listado final de participantes',
      );
    }

    const listado = await this.construirListado(feria);
    return {
      feria: listado.feria,
      cupo: listado.cupo,
      productosPermitidos: listado.productosPermitidos,
      productosCatalogo: listado.productosCatalogo,
      participantes: listado.participantes,
      listadoFinal: listado.listadoFinal,
      organizador: this.aOrganizador(feria),
    };
  }

  /** Bloquea la feria y verifica la propiedad del organizador. */
  private async bloquearFeria(
    tx: Prisma.TransactionClient,
    feriaId: bigint,
    organizadorId: bigint,
  ): Promise<FilaFeriaParticipantes> {
    await tx.$queryRaw`SELECT id FROM ferias WHERE id = ${feriaId} FOR UPDATE`;
    const feria = await tx.ferias.findFirst({
      where: { id: feriaId },
      select: SELECT_FERIA_PARTICIPANTES,
    });

    if (!feria || feria.organizador_id !== organizadorId) {
      throw new NotFoundException('La feria no existe o no te pertenece');
    }

    return feria;
  }

  /** Reglas comunes de estado para cualquier mutación. */
  private validarFeriaGestionable(feria: FilaFeriaParticipantes): void {
    if (feria.participantes_enviados_en) {
      throw new ConflictException(
        'El listado final ya fue enviado y no se puede modificar',
      );
    }
    if (feria.estado !== 'aprobada') {
      throw new ConflictException(
        'Solo se pueden gestionar participantes cuando la feria está aprobada',
      );
    }
  }

  /** Valida productos activos y permitidos por la zona. */
  private async validarProductos(
    ids: string[],
    zonaId: bigint,
    cliente: ClientePrisma,
  ): Promise<{ id: bigint; nombre: string }[]> {
    const identificadores = [...new Set(ids)].map((id) => parseIdBigint(id));
    const productos = await cliente.productos.findMany({
      where: { id: { in: identificadores }, activo: true },
      select: { id: true, nombre: true },
    });

    if (productos.length !== identificadores.length) {
      throw new BadRequestException(
        'Uno o más productos no existen o están inactivos',
      );
    }

    const permitidos = await cliente.zona_productos.findMany({
      where: { zona_id: zonaId, productos: { activo: true } },
      select: { producto_id: true },
    });

    if (permitidos.length > 0) {
      const idsPermitidos = new Set(
        permitidos.map((item) => item.producto_id.toString()),
      );
      const noPermitidos = productos
        .filter((producto) => !idsPermitidos.has(producto.id.toString()))
        .map((producto) => producto.nombre);

      if (noPermitidos.length > 0) {
        throw new BadRequestException(
          `Los siguientes productos no están permitidos en la zona: ${noPermitidos.join(', ')}`,
        );
      }
    }

    return productos;
  }

  /** Productos activos del catálogo de la zona. */
  private async productosPermitidos(
    zonaId: bigint,
    cliente: ClientePrisma,
  ): Promise<ProductoFeriaDto[]> {
    const filas = await cliente.zona_productos.findMany({
      where: { zona_id: zonaId, productos: { activo: true } },
      select: { productos: { select: { id: true, nombre: true } } },
    });

    return filas
      .map((fila) => ({
        id: fila.productos.id.toString(),
        nombre: fila.productos.nombre,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  /** Construye el listado con cupo y estado de envío. */
  private async construirListado(
    feria: FilaFeriaParticipantes,
    cliente: ClientePrisma = this.prisma,
  ): Promise<ListadoParticipantesFeriaDto> {
    const [filas, productosPermitidos, catalogo] = await Promise.all([
      cliente.feria_vendedores.findMany({
        where: { feria_id: feria.id, activo: true },
        orderBy: [{ creado_en: 'asc' }, { id: 'asc' }],
        select: SELECT_PARTICIPANTE,
      }),
      this.productosPermitidos(feria.zonas.id, cliente),
      cliente.productos.findMany({
        where: { activo: true },
        orderBy: { nombre: 'asc' },
        select: { id: true, nombre: true },
      }),
    ]);

    const participantes = filas.map((fila) => this.aParticipante(fila));
    const ocupados = participantes.length;
    const aprobado = feria.numero_puestos;

    return {
      feria: {
        id: feria.id.toString(),
        numeroRadicado: feria.numero_radicado,
        nombre: feria.nombre,
        estado: feria.estado,
        fechaInicio: this.aFechaISO(feria.fecha_inicio),
        fechaFin: this.aFechaISO(feria.fecha_fin),
        numeroPuestos: feria.numero_puestos,
        zona: {
          id: feria.zonas.id.toString(),
          nombre: feria.zonas.nombre,
        },
      },
      cupo: {
        aprobado,
        ocupados,
        disponibles: Math.max(0, aprobado - ocupados),
        completo: ocupados >= aprobado,
      },
      productosPermitidos,
      productosCatalogo: catalogo.map((producto) => ({
        id: producto.id.toString(),
        nombre: producto.nombre,
      })),
      participantes,
      listadoFinal: {
        enviado: feria.participantes_enviados_en !== null,
        enviadoEn: feria.participantes_enviados_en,
      },
    };
  }

  /** Convierte una fila de participante al DTO de respuesta. */
  private aParticipante(fila: FilaParticipante): ParticipanteFeriaDto {
    return {
      id: fila.id.toString(),
      nombre: fila.nombre_vendedor,
      documento: fila.documento,
      productos: fila.feria_vendedor_productos
        .map((item) => ({
          id: item.productos.id.toString(),
          nombre: item.productos.nombre,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      creadoEn: fila.creado_en,
      actualizadoEn: fila.actualizado_en,
    };
  }

  /** Datos del organizador para la vista del gestor. */
  private aOrganizador(
    feria: FilaFeriaParticipantes,
  ): OrganizadorParticipantesDto {
    const usuario = feria.organizadores.usuarios_organizadores_usuario_idTousuarios;
    return {
      id: usuario.id.toString(),
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      correo: usuario.correo,
      organizacion: feria.organizadores.nombre_organizacion,
      nit: feria.organizadores.nit,
    };
  }

  /** Convierte una fecha DATE de PostgreSQL a `YYYY-MM-DD`. */
  private aFechaISO(valor: Date | string): string {
    if (valor instanceof Date) return valor.toISOString().slice(0, 10);
    return String(valor).slice(0, 10);
  }
}
