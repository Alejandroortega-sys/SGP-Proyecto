import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

/** Datos de una sesión recién creada. */
export interface SesionCreada {
  /** Identificador de la sesión; viaja como claim `sid` en el access token. */
  id: bigint;
  /** Refresh token en claro; solo se entrega al cliente una vez. */
  refreshToken: string;
  /** Fecha de expiración del refresh token. */
  refreshExpiraEn: Date;
}

/** Resultado de validar un refresh token. */
export interface SesionValidada {
  /** Identificador de la sesión. */
  id: bigint;
  /** Dueño de la sesión. */
  usuarioId: bigint;
  /** `true` si el token recibido es el anterior y se detectó reutilización. */
  reutilizado: boolean;
}

/** Resultado de rotar un refresh token. */
export interface RefreshRotado {
  /** Nuevo refresh token en claro. */
  refreshToken: string;
  /** Nueva fecha de expiración. */
  refreshExpiraEn: Date;
}

/**
 * Sesiones autenticadas y refresh tokens con rotación.
 *
 * - El refresh token es una cadena aleatoria de 32 bytes; en la base de datos
 *   solo se guarda su hash SHA-256.
 * - Cada fila de `sesiones` representa un dispositivo/sesión.
 * - `revocada_en` permite un logout persistente aunque el access token siga
 *   vigente.
 * - Al rotar se conserva el hash anterior para detectar reutilización.
 *
 * El access token lleva el id de la sesión en el claim `sid`; el guard lo usa
 * para comprobar que la sesión siga activa.
 */
@Injectable()
export class SesionesService {
  private readonly logger = new Logger(SesionesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una sesión nueva y devuelve el refresh token en claro.
   *
   * @param usuarioId Dueño de la sesión.
   * @param ttlSegundos Vigencia del refresh token.
   */
  async crear(
    usuarioId: bigint,
    ttlSegundos: number,
  ): Promise<SesionCreada> {
    // Limpieza oportunista de sesiones vencidas del usuario.
    await this.prisma.sesiones.deleteMany({
      where: {
        usuario_id: usuarioId,
        refresh_expira_en: { lt: new Date() },
      },
    });

    const refreshToken = this.generarRefreshToken();
    const refreshExpiraEn = this.calcularExpiracion(ttlSegundos);
    const sesion = await this.prisma.sesiones.create({
      data: {
        usuario_id: usuarioId,
        refresh_token_hash: this.hash(refreshToken),
        refresh_expira_en: refreshExpiraEn,
      },
      select: { id: true },
    });

    return {
      id: sesion.id,
      refreshToken,
      refreshExpiraEn,
    };
  }

  /**
   * Valida un refresh token.
   *
   * Si el hash corresponde al token anterior de una sesión, se considera
   * reutilización: se revoca la sesión y se devuelve `reutilizado: true`.
   */
  async validarRefresh(refreshToken: string): Promise<SesionValidada | null> {
    const hash = this.hash(refreshToken);

    const actual = await this.prisma.sesiones.findFirst({
      where: {
        refresh_token_hash: hash,
        revocada_en: null,
        refresh_expira_en: { gt: new Date() },
      },
      select: { id: true, usuario_id: true },
    });
    if (actual) {
      return {
        id: actual.id,
        usuarioId: actual.usuario_id,
        reutilizado: false,
      };
    }

    const anterior = await this.prisma.sesiones.findFirst({
      where: {
        refresh_token_anterior_hash: hash,
        revocada_en: null,
        refresh_expira_en: { gt: new Date() },
      },
      select: { id: true, usuario_id: true },
    });
    if (anterior) {
      await this.revocar(anterior.id, anterior.usuario_id);
      this.logger.warn(
        `Reutilización de refresh token detectada para la sesión ${anterior.id.toString()}`,
      );
      return {
        id: anterior.id,
        usuarioId: anterior.usuario_id,
        reutilizado: true,
      };
    }

    return null;
  }

  /**
   * Rota el refresh token de una sesión activa.
   *
   * @param idSesion Sesión que se está refrescando.
   * @param refreshTokenAnterior Token que el cliente acaba de usar.
   * @param ttlSegundos Nueva vigencia.
   */
  async rotar(
    idSesion: bigint,
    refreshTokenAnterior: string,
    ttlSegundos: number,
  ): Promise<RefreshRotado> {
    const refreshToken = this.generarRefreshToken();
    const refreshExpiraEn = this.calcularExpiracion(ttlSegundos);

    await this.prisma.sesiones.update({
      where: { id: idSesion },
      data: {
        refresh_token_anterior_hash: this.hash(refreshTokenAnterior),
        refresh_token_hash: this.hash(refreshToken),
        refresh_expira_en: refreshExpiraEn,
      },
    });

    return { refreshToken, refreshExpiraEn };
  }

  /** Indica si una sesión existe, no está revocada y no ha expirado. */
  async estaActiva(idSesion: bigint, usuarioId: bigint): Promise<boolean> {
    const sesion = await this.prisma.sesiones.findFirst({
      where: {
        id: idSesion,
        usuario_id: usuarioId,
        revocada_en: null,
        refresh_expira_en: { gt: new Date() },
      },
      select: { id: true },
    });
    return sesion !== null;
  }

  /** Revoca una sesión concreta (logout de un dispositivo). */
  async revocar(idSesion: bigint, usuarioId: bigint): Promise<number> {
    const resultado = await this.prisma.sesiones.updateMany({
      where: {
        id: idSesion,
        usuario_id: usuarioId,
        revocada_en: null,
      },
      data: { revocada_en: new Date() },
    });
    return resultado.count;
  }

  /** Revoca todas las sesiones activas de un usuario. */
  async revocarTodas(usuarioId: bigint): Promise<number> {
    const resultado = await this.prisma.sesiones.updateMany({
      where: { usuario_id: usuarioId, revocada_en: null },
      data: { revocada_en: new Date() },
    });
    return resultado.count;
  }

  /** Genera un refresh token opaco de alta entropía. */
  private generarRefreshToken(): string {
    return randomBytes(32).toString('hex');
  }

  /** Calcula la fecha de expiración a partir de un TTL en segundos. */
  private calcularExpiracion(ttlSegundos: number): Date {
    return new Date(Date.now() + ttlSegundos * 1_000);
  }

  /** Hash SHA-256 del refresh token; nunca se guarda el token en claro. */
  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
