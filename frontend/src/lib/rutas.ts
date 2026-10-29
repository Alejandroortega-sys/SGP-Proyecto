import type { RolUsuario, UsuarioSesion } from "@/types/api";

export function rutaInicio(usuario: Pick<UsuarioSesion, "rol">): string {
  switch (usuario.rol) {
    case "gestor":
      return "/gestor/panel";
    case "organizador":
      return "/organizador/inicio";
    case "comerciante":
      return "/comerciante/inicio";
    default:
      return "/";
  }
}

export function esGestorAdministrador(
  usuario: Pick<UsuarioSesion, "rol" | "perfil"> | null,
): boolean {
  return usuario?.rol === "gestor" && usuario.perfil === "administrador";
}

export function nombreRol(rol: RolUsuario): string {
  switch (rol) {
    case "comerciante":
      return "Comerciante";
    case "organizador":
      return "Organizador";
    case "gestor":
      return "Gestor municipal";
    default:
      return rol;
  }
}
