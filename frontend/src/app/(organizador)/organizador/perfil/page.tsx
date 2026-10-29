import type { Metadata } from "next";
import { PerfilUsuario } from "@/features/perfil/perfil-usuario";

export const metadata: Metadata = {
  title: "Mi perfil",
};

export default function PaginaPerfilOrganizador() {
  return <PerfilUsuario rol="organizador" />;
}
