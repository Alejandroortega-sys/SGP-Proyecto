import { Suspense } from "react";
import type { Metadata } from "next";
import { Cargando } from "@/components/ui/estado-vacio";
import { ListadoParticipantesGestor } from "@/features/ferias-gestor/listado-participantes";

export const metadata: Metadata = {
  title: "Listado final de participantes",
};

export default async function PaginaParticipantesGestor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<Cargando texto="Cargando el listado final…" />}>
      <ListadoParticipantesGestor feriaId={id} />
    </Suspense>
  );
}
