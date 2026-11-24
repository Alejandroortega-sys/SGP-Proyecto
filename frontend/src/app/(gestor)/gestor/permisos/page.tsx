import type { Metadata } from "next";
import { ListaPermisosGestor } from "@/features/permisos/lista-permisos-gestor";

export const metadata: Metadata = {
  title: "Permisos",
};

export default function PaginaPermisosGestor() {
  return <ListaPermisosGestor />;
}
