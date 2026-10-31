import type { Metadata } from "next";
import { CrearGestor } from "@/features/gestor/crear-gestor";

export const metadata: Metadata = {
  title: "Crear gestor",
};

export default function PaginaCrearGestor() {
  return <CrearGestor />;
}
