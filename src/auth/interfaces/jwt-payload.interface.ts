import type { perfil_gestor, rol_usuario } from '../../generated/prisma/client';

/**
 * Contenido del JWT firmado por la aplicación.
 *
 * `sub` es el identificador del usuario (BIGINT serializado como string, tal
 * como se expone en las respuestas JSON). `perfil` solo viaja para gestores:
 * distingue entre revisor y administrador.
 */
export interface JwtPayload {
  /** Identificador del usuario (BIGINT como string). */
  sub: string;
  /** Correo normalizado del usuario. */
  correo: string;
  /** Rol que determina los endpoints permitidos. */
  rol: rol_usuario;
  /** Perfil del gestor (solo cuando el rol es `gestor`). */
  perfil?: perfil_gestor;
}
