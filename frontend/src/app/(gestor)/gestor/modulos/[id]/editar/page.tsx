import type { Metadata } from "next";
import { EditorModulo } from "@/features/modulos/editor-modulo";

export const metadata: Metadata = {
  title: "Editar módulo",
};

export default async function PaginaEditarModulo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditorModulo id={id} />;
}
