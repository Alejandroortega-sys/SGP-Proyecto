import type { Metadata } from "next";
import { ConfirmacionSolicitud } from "@/features/solicitudes/confirmacion-solicitud";

export const metadata: Metadata = {
  title: "Solicitud radicada",
};

export default async function PaginaConfirmacionSolicitud({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ correoEnviado?: string }>;
}) {
  const { id } = await params;
  const { correoEnviado } = await searchParams;
  const envio =
    correoEnviado === "1" ? true : correoEnviado === "0" ? false : null;

  return <ConfirmacionSolicitud id={id} correoEnviado={envio} />;
}
