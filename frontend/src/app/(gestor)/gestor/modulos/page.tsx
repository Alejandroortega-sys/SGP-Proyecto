import type { Metadata } from "next";
import { ListaModulos } from "@/features/modulos/lista-modulos";

export const metadata: Metadata = {
  title: "Módulos y puestos del censo",
};

export default function PaginaModulos() {
  return <ListaModulos />;
}
