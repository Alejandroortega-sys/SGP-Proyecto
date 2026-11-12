import type { Metadata } from "next";
import { EditorEspacio } from "@/features/espacios-gestor/editor-espacio";

export const metadata: Metadata = {
  title: "Crear espacio temporal",
};

export default function PaginaNuevoEspacio() {
  return <EditorEspacio />;
}
