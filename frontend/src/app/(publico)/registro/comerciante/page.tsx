import type { Metadata } from "next";
import Link from "next/link";
import { IconoFlechaIzquierda } from "@/components/ui/iconos";
import { Tarjeta, TarjetaCuerpo, TarjetaEncabezado } from "@/components/ui/tarjeta";
import { FormularioRegistroComerciante } from "@/features/publico/formulario-registro-comerciante";

export const metadata: Metadata = {
  title: "Registro de comerciante",
  description:
    "Crea tu cuenta de comerciante en la plataforma SGP Tuluá para solicitar espacios en el espacio público.",
};

export default function PaginaRegistroComerciante() {
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
            Registro de Comerciante
          </h1>
          <p className="mt-1.5 text-sm text-texto">
            Completa los datos para crear tu cuenta de comercio formal o
            informal en Tuluá.
          </p>
        </TarjetaEncabezado>
        <TarjetaCuerpo>
          <FormularioRegistroComerciante />
        </TarjetaCuerpo>
      </Tarjeta>
    </div>
  );
}
