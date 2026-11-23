import { Suspense } from "react";
import type { Metadata } from "next";
import { Cargando } from "@/components/ui/estado-vacio";
import { DetalleFeria } from "@/features/ferias/detalle-feria";

export const metadata: Metadata = {
  title: "Detalle de la feria",
};

export default async function PaginaDetalleFeria({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<Cargando texto="Cargando la feria…" />}>
      <DetalleFeria id={id} />
    </Suspense>
  );
}
