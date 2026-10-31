import type { Metadata } from "next";
import { ListaComerciantes } from "@/features/gestor/lista-comerciantes";

export const metadata: Metadata = {
  title: "Comerciantes",
};

export default function PaginaListaComerciantes() {
  return <ListaComerciantes />;
}
