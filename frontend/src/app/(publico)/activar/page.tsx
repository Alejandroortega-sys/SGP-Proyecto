import type { Metadata } from "next";
import Link from "next/link";
import { Tarjeta, TarjetaCuerpo, TarjetaEncabezado } from "@/components/ui/tarjeta";
import { FormularioActivacion } from "@/features/publico/formulario-activacion";

export const instant = false;

export const metadata: Metadata = {
  title: "Activar cuenta",
  description: "Activa tu cuenta SGP Tuluá con el código de 6 dígitos enviado a tu correo.",
};

export default async function PaginaActivar({
  searchParams,
}: PageProps<"/activar">) {
  const parametros = await searchParams;
  const correo = typeof parametros.correo === "string" ? parametros.correo : "";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-10 sm:px-6 sm:py-14">
      <Tarjeta>
        <TarjetaEncabezado className="text-center">
          <h1 className="text-xl font-extrabold text-titulo sm:text-2xl">
            Activa tu Cuenta
          </h1>
          <p className="mt-1.5 text-sm text-texto">
            Confirma tu registro con el código de verificación enviado a tu
            correo electrónico.
          </p>
        </TarjetaEncabezado>
        <TarjetaCuerpo>
          <FormularioActivacion correoInicial={correo} />
        </TarjetaCuerpo>
      </Tarjeta>

      <p className="mt-6 text-center text-sm text-texto">
        <Link href="/login" className="font-medium text-primario hover:underline">
          ← Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
