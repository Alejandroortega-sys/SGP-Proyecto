"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Boton } from "@/components/ui/boton";
import { EnlaceBoton } from "@/components/ui/enlace-boton";
import { Spinner } from "@/components/ui/spinner";
import {
  IconoCerrar,
  IconoEscudo,
  IconoMenu,
  IconoPersona,
} from "@/components/ui/iconos";
import { useSesion } from "@/hooks/use-sesion";

const ENLACES = [
  { href: "/", texto: "Inicio" },
  { href: "/#como-funciona", texto: "Conoce el Proyecto" },
  { href: "/mapa", texto: "Mapa" },
  { href: "/#geo-portal", texto: "Ferias", proximamente: true },
] as const;

export function NavbarPublica() {
  const [abierta, setAbierta] = useState(false);
  const rutaActual = usePathname();
  const [rutaCerrada, setRutaCerrada] = useState(rutaActual);
  const { usuario, cargando, salir } = useSesion();

  if (rutaCerrada !== rutaActual) {
    setRutaCerrada(rutaActual);
    setAbierta(false);
  }

  const cerrarSesionLocal = () => {
    void salir();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-borde bg-superficie/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 rounded-lg py-1"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
            <IconoEscudo className="size-5" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-bold text-titulo">
              Gestión del Espacio Público
            </span>
            <span className="block text-xs font-medium text-accent-texto">
              SGP Tuluá
            </span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Principal">
          {ENLACES.map((enlace) => (
            <Link
              key={enlace.texto}
              href={enlace.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-texto transition-colors duration-150 hover:bg-interaccion hover:text-titulo"
            >
              {enlace.texto}
              {"proximamente" in enlace && enlace.proximamente ? (
                <span className="ml-1.5 rounded-full border border-advertencia-borde bg-advertencia-suave px-1.5 py-0.5 text-[10px] font-semibold uppercase text-advertencia-texto">
                  Próximamente
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {cargando ? (
            <Spinner className="size-5 text-tenue" />
          ) : usuario ? (
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-2 rounded-lg border border-borde bg-fondo px-3 py-1.5 sm:flex">
                <IconoPersona className="size-4 text-accent-texto" />
                <span className="max-w-40 truncate text-sm font-medium text-titulo">
                  {usuario.nombre}
                </span>
                <span className="rounded-full bg-accent-suave px-2 py-0.5 text-[11px] font-semibold uppercase text-accent-texto">
                  {usuario.rol}
                </span>
              </span>
              <Boton
                variante="contorno"
                tamano="sm"
                onClick={cerrarSesionLocal}
                aria-label="Cerrar sesión"
              >
                <IconoCerrar className="size-4" />
                <span className="hidden sm:inline">Cerrar sesión</span>
              </Boton>
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <EnlaceBoton href="/login" tamano="sm" variante="contorno">
                Iniciar Sesión
              </EnlaceBoton>
              <EnlaceBoton href="/registro" tamano="sm">
                Registrarse
              </EnlaceBoton>
            </div>
          )}

          <button
            type="button"
            onClick={() => setAbierta((actual) => !actual)}
            aria-expanded={abierta}
            aria-controls="menu-publico"
            aria-label={abierta ? "Cerrar menú" : "Abrir menú"}
            className="flex size-10 items-center justify-center rounded-lg text-titulo transition-colors duration-150 hover:bg-interaccion focus-visible:outline-2 focus-visible:outline-accent lg:hidden"
          >
            {abierta ? <IconoCerrar /> : <IconoMenu />}
          </button>
        </div>
      </div>

      <div
        id="menu-publico"
        hidden={!abierta}
        className="border-t border-borde bg-superficie lg:hidden"
      >
        <nav
          aria-label="Principal móvil"
          className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6"
        >
          {ENLACES.map((enlace) => (
            <Link
              key={`movil-${enlace.texto}`}
              href={enlace.href}
              onClick={() => setAbierta(false)}
              className="flex min-h-11 items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-texto transition-colors duration-150 hover:bg-interaccion hover:text-titulo"
            >
              {enlace.texto}
              {"proximamente" in enlace && enlace.proximamente ? (
                <span className="rounded-full border border-advertencia-borde bg-advertencia-suave px-2 py-0.5 text-[10px] font-semibold uppercase text-advertencia-texto">
                  Próximamente
                </span>
              ) : null}
            </Link>
          ))}
          {cargando ? null : usuario ? (
            <div className="mt-1 flex flex-col gap-2 border-t border-borde pt-3">
              <p className="px-3 text-sm text-titulo">
                <span className="font-semibold">{usuario.nombre}</span>
                <span className="ml-2 text-xs uppercase text-accent-texto">
                  {usuario.rol}
                </span>
              </p>
              <Boton variante="contorno" onClick={cerrarSesionLocal}>
                Cerrar sesión
              </Boton>
            </div>
          ) : (
            <div className="mt-1 flex flex-col gap-2 border-t border-borde pt-3">
              <EnlaceBoton href="/login" variante="contorno">
                Iniciar Sesión
              </EnlaceBoton>
              <EnlaceBoton href="/registro">Registrarse</EnlaceBoton>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
