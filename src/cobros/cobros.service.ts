import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { parseIdBigint } from '../common/parse-id';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { construirReciboPdf } from './recibo';
import {
  type CobroListadoDto,
  ListarMisCobrosQueryDto,
  ListarMisCobrosResponseDto,
  PagarCobroResponseDto,
} from './dto/cobros.dto';

/** Columnas del cobro con el número del permiso asociado. */
const SELECT_COBRO = {
  id: true,
  valor: true,
  estado: true,
  pagado_en: true,
  recibo_url: true,
  creado_en: true,
  permisos: {
    select: {
      id: true,
      numero: true,
      titular_id: true,
      comerciantes: {
        select: { usuarios: { select: { nombre: true, apellido: true } } },
      },
    },
  },
} satisfies Prisma.cobrosSelect;

type FilaCobro = Prisma.cobrosGetPayload<{ select: typeof SELECT_COBRO }>;

/** Fila bloqueada del cobro al registrar el pago simulado. */
interface FilaCobroPago {
  id: bigint;
  estado: string;
  valor: Prisma.Decimal;
  permiso_numero: string;
  titular_id: bigint;
  titular_nombre: string;
  titular_apellido: string | null;
}

/**
 * Cobros del uso de suelo (HU-36). El pago es SIEMPRE simulado (AGENTS
 * §9.12): sin pasarela, sin SDK de pagos y sin datos de tarjeta; el flujo
 * termina en `estado_cobro = pagado` + recibo descargable.
 *
 * El cobro nace del permiso dentro de la transacción de emisión
 * (`PermisosService.emitir`, decisión D11); este módulo lo consulta y lo
 * paga. Los montos son NUMERIC y se tratan como string en la API
 * (Prisma.Decimal).
 */
@Injectable()
export class CobrosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista los cobros de los permisos del comerciante autenticado. */
  async listar(
    usuario: UsuarioAutenticado,
    dto: ListarMisCobrosQueryDto,
  ): Promise<ListarMisCobrosResponseDto> {
    const usuarioId = parseIdBigint(usuario.id);
    const pagina = dto.pagina ?? 1;
    const limite = dto.limite ?? 20;
    const where: Prisma.cobrosWhereInput = {
      permisos: { titular_id: usuarioId },
    };

    const [filas, total] = await Promise.all([
      this.prisma.cobros.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: [{ creado_en: 'desc' }, { id: 'desc' }],
        select: SELECT_COBRO,
      }),
      this.prisma.cobros.count({ where }),
    ]);

    return {
      datos: filas.map((fila) => this.mapear(fila)),
      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas: total === 0 ? 0 : Math.ceil(total / limite),
      },
    };
  }

  /**
   * Registra el pago simulado del cobro (HU-36-CA2).
   *
   * Pasa el cobro de «pendiente» a «pagado», estampa `pagado_en` y deja la
   * URL del recibo. No existe pasarela: la confirmación basta. El cobro se
   * bloquea con `FOR UPDATE` y se verifica la propiedad (IDOR) antes de
   * actualizar.
   */
  async pagar(
    usuario: UsuarioAutenticado,
    idCobro: string,
  ): Promise<PagarCobroResponseDto> {
    const usuarioId = parseIdBigint(usuario.id);
    const cobroId = parseIdBigint(idCobro);

    return this.prisma.$transaction(async (tx) => {
      const filas = await tx.$queryRaw<FilaCobroPago[]>`
        SELECT c.id, c.estado, c.valor,
               p.numero AS permiso_numero, p.titular_id,
               u.nombre AS titular_nombre, u.apellido AS titular_apellido
          FROM cobros c
          JOIN permisos p ON p.id = c.permiso_id
          JOIN usuarios u ON u.id = p.titular_id
         WHERE c.id = ${cobroId} AND p.titular_id = ${usuarioId}
         FOR UPDATE OF c`;
      const cobro = filas[0];
      if (!cobro) {
        throw new NotFoundException(
          'El cobro no existe o no pertenece a su cuenta',
        );
      }
      if (cobro.estado === 'pagado') {
        throw new ConflictException('El cobro ya está pagado.');
      }
      if (cobro.estado !== 'pendiente') {
        throw new UnprocessableEntityException(
          'El cobro está anulado y no admite pago.',
        );
      }

      const reciboUrl = `/cobros/mios/${cobroId.toString()}/recibo`;
      const actualizado = await tx.cobros.update({
        where: { id: cobroId },
        data: {
          estado: 'pagado',
          pagado_en: new Date(),
          recibo_url: reciboUrl,
        },
        select: { id: true, pagado_en: true },
      });

      return {
        id: actualizado.id.toString(),
        permisoNumero: cobro.permiso_numero,
        valor: cobro.valor.toString(),
        estado: 'pagado',
        pagadoEn: actualizado.pagado_en as Date,
        reciboUrl,
        mensaje:
          'Pago simulado registrado: no se realizó ninguna transacción real. ' +
          'El recibo queda disponible para descarga.',
      };
    });
  }

  /**
   * Genera el PDF del recibo (HU-36-CA2/1247).
   *
   * Solo disponible tras el pago simulado; el cobro debe pertenecer al
   * comerciante autenticado (IDOR).
   */
  async reciboMio(
    usuario: UsuarioAutenticado,
    idCobro: string,
  ): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    const usuarioId = parseIdBigint(usuario.id);
    const cobroId = parseIdBigint(idCobro);

    const fila = await this.prisma.cobros.findFirst({
      where: { id: cobroId, permisos: { titular_id: usuarioId } },
      select: SELECT_COBRO,
    });
    if (!fila) {
      throw new NotFoundException(
        'El cobro no existe o no pertenece a su cuenta',
      );
    }
    if (fila.estado !== 'pagado' || !fila.pagado_en) {
      throw new UnprocessableEntityException(
        'El recibo está disponible solo después de registrar el pago simulado.',
      );
    }

    const buffer = await construirReciboPdf({
      numeroCobro: fila.id.toString(),
      permisoNumero: fila.permisos.numero,
      titular:
        fila.permisos.comerciantes.usuarios.apellido === null
          ? fila.permisos.comerciantes.usuarios.nombre
          : `${fila.permisos.comerciantes.usuarios.nombre} ` +
            `${fila.permisos.comerciantes.usuarios.apellido}`,
      valor: fila.valor.toString(),
      pagadoEn: fila.pagado_en,
    });
    return { buffer, nombreArchivo: `recibo-COB-${fila.id}.pdf` };
  }

  private mapear(fila: FilaCobro): CobroListadoDto {
    return {
      id: fila.id.toString(),
      permisoId: fila.permisos.id.toString(),
      permisoNumero: fila.permisos.numero,
      valor: fila.valor.toString(),
      estado: fila.estado,
      pagadoEn: fila.pagado_en,
      reciboUrl: fila.recibo_url,
      creadoEn: fila.creado_en,
    };
  }
}
