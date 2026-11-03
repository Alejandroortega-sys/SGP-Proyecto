import type { Metadata } from "next";
import { HistorialZona } from "@/features/zonas/historial-zona";

export const metadata: Metadata = {
  title: "Historial de la zona",
};

export default async function PaginaHistorialZona({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <HistorialZona id={id} />;
}
