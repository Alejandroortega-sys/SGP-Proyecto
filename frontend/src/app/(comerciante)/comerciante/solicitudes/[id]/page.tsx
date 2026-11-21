import type { Metadata } from "next";
import { DetalleSolicitud } from "@/features/solicitudes/detalle-solicitud";

export const metadata: Metadata = {
  title: "Detalle de la solicitud",
};

export default async function PaginaDetalleSolicitud({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DetalleSolicitud id={id} />;
}
