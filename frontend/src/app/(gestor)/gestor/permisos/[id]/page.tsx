import type { Metadata } from "next";
import { DetallePermisoGestor } from "@/features/permisos/detalle-permiso-gestor";

export const metadata: Metadata = {
  title: "Detalle del permiso",
};

export default async function PaginaDetallePermisoGestor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DetallePermisoGestor id={id} />;
}
