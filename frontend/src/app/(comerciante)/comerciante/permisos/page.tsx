import type { Metadata } from "next";
import { MisPermisos } from "@/features/permisos/mis-permisos";

export const metadata: Metadata = {
  title: "Mis permisos",
};

export default function PaginaMisPermisos() {
  return <MisPermisos />;
}
