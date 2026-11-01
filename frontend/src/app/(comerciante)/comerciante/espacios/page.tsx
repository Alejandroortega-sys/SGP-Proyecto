import type { Metadata } from "next";
import { EspaciosComerciante } from "@/features/espacios/espacios-comerciante";

export const metadata: Metadata = {
  title: "Espacios disponibles",
  description:
    "Consulta los espacios disponibles del espacio público de Tuluá, su ficha detallada y las restricciones de su zona.",
};

export default function PaginaEspaciosComerciante() {
  return <EspaciosComerciante />;
}
