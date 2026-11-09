import type { Metadata } from "next";
import { EditorModulo } from "@/features/modulos/editor-modulo";

export const metadata: Metadata = {
  title: "Censar módulo o puesto",
};

export default function PaginaNuevoModulo() {
  return <EditorModulo />;
}
