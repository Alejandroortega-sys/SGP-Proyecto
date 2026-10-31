import type { Metadata } from "next";
import { ListaOrganizaciones } from "@/features/gestor/lista-organizaciones";

export const metadata: Metadata = {
  title: "Organizaciones",
};

export default function PaginaListaOrganizaciones() {
  return <ListaOrganizaciones />;
}
