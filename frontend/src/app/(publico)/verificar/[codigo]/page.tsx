import type { Metadata } from "next";
import { ResultadoVerificacion } from "@/features/verificacion/resultado-verificacion";

export const metadata: Metadata = {
  title: "Resultado de la verificación",
  robots: { index: false },
};

// El resultado depende del token de la URL (URL data) y de una consulta a la
// API en el cliente: la página se renderiza en cada petición en lugar de
// prerrenderizar un «App Shell» instantáneo (decisión explícita según la
// sugerencia `[block]` de Next.js para rutas dinámicas bloqueantes).
export const instant = false;

export default async function PaginaResultadoVerificacion({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  return <ResultadoVerificacion codigo={decodeURIComponent(codigo)} />;
}
