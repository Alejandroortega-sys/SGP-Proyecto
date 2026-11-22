import type { Metadata } from "next";
import { DetalleRevisionSolicitud } from "@/features/revision-solicitudes/detalle-revision-solicitud";

export const metadata: Metadata = {
  title: "Detalle de la revisión documental",
};

export default async function PaginaDetalleRevisionSolicitud({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DetalleRevisionSolicitud id={id} />;
}
