import type { Metadata } from "next";
import { Auditoria } from "@/features/gestor/auditoria";

export const metadata: Metadata = {
  title: "Auditoría",
};

export default function PaginaAuditoria() {
  return <Auditoria />;
}
