import type { Metadata } from "next";
import Link from "next/link";
import { IconoFeria, IconoTienda } from "@/components/ui/iconos";

export const metadata: Metadata = {
  title: "Crear cuenta",
  description: "Elige el tipo de cuenta que necesitas crear en SGP Tuluá.",
};

const OPCIONES = [
  {
    href: "/registro/comerciante",
    titulo: "Soy Comerciante",
    descripcion:
      "Vendo productos o servicios en casetas, puestos fijos o ambulantes en el espacio público de Tuluá.",
    accion: "Crear cuenta de comerciante",
    icono: IconoTienda,
    color: "bg-primario-suave text-primario",
  },
  {
    href: "/registro/organizador",
    titulo: "Soy Organizador de Ferias",
    descripcion:
      "Represento una organización o asociación que promueve mercados campesinos y ferias locales.",
    accion: "Crear cuenta de organizador",
    icono: IconoFeria,
    color: "bg-amber-50 text-acento",
  },
];

export default function PaginaSelectorRegistro() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
          Elige el tipo de registro
        </h1>
        <p className="mt-3 text-base text-texto">
          Selecciona la opción que mejor describa tu actividad
        </p>
      </div>

      <div className="mt-9 grid gap-5 md:grid-cols-2">
        {OPCIONES.map((opcion) => {
          const Icono = opcion.icono;
          return (
            <Link
              key={opcion.href}
              href={opcion.href}
              className="group flex flex-col rounded-xl border border-borde bg-superficie p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primario hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario"
            >
              <span
                className={`flex size-12 items-center justify-center rounded-xl ${opcion.color}`}
              >
                <Icono className="size-6" />
              </span>
              <h2 className="mt-4 text-lg font-bold text-titulo">
                {opcion.titulo}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-texto">
                {opcion.descripcion}
              </p>
              <span className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-primario px-4 py-2.5 text-sm font-semibold text-white transition-colors group-hover:bg-primario-hover">
                {opcion.accion}
              </span>
            </Link>
          );
        })}
      </div>

      <p className="mt-8 text-center text-sm text-texto">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-primario hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
