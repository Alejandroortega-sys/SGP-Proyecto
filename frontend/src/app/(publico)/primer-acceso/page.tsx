import type { Metadata } from "next";
import { Tarjeta, TarjetaCuerpo, TarjetaEncabezado } from "@/components/ui/tarjeta";
import { FormularioPrimerAcceso } from "@/features/publico/formulario-primer-acceso";

export const instant = false;

export const metadata: Metadata = {
  title: "Primer acceso de gestor",
  description:
    "Cambia tu contraseña temporal y accede al panel administrativo de SGP Tuluá.",
};

export default async function PaginaPrimerAcceso({
  searchParams,
}: PageProps<"/primer-acceso">) {
  const parametros = await searchParams;
  const correo = typeof parametros.correo === "string" ? parametros.correo : "";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-10 sm:px-6 sm:py-14">
      <Tarjeta>
        <TarjetaEncabezado className="text-center">
          <h1 className="text-xl font-extrabold text-titulo sm:text-2xl">
            Primer Acceso de Gestor Municipal
          </h1>
          <p className="mt-1.5 text-sm text-texto">
            Establece tu contraseña definitiva para operar el panel
            administrativo.
          </p>
        </TarjetaEncabezado>
        <TarjetaCuerpo>
          <FormularioPrimerAcceso correoInicial={correo} />
        </TarjetaCuerpo>
      </Tarjeta>
    </div>
  );
}
