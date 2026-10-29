import type { Metadata } from "next";
import { InicioUsuario } from "@/features/inicio/inicio-usuario";

export const metadata: Metadata = {
  title: "Inicio del comerciante",
};

export default function PaginaInicioComerciante() {
  return <InicioUsuario rol="comerciante" />;
}
