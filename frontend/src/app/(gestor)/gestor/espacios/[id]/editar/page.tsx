import type { Metadata } from "next";
import { EditorEspacio } from "@/features/espacios-gestor/editor-espacio";

export const metadata: Metadata = {
  title: "Editar espacio temporal",
};

export default async function PaginaEditarEspacio({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditorEspacio id={id} />;
}
