import type { Metadata } from "next";
import { PerfilGestor } from "@/features/gestor/perfil-gestor";

export const metadata: Metadata = {
  title: "Mi perfil de gestor",
};

export default function PaginaPerfilGestor() {
  return <PerfilGestor />;
}
