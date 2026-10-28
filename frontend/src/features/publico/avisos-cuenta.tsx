import Link from "next/link";
import { Alerta } from "@/components/ui/alerta";
import { IconoCheck } from "@/components/ui/iconos";
import { EtiquetaEstado } from "@/components/ui/etiqueta";

export function AvisoCuentaCreada({ correo }: { correo: string }) {
  const href = `/activar?correo=${encodeURIComponent(correo)}`;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-white text-emerald-600">
        <IconoCheck className="size-7" />
      </span>

      <div>
        <h2 className="text-lg font-extrabold text-emerald-900">
          ¡Cuenta creada con éxito!
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-emerald-900">
          Hemos enviado un código de activación de 6 dígitos a{" "}
          <strong className="break-all">{correo}</strong>. El código tiene una
          vigencia de 15 minutos.
        </p>
        <div className="mt-3">
          <EtiquetaEstado estado="pendiente_activacion" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Link
          href={href}
          className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primario px-5 py-3 text-sm font-semibold text-white hover:bg-primario-hover"
        >
          Ingresar el código de activación
        </Link>
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-borde bg-white px-5 py-2.5 text-sm font-semibold text-texto hover:bg-slate-50"
        >
          Ir a iniciar sesión
        </Link>
      </div>
    </div>
  );
}

export function AvisoCorreoNoEnviado({ correo }: { correo: string }) {
  return (
    <Alerta tono="advertencia">
      {`La cuenta pudo haberse creado, pero no pudimos enviar el correo de activación.\n`}
      <Link
        href={`/activar?correo=${encodeURIComponent(correo)}`}
        className="font-semibold underline"
      >
        Intenta activar la cuenta
      </Link>{" "}
      o solicita un nuevo código desde esa pantalla.
    </Alerta>
  );
}
