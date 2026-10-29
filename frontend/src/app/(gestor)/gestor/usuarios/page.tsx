import type { Metadata } from "next";
import { ListaUsuarios } from "@/features/gestor/lista-usuarios";

export const metadata: Metadata = {
  title: "Cuentas de usuario",
};

export default function PaginaListaUsuarios() {
  return <ListaUsuarios />;
}
