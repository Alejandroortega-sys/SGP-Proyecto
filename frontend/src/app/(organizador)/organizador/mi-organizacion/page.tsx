import type { Metadata } from "next";
import { GestionOrganizacion } from "@/features/organizador/gestion-organizacion";

export const metadata: Metadata = {
  title: "Mi organización",
};

export default function PaginaMiOrganizacion() {
  return <GestionOrganizacion />;
}
