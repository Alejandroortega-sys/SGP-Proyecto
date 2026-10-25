import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { enteroPositivo } from '../common/entero-positivo';
import { fijarActorAuditoria } from '../common/auditoria';
import { OPCIONES_ARGON2 } from '../common/opciones-argon2';
import { CorreoService } from '../correo/correo.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ComercianteResponseDto,
  MensajeResponseDto,
} from './dto/comerciante-response.dto';
import { CuentaResponseDto } from './dto/cuenta-response.dto';
import { ActivarCuentaDto } from './dto/activar-cuenta.dto';
import {
  ActualizarComercianteGestorDto,
  ComercianteActualizadoDto,
} from './dto/actualizar-comerciante-gestor.dto';
import { CrearComercianteDto } from './dto/crear-comerciante.dto';
import { CrearOrganizadorDto } from './dto/crear-organizador.dto';
import { ReenviarCodigoDto } from './dto/reenviar-codigo.dto';
import { RestablecerPasswordDto } from './dto/restablecer-password.dto';
import { SolicitarRecuperacionDto } from './dto/solicitar-recuperacion.dto';

/** Mensaje genérico para no revelar si la cuenta existe (anti-enumeración). */
const CODIGO_INVALIDO = 'El código de activación es inválido o ha expirado';

/** Respuesta genérica del reenvío (no revela si la cuenta existe). */
const MENSAJE_REENVIO =
  'Si el correo corresponde a una cuenta pendiente de activación, ' +
  'enviamos un nuevo código.';

/**
 * Respuesta genérica de la solicitud de recuperación (no revela si el
 * correo tiene una cuenta activa registrada).
 */
const MENSAJE_RECUPERACION =
  'Si el correo corresponde a una cuenta activa, enviamos un código para ' +
  'restablecer la contraseña. Revisa tu correo: el código tiene vigencia ' +
  'corta.';

/**
 * Mensaje genérico para códigos de recuperación inválidos: cubre cuenta
 * inexistente o no activa, código erróneo, ya usado o expirado.
 */
const CODIGO_RECUPERACION_INVALIDO =
  'El código de recuperación es inválido o ha expirado. Solicita uno nuevo.';

/**
 * Lógica del registro y activación de comerciantes (HU-01) y de la corrección
 * de sus datos sensibles por un gestor municipal (HU-04).
 *
 * - La contraseña se guarda hasheada con argon2 (argon2id).
 * - La cuenta nace en estado «Pendiente de activación».
 * - La activación usa un código numérico de 6 dígitos enviado por correo;
 *   en la BD solo se guarda el hash argon2 de ese código (`tokens_seguridad`).
 * - Los errores de BD (correo/documento duplicados, CHECK de rol) los
 *   traduce el filtro global; aquí no se capturan.
 */
@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);
  /** Vigencia del código de activación, en minutos. */
  private readonly ttlMinutos: number;
  /** Vigencia del código de recuperación de contraseña, en minutos. */
  private readonly ttlRecuperacionMinutos: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
    config: ConfigService,
  ) {
    this.ttlMinutos = enteroPositivo(
      config.get<string | undefined>('ACTIVATION_CODE_TTL_MINUTES'),
      15,
    );
    this.ttlRecuperacionMinutos = enteroPositivo(
      config.get<string | undefined>('PASSWORD_RECOVERY_CODE_TTL_MINUTES'),
      2,
    );
  }

  /**
   * Registra el perfil de un comerciante.
   *
   * En una única transacción crea: la cuenta en `usuarios` (rol comerciante,
   * estado «pendiente de activación»), el perfil en `comerciantes`, el hash
   * del código en `tokens_seguridad` y el aviso en `notificaciones`.
   * Después confirma el commit y envía el código por correo.
   */
  async crearComerciante(
    dto: CrearComercianteDto,
  ): Promise<ComercianteResponseDto> {
    const correo = dto.correo.trim().toLowerCase();
    const nombre = dto.nombre.trim();
    const apellido = dto.apellido?.trim() || undefined;
    const codigo = this.generarCodigo();

    // Los hash se calculan ANTES de abrir la transacción para mantenerla corta.
    const [passwordHash, tokenHash] = await Promise.all([
      argon2.hash(dto.password, OPCIONES_ARGON2),
      argon2.hash(codigo, OPCIONES_ARGON2),
    ]);
    const expiraEn = new Date(Date.now() + this.ttlMinutos * 60_000);

    const usuario = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.usuarios.create({
        data: {
          rol: 'comerciante',
          nombre,
          apellido,
          tipo_documento: dto.tipoDocumento,
          documento: dto.documento.trim(),
          telefono: dto.telefono.trim(),
          correo,
          password_hash: passwordHash,
          // estado: la BD lo deja en «pendiente_activación» por defecto.
          comerciantes: {
            create: {
              actividad_comercial: dto.actividadComercial.trim(),
              categoria: dto.categoria,
            },
          },
        },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          correo: true,
          rol: true,
          estado: true,
          comerciantes: {
            select: { actividad_comercial: true, categoria: true },
          },
        },
      });

      // Se guarda el hash del código, nunca el código plano.
      await tx.tokens_seguridad.create({
        data: {
          usuario_id: creado.id,
          tipo: 'activacion',
          token_hash: tokenHash,
          expira_en: expiraEn,
        },
      });

      await tx.notificaciones.create({
        data: {
          usuario_id: creado.id,
          tipo: 'activacion',
          asunto: 'Active su cuenta',
          cuerpo:
            `Hola ${nombre}, ingresa el código de 6 dígitos que te enviamos ` +
            'por correo para activar tu cuenta en SGP Tuluá.',
          canal: 'correo',
        },
      });

      return creado;
    });

    try {
      await this.correo.enviarCodigoActivacion(
        correo,
        usuario.nombre,
        codigo,
        this.ttlMinutos,
      );
    } catch (error) {
      // La cuenta ya quedó creada: el usuario puede pedir un código nuevo.
      this.logger.error(
        `No se pudo enviar el código de activación a ${correo}: ${String(error)}`,
      );
      throw new ServiceUnavailableException(
        'La cuenta fue creada, pero no pudimos enviar el código de ' +
          'activación. Solicita uno nuevo con el endpoint de reenvío.',
      );
    }

    return {
      id: usuario.id.toString(),
      nombre: usuario.nombre,
      apellido: usuario.apellido ?? undefined,
      correo: usuario.correo,
      rol: usuario.rol,
      estado: usuario.estado,
      actividadComercial: usuario.comerciantes?.actividad_comercial,
      categoria: usuario.comerciantes?.categoria,
      mensaje:
        'Cuenta creada en estado «Pendiente de activación». Revisa tu ' +
        'correo e ingresa el código de activación.',
    };
  }

  /**
   * Registra la cuenta de un organizador de feria.
   *
   * Solo crea la cuenta personal (`usuarios`) y el token de activación. La
   * organización se registra después de activar la cuenta, mediante
   * `POST /organizadores/mi-organizacion`; por eso aquí no se crea ninguna
   * fila en `organizadores`.
   *
   * La cuenta nace en estado «pendiente_activacion» (valor por defecto de la
   * BD) y recibe el mismo código de 6 dígitos que un comerciante.
   */
  async crearOrganizador(dto: CrearOrganizadorDto): Promise<CuentaResponseDto> {
    const correo = dto.correo.trim().toLowerCase();
    const nombre = dto.nombre.trim();
    const apellido = dto.apellido?.trim() || undefined;
    const codigo = this.generarCodigo();

    const [passwordHash, tokenHash] = await Promise.all([
      argon2.hash(dto.password, OPCIONES_ARGON2),
      argon2.hash(codigo, OPCIONES_ARGON2),
    ]);
    const expiraEn = new Date(Date.now() + this.ttlMinutos * 60_000);

    const usuario = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.usuarios.create({
        data: {
          rol: 'organizador',
          nombre,
          apellido,
          tipo_documento: dto.tipoDocumento,
          documento: dto.documento.trim(),
          telefono: dto.telefono.trim(),
          correo,
          password_hash: passwordHash,
          // estado: la BD lo deja en «pendiente_activación» por defecto.
        },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          correo: true,
          rol: true,
          estado: true,
        },
      });

      await tx.tokens_seguridad.create({
        data: {
          usuario_id: creado.id,
          tipo: 'activacion',
          token_hash: tokenHash,
          expira_en: expiraEn,
        },
      });

      await tx.notificaciones.create({
        data: {
          usuario_id: creado.id,
          tipo: 'activacion',
          asunto: 'Active su cuenta',
          cuerpo:
            `Hola ${nombre}, ingresa el código de 6 dígitos que te enviamos ` +
            'por correo para activar tu cuenta de organizador en SGP Tuluá.',
          canal: 'correo',
        },
      });

      return creado;
    });

    try {
      await this.correo.enviarCodigoActivacion(
        correo,
        usuario.nombre,
        codigo,
        this.ttlMinutos,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo enviar el código de activación a ${correo}: ${String(error)}`,
      );
      throw new ServiceUnavailableException(
        'La cuenta fue creada, pero no pudimos enviar el código de ' +
          'activación. Solicita uno nuevo con el endpoint de reenvío.',
      );
    }

    return {
      id: usuario.id.toString(),
      nombre: usuario.nombre,
      apellido: usuario.apellido ?? undefined,
      correo: usuario.correo,
      rol: usuario.rol,
      estado: usuario.estado,
      mensaje:
        'Cuenta de organizador creada en estado «Pendiente de activación». ' +
        'Revisa tu correo e ingresa el código de activación.',
    };
  }

  /**
   * Activa la cuenta comparando el código recibido con el hash guardado.
   *
   * Si el código es correcto y no ha expirado: marca el token como usado,
   * pasa la cuenta a «activa» y registra la notificación.
   */
  async activarCuenta(dto: ActivarCuentaDto): Promise<CuentaResponseDto> {
    const correo = dto.correo.trim().toLowerCase();

    const usuario = await this.prisma.usuarios.findUnique({
      where: { correo },
      select: { id: true, nombre: true, correo: true, rol: true, estado: true },
    });

    if (usuario && usuario.estado === 'activa') {
      throw new ConflictException('La cuenta ya está activa');
    }
    if (!usuario || usuario.estado !== 'pendiente_activacion') {
      // Mensaje genérico: no se revela si la cuenta existe.
      throw new BadRequestException(CODIGO_INVALIDO);
    }

    const token = await this.prisma.tokens_seguridad.findFirst({
      where: {
        usuario_id: usuario.id,
        tipo: 'activacion',
        usado: false,
        expira_en: { gt: new Date() },
      },
      orderBy: { creado_en: 'desc' },
    });

    if (!token) {
      throw new BadRequestException(CODIGO_INVALIDO);
    }

    const coincide = await argon2
      .verify(token.token_hash, dto.codigo)
      .catch(() => false);
    if (!coincide) {
      throw new BadRequestException(CODIGO_INVALIDO);
    }

    await this.prisma.$transaction([
      this.prisma.tokens_seguridad.update({
        where: { id: token.id },
        data: { usado: true },
      }),
      this.prisma.usuarios.update({
        where: { id: usuario.id },
        data: { estado: 'activa' },
      }),
      this.prisma.notificaciones.create({
        data: {
          usuario_id: usuario.id,
          tipo: 'activacion',
          asunto: 'Cuenta activada',
          cuerpo:
            'Tu cuenta en la plataforma SGP Tuluá fue activada correctamente.',
          canal: 'app',
        },
      }),
    ]);

    return {
      id: usuario.id.toString(),
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.rol,
      estado: 'activa',
      mensaje: 'Cuenta activada correctamente. Ya puedes iniciar sesión.',
    };
  }

  /**
   * Genera y envía un código nuevo, invalidando los anteriores.
   *
   * Responde siempre con el mismo mensaje, exista o no la cuenta, para no
   * permitir enumerar correos registrados.
   */
  async reenviarCodigo(dto: ReenviarCodigoDto): Promise<MensajeResponseDto> {
    const correo = dto.correo.trim().toLowerCase();

    const usuario = await this.prisma.usuarios.findUnique({
      where: { correo },
      select: { id: true, nombre: true, estado: true },
    });

    if (!usuario || usuario.estado !== 'pendiente_activacion') {
      // Mantiene el mismo mensaje para no revelar la existencia de la cuenta.
      return { mensaje: MENSAJE_REENVIO };
    }

    const codigo = this.generarCodigo();
    const tokenHash = await argon2.hash(codigo, OPCIONES_ARGON2);
    const expiraEn = new Date(Date.now() + this.ttlMinutos * 60_000);

    await this.prisma.$transaction([
      // Invalida los códigos anteriores: solo queda vigente el último.
      this.prisma.tokens_seguridad.updateMany({
        where: {
          usuario_id: usuario.id,
          tipo: 'activacion',
          usado: false,
        },
        data: { usado: true },
      }),
      this.prisma.tokens_seguridad.create({
        data: {
          usuario_id: usuario.id,
          tipo: 'activacion',
          token_hash: tokenHash,
          expira_en: expiraEn,
        },
      }),
    ]);

    try {
      await this.correo.enviarCodigoActivacion(
        correo,
        usuario.nombre,
        codigo,
        this.ttlMinutos,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo reenviar el código de activación a ${correo}: ${String(error)}`,
      );
      throw new ServiceUnavailableException(
        'No pudimos enviar el nuevo código de activación. ' +
          'Inténtalo de nuevo en unos minutos.',
      );
    }

    return { mensaje: MENSAJE_REENVIO };
  }

  /**
   * Genera y envía un código de recuperación de contraseña.
   *
   * Solo las cuentas activas reciben código; para el resto (incluidos
   * correos no registrados) la respuesta es la misma, para no permitir la
   * enumeración de cuentas. Cada solicitud invalida los códigos pendientes
   * anteriores: solo el último queda vigente, con la vigencia corta
   * configurada (2 minutos por defecto).
   */
  async solicitarRecuperacion(
    dto: SolicitarRecuperacionDto,
  ): Promise<MensajeResponseDto> {
    const correo = dto.correo.trim().toLowerCase();

    const usuario = await this.prisma.usuarios.findUnique({
      where: { correo },
      select: { id: true, nombre: true, estado: true },
    });

    // Solo las cuentas activas pueden recuperar la contraseña.
    if (!usuario || usuario.estado !== 'activa') {
      // Mantiene el mismo mensaje para no revelar la existencia de la cuenta.
      return { mensaje: MENSAJE_RECUPERACION };
    }

    const codigo = this.generarCodigo();
    const tokenHash = await argon2.hash(codigo, OPCIONES_ARGON2);
    const expiraEn = new Date(
      Date.now() + this.ttlRecuperacionMinutos * 60_000,
    );

    await this.prisma.$transaction([
      // Invalida los códigos pendientes: solo queda vigente el último.
      this.prisma.tokens_seguridad.updateMany({
        where: {
          usuario_id: usuario.id,
          tipo: 'recuperacion_password',
          usado: false,
        },
        data: { usado: true },
      }),
      // Se guarda el hash del código, nunca el código plano.
      this.prisma.tokens_seguridad.create({
        data: {
          usuario_id: usuario.id,
          tipo: 'recuperacion_password',
          token_hash: tokenHash,
          expira_en: expiraEn,
        },
      }),
    ]);

    try {
      await this.correo.enviarCodigoRecuperacion(
        correo,
        usuario.nombre,
        codigo,
        this.ttlRecuperacionMinutos,
      );
    } catch (error) {
      // El código ya quedó guardado: el usuario puede pedir uno nuevo.
      this.logger.error(
        `No se pudo enviar el código de recuperación a ${correo}: ${String(error)}`,
      );
      throw new ServiceUnavailableException(
        'No pudimos enviar el código de recuperación. ' +
          'Inténtalo de nuevo en unos minutos.',
      );
    }

    return { mensaje: MENSAJE_RECUPERACION };
  }

  /**
   * Restablece la contraseña confirmando el código enviado por correo.
   *
   * Si el código es correcto y no ha expirado: consume todos los códigos de
   * recuperación pendientes, actualiza la contraseña (hash argon2id) y
   * limpia el bloqueo por intentos fallidos del login, pues el código
   * válido demostró la identidad del usuario. La comparación de la
   * expiración la hace la base de datos (`expira_en > now()`).
   */
  async restablecerPassword(
    dto: RestablecerPasswordDto,
  ): Promise<MensajeResponseDto> {
    const correo = dto.correo.trim().toLowerCase();

    const usuario = await this.prisma.usuarios.findUnique({
      where: { correo },
      select: { id: true, nombre: true, estado: true },
    });

    // Mensaje genérico: cubre cuenta inexistente y cuenta no activa.
    if (!usuario || usuario.estado !== 'activa') {
      throw new BadRequestException(CODIGO_RECUPERACION_INVALIDO);
    }

    const token = await this.prisma.tokens_seguridad.findFirst({
      where: {
        usuario_id: usuario.id,
        tipo: 'recuperacion_password',
        usado: false,
        expira_en: { gt: new Date() },
      },
      orderBy: { creado_en: 'desc' },
    });

    if (!token) {
      throw new BadRequestException(CODIGO_RECUPERACION_INVALIDO);
    }

    const coincide = await argon2
      .verify(token.token_hash, dto.codigo)
      .catch(() => false);
    if (!coincide) {
      throw new BadRequestException(CODIGO_RECUPERACION_INVALIDO);
    }

    // Se calcula antes de abrir la transacción para mantenerla corta.
    const passwordHash = await argon2.hash(dto.password, OPCIONES_ARGON2);

    await this.prisma.$transaction([
      // Consume todos los códigos de recuperación pendientes.
      this.prisma.tokens_seguridad.updateMany({
        where: {
          usuario_id: usuario.id,
          tipo: 'recuperacion_password',
          usado: false,
        },
        data: { usado: true },
      }),
      this.prisma.usuarios.update({
        where: { id: usuario.id },
        data: {
          password_hash: passwordHash,
          // Autodesbloqueo: el código válido demostró la identidad.
          intentos_fallidos: 0,
          bloqueado_hasta: null,
        },
      }),
      this.prisma.notificaciones.create({
        data: {
          usuario_id: usuario.id,
          tipo: 'recuperacion_password',
          asunto: 'Contraseña actualizada',
          cuerpo:
            `Hola ${usuario.nombre}, la contraseña de tu cuenta en SGP ` +
            'Tuluá fue actualizada. Si no fuiste tú, comunícate de inmediato ' +
            'con la Secretaría de Gobierno.',
          canal: 'app',
        },
      }),
    ]);

    return {
      mensaje:
        'Contraseña actualizada correctamente. Ya puedes iniciar sesión con ' +
        'tu nueva contraseña.',
    };
  }

  /**
   * Corrige los campos sensibles del perfil de un comerciante (HU-04).
   *
   * Endpoint usado por el gestor municipal (revisor o administrador) para los
   * datos que el propio comerciante no puede tocar: documento, tipo de
   * documento, actividad comercial y categoría. Recibe el identificador del
   * **gestor** autenticado para dejarlo como actor de la auditoría.
   *
   * **Auditoría** (todo dentro de una transacción):
   * - `usuarios` (documento, tipo): el trigger `fn_auditoria` registra la
   *   fila antes/después con el gestor como actor (`app.actor_id`).
   * - `comerciantes` (actividad, categoría): esa tabla no tiene trigger, así
   *   que el registro en `auditoria` lo escribe aquí la aplicación con el
   *   valor anterior y el nuevo.
   *
   * @param idComerciante Identificador del comerciante a corregir.
   * @param dto Campos a corregir (al menos uno).
   * @param idGestor Identificador del gestor autenticado (actor de auditoría).
   * @throws NotFoundException si el usuario no existe o no es comerciante.
   * @throws BadRequestException si el cuerpo no trae ningún campo.
   */
  async actualizarComerciantePorGestor(
    idComerciante: bigint,
    dto: ActualizarComercianteGestorDto,
    idGestor: bigint,
  ): Promise<ComercianteActualizadoDto> {
    const usuario = await this.prisma.usuarios.findUnique({
      where: { id: idComerciante },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        tipo_documento: true,
        documento: true,
        telefono: true,
        correo: true,
        estado: true,
        rol: true,
        comerciantes: {
          select: { actividad_comercial: true, categoria: true },
        },
      },
    });

    if (!usuario || usuario.rol !== 'comerciante') {
      throw new NotFoundException('El comerciante solicitado no existe');
    }

    const datosUsuario: Prisma.usuariosUncheckedUpdateInput = {};
    if (dto.documento !== undefined) {
      datosUsuario.documento = dto.documento.trim();
    }
    if (dto.tipoDocumento !== undefined) {
      datosUsuario.tipo_documento = dto.tipoDocumento;
    }

    const datosComerciante: Prisma.comerciantesUncheckedUpdateInput = {};
    if (dto.actividadComercial !== undefined) {
      datosComerciante.actividad_comercial = dto.actividadComercial.trim();
    }
    if (dto.categoria !== undefined) {
      datosComerciante.categoria = dto.categoria;
    }

    const cambioUsuario = Object.keys(datosUsuario).length > 0;
    const cambioComerciante = Object.keys(datosComerciante).length > 0;
    if (!cambioUsuario && !cambioComerciante) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para corregir (documento, ' +
          'tipoDocumento, actividadComercial o categoria).',
      );
    }

    const actualizado = await this.prisma.$transaction(async (tx) => {
      // Auditoría: el actor de este cambio es el gestor, no el comerciante.
      await fijarActorAuditoria(tx, idGestor);

      if (cambioUsuario) {
        // El trigger fn_auditoria de usuarios deja el registro en auditoria.
        await tx.usuarios.update({
          where: { id: idComerciante },
          data: datosUsuario,
        });
      }

      let perfilComercial = usuario.comerciantes!;
      if (cambioComerciante) {
        const anterior = perfilComercial;
        perfilComercial = await tx.comerciantes.update({
          where: { usuario_id: idComerciante },
          data: datosComerciante,
        });
        // `comerciantes` no tiene trigger de auditoría: se registra a mano
        // con el valor anterior y el nuevo, igual que haría fn_auditoria.
        // Se usa SQL crudo para que `creado_en` lo genere `now()` de
        // PostgreSQL: el `@default(now())` de Prisma lo calcula el cliente y
        // con el driver adapter aplica el desfase de la zona local.
        const valorAnterior = {
          usuario_id: idComerciante.toString(),
          actividad_comercial: anterior.actividad_comercial,
          categoria: anterior.categoria,
        };
        const valorNuevo = {
          usuario_id: idComerciante.toString(),
          actividad_comercial: perfilComercial.actividad_comercial,
          categoria: perfilComercial.categoria,
        };
        await tx.$executeRaw`
          INSERT INTO auditoria
            (tabla, registro_id, accion, valor_anterior, valor_nuevo, actor_id)
          VALUES (
            'comerciantes',
            ${idComerciante},
            'update',
            ${JSON.stringify(valorAnterior)}::jsonb,
            ${JSON.stringify(valorNuevo)}::jsonb,
            ${idGestor}
          )
        `;
      }

      return {
        tipo_documento: cambioUsuario
          ? ((datosUsuario.tipo_documento as string | undefined) ??
            usuario.tipo_documento)
          : usuario.tipo_documento,
        documento: cambioUsuario
          ? ((datosUsuario.documento as string | undefined) ??
            usuario.documento)
          : usuario.documento,
        perfilComercial,
      };
    });

    return {
      id: usuario.id.toString(),
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      tipoDocumento: actualizado.tipo_documento,
      documento: actualizado.documento,
      telefono: usuario.telefono,
      correo: usuario.correo,
      estado: usuario.estado,
      actividadComercial: actualizado.perfilComercial.actividad_comercial,
      categoria: actualizado.perfilComercial.categoria,
      mensaje:
        'Datos del comerciante actualizados. El cambio quedó registrado en ' +
        'la auditoría.',
    };
  }

  /** Genera un código numérico aleatorio de 6 dígitos (criptoseguro). */
  private generarCodigo(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }
}
