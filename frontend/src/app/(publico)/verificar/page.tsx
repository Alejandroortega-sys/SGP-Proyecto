import type { Metadata } from "next";
import { EscanerQr } from "@/features/verificacion/escaner-qr";

export const metadata: Metadata = {
  title: "Verificar un permiso",
  description:
    "Consulta pública sin registro de la legalidad, vigencia y categoría de un permiso de uso del espacio público.",
};

export default function PaginaVerificar() {
  return <EscanerQr />;
}
