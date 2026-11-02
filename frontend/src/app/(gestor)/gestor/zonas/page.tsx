import type { Metadata } from "next";
import { ListaZonas } from "@/features/zonas/lista-zonas";

export const metadata: Metadata = {
  title: "Zonas del espacio público",
};

export default function PaginaZonas() {
  return <ListaZonas />;
}
