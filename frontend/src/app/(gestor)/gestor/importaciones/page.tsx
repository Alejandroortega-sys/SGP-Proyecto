import type { Metadata } from "next";
import { ImportadorDatos } from "@/features/importaciones/importador-datos";

export const metadata: Metadata = {
  title: "Importar zonas y módulos",
};

export default function PaginaImportaciones() {
  return <ImportadorDatos />;
}
