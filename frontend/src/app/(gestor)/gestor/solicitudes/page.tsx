import type { Metadata } from "next";
import { ListaSolicitudesRevision } from "@/features/revision-solicitudes/lista-solicitudes-revision";

export const metadata: Metadata = {
  title: "Revisión de solicitudes",
};

export default function PaginaRevisionSolicitudes() {
  return <ListaSolicitudesRevision />;
}
