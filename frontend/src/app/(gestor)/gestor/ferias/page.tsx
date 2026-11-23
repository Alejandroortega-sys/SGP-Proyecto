import type { Metadata } from "next";
import { CalendarioFerias } from "@/features/ferias-gestor/calendario-ferias";

export const metadata: Metadata = {
  title: "Calendario de ferias",
};

export default function PaginaCalendarioFerias() {
  return <CalendarioFerias />;
}
