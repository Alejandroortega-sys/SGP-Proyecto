import type {
  estado_usuario,
  perfil_gestor,
  rol_usuario,
} from '../../generated/prisma/client';

/**
 * Usuario autenticado adjunto a `request.usuario` por `JwtAuthGuard`.
 *
 * Se recarga desde la base de datos en cada petición, de modo que una
 * suspensión o un cambio de rol tienen efecto inmediato sin esperar a que
 * expire el token.
 */
export interface UsuarioAutenticado {
  /** Identificador del usuario (BIGINT como string). */
  id: string;
  /** Nombres del usuario. */
  nombre: string;
  /** Apellidos del usuario, si los tiene. */
  apellido?: string;
  /** Correo normalizado. */
  correo: string;
  /** Rol vigente en la base de datos. */
  rol: rol_usuario;
  /** Perfil del gestor, o `null` si no es gestor. */
  perfil: perfil_gestor | null;
  /** Estado vigente de la cuenta. */
  estado: estado_usuario;
}
