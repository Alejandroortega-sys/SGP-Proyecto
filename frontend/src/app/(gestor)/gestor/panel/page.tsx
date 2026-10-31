import type { Metadata } from "next";
import { PanelGestor } from "@/features/gestor/panel-gestor";

export const metadata: Metadata = {
  title: "Panel administrativo",
};

export default function PaginaPanelGestor() {
  return <PanelGestor />;
}
