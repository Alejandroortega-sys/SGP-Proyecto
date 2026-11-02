import type { Metadata } from "next";
import { EditorZona } from "@/features/zonas/editor-zona";

export const metadata: Metadata = {
  title: "Editar zona",
};

export default async function PaginaEditarZona({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ guardada?: string }>;
}) {
  const { id } = await params;
  const { guardada } = await searchParams;

  return (
    <EditorZona
      id={id}
      mensajeInicial={
        guardada
          ? "La zona se creó correctamente y ya está publicada en el mapa."
          : undefined
      }
    />
  );
}
