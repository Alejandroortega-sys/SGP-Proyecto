import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { OPCIONES_ARGON2 } from '../common/opciones-argon2';
import { parseIdBigint } from '../common/parse-id';
import { fijarActorAuditoria } from '../common/auditoria';
import { CorreoService } from '../correo/correo.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  OrganizacionPerfilDto,
  PerfilResponseDto,
  SeguridadPerfilDto,
} from './dto/ver-perfil.dto';
import type { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
import type { CambiarPasswordDto } from './dto/cambiar-password.dto';
import type { MensajeResponseDto } from '../usuarios/dto/comerciante-response.dto';

/** Columnas del perfil (con el perfil comercial o la organización 1:1). */
const SELECT_PERFIL = {
  id: true,
  nombre: true,
  apellido: true,
  tipo_documento: true,
  documento: true,
  telefono: true,
  correo: true,
  rol: true,
  estado: true,
  creado_en: true,
  comerciantes: {
    select: { actividad_comercial: true, categoria: true },
  },
  organizadores_organizadores_usuario_idTousuarios: {
    select: {
      nombre_organizacion: true,
      nit: true,
      representante: true,
      tipo_feria: true,
      contacto: true,
      estado: true,
      validado_en: true,
    },
  },
} satisfies Prisma.usuariosSelect;

/** Tipo de la fila devuelta por la consulta del perfil. */
type FilaPerfil = Prisma.usuariosGetPayload<{ select: typeof SELECT_PERFIL }>;

/**
 * Perfil del usuario autenticado (HU-04).
 *
 * Para comerciantes incluye los datos personales, la actividad comercial (solo
 * lectura: la corrige un gestor) y la seguridad de la cuenta. Para
 * organizadores incluye los datos personales, la organización registrada (o
 * `null`) y la seguridad. El cambio de contraseña se hace con confirmación por
 * correo.
 *
 * **Auditoría:** cada cambio (`PATCH /perfil` y `PATCH /perfil/password`)
 * ocurre dentro de una transacción en la que se fija `app.actor_id`; el
 * trigger `fn_auditoria` de `usuarios` registra automáticamente el valor
 * anterior y el nuevo junto con el actor (ver docs/baseDatos.md §2).
 */
@Injectable()
export class PerfilService {
  private readonly logger = new Logger(PerfilService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
  ) {}

  /**
   * Devuelve el perfil del usuario autenticado.
   *
   * Para comerciantes incluye la actividad comercial (HU-04); para
   * organizadores incluye la organización registrada, que puede ser `null`
   * mientras no la haya creado.
   */
  async ver(idUsuario: string): Promise<PerfilResponseDto> {
    const usuario = await this.prisma.usuarios.findUnique({
      where: { id: parseIdBigint(idUsuario) },
      select: SELECT_PERFIL,
    });

    if (!usuario) {
      // El guard garantiza un usuario activo; esto cubre datos corruptos.
      throw new NotFoundException('La cuenta no existe');
    }

    if (usuario.rol === 'comerciante' && !usuario.comerciantes) {
      throw new NotFoundException('El perfil del comerciante no existe');
    }

    if (usuario.rol !== 'comerciante' && usuario.rol !== 'organizador') {
      throw new NotFoundException('El perfil de la cuenta no existe');
    }

    return this.mapearPerfil(usuario);
  }

  /**
   * Actualiza los datos personales y de contacto del usuario autenticado.
   *
   * Solo acepta `nombre`, `apellido` y `telefono` (el DTO no declara los
   * campos sensibles ni los de la organización; el pipe global los rechaza con
   * 400). El cambio queda auditado en `auditoria` por el trigger de `usuarios`
   * con el propio usuario como actor.
   *
   * @throws BadRequestException si el cuerpo no trae ningún campo.
   */
  async actualizar(
    idUsuario: string,
    dto: ActualizarPerfilDto,
  ): Promise<PerfilResponseDto> {
    const id = parseIdBigint(idUsuario);

    const datos: Prisma.usuariosUncheckedUpdateInput = {};
    if (dto.nombre !== undefined) {
      datos.nombre = dto.nombre.trim();
    }
    if (dto.apellido !== undefined) {
      datos.apellido = dto.apellido?.trim() || null;
    }
    if (dto.telefono !== undefined) {
      datos.telefono = dto.telefono.trim();
    }

    if (Object.keys(datos).length === 0) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para actualizar (nombre, apellido o ' +
          'telefono). Los datos de la organización se actualizan en ' +
          '`PATCH /organizadores/mi-organizacion`.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Auditoría: el actor de este cambio es el propio comerciante.
      await fijarActorAuditoria(tx, id);
      // El trigger fn_auditoria registra la fila antes/después.
      await tx.usuarios.update({ where: { id }, data: datos });
    });

    return this.ver(idUsuario);
  }

  /**
   * Cambia la contraseña verificando la actual (HU-04).
   *
   * - La contraseña actual se compara con el hash argon2 guardado; si no
   *   coincide responde 400 sin revelar detalles.
   * - La nueva sigue la política del registro (mín. 8 caracteres con número) y
   *   se guarda hasheada con argon2id.
   * - En una transacción: fija el actor de auditoría, actualiza el hash y
   *   registra la notificación interna.
   * - Después envía el aviso por correo; si el envío falla, el cambio ya
   *   quedó aplicado y el fallo solo se registra en el log.
   *
   * @throws BadRequestException si la contraseña actual no coincide.
   */
  async cambiarPassword(
    idUsuario: string,
    dto: CambiarPasswordDto,
  ): Promise<MensajeResponseDto> {
    const id = parseIdBigint(idUsuario);

    const usuario = await this.prisma.usuarios.findUnique({
      where: { id },
      select: { id: true, nombre: true, correo: true, password_hash: true },
    });
    if (!usuario) {
      throw new NotFoundException('La cuenta no existe');
    }

    const coincide = usuario.password_hash
      ? await argon2
          .verify(usuario.password_hash, dto.passwordActual)
          .catch(() => false)
      : false;
    if (!coincide) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }

    // Se calcula antes de abrir la transacción para mantenerla corta.
    const passwordHash = await argon2.hash(dto.passwordNueva, OPCIONES_ARGON2);

    await this.prisma.$transaction(async (tx) => {
      // Auditoría: el actor es el propio comerciante; el trigger de
      // usuarios registra el cambio (el hash anterior y el nuevo).
      await fijarActorAuditoria(tx, id);
      await tx.usuarios.update({
        where: { id },
        data: { password_hash: passwordHash },
      });
      await tx.notificaciones.create({
        data: {
          usuario_id: id,
          tipo: 'cambio_password',
          asunto: 'Contraseña actualizada',
          cuerpo:
            `Hola ${usuario.nombre}, la contraseña de tu cuenta en SGP ` +
            'Tuluá fue actualizada desde tu perfil. Si no fuiste tú, ' +
            'comunícate de inmediato con la Secretaría de Gobierno.',
          canal: 'app',
        },
      });
    });

    try {
      await this.correo.enviarAvisoCambioPassword(
        usuario.correo,
        usuario.nombre,
      );
    } catch (error) {
      // El cambio ya quedó aplicado y notificado en la app: solo se registra
      // el fallo del correo para revisarlo, sin revertir nada.
      this.logger.error(
        `No se pudo enviar el aviso de cambio de contraseña a ${usuario.correo}: ${String(error)}`,
      );
    }

    return {
      mensaje:
        'Contraseña actualizada correctamente. Enviamos un aviso a tu correo.',
    };
  }

  /** Convierte la fila de la BD en la respuesta del perfil. */
  private mapearPerfil(usuario: FilaPerfil): PerfilResponseDto {
    const seguridad: SeguridadPerfilDto = {
      correo: usuario.correo,
      estado: usuario.estado,
      creadoEn: usuario.creado_en,
    };

    const datosPersonales = {
      id: usuario.id.toString(),
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      tipoDocumento: usuario.tipo_documento,
      documento: usuario.documento,
      telefono: usuario.telefono,
    };

    if (usuario.rol === 'comerciante') {
      return {
        datosPersonales,
        actividadComercial: {
          actividadComercial: usuario.comerciantes!.actividad_comercial,
          categoria: usuario.comerciantes!.categoria,
        },
        seguridad,
      };
    }

    const organizacion =
      usuario.organizadores_organizadores_usuario_idTousuarios;
    const organizacionDto: OrganizacionPerfilDto | null = organizacion
      ? {
          nombreOrganizacion: organizacion.nombre_organizacion,
          nit: organizacion.nit,
          representante: organizacion.representante,
          tipoFeria: organizacion.tipo_feria,
          contacto: organizacion.contacto,
          estado: organizacion.estado,
          validadoEn: organizacion.validado_en,
        }
      : null;

    return {
      datosPersonales,
      organizacion: organizacionDto,
      seguridad,
    };
  }
}
