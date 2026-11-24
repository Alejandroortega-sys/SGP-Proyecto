import type { Metadata } from "next";
import { MisCobros } from "@/features/cobros/mis-cobros";

export const metadata: Metadata = {
  title: "Mis pagos",
};

export default function PaginaMisPagos() {
  return <MisCobros />;
}
