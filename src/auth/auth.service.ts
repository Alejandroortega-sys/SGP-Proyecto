import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { enteroPositivo } from '../common/entero-positivo';
import { fijarActorAuditoria } from '../common/auditoria';
import { OPCIONES_ARGON2 } from '../common/opciones-argon2';
import { parseIdBigint } from '../common/parse-id';
import type {
  estado_usuario,
  perfil_gestor,
  rol_usuario,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  LoginPrimerAccesoResponseDto,
  LoginResponseDto,
  RefreshResponseDto,
} from './dto/login-response.dto';
import type { LoginDto } from './dto/login.dto';
import type { LogoutDto } from './dto/logout.dto';
import type { PrimerAccesoGestorDto } from './dto/primer-acceso-gestor.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';
import type { JwtPayload } from './interfaces/jwt-payload.interface';
import { SesionesService } from './sesiones.service';

/** Mensaje único para no revelar si el correo está registrado. */
const CREDENCIALES_INVALIDAS = 'Credenciales inválidas';

/**
 * Hash argon2id de descarte: se verifica cuando el correo no existe para que
 * el tiempo de respuesta sea similar al de una contraseña incorrecta y no se
 * pueda enumerar cuentas midiendo latencias. Nunca coincide con un login
 * válido porque el usuario no existe.
 */
const HASH_DESCARTE =
  '$argon2id$v=19$m=19456,p=1,t=2$kf3b2FkpKsGTxJgYS84tUQ$Ht3hrSXH5cZwc5BJX8gE47ImO9+dn4pjSHv6bKZR/SU';

/** Mensaje de 403 según el estado de la cuenta. */
const MENSAJES_ESTADO: Record<estado_usuario, string> = {
  pendiente_activacion:
    'La cuenta está pendiente de activación. Revisa tu correo e ingresa el ' +
    'código de activación.',
  suspendida:
    'Su cuenta ha sido suspendida, comuníquese con soporte para activarla.',
  inactiva:
    'Su cuenta ha sido desactivada, comuníquese con soporte para activarla.',
  activa: '',
};

/** Fila devuelta por el incremento atómico de intentos fallidos. */
interface ResultadoIntento {
  /** `true` si este intento dejó la cuenta bloqueada. */
  bloqueado: boolean;
  /** Minutos de bloqueo restantes (o `null` si no quedó bloqueada). */
  minutos: number | null;
}

/** Estado de bloqueo calculado por la base de datos. */
interface EstadoBloqueo {
  bloqueado: boolean;
  minutos: number;
}

/** Datos mínimos para emitir una sesión JWT. */
interface UsuarioSesion {
  id: bigint;
  nombre: string;
  apellido: string | null;
  correo: string;
  rol: rol_usuario;
  estado: estado_usuario;
  perfil: perfil_gestor | null;
}

/**
 * Inicio de sesión con JWT y control de intentos fallidos.
 *
 * - Verifica la contraseña con argon2 (argon2id), el mismo algoritmo con el
 *   que se registran las cuentas.
 * - Tras `LOGIN_MAX_ATTEMPTS` fallos consecutivos bloquea la cuenta durante
 *   `LOGIN_LOCK_MINUTES` minutos (HTTP 423).
 * - Emite un JWT con vigencia de `JWT_GESTOR_EXPIRES_IN_SECONDS` para los
 *   gestores (30 min por defecto) y `JWT_EXPIRES_IN_SECONDS` para el resto
 *   (8 h por defecto).
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Vigencia del token para comerciantes y organizadores. */
  private readonly expiracionNormal: number;
  /** Vigencia del token para gestores. */
  private readonly expiracionGestor: number;
  /** Vigencia del refresh token, en segundos. */
  private readonly expiracionRefresh: number;
  /** Fallos consecutivos que provocan el bloqueo. */
  private readonly maxIntentos: number;
  /** Duración del bloqueo, en minutos. */
  private readonly minutosBloqueo: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly sesiones: SesionesService,
    config: ConfigService,
  ) {
    this.expiracionNormal = enteroPositivo(
      config.get<string>('JWT_EXPIRES_IN_SECONDS'),
      28_800,
    );
    this.expiracionGestor = enteroPositivo(
      config.get<string>('JWT_GESTOR_EXPIRES_IN_SECONDS'),
      1_800,
    );
    this.expiracionRefresh = enteroPositivo(
      config.get<string>('JWT_REFRESH_EXPIRES_IN_SECONDS'),
      604_800,
    );
    this.maxIntentos = enteroPositivo(
      config.get<string>('LOGIN_MAX_ATTEMPTS'),
      5,
    );
    this.minutosBloqueo = enteroPositivo(
      config.get<string>('LOGIN_LOCK_MINUTES'),
      15,
    );
  }

  /**
   * Autentica un usuario y devuelve su JWT.
   *
   * Los gestores recién creados quedan en estado «pendiente_activacion» y
   * reciben una contraseña temporal por correo. Cuando uno de ellos inicia
   * sesión con esa contraseña, no se emite el JWT de acceso: se devuelve una
   * respuesta que obliga a cambiar la contraseña en
   * `POST /auth/gestor/primer-acceso`.
   *
   * @param dto Correo y contraseña enviados por el cliente.
   * @throws UnauthorizedException (401) si el usuario no existe o la
   *   contraseña es incorrecta.
   * @throws ForbiddenException (403) si la cuenta no está activa y no es un
   *   gestor pendiente de primer acceso.
   * @throws HttpException (423) si la cuenta está bloqueada por intentos
   *   fallidos.
   */
  async login(
    dto: LoginDto,
  ): Promise<LoginResponseDto | LoginPrimerAccesoResponseDto> {
    const correo = dto.correo.trim().toLowerCase();

    const usuario = await this.prisma.usuarios.findUnique({
      where: { correo },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        correo: true,
        password_hash: true,
        rol: true,
        estado: true,
        gestores_gestores_usuario_idTousuarios: {
          select: { perfil: true },
        },
      },
    });

    if (!usuario) {
      // Mismo costo computacional que una verificación real (anti-timing).
      await argon2.verify(HASH_DESCARTE, dto.password).catch(() => false);
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }

    // El bloqueo se evalúa antes que la contraseña: aunque el atacante
    // acierte, no puede entrar hasta que termine el castigo.
    const bloqueo = await this.estadoBloqueo(usuario.id);
    if (bloqueo.bloqueado) {
      throw this.errorBloqueado(bloqueo.minutos);
    }

    const esGestorPendiente =
      usuario.rol === 'gestor' && usuario.estado === 'pendiente_activacion';

    if (usuario.estado !== 'activa' && !esGestorPendiente) {
      throw new ForbiddenException(MENSAJES_ESTADO[usuario.estado]);
    }

    const coincide = usuario.password_hash
      ? await argon2
          .verify(usuario.password_hash, dto.password)
          .catch(() => false)
      : false;

    if (!coincide) {
      const intento = await this.registrarIntentoFallido(usuario.id);
      if (intento.bloqueado) {
        this.logger.warn(
          `Cuenta ${correo} bloqueada ${this.minutosBloqueo} min por ${this.maxIntentos} intentos fallidos`,
        );
        throw this.errorBloqueado(intento.minutos ?? this.minutosBloqueo);
      }
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }

    // Login correcto: se limpian los contadores de seguridad. El cambio
    // queda auditado con el propio usuario como actor (fijando
    // app.actor_id dentro de la transacción para el trigger de usuarios).
    await this.prisma.$transaction(async (tx) => {
      await fijarActorAuditoria(tx, usuario.id);
      await tx.usuarios.update({
        where: { id: usuario.id },
        data: { intentos_fallidos: 0, bloqueado_hasta: null },
      });
    });

    const perfil =
      usuario.rol === 'gestor'
        ? (usuario.gestores_gestores_usuario_idTousuarios?.perfil ?? null)
        : null;

    if (esGestorPendiente) {
      this.logger.log(
        `Primer acceso pendiente: ${correo} (gestor ${perfil ?? 'sin perfil'})`,
      );
      return {
        requiereCambioPassword: true,
        correo: usuario.correo,
        nombre: usuario.nombre,
        perfil: perfil ?? 'revisor',
        mensaje:
          'Debes cambiar tu contraseña para activar la cuenta y acceder a ' +
          'la plataforma.',
      };
    }

    this.logger.log(`Inicio de sesión correcto: ${correo} (${usuario.rol})`);

    const sesion = await this.sesiones.crear(
      usuario.id,
      this.expiracionRefresh,
    );

    return this.emitirSesion(
      {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol,
        estado: usuario.estado,
        perfil,
      },
      sesion,
    );
  }

  /**
   * Completa el primer acceso de un gestor recién creado.
   *
   * Verifica la contraseña temporal asignada por el administrador y define la
   * contraseña definitiva. Hasta que este cambio se completa, la cuenta
   * permanece en «pendiente_activacion» y no puede usar el resto de la API.
   *
   * @param dto Correo, contraseña temporal y contraseña nueva confirmada.
   * @throws UnauthorizedException si la cuenta no existe o la temporal es
   *   incorrecta.
   * @throws ForbiddenException si la cuenta no pertenece a un gestor o no
   *   puede iniciar sesión.
   * @throws ConflictException si la cuenta ya no está pendiente de primer
   *   acceso.
   */
  async primerAccesoGestor(
    dto: PrimerAccesoGestorDto,
  ): Promise<LoginResponseDto> {
    const correo = dto.correo.trim().toLowerCase();

    const usuario = await this.prisma.usuarios.findUnique({
      where: { correo },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        correo: true,
        password_hash: true,
        rol: true,
        estado: true,
        gestores_gestores_usuario_idTousuarios: {
          select: { perfil: true },
        },
      },
    });

    if (!usuario) {
      await argon2.verify(HASH_DESCARTE, dto.passwordActual).catch(() => false);
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }

    const bloqueo = await this.estadoBloqueo(usuario.id);
    if (bloqueo.bloqueado) {
      throw this.errorBloqueado(bloqueo.minutos);
    }

    if (usuario.rol !== 'gestor') {
      throw new ForbiddenException(
        'La cuenta no corresponde a un gestor municipal',
      );
    }

    const coincide = usuario.password_hash
      ? await argon2
          .verify(usuario.password_hash, dto.passwordActual)
          .catch(() => false)
      : false;

    if (!coincide) {
      const intento = await this.registrarIntentoFallido(usuario.id);
      if (intento.bloqueado) {
        this.logger.warn(
          `Cuenta ${correo} bloqueada ${this.minutosBloqueo} min por ${this.maxIntentos} intentos fallidos`,
        );
        throw this.errorBloqueado(intento.minutos ?? this.minutosBloqueo);
      }
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }

    if (usuario.estado !== 'pendiente_activacion') {
      if (usuario.estado === 'activa') {
        throw new ConflictException(
          'La cuenta ya está activa. Inicia sesión con tu contraseña actual.',
        );
      }
      throw new ForbiddenException(MENSAJES_ESTADO[usuario.estado]);
    }

    // Se calcula antes de abrir la transacción para mantenerla corta.
    const passwordHash = await argon2.hash(dto.password, OPCIONES_ARGON2);
    const perfil =
      usuario.gestores_gestores_usuario_idTousuarios?.perfil ?? null;

    await this.prisma.$transaction(async (tx) => {
      // Auditoría: el gestor que cambia su propia contraseña es el actor.
      await fijarActorAuditoria(tx, usuario.id);
      await tx.usuarios.update({
        where: { id: usuario.id },
        data: {
          password_hash: passwordHash,
          estado: 'activa',
          intentos_fallidos: 0,
          bloqueado_hasta: null,
        },
      });
      await tx.notificaciones.create({
        data: {
          usuario_id: usuario.id,
          tipo: 'activacion',
          asunto: 'Cuenta de gestor activada',
          cuerpo:
            'Tu cuenta de gestor municipal fue activada. Ya puedes usar la ' +
            'plataforma con tu nueva contraseña.',
          canal: 'app',
        },
      });
    });

    this.logger.log(`Primer acceso completado: ${correo} (gestor)`);

    const sesion = await this.sesiones.crear(
      usuario.id,
      this.expiracionRefresh,
    );

    return this.emitirSesion(
      {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol,
        estado: 'activa',
        perfil,
      },
      sesion,
    );
  }

  /**
   * Renueva el access token usando un refresh token válido.
   *
   * El refresh se rota: el token recibido queda como anterior y se emite uno
   * nuevo. Si se intenta reutilizar el anterior, la sesión se revoca.
   */
  async refresh(dto: RefreshTokenDto): Promise<RefreshResponseDto> {
    const validacion = await this.sesiones.validarRefresh(dto.refreshToken);
    if (!validacion || validacion.reutilizado) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const usuario = await this.prisma.usuarios.findUnique({
      where: { id: validacion.usuarioId },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        correo: true,
        rol: true,
        estado: true,
        gestores_gestores_usuario_idTousuarios: {
          select: { perfil: true },
        },
      },
    });

    if (!usuario) {
      await this.sesiones.revocar(validacion.id, validacion.usuarioId);
      throw new UnauthorizedException('La cuenta de la sesión ya no existe');
    }

    if (usuario.estado !== 'activa') {
      await this.sesiones.revocar(validacion.id, validacion.usuarioId);
      throw new ForbiddenException(MENSAJES_ESTADO[usuario.estado]);
    }

    const perfil =
      usuario.rol === 'gestor'
        ? (usuario.gestores_gestores_usuario_idTousuarios?.perfil ?? null)
        : null;

    const rotado = await this.sesiones.rotar(
      validacion.id,
      dto.refreshToken,
      this.expiracionRefresh,
    );

    const sesion = await this.emitirSesion(
      {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol,
        estado: 'activa',
        perfil,
      },
      {
        id: validacion.id,
        refreshToken: rotado.refreshToken,
        refreshExpiraEn: rotado.refreshExpiraEn,
      },
    );

    return {
      accessToken: sesion.accessToken,
      refreshToken: sesion.refreshToken,
      tokenType: sesion.tokenType,
      expiresIn: sesion.expiresIn,
      refreshExpiresIn: sesion.refreshExpiresIn,
      usuario: sesion.usuario,
    };
  }

  /**
   * Cierra la sesión actual o todas las sesiones del usuario.
   *
   * La revocación se guarda en `sesiones.revocada_en`, por lo que el access
   * token deja de servir inmediatamente y sobrevive a reinicios del servidor.
   * El frontend debe eliminar ambos tokens de su almacenamiento.
   *
   * @param idUsuario Identificador del usuario autenticado (string del JWT).
   * @param token JWT completo recibido en `Authorization`.
   * @param dto Si `todas` es `true`, revoca todas las sesiones del usuario.
   */
  async logout(
    idUsuario: string,
    token: string,
    dto: LogoutDto = {},
  ): Promise<void> {
    const payload = await this.jwt
      .verifyAsync<JwtPayload>(token)
      .catch(() => null);
    if (!payload?.sid) {
      throw new UnauthorizedException('Token de acceso sin sesión');
    }

    const id = parseIdBigint(idUsuario);
    if (dto.todas) {
      await this.sesiones.revocarTodas(id);
      return;
    }

    await this.sesiones.revocar(parseIdBigint(payload.sid), id);
  }

  /** Construye la respuesta de login con el JWT de acceso. */
  private async emitirSesion(
    usuario: UsuarioSesion,
    sesion: {
      id: bigint;
      refreshToken: string;
      refreshExpiraEn: Date;
    },
  ): Promise<LoginResponseDto> {
    const expiresIn =
      usuario.rol === 'gestor' ? this.expiracionGestor : this.expiracionNormal;

    const payload: JwtPayload = {
      sub: usuario.id.toString(),
      correo: usuario.correo,
      rol: usuario.rol,
      sid: sesion.id.toString(),
      ...(usuario.perfil ? { perfil: usuario.perfil } : {}),
    };

    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn,
      // Evita que dos logins en el mismo segundo generen el mismo JWT (y que
      // un logout revoque involuntariamente la sesión nueva).
      jwtid: randomUUID(),
    });

    const refreshExpiresIn = Math.max(
      0,
      Math.round((sesion.refreshExpiraEn.getTime() - Date.now()) / 1_000),
    );

    return {
      requiereCambioPassword: false,
      accessToken,
      refreshToken: sesion.refreshToken,
      tokenType: 'Bearer',
      expiresIn,
      refreshExpiresIn,
      usuario: {
        id: usuario.id.toString(),
        nombre: usuario.nombre,
        apellido: usuario.apellido ?? undefined,
        correo: usuario.correo,
        rol: usuario.rol,
        perfil: usuario.perfil,
        estado: usuario.estado,
      },
    };
  }

  /**
   * Consulta en la base de datos si la cuenta está bloqueada y cuántos
   * minutos le quedan.
   *
   * La comparación se hace **en SQL** (`bloqueado_hasta > now()`) y no en
   * JavaScript a propósito: con `@prisma/adapter-pg` la deserialización de
   * `timestamptz` aplica el desfase de la zona local, de modo que leer la
   * columna con Prisma devuelve una hora incorrecta. Calcularlo en el motor
   * evita ese problema y mantiene la decisión de seguridad en un solo lugar.
   *
   * @param id Identificador del usuario (BIGINT).
   */
  private async estadoBloqueo(id: bigint): Promise<EstadoBloqueo> {
    const filas = await this.prisma.$queryRaw<EstadoBloqueo[]>`
      SELECT (bloqueado_hasta IS NOT NULL AND bloqueado_hasta > now()) AS bloqueado,
             GREATEST(
               COALESCE(
                 CEIL(EXTRACT(EPOCH FROM (bloqueado_hasta - now())) / 60),
                 0
               ),
               0
             )::int AS minutos
        FROM usuarios
       WHERE id = ${id.toString()}::bigint
    `;

    return filas[0] ?? { bloqueado: false, minutos: 0 };
  }

  /**
   * Incrementa el contador de intentos fallidos de forma atómica.
   *
   * Una sola sentencia `UPDATE ... RETURNING` evita condiciones de carrera
   * entre peticiones concurrentes. Al alcanzar el máximo, fija
   * `bloqueado_hasta` y reinicia el contador para el siguiente ciclo. El
   * `RETURNING` calcula el bloqueo y los minutos en SQL (ver `estadoBloqueo`),
   * sin deserializar fechas en JavaScript.
   *
   * @param id Identificador del usuario (BIGINT).
   * @returns Si quedó bloqueada y los minutos restantes.
   */
  private async registrarIntentoFallido(id: bigint): Promise<ResultadoIntento> {
    const filas = await this.prisma.$queryRaw<ResultadoIntento[]>`
      UPDATE usuarios
         SET intentos_fallidos = CASE
               WHEN intentos_fallidos + 1 >= ${this.maxIntentos}::int THEN 0
               ELSE intentos_fallidos + 1
             END,
             bloqueado_hasta = CASE
               WHEN intentos_fallidos + 1 >= ${this.maxIntentos}::int
                 THEN now() + make_interval(mins => ${this.minutosBloqueo}::int)
               ELSE bloqueado_hasta
             END,
             actualizado_en = now()
       WHERE id = ${id.toString()}::bigint
       RETURNING (bloqueado_hasta IS NOT NULL AND bloqueado_hasta > now()) AS bloqueado,
                 CASE
                   WHEN bloqueado_hasta IS NOT NULL AND bloqueado_hasta > now()
                     THEN CEIL(
                       EXTRACT(EPOCH FROM (bloqueado_hasta - now())) / 60
                     )::int
                   ELSE NULL
                 END AS minutos
    `;

    return filas[0] ?? { bloqueado: false, minutos: null };
  }

  /** Construye el error 423 con los minutos restantes del bloqueo. */
  private errorBloqueado(minutos: number): HttpException {
    const restantes = Math.max(1, Math.ceil(minutos));
    return new HttpException(
      {
        statusCode: HttpStatus.LOCKED,
        message:
          `La cuenta está bloqueada por demasiados intentos fallidos. ` +
          `Inténtalo de nuevo en ${restantes} minuto(s).`,
        error: 'Locked',
      },
      HttpStatus.LOCKED,
    );
  }
}
