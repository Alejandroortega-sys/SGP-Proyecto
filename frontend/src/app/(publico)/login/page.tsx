import type { Metadata } from "next";
import Link from "next/link";
import { IconoEscudo } from "@/components/ui/iconos";
import { Tarjeta, TarjetaCuerpo, TarjetaEncabezado } from "@/components/ui/tarjeta";
import { FormularioLogin } from "@/features/publico/formulario-login";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Acceso a la plataforma SGP Tuluá para comerciantes, organizadores y gestores municipales.",
};

export default function PaginaLogin() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-10 sm:px-6 sm:py-14">
      <Tarjeta>
        <TarjetaEncabezado className="text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primario text-white">
            <IconoEscudo className="size-7" />
          </span>
          <h1 className="mt-4 text-xl font-extrabold text-titulo sm:text-2xl">
            Ingreso a la Plataforma SGP
          </h1>
          <p className="mt-1.5 text-sm text-texto">
            Accede con tu correo electrónico registrado
          </p>
        </TarjetaEncabezado>
        <TarjetaCuerpo>
          <FormularioLogin />
        </TarjetaCuerpo>
      </Tarjeta>

      <p className="mt-6 text-center text-sm text-texto">
        <Link href="/" className="font-medium text-primario hover:underline">
          ← Volver al inicio
        </Link>
      </p>
    </div>
  );
}
