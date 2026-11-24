import { Suspense } from "react";
import type { Metadata } from "next";
import { Cargando } from "@/components/ui/estado-vacio";
import { GestionParticipantes } from "@/features/ferias/participantes/gestion-participantes";

export const metadata: Metadata = {
  title: "Participantes de la feria",
};

export default async function PaginaParticipantesFeria({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<Cargando texto="Cargando los participantes…" />}>
      <GestionParticipantes feriaId={id} />
    </Suspense>
  );
}
