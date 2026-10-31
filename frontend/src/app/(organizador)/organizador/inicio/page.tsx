import type { Metadata } from "next";
import { InicioUsuario } from "@/features/inicio/inicio-usuario";

export const metadata: Metadata = {
  title: "Inicio del organizador",
};

export default function PaginaInicioOrganizador() {
  return <InicioUsuario rol="organizador" />;
}
