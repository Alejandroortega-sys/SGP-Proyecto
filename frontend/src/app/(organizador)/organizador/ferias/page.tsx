import type { Metadata } from "next";
import { ListaFerias } from "@/features/ferias/lista-ferias";

export const metadata: Metadata = {
  title: "Mis ferias",
};

export default function PaginaMisFerias() {
  return <ListaFerias />;
}
