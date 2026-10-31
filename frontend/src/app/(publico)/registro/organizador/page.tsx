import type { Metadata } from "next";
import Link from "next/link";
import { IconoFlechaIzquierda } from "@/components/ui/iconos";
import { Tarjeta, TarjetaCuerpo, TarjetaEncabezado } from "@/components/ui/tarjeta";
import { FormularioRegistroOrganizador } from "@/features/publico/formulario-registro-organizador";

export const metadata: Metadata = {
  title: "Registro de organizador",
  description:
    "Crea tu cuenta de representante de ferias y organizaciones agroecológicas en SGP Tuluá.",
};

export default function PaginaRegistroOrganizador() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/registro"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-primario hover:underline"
      >
        <IconoFlechaIzquierda className="size-4" />
        Cambiar tipo de registro
      </Link>

      <Tarjeta className="mt-3">
        <TarjetaEncabezado>
          <h1 className="text-xl font-extrabold text-titulo sm:text-2xl">
            Registro de Organizador de Ferias
          </h1>
          <p className="mt-1.5 text-sm text-texto">
            Crea la cuenta personal del representante. Los datos de la
            organización se registran en el siguiente paso.
          </p>
        </TarjetaEncabezado>
        <TarjetaCuerpo>
          <FormularioRegistroOrganizador />
        </TarjetaCuerpo>
      </Tarjeta>
    </div>
  );
}
