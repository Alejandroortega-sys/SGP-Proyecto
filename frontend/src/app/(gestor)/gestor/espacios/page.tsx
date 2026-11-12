import type { Metadata } from "next";
import { ListaEspacios } from "@/features/espacios-gestor/lista-espacios";

export const metadata: Metadata = {
  title: "Catálogo de espacios temporales",
};

export default function PaginaEspaciosGestor() {
  return <ListaEspacios />;
}
