import type { Metadata } from "next";
import { PerfilUsuario } from "@/features/perfil/perfil-usuario";

export const metadata: Metadata = {
  title: "Mi perfil",
};

export default function PaginaPerfilComerciante() {
  return <PerfilUsuario rol="comerciante" />;
}
