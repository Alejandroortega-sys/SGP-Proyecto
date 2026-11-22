import type { RolUsuario, UsuarioSesion } from '@/types/api';

export function rutaInicio(usuario: Pick<UsuarioSesion, 'rol'>): string {
  switch (usuario.rol) {
    case 'gestor':
      return '/gestor/panel';
    case 'organizador':
      return '/organizador/inicio';
    case 'comerciante':
      return '/comerciante/inicio';
    default:
      return '/';
  }
}

export function esGestorAdministrador(
  usuario: Pick<UsuarioSesion, 'rol' | 'perfil'> | null,
): boolean {
  return usuario?.rol === 'gestor' && usuario.perfil === 'administrador';
}

export function nombreRol(rol: RolUsuario): string {
  switch (rol) {
    case 'comerciante':
      return 'Comerciante';
    case 'organizador':
      return 'Organizador';
    case 'gestor':
      return 'Gestor municipal';
    default:
      return rol;
  }
}

/**
 * Ruta al detalle de una solicitud según el rol.
 *
 * Hoy solo el comerciante tiene pantalla de detalle de sus solicitudes. Las
 * notificaciones de otros roles pueden seguir mostrándose sin enlace.
 */
export function rutaDetalleSolicitud(
  rol: RolUsuario,
  solicitudId: string,
): string | null {
  if (rol !== 'comerciante') return null;
  return `/comerciante/solicitudes/${solicitudId}`;
}
