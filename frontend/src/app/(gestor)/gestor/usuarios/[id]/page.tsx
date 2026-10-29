import type { Metadata } from "next";
import { DetalleUsuario } from "@/features/gestor/detalle-usuario";

export const metadata: Metadata = {
  title: "Detalle de la cuenta",
};

export default async function PaginaDetalleUsuario({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DetalleUsuario id={id} />;
}
