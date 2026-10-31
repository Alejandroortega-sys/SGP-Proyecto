import Link from "next/link";
import { IconoEscudo } from "@/components/ui/iconos";

export function FooterPublico() {
  return (
    <footer className="border-t border-borde bg-superficie">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primario text-white">
              <IconoEscudo className="size-5" />
            </span>
            <span className="text-sm font-bold text-titulo">SGP Tuluá</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-texto">
            Plataforma de Gestión del Espacio Público, Ferias Agroecológicas y
            Comercio Formal/Informal del Municipio de Tuluá, Valle del Cauca.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase text-titulo">
            Entidad responsable
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-texto">
            <li>Alcaldía Municipal de Tuluá</li>
            <li>Tuluá, Valle del Cauca, Colombia</li>
            <li>Dominio institucional: tulua.gov.co</li>
            <li className="text-tenue">
              Los canales de atención al ciudadano se publican en el portal
              oficial de la Alcaldía.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase text-titulo">
            Accesos rápidos
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-texto">
            <li>
              <Link
                href="/registro"
                className="font-medium text-primario hover:underline"
              >
                Crear cuenta
              </Link>
            </li>
            <li>
              <Link
                href="/login"
                className="font-medium text-primario hover:underline"
              >
                Ingresar a la plataforma
              </Link>
            </li>
            <li>
              <Link
                href="/recuperar"
                className="font-medium text-primario hover:underline"
              >
                Recuperar contraseña
              </Link>
            </li>
            <li>
              <Link
                href="/#como-funciona"
                className="font-medium text-primario hover:underline"
              >
                Cómo funciona el trámite
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-borde bg-fondo">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-xs text-tenue sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © 2026 Alcaldía Municipal de Tuluá. Todos los derechos reservados.
          </p>
          <p>
            Tratamiento de datos personales conforme a la Ley 1581 de 2012 y a
            la normativa municipal vigente.
          </p>
        </div>
      </div>
    </footer>
  );
}
