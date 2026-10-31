import type { Metadata } from "next";
import { MapaZonas } from "@/features/mapa/mapa-zonas";

export const metadata: Metadata = {
  title: "Mapa de zonas",
  description:
    "Consulta las zonas permitidas, restringidas y de alta congestión del espacio público de Tuluá.",
};

export default function PaginaMapa() {
  return <MapaZonas />;
}
