import type { Metadata } from "next";
import { FichaModulo } from "@/features/modulos/ficha-modulo";

export const metadata: Metadata = {
  title: "Ficha del módulo",
};

export default async function PaginaFichaModulo({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ guardado?: string }>;
}) {
  const { id } = await params;
  const { guardado } = await searchParams;

  return (
    <FichaModulo
      id={id}
      mensajeInicial={
        guardado ? "El módulo se censó correctamente." : undefined
      }
    />
  );
}
