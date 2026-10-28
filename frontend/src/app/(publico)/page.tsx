import type { Metadata } from "next";
import Link from "next/link";
import {
  IconoFeria,
  IconoMapa,
  IconoQr,
  IconoTienda,
} from "@/components/ui/iconos";

export const metadata: Metadata = {
  title: "Inicio",
};

const PASOS = [
  {
    numero: "1",
    titulo: "Regístrate y activa tu cuenta",
    descripcion:
      "Ingresa tu documento de identidad, tu correo y un código de 6 dígitos enviado por correo confirma que eres tú.",
  },
  {
    numero: "2",
    titulo: "Solicita tu espacio o evento",
    descripcion:
      "Elige la ubicación y el horario permitido para tu puesto, caseta o feria, y radica tu solicitud con sus documentos.",
  },
  {
    numero: "3",
    titulo: "Obtén tu permiso con QR",
    descripcion:
      "Recibe un carné digital con código QR verificable por cualquier ciudadano desde la vía pública.",
  },
];

export default function PaginaBienvenida() {
  return (
    <>
      <section className="border-b border-borde bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 md:items-center md:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase text-emerald-700">
              Alcaldía de Tuluá · Valle del Cauca
            </span>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight text-titulo sm:text-4xl md:text-[2.75rem] md:leading-[1.15]">
              Hacia un espacio público ordenado, inclusivo y transparente en
              Tuluá
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-texto sm:text-lg">
              Formaliza tu comercio en el espacio público, solicita espacios
              para ferias agroecológicas y obtén permisos digitales con código
              QR, todo desde un solo lugar.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/registro/comerciante"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primario px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-primario-hover"
              >
                Solicitar Espacio Comercial
              </Link>
              <Link
                href="/registro/organizador"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-primario bg-white px-6 py-3 text-base font-semibold text-primario transition-colors hover:bg-primario-suave"
              >
                Soy Organizador de Ferias
              </Link>
            </div>
            <p className="mt-4 text-sm text-tenue">
              ¿Ya tienes cuenta?{" "}
              <Link
                href="/login"
                className="font-semibold text-primario hover:underline"
              >
                Inicia sesión
              </Link>
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-borde bg-fondo p-5">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primario-suave text-primario">
                <IconoTienda />
              </span>
              <h2 className="mt-3 text-sm font-bold text-titulo">
                Comercio formal e informal
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-texto">
                Censo y caracterización de módulos, casetas y ventas
                ambulantes.
              </p>
            </div>
            <div className="rounded-xl border border-borde bg-fondo p-5">
              <span className="flex size-10 items-center justify-center rounded-lg bg-amber-50 text-acento">
                <IconoFeria />
              </span>
              <h2 className="mt-3 text-sm font-bold text-titulo">
                Ferias agroecológicas
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-texto">
                Asignación temporal de espacios para eventos y mercados
                campesinos.
              </p>
            </div>
            <div className="rounded-xl border border-borde bg-fondo p-5">
              <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <IconoQr />
              </span>
              <h2 className="mt-3 text-sm font-bold text-titulo">
                Permisos con QR
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-texto">
                Vigencia y titularidad verificables por cualquier ciudadano.
              </p>
            </div>
            <div className="rounded-xl border border-borde bg-fondo p-5">
              <span className="flex size-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                <IconoMapa />
              </span>
              <h2 className="mt-3 text-sm font-bold text-titulo">
                Motor de factibilidad
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-texto">
                Evaluación de flujos peatonales y saturación comercial sin
                sensores.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="border-b border-borde bg-fondo">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-16">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-extrabold text-titulo sm:text-3xl">
              ¿Cómo funciona?
            </h2>
            <p className="mt-3 text-base leading-relaxed text-texto">
              Tres pasos para pasar del comercio informal a un permiso digital
              verificado.
            </p>
          </div>
          <ol className="mt-8 grid gap-5 md:grid-cols-3">
            {PASOS.map((paso) => (
              <li
                key={paso.numero}
                className="rounded-xl border border-borde bg-superficie p-6 shadow-sm"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-primario text-base font-bold text-white">
                  {paso.numero}
                </span>
                <h3 className="mt-4 text-base font-bold text-titulo">
                  {paso.titulo}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-texto">
                  {paso.descripcion}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="geo-portal" className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-16">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-2xl font-extrabold text-titulo sm:text-3xl">
                Zonas, espacios y ferias
              </h2>
              <p className="mt-3 text-base leading-relaxed text-texto">
                El Geo-Portal mostrará las zonas normativas del municipio, los
                espacios disponibles y el calendario de ferias
                agroecológicas.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-texto">
                Mientras tanto, puedes crear tu cuenta y comenzar con tu
                registro de comerciante u organizador de ferias.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/registro"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primario px-5 py-2.5 text-sm font-semibold text-white hover:bg-primario-hover"
                >
                  Crear mi cuenta
                </Link>
                <Link
                  href="/#como-funciona"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-borde bg-white px-5 py-2.5 text-sm font-semibold text-texto hover:bg-slate-50"
                >
                  Ver los pasos del trámite
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-6">
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs font-semibold uppercase text-amber-700">
                Próximamente
              </span>
              <h3 className="mt-3 text-base font-bold text-titulo">
                El Geo-Portal y el visor de ferias estarán disponibles en el
                Sprint 2
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-texto">
                Estamos habilitando la consulta pública de zonas geográficas y
                el calendario de eventos. Esta sección se actualizará
                automáticamente cuando el módulo esté activo.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
