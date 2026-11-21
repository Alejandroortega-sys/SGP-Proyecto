import type { Metadata } from "next";
import { AsistenteSolicitud } from "@/features/solicitudes/asistente-solicitud";

export const metadata: Metadata = {
  title: "Nueva solicitud de espacio",
};

export default async function PaginaNuevaSolicitud({
  searchParams,
}: {
  searchParams: Promise<{ espacioId?: string }>;
}) {
  const { espacioId } = await searchParams;
  return <AsistenteSolicitud espacioIdInicial={espacioId ?? null} />;
}
