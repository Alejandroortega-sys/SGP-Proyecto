import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { fijarActorAuditoria } from '../common/auditoria';
import { OPCIONES_ARGON2 } from '../common/opciones-argon2';
import { parseIdBigint } from '../common/parse-id';
import { CorreoService } from '../correo/correo.service';
import { Prisma } from '../generated/prisma/client';
import type { perfil_gestor, rol_usuario } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CambiarPasswordDto } from '../perfil/dto/cambiar-password.dto';
import type { MensajeResponseDto } from '../usuarios/dto/comerciante-response.dto';
import {
  AuditoriaItemDto,
  ListarAuditoriaQueryDto,
  ListarAuditoriaResponseDto,
} from './dto/auditoria.dto';
import {
  CambiarEstadoUsuarioDto,
  type EstadoCuentaGestionable,
  UsuarioEstadoActualizadoDto,
} from './dto/cambiar-estado-usuario.dto';
import {
  CrearGestorDto,
  GestorCreadoDto,
  InvitacionGestorReenviadaDto,
} from './dto/crear-gestor.dto';
import {
  ActualizarPerfilGestorDto,
  PerfilGestorResponseDto,
} from './dto/perfil-gestor.dto';
import type { ListarComerciantesQueryDto } from './dto/listar-comerciantes-query.dto';
import {
  ComercianteListadoDto,
  ListarComerciantesResponseDto,
} from './dto/listar-comerciantes-response.dto';
import type { ListarUsuariosQueryDto } from './dto/listar-usuarios-query.dto';
import {
  ListarUsuariosResponseDto,
  UsuarioListadoDto,
} from './dto/listar-usuarios-response.dto';
import {
  PermisoDetalleDto,
  SolicitudDetalleDto,
  UsuarioDetalleResponseDto,
} from './dto/usuario-detalle-response.dto';

/** Roles que puede consultar el perfil revisor. */
const ROLES_REVISOR: readonly rol_usuario[] = ['comerciante', 'organizador'];

/**
 * Claves que nunca deben salir en la auditoría. El trigger `fn_auditoria`
 * guarda la fila completa de `usuarios`, incluido `password_hash`.
 */
const CLAVES_SENSIBLES_AUDITORIA = new Set([
  'password_hash',
  'token_hash',
  'qr_token',
]);

/** Elimina recursivamente las claves sensibles de un valor JSON. */
function sanitizarAuditoria(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.map((elemento) => sanitizarAuditoria(elemento));
  }
  if (valor && typeof valor === 'object') {
    const resultado: Record<string, unknown> = {};
    for (const [clave, contenido] of Object.entries(
      valor as Record<string, unknown>,
    )) {
      if (!CLAVES_SENSIBLES_AUDITORIA.has(clave)) {
        resultado[clave] = sanitizarAuditoria(contenido);
      }
    }
    return resultado;
  }
  return valor;
}

/** Columnas del listado de comerciantes, con los conteos de su perfil. */
const SELECT_LISTADO = {
  id: true,
  nombre: true,
  apellido: true,
  tipo_documento: true,
  documento: true,
  correo: true,
  telefono: true,
  estado: true,
  creado_en: true,
  comerciantes: {
    select: {
      actividad_comercial: true,
      categoria: true,
      _count: {
        select: { solicitudes: true, permisos: true },
      },
    },
  },
} satisfies Prisma.usuariosSelect;

/** Fila devuelta por la consulta del listado de comerciantes. */
type FilaListado = Prisma.usuariosGetPayload<{ select: typeof SELECT_LISTADO }>;

/** Columnas del listado general de cuentas. */
const SELECT_USUARIOS = {
  id: true,
  nombre: true,
  apellido: true,
  correo: true,
  documento: true,
  telefono: true,
  rol: true,
  estado: true,
  creado_en: true,
  gestores_gestores_usuario_idTousuarios: {
    select: { perfil: true },
  },
  comerciantes: {
    select: { categoria: true, actividad_comercial: true },
  },
  organizadores_organizadores_usuario_idTousuarios: {
    select: { nombre_organizacion: true },
  },
} satisfies Prisma.usuariosSelect;

/** Fila devuelta por el listado general de cuentas. */
type FilaUsuarioListado = Prisma.usuariosGetPayload<{
  select: typeof SELECT_USUARIOS;
}>;

/** Columnas del detalle del usuario, con solicitudes y permisos. */
const SELECT_DETALLE = {
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
  actualizado_en: true,
  gestores_gestores_usuario_idTousuarios: {
    select: { perfil: true, creado_por: true },
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
  comerciantes: {
    select: {
      actividad_comercial: true,
      categoria: true,
      actualizado_en: true,
      solicitudes: {
        orderBy: { creado_en: 'desc' },
        select: {
          id: true,
          numero_radicado: true,
          estado: true,
          actividad: true,
          fecha_inicio: true,
          fecha_fin: true,
          hora_inicio: true,
          hora_fin: true,
          radicada_en: true,
          decidida_en: true,
          motivo_rechazo: true,
          creado_en: true,
          espacios_temporales: { select: { nombre: true } },
          permisos: { select: { numero: true, estado: true } },
        },
      },
      permisos: {
        orderBy: { emitido_en: 'desc' },
        select: {
          id: true,
          numero: true,
          categoria_autorizada: true,
          fecha_inicio: true,
          fecha_fin: true,
          estado: true,
          emitido_en: true,
          espacios_temporales: { select: { nombre: true } },
          solicitudes: { select: { numero_radicado: true } },
          cobros: { select: { valor: true, estado: true, pagado_en: true } },
        },
      },
    },
  },
} satisfies Prisma.usuariosSelect;

/** Fila devuelta por la consulta del detalle. */
type FilaDetalle = Prisma.usuariosGetPayload<{ select: typeof SELECT_DETALLE }>;

/** Solicitud anidada en el detalle. */
type FilaSolicitud = NonNullable<
  FilaDetalle['comerciantes']
>['solicitudes'][number];

/** Permiso anidado en el detalle. */
type FilaPermiso = NonNullable<FilaDetalle['comerciantes']>['permisos'][number];

/** Formatea una hora de la BD (`TIME`) como `HH:mm`. */
function formatearHora(valor: Date): string {
  return valor.toISOString().slice(11, 16);
}

/**
 * Consulta y administración de cuentas desde el panel del gestor municipal.
 *
 * - El revisor solo puede consultar comerciantes y organizadores.
 * - El administrador puede consultar cualquier cuenta, crear gestores y
 *   activar, suspender o inactivar cuentas.
 * - Los gestores recién creados reciben una contraseña temporal y deben
 *   cambiarla en su primer inicio de sesión.
 * - Cada cambio de estado se ejecuta en una transacción que fija
 *   `app.actor_id`; el trigger `fn_auditoria` de `usuarios` deja el registro
 *   en la tabla `auditoria` con el estado anterior y el nuevo.
 */
@Injectable()
export class GestorService {
  private readonly logger = new Logger(GestorService.name);
  /** URL del frontend para el enlace del correo de invitación. */
  private readonly urlAcceso: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
    config: ConfigService,
  ) {
    const base = config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
    this.urlAcceso = `${base.replace(/\/+$/, '')}/login`;
  }

  /**
   * Crea un gestor con perfil revisor o administrador.
   *
   * La cuenta nace en «pendiente_activacion» y recibe una contraseña temporal
   * por correo. Hasta que el gestor la cambie en su primer acceso, no puede
   * usar el resto de la plataforma.
   *
   * @param dto Datos del gestor.
   * @param idAdmin Identificador del administrador que crea la cuenta.
   */
  async crearGestor(
    dto: CrearGestorDto,
    idAdmin: bigint,
  ): Promise<GestorCreadoDto> {
    const correo = dto.correo.trim().toLowerCase();
    const nombre = dto.nombre.trim();
    const apellido = dto.apellido?.trim() || undefined;
    const passwordTemporal = this.generarPasswordTemporal();
    const passwordHash = await argon2.hash(passwordTemporal, OPCIONES_ARGON2);

    const creado = await this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, idAdmin);

      const usuario = await tx.usuarios.create({
        data: {
          rol: 'gestor',
          nombre,
          apellido,
          correo,
          password_hash: passwordHash,
          estado: 'pendiente_activacion',
          gestores_gestores_usuario_idTousuarios: {
            create: {
              perfil: dto.perfil,
              creado_por: idAdmin,
            },
          },
        },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          correo: true,
          estado: true,
          gestores_gestores_usuario_idTousuarios: {
            select: { perfil: true },
          },
        },
      });

      await tx.notificaciones.create({
        data: {
          usuario_id: usuario.id,
          tipo: 'invitacion_gestor',
          asunto: 'Cuenta de gestor creada',
          cuerpo:
            `Se creó tu cuenta de gestor con perfil ${dto.perfil}. Revisa ` +
            'tu correo y cambia la contraseña en el primer inicio de sesión.',
          canal: 'correo',
        },
      });

      // La tabla `gestores` no tiene trigger de auditoría: se registra aquí
      // con el administrador como actor, igual que se hace con `comerciantes`.
      const valorNuevo = {
        usuario_id: usuario.id.toString(),
        perfil: dto.perfil,
        creado_por: idAdmin.toString(),
      };
      await tx.$executeRaw`
        INSERT INTO auditoria
          (tabla, registro_id, accion, valor_anterior, valor_nuevo, actor_id)
        VALUES (
          'gestores',
          ${usuario.id},
          'insert',
          NULL,
          ${JSON.stringify(valorNuevo)}::jsonb,
          ${idAdmin}
        )
      `;

      return usuario;
    });

    const perfil =
      creado.gestores_gestores_usuario_idTousuarios?.perfil ?? dto.perfil;

    try {
      await this.correo.enviarCredencialesGestor(
        correo,
        nombre,
        perfil,
        passwordTemporal,
        this.urlAcceso,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo enviar la invitación de gestor a ${correo}: ${String(error)}`,
      );
      throw new ServiceUnavailableException(
        'La cuenta de gestor fue creada, pero no pudimos enviar la ' +
          'contraseña temporal al correo.',
      );
    }

    return {
      id: creado.id.toString(),
      nombre: creado.nombre,
      apellido: creado.apellido,
      correo: creado.correo,
      perfil,
      estado: creado.estado,
      mensaje:
        'Cuenta de gestor creada. Enviamos la contraseña temporal al correo; ' +
        'debe cambiarla en el primer inicio de sesión.',
    };
  }

  /**
   * Devuelve el perfil del gestor autenticado.
   *
   * @param idGestor Identificador del gestor autenticado.
   */
  async verPerfil(idGestor: bigint): Promise<PerfilGestorResponseDto> {
    const usuario = await this.prisma.usuarios.findUnique({
      where: { id: idGestor },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        telefono: true,
        correo: true,
        rol: true,
        estado: true,
        creado_en: true,
        actualizado_en: true,
        gestores_gestores_usuario_idTousuarios: {
          select: { perfil: true },
        },
      },
    });

    if (
      !usuario ||
      usuario.rol !== 'gestor' ||
      !usuario.gestores_gestores_usuario_idTousuarios
    ) {
      throw new NotFoundException('El perfil del gestor no existe');
    }

    return {
      id: usuario.id.toString(),
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      correo: usuario.correo,
      telefono: usuario.telefono,
      perfil: usuario.gestores_gestores_usuario_idTousuarios.perfil,
      estado: usuario.estado,
      creadoEn: usuario.creado_en,
      actualizadoEn: usuario.actualizado_en,
    };
  }

  /**
   * Actualiza los datos personales y de contacto del gestor autenticado.
   *
   * Solo acepta `nombre`, `apellido` y `telefono` (al menos uno). El cambio
   * queda auditado por el trigger `fn_auditoria` de `usuarios`, con el propio
   * gestor como actor.
   *
   * @param idGestor Identificador del gestor autenticado.
   * @param dto Campos a actualizar.
   */
  async actualizarPerfil(
    idGestor: bigint,
    dto: ActualizarPerfilGestorDto,
  ): Promise<PerfilGestorResponseDto> {
    const usuario = await this.prisma.usuarios.findUnique({
      where: { id: idGestor },
      select: { id: true, rol: true },
    });
    if (!usuario || usuario.rol !== 'gestor') {
      throw new NotFoundException('El perfil del gestor no existe');
    }

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
        'Debe enviar al menos un campo para actualizar (nombre, apellido o teléfono).',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, idGestor);
      await tx.usuarios.update({ where: { id: idGestor }, data: datos });
    });

    return this.verPerfil(idGestor);
  }

  /**
   * Cambia la contraseña del gestor autenticado.
   *
   * Exige la contraseña actual y envía un aviso al correo institucional. El
   * cambio queda registrado en `auditoria` con el propio gestor como actor.
   *
   * @param idGestor Identificador del gestor autenticado.
   * @param dto Contraseña actual, nueva y confirmación.
   */
  async cambiarPassword(
    idGestor: bigint,
    dto: CambiarPasswordDto,
  ): Promise<MensajeResponseDto> {
    const usuario = await this.prisma.usuarios.findUnique({
      where: { id: idGestor },
      select: {
        id: true,
        rol: true,
        nombre: true,
        correo: true,
        password_hash: true,
      },
    });
    if (!usuario || usuario.rol !== 'gestor') {
      throw new NotFoundException('El perfil del gestor no existe');
    }

    const coincide = usuario.password_hash
      ? await argon2
          .verify(usuario.password_hash, dto.passwordActual)
          .catch(() => false)
      : false;
    if (!coincide) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }

    const passwordHash = await argon2.hash(dto.passwordNueva, OPCIONES_ARGON2);

    await this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, idGestor);
      await tx.usuarios.update({
        where: { id: idGestor },
        data: { password_hash: passwordHash },
      });
      await tx.notificaciones.create({
        data: {
          usuario_id: idGestor,
          tipo: 'cambio_password',
          asunto: 'Contraseña actualizada',
          cuerpo:
            `Hola ${usuario.nombre}, la contraseña de tu cuenta de gestor ` +
            'en SGP Tuluá fue actualizada. Si no fuiste tú, comunícate de ' +
            'inmediato con la Secretaría de Gobierno.',
          canal: 'app',
        },
      });
      // Por seguridad, se cierran todas las sesiones del gestor.
      await tx.sesiones.updateMany({
        where: { usuario_id: idGestor, revocada_en: null },
        data: { revocada_en: new Date() },
      });
    });

    try {
      await this.correo.enviarAvisoCambioPassword(
        usuario.correo,
        usuario.nombre,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo enviar el aviso de cambio de contraseña a ${usuario.correo}: ${String(error)}`,
      );
    }

    return {
      mensaje:
        'Contraseña actualizada correctamente. Cerramos todas tus sesiones; ' +
        'inicia sesión de nuevo. Enviamos un aviso a tu correo.',
    };
  }

  /**
   * Reenvía la invitación a un gestor que aún no completó su primer acceso.
   *
   * Genera una nueva contraseña temporal, actualiza el hash y envía el correo.
   * La cuenta permanece en `pendiente_activacion` hasta que el gestor cambie
   * la contraseña en `POST /auth/gestor/primer-acceso`.
   *
   * @param idGestor Identificador del gestor pendiente.
   * @param idAdmin Administrador que ejecuta la acción.
   */
  async reenviarInvitacion(
    idGestor: bigint,
    idAdmin: bigint,
  ): Promise<InvitacionGestorReenviadaDto> {
    const usuario = await this.prisma.usuarios.findUnique({
      where: { id: idGestor },
      select: {
        id: true,
        nombre: true,
        correo: true,
        rol: true,
        estado: true,
        gestores_gestores_usuario_idTousuarios: {
          select: { perfil: true },
        },
      },
    });

    if (
      !usuario ||
      usuario.rol !== 'gestor' ||
      !usuario.gestores_gestores_usuario_idTousuarios
    ) {
      throw new NotFoundException('El gestor solicitado no existe');
    }

    if (usuario.estado === 'activa') {
      throw new ConflictException(
        'La cuenta ya está activa. El gestor puede usar la recuperación de contraseña.',
      );
    }

    if (usuario.estado !== 'pendiente_activacion') {
      throw new ConflictException(
        'Solo se puede reenviar la invitación a un gestor pendiente de activación.',
      );
    }

    const perfil = usuario.gestores_gestores_usuario_idTousuarios.perfil;
    const passwordTemporal = this.generarPasswordTemporal();
    const passwordHash = await argon2.hash(passwordTemporal, OPCIONES_ARGON2);

    await this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, idAdmin);
      await tx.usuarios.update({
        where: { id: idGestor },
        data: {
          password_hash: passwordHash,
          intentos_fallidos: 0,
          bloqueado_hasta: null,
        },
      });
      await tx.notificaciones.create({
        data: {
          usuario_id: idGestor,
          tipo: 'invitacion_gestor',
          asunto: 'Nueva contraseña temporal',
          cuerpo:
            'Se generó una nueva contraseña temporal para tu cuenta de ' +
            'gestor. Revisa tu correo y cámbiala en el primer inicio de sesión.',
          canal: 'correo',
        },
      });
      // La contraseña temporal invalida cualquier sesión anterior.
      await tx.sesiones.updateMany({
        where: { usuario_id: idGestor, revocada_en: null },
        data: { revocada_en: new Date() },
      });
    });

    try {
      await this.correo.enviarCredencialesGestor(
        usuario.correo,
        usuario.nombre,
        perfil,
        passwordTemporal,
        this.urlAcceso,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo reenviar la invitación de gestor a ${usuario.correo}: ${String(error)}`,
      );
      throw new ServiceUnavailableException(
        'La contraseña temporal fue actualizada, pero no pudimos enviar el ' +
          'correo. Inténtalo de nuevo en unos minutos.',
      );
    }

    return {
      id: usuario.id.toString(),
      correo: usuario.correo,
      perfil,
      mensaje:
        'Invitación reenviada. El gestor recibirá una nueva contraseña ' +
        'temporal por correo.',
    };
  }

  /**
   * Lista comerciantes con búsqueda, filtros y paginación.
   *
   * La búsqueda se aplica por palabras: cada término debe aparecer en el
   * nombre, apellido, correo, documento o actividad comercial. Los filtros de
   * estado y categoría se combinan con la búsqueda mediante `AND`.
   */
  async listarComerciantes(
    dto: ListarComerciantesQueryDto,
  ): Promise<ListarComerciantesResponseDto> {
    const pagina = dto.pagina ?? 1;
    const limite = dto.limite ?? 20;
    const where = this.construirFiltros(dto);

    const [filas, total] = await Promise.all([
      this.prisma.usuarios.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: [{ creado_en: 'desc' }, { id: 'desc' }],
        select: SELECT_LISTADO,
      }),
      this.prisma.usuarios.count({ where }),
    ]);

    return {
      datos: filas.map((fila) => this.mapearListado(fila)),
      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas: total === 0 ? 0 : Math.ceil(total / limite),
      },
    };
  }

  /**
   * Lista todas las cuentas según el perfil de quien consulta.
   *
   * El revisor queda limitado a comerciantes y organizadores; el
   * administrador puede filtrar por cualquier rol y perfil.
   */
  async listarUsuarios(
    dto: ListarUsuariosQueryDto,
    perfilSolicitante: perfil_gestor | null,
  ): Promise<ListarUsuariosResponseDto> {
    const pagina = dto.pagina ?? 1;
    const limite = dto.limite ?? 20;
    const where = this.construirFiltrosUsuarios(dto, perfilSolicitante);

    const [filas, total] = await Promise.all([
      this.prisma.usuarios.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: [{ creado_en: 'desc' }, { id: 'desc' }],
        select: SELECT_USUARIOS,
      }),
      this.prisma.usuarios.count({ where }),
    ]);

    return {
      datos: filas.map((fila) => this.mapearUsuarioListado(fila)),
      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas: total === 0 ? 0 : Math.ceil(total / limite),
      },
    };
  }

  /**
   * Devuelve el detalle de una cuenta con sus solicitudes y permisos.
   *
   * El revisor solo puede consultar comerciantes y organizadores; el
   * administrador puede consultar cualquier cuenta.
   *
   * @throws NotFoundException si la cuenta no existe.
   * @throws ForbiddenException si el revisor intenta ver un gestor.
   */
  async obtenerUsuario(
    id: bigint,
    perfilSolicitante: perfil_gestor | null,
  ): Promise<UsuarioDetalleResponseDto> {
    const fila = await this.prisma.usuarios.findUnique({
      where: { id },
      select: SELECT_DETALLE,
    });

    if (!fila) {
      throw new NotFoundException('El usuario solicitado no existe');
    }

    if (
      perfilSolicitante !== 'administrador' &&
      fila.rol !== 'comerciante' &&
      fila.rol !== 'organizador'
    ) {
      throw new ForbiddenException(
        'El perfil revisor solo puede consultar comerciantes y organizadores.',
      );
    }

    return this.mapearDetalle(fila);
  }

  /**
   * Activa, suspende o inactiva una cuenta.
   *
   * Reglas:
   * - El administrador no puede cambiar el estado de su propia cuenta.
   * - Un gestor en «pendiente_activacion» debe completar el primer acceso
   *   antes de que se le modifique el estado.
   * - Para desactivar a otro administrador deben existir al menos dos
   *   administradores activos. La comprobación se hace dentro de una
   *   transacción con bloqueo de las filas de administradores activos.
   * - Al activar se limpian el bloqueo y los intentos fallidos del login.
   * - El `UPDATE` de `usuarios` dispara `fn_auditoria` con el gestor como
   *   actor (`app.actor_id`), dejando el registro en `auditoria`.
   *
   * @param id Identificador de la cuenta a modificar.
   * @param dto Estado nuevo.
   * @param idGestor Identificador del gestor administrador autenticado.
   */
  async cambiarEstado(
    id: bigint,
    dto: CambiarEstadoUsuarioDto,
    idGestor: bigint,
  ): Promise<UsuarioEstadoActualizadoDto> {
    const resultado = await this.prisma.$transaction(async (tx) => {
      // Auditoría: el trigger fn_auditoria toma este actor para registrar
      // el valor anterior y el nuevo de la fila de usuarios.
      await fijarActorAuditoria(tx, idGestor);

      // Se bloquean los administradores activos antes de leer el objetivo.
      // Todas las peticiones ejecutan la misma consulta en el mismo orden,
      // lo que evita que dos administradores se desactiven mutuamente.
      await tx.$queryRaw`
        SELECT u.id
          FROM usuarios u
          JOIN gestores g ON g.usuario_id = u.id
         WHERE u.rol = 'gestor'
           AND u.estado = 'activa'
           AND g.perfil = 'administrador'
         ORDER BY u.id
         FOR UPDATE OF u
      `;

      const usuario = await tx.usuarios.findUnique({
        where: { id },
        select: {
          id: true,
          nombre: true,
          correo: true,
          rol: true,
          estado: true,
          gestores_gestores_usuario_idTousuarios: {
            select: { perfil: true },
          },
        },
      });

      if (!usuario) {
        throw new NotFoundException('El usuario solicitado no existe');
      }

      if (id === idGestor) {
        throw new ForbiddenException(
          'No puede cambiar el estado de su propia cuenta.',
        );
      }

      if (usuario.estado === dto.estado) {
        throw new ConflictException(
          `La cuenta ya se encuentra en estado «${dto.estado}»`,
        );
      }

      if (
        usuario.rol === 'gestor' &&
        usuario.estado === 'pendiente_activacion'
      ) {
        throw new ConflictException(
          'El gestor debe completar el cambio de contraseña de primer acceso ' +
            'antes de modificar el estado de la cuenta.',
        );
      }

      const esAdministradorActivo =
        usuario.rol === 'gestor' &&
        usuario.gestores_gestores_usuario_idTousuarios?.perfil ===
          'administrador' &&
        usuario.estado === 'activa';

      if (esAdministradorActivo && dto.estado !== 'activa') {
        const administradoresActivos = await tx.usuarios.count({
          where: {
            rol: 'gestor',
            estado: 'activa',
            gestores_gestores_usuario_idTousuarios: {
              is: { perfil: 'administrador' },
            },
          },
        });

        if (administradoresActivos < 2) {
          throw new ConflictException(
            'Debe existir al menos un administrador activo en el sistema. ' +
              'No es posible desactivar a otro administrador sin otro ' +
              'administrador activo.',
          );
        }
      }

      const actualizado = await tx.usuarios.update({
        where: { id },
        data: {
          estado: dto.estado,
          ...(dto.estado === 'activa'
            ? { intentos_fallidos: 0, bloqueado_hasta: null }
            : {}),
        },
        select: {
          id: true,
          nombre: true,
          correo: true,
          estado: true,
        },
      });

      if (dto.estado !== 'activa') {
        // Suspender o inactivar invalida todas las sesiones del usuario.
        await tx.sesiones.updateMany({
          where: { usuario_id: id, revocada_en: null },
          data: { revocada_en: new Date() },
        });
      }

      return { usuario, actualizado };
    });

    if (dto.estado !== 'activa') {
      try {
        await this.correo.enviarAvisoEstadoCuenta(
          resultado.actualizado.correo,
          resultado.actualizado.nombre,
          dto.estado,
          dto.motivo,
        );
      } catch (error) {
        // El estado ya quedó actualizado; el fallo del correo se registra
        // para revisión, pero no revierte la decisión del administrador.
        this.logger.error(
          `No se pudo enviar el aviso de cuenta ${dto.estado} a ` +
            `${resultado.actualizado.correo}: ${String(error)}`,
        );
      }
    }

    return {
      id: resultado.actualizado.id.toString(),
      nombre: resultado.actualizado.nombre,
      correo: resultado.actualizado.correo,
      estadoAnterior: resultado.usuario.estado,
      estado: resultado.actualizado.estado,
      motivo: dto.motivo ?? null,
      mensaje: this.mensajeEstado(dto.estado),
    };
  }

  /**
   * Lista los registros de auditoría para el administrador.
   *
   * Solo se expone al perfil administrador (lo exige el controlador). Los
   * valores JSON se limpian recursivamente para no devolver `password_hash`,
   * `token_hash` ni `qr_token`.
   */
  async listarAuditoria(
    dto: ListarAuditoriaQueryDto,
  ): Promise<ListarAuditoriaResponseDto> {
    const pagina = dto.pagina ?? 1;
    const limite = dto.limite ?? 20;

    const where: Prisma.auditoriaWhereInput = {
      ...(dto.tabla ? { tabla: dto.tabla } : {}),
      ...(dto.registroId
        ? { registro_id: parseIdBigint(dto.registroId) }
        : {}),
      ...(dto.accion ? { accion: dto.accion } : {}),
    };

    const [filas, total] = await Promise.all([
      this.prisma.auditoria.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: [{ creado_en: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          tabla: true,
          registro_id: true,
          accion: true,
          valor_anterior: true,
          valor_nuevo: true,
          creado_en: true,
          usuarios: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              correo: true,
            },
          },
        },
      }),
      this.prisma.auditoria.count({ where }),
    ]);

    const datos: AuditoriaItemDto[] = filas.map((fila) => ({
      id: fila.id.toString(),
      tabla: fila.tabla,
      registroId: fila.registro_id.toString(),
      accion: fila.accion,
      valorAnterior: sanitizarAuditoria(fila.valor_anterior),
      valorNuevo: sanitizarAuditoria(fila.valor_nuevo),
      actor: fila.usuarios
        ? {
            id: fila.usuarios.id.toString(),
            nombre: fila.usuarios.nombre,
            apellido: fila.usuarios.apellido,
            correo: fila.usuarios.correo,
          }
        : null,
      creadoEn: fila.creado_en,
    }));

    return {
      datos,
      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas: total === 0 ? 0 : Math.ceil(total / limite),
      },
    };
  }

  /** Construye el `where` del listado de comerciantes. */
  private construirFiltros(
    dto: ListarComerciantesQueryDto,
  ): Prisma.usuariosWhereInput {
    const condiciones: Prisma.usuariosWhereInput[] = [{ rol: 'comerciante' }];

    if (dto.estado) {
      condiciones.push({ estado: dto.estado });
    }

    if (dto.categoria) {
      condiciones.push({
        comerciantes: { is: { categoria: dto.categoria } },
      });
    }

    this.agregarBusqueda(condiciones, dto.busqueda);

    return { AND: condiciones };
  }

  /** Construye el `where` del listado general de cuentas. */
  private construirFiltrosUsuarios(
    dto: ListarUsuariosQueryDto,
    perfilSolicitante: perfil_gestor | null,
  ): Prisma.usuariosWhereInput {
    const condiciones: Prisma.usuariosWhereInput[] = [];

    if (perfilSolicitante !== 'administrador') {
      if (dto.perfil) {
        throw new ForbiddenException(
          'El perfil revisor no puede filtrar cuentas por perfil de gestor.',
        );
      }
      if (dto.rol && !ROLES_REVISOR.includes(dto.rol)) {
        throw new ForbiddenException(
          'El perfil revisor solo puede consultar comerciantes y ' +
            'organizadores.',
        );
      }
      condiciones.push({ rol: dto.rol ?? { in: [...ROLES_REVISOR] } });
    } else {
      if (dto.rol) {
        condiciones.push({ rol: dto.rol });
      }
      if (dto.perfil) {
        condiciones.push({
          gestores_gestores_usuario_idTousuarios: {
            is: { perfil: dto.perfil },
          },
        });
      }
    }

    if (dto.estado) {
      condiciones.push({ estado: dto.estado });
    }

    this.agregarBusqueda(condiciones, dto.busqueda);

    return { AND: condiciones };
  }

  /** Agrega las condiciones de búsqueda por palabras. */
  private agregarBusqueda(
    condiciones: Prisma.usuariosWhereInput[],
    busqueda: string | undefined,
  ): void {
    const terminos = (busqueda ?? '')
      .trim()
      .split(/\s+/)
      .filter((termino) => termino.length > 0);

    for (const termino of terminos) {
      condiciones.push({
        OR: [
          { nombre: { contains: termino, mode: 'insensitive' } },
          { apellido: { contains: termino, mode: 'insensitive' } },
          // `correo` es CITEXT: `LIKE` sigue siendo sensible a mayúsculas, por
          // eso se fuerza `mode: 'insensitive'` (ILIKE).
          { correo: { contains: termino, mode: 'insensitive' } },
          { documento: { contains: termino, mode: 'insensitive' } },
          {
            comerciantes: {
              is: {
                actividad_comercial: {
                  contains: termino,
                  mode: 'insensitive',
                },
              },
            },
          },
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
        ],
      });
    }
  }

  /** Convierte una fila del listado de comerciantes en el DTO de respuesta. */
  private mapearListado(fila: FilaListado): ComercianteListadoDto {
    return {
      id: fila.id.toString(),
      nombre: fila.nombre,
      apellido: fila.apellido,
      tipoDocumento: fila.tipo_documento,
      documento: fila.documento,
      correo: fila.correo,
      telefono: fila.telefono,
      estado: fila.estado,
      categoria: fila.comerciantes?.categoria ?? null,
      actividadComercial: fila.comerciantes?.actividad_comercial ?? null,
      totalSolicitudes: fila.comerciantes?._count.solicitudes ?? 0,
      totalPermisos: fila.comerciantes?._count.permisos ?? 0,
      creadoEn: fila.creado_en,
    };
  }

  /** Convierte una fila del listado general en el DTO de respuesta. */
  private mapearUsuarioListado(fila: FilaUsuarioListado): UsuarioListadoDto {
    return {
      id: fila.id.toString(),
      nombre: fila.nombre,
      apellido: fila.apellido,
      correo: fila.correo,
      documento: fila.documento,
      telefono: fila.telefono,
      rol: fila.rol,
      estado: fila.estado,
      perfil: fila.gestores_gestores_usuario_idTousuarios?.perfil ?? null,
      categoria: fila.comerciantes?.categoria ?? null,
      actividadComercial: fila.comerciantes?.actividad_comercial ?? null,
      nombreOrganizacion:
        fila.organizadores_organizadores_usuario_idTousuarios
          ?.nombre_organizacion ?? null,
      creadoEn: fila.creado_en,
    };
  }

  /** Convierte una fila del detalle en el DTO de respuesta. */
  private mapearDetalle(fila: FilaDetalle): UsuarioDetalleResponseDto {
    const comercial = fila.comerciantes;
    const solicitudes = comercial
      ? comercial.solicitudes.map((solicitud) =>
          this.mapearSolicitud(solicitud),
        )
      : [];
    const permisos = comercial
      ? comercial.permisos.map((permiso) => this.mapearPermiso(permiso))
      : [];
    const gestor = fila.gestores_gestores_usuario_idTousuarios;
    const organizacion = fila.organizadores_organizadores_usuario_idTousuarios;

    return {
      usuario: {
        id: fila.id.toString(),
        nombre: fila.nombre,
        apellido: fila.apellido,
        tipoDocumento: fila.tipo_documento,
        documento: fila.documento,
        telefono: fila.telefono,
        correo: fila.correo,
        rol: fila.rol,
        estado: fila.estado,
        creadoEn: fila.creado_en,
        actualizadoEn: fila.actualizado_en,
        perfilComercial: comercial
          ? {
              actividadComercial: comercial.actividad_comercial,
              categoria: comercial.categoria,
              actualizadoEn: comercial.actualizado_en,
            }
          : null,
        perfilGestor: gestor
          ? {
              perfil: gestor.perfil,
              creadoPor: gestor.creado_por?.toString() ?? null,
            }
          : null,
        organizacion: organizacion
          ? {
              nombreOrganizacion: organizacion.nombre_organizacion,
              nit: organizacion.nit,
              representante: organizacion.representante,
              tipoFeria: organizacion.tipo_feria,
              contacto: organizacion.contacto,
              estado: organizacion.estado,
              validadoEn: organizacion.validado_en,
            }
          : null,
      },
      solicitudes,
      permisos,
      totales: {
        solicitudes: solicitudes.length,
        permisos: permisos.length,
      },
    };
  }

  /** Convierte una solicitud anidada en su DTO. */
  private mapearSolicitud(solicitud: FilaSolicitud): SolicitudDetalleDto {
    return {
      id: solicitud.id.toString(),
      numeroRadicado: solicitud.numero_radicado,
      estado: solicitud.estado,
      actividad: solicitud.actividad,
      fechaInicio: solicitud.fecha_inicio,
      fechaFin: solicitud.fecha_fin,
      horaInicio: formatearHora(solicitud.hora_inicio),
      horaFin: formatearHora(solicitud.hora_fin),
      radicadaEn: solicitud.radicada_en,
      decididaEn: solicitud.decidida_en,
      motivoRechazo: solicitud.motivo_rechazo,
      creadoEn: solicitud.creado_en,
      espacio: solicitud.espacios_temporales?.nombre ?? null,
      permiso: solicitud.permisos
        ? {
            numero: solicitud.permisos.numero,
            estado: solicitud.permisos.estado,
          }
        : null,
    };
  }

  /** Convierte un permiso anidado en su DTO. */
  private mapearPermiso(permiso: FilaPermiso): PermisoDetalleDto {
    return {
      id: permiso.id.toString(),
      numero: permiso.numero,
      categoriaAutorizada: permiso.categoria_autorizada,
      fechaInicio: permiso.fecha_inicio,
      fechaFin: permiso.fecha_fin,
      estado: permiso.estado,
      emitidoEn: permiso.emitido_en,
      espacio: permiso.espacios_temporales?.nombre ?? null,
      solicitudNumero: permiso.solicitudes.numero_radicado,
      cobro: permiso.cobros
        ? {
            valor: permiso.cobros.valor.toString(),
            estado: permiso.cobros.estado,
            pagadoEn: permiso.cobros.pagado_en,
          }
        : null,
    };
  }

  /** Genera una contraseña temporal con mayúscula, minúscula, dígito y símbolo. */
  private generarPasswordTemporal(): string {
    const mayusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const minusculas = 'abcdefghijkmnopqrstuvwxyz';
    const digitos = '23456789';
    const simbolos = '!@#$%&*';
    const todos = mayusculas + minusculas + digitos + simbolos;

    const elegir = (alfabeto: string): string =>
      alfabeto[randomInt(alfabeto.length)] as string;

    let password =
      elegir(mayusculas) +
      elegir(minusculas) +
      elegir(digitos) +
      elegir(simbolos);

    for (let i = 0; i < 8; i++) {
      password += elegir(todos);
    }

    return password;
  }

  /** Mensaje de confirmación según el estado aplicado. */
  private mensajeEstado(estado: EstadoCuentaGestionable): string {
    const mensajes: Record<EstadoCuentaGestionable, string> = {
      activa: 'Cuenta activada. El cambio quedó registrado en la auditoría.',
      suspendida:
        'Cuenta suspendida. El cambio quedó registrado en la auditoría.',
      inactiva:
        'Cuenta marcada como inactiva. El cambio quedó registrado en la ' +
        'auditoría.',
    };
    return mensajes[estado];
  }
}
