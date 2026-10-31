import type { Metadata } from "next";
import { DetalleOrganizacion } from "@/features/gestor/detalle-organizacion";

export const metadata: Metadata = {
  title: "Detalle de la organización",
};

export default async function PaginaDetalleOrganizacion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DetalleOrganizacion id={id} />;
}
