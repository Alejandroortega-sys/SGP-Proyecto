import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { enteroPositivo } from '../common/entero-positivo';
import type { estado_usuario } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginResponseDto } from './dto/login-response.dto';
import type { LoginDto } from './dto/login.dto';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

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
    'La cuenta está suspendida. Comunícate con la Secretaría de Gobierno.',
  inactiva:
    'La cuenta está inactiva. Comunícate con la Secretaría de Gobierno.',
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
  /** Fallos consecutivos que provocan el bloqueo. */
  private readonly maxIntentos: number;
  /** Duración del bloqueo, en minutos. */
  private readonly minutosBloqueo: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
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
   * @param dto Correo y contraseña enviados por el cliente.
   * @throws UnauthorizedException (401) si el usuario no existe o la
   *   contraseña es incorrecta.
   * @throws ForbiddenException (403) si la cuenta no está activa.
   * @throws HttpException (423) si la cuenta está bloqueada por intentos
   *   fallidos.
   */
  async login(dto: LoginDto): Promise<LoginResponseDto> {
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

    if (usuario.estado !== 'activa') {
      throw new ForbiddenException(MENSAJES_ESTADO[usuario.estado]);
    }

    const coincide = usuario.password_hash
      ? await argon2.verify(usuario.password_hash, dto.password).catch(() => false)
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

    // Login correcto: se limpian los contadores de seguridad.
    await this.prisma.usuarios.update({
      where: { id: usuario.id },
      data: { intentos_fallidos: 0, bloqueado_hasta: null },
    });

    const perfil =
      usuario.rol === 'gestor'
        ? (usuario.gestores_gestores_usuario_idTousuarios?.perfil ?? null)
        : null;
    const expiresIn =
      usuario.rol === 'gestor' ? this.expiracionGestor : this.expiracionNormal;

    const payload: JwtPayload = {
      sub: usuario.id.toString(),
      correo: usuario.correo,
      rol: usuario.rol,
      ...(perfil ? { perfil } : {}),
    };

    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn,
    });

    this.logger.log(`Inicio de sesión correcto: ${correo} (${usuario.rol})`);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      usuario: {
        id: usuario.id.toString(),
        nombre: usuario.nombre,
        apellido: usuario.apellido ?? undefined,
        correo: usuario.correo,
        rol: usuario.rol,
        perfil,
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
  private async registrarIntentoFallido(
    id: bigint,
  ): Promise<ResultadoIntento> {
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
