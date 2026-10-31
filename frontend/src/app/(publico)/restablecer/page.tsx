import type { Metadata } from "next";
import { Tarjeta, TarjetaCuerpo, TarjetaEncabezado } from "@/components/ui/tarjeta";
import { FormularioRestablecer } from "@/features/publico/formulario-restablecer";

export const instant = false;

export const metadata: Metadata = {
  title: "Restablecer contraseña",
  description: "Define tu nueva contraseña con el código de verificación recibido por correo.",
};

export default async function PaginaRestablecer({
  searchParams,
}: PageProps<"/restablecer">) {
  const parametros = await searchParams;
  const correo = typeof parametros.correo === "string" ? parametros.correo : "";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-10 sm:px-6 sm:py-14">
      <Tarjeta>
        <TarjetaEncabezado className="text-center">
          <h1 className="text-xl font-extrabold text-titulo sm:text-2xl">
            Define tu nueva contraseña
          </h1>
          <p className="mt-1.5 text-sm text-texto">
            Ingresa el código de verificación y tu nueva contraseña.
          </p>
        </TarjetaEncabezado>
        <TarjetaCuerpo>
          <FormularioRestablecer correoInicial={correo} />
        </TarjetaCuerpo>
      </Tarjeta>
    </div>
  );
}
