import type { Metadata } from "next";
import { DetalleEspacio } from "@/features/espacios-gestor/detalle-espacio";

export const metadata: Metadata = {
  title: "Ficha del espacio temporal",
};

export default async function PaginaDetalleEspacio({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ guardado?: string }>;
}) {
  const { id } = await params;
  const { guardado } = await searchParams;

  return (
    <DetalleEspacio
      id={id}
      mensajeInicial={
        guardado ? "El espacio se creó correctamente." : undefined
      }
    />
  );
}
