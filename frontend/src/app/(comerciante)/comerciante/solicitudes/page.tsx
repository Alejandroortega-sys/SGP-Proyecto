import type { Metadata } from "next";
import { ListaSolicitudes } from "@/features/solicitudes/lista-solicitudes";

export const metadata: Metadata = {
  title: "Mis solicitudes",
};

export default function PaginaMisSolicitudes() {
  return <ListaSolicitudes />;
}
