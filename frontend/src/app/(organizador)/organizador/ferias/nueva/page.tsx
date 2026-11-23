import type { Metadata } from "next";
import { FormularioFeria } from "@/features/ferias/formulario-feria";

export const metadata: Metadata = {
  title: "Solicitar una feria",
};

export default function PaginaNuevaFeria() {
  return <FormularioFeria />;
}
