import type { Metadata } from "next";
import { Tarjeta, TarjetaCuerpo, TarjetaEncabezado } from "@/components/ui/tarjeta";
import { FormularioRecuperacion } from "@/features/publico/formulario-recuperacion";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
  description: "Solicita un código para restablecer tu contraseña en SGP Tuluá.",
};

export default function PaginaRecuperar() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-10 sm:px-6 sm:py-14">
      <Tarjeta>
        <TarjetaEncabezado className="text-center">
          <h1 className="text-xl font-extrabold text-titulo sm:text-2xl">
            Recupera tu contraseña
          </h1>
          <p className="mt-1.5 text-sm text-texto">
            Te enviaremos un código de verificación a tu correo electrónico.
          </p>
        </TarjetaEncabezado>
        <TarjetaCuerpo>
          <FormularioRecuperacion />
        </TarjetaCuerpo>
      </Tarjeta>
    </div>
  );
}
