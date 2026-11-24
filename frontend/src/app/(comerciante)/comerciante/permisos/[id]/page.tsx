import type { Metadata } from "next";
import { CarnePermiso } from "@/features/permisos/carne-permiso";

export const metadata: Metadata = {
  title: "Mi carné digital",
};

export default async function PaginaCarnePermiso({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CarnePermiso id={id} />;
}
