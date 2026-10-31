import type {
  CategoriaComercio,
  PerfilGestor,
  RolUsuario,
} from "@/types/api";

export function formatearFecha(valor: string | null | undefined): string {
  if (!valor) return "—";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatearFechaHora(valor: string | null | undefined): string {
  if (!valor) return "—";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function textoRol(rol: RolUsuario | string): string {
  switch (rol) {
    case "comerciante":
      return "Comerciante";
    case "organizador":
      return "Organizador";
    case "gestor":
      return "Gestor";
    default:
      return rol;
  }
}

export function textoPerfil(perfil: PerfilGestor | null | undefined): string {
  if (!perfil) return "—";
  return perfil === "administrador" ? "Administrador" : "Revisor";
}

export function textoCategoria(
  categoria: CategoriaComercio | null | undefined,
): string {
  if (!categoria) return "—";
  return categoria === "formal" ? "Formal" : "Informal";
}

export function textoAccion(accion: string): string {
  switch (accion) {
    case "insert":
      return "Creación";
    case "update":
      return "Actualización";
    case "delete":
      return "Eliminación";
    default:
      return accion;
  }
}

export function resumirValor(valor: unknown, maximo = 160): string {
  if (valor === null || valor === undefined) return "—";
  const texto =
    typeof valor === "string" ? valor : JSON.stringify(valor, null, 2);
  if (texto.length <= maximo) return texto;
  return `${texto.slice(0, maximo)}…`;
}

export function nombreCompleto(
  nombre: string,
  apellido?: string | null,
): string {
  return [nombre, apellido].filter(Boolean).join(" ");
}
