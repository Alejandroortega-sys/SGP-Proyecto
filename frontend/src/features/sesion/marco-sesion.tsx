"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Boton } from "@/components/ui/boton";
import {
  IconoCerrar,
  IconoEscudo,
  IconoMenu,
  IconoPersona,
} from "@/components/ui/iconos";
import { Spinner } from "@/components/ui/spinner";
import { useSesion } from "@/hooks/use-sesion";
import { listarNotificaciones } from "@/lib/api-client";
import { nombreRol, rutaInicio } from "@/lib/rutas";
import type { RolUsuario } from "@/types/api";

interface EnlaceSesion {
  href: string;
  texto: string;
  roles: RolUsuario[];
  soloAdministrador?: boolean;
}

const ENLACES: EnlaceSesion[] = [
  { href: "/comerciante/inicio", texto: "Inicio", roles: ["comerciante"] },
  { href: "/comerciante/perfil", texto: "Mi perfil", roles: ["comerciante"] },
  { href: "/organizador/inicio", texto: "Inicio", roles: ["organizador"] },
  { href: "/organizador/perfil", texto: "Mi perfil", roles: ["organizador"] },
  {
    href: "/organizador/mi-organizacion",
    texto: "Mi organización",
    roles: ["organizador"],
  },
  { href: "/gestor/panel", texto: "Panel", roles: ["gestor"] },
  { href: "/gestor/usuarios", texto: "Usuarios", roles: ["gestor"] },
  { href: "/gestor/comerciantes", texto: "Comerciantes", roles: ["gestor"] },
  {
    href: "/gestor/organizaciones",
    texto: "Organizaciones",
    roles: ["gestor"],
  },
  {
    href: "/gestor/auditoria",
    texto: "Auditoría",
    roles: ["gestor"],
    soloAdministrador: true,
  },
  { href: "/gestor/perfil", texto: "Mi perfil", roles: ["gestor"] },
  { href: "/notificaciones", texto: "Notificaciones", roles: ["comerciante", "organizador", "gestor"] },
];

export function MarcoSesion({ children }: { children: ReactNode }) {
  const { usuario, cargando, salir } = useSesion();
  const pathname = usePathname();
  const router = useRouter();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [noLeidas, setNoLeidas] = useState(0);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    let activo = true;
    listarNotificaciones({ leida: false, pagina: 1, limite: 1 })
      .then((respuesta) => {
        if (activo) setNoLeidas(respuesta.noLeidas);
      })
      .catch(() => {
        if (activo) setNoLeidas(0);
      });
    return () => {
      activo = false;
    };
  }, [pathname]);

  const esAdministrador = usuario?.perfil === "administrador";
  const enlaces = ENLACES.filter(
    (enlace) =>
      usuario !== null &&
      enlace.roles.includes(usuario.rol) &&
      (!enlace.soloAdministrador || esAdministrador),
  );

  async function cerrarSesion() {
    if (saliendo) return;
    setSaliendo(true);
    try {
      await salir();
      router.replace("/login");
    } finally {
      setSaliendo(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-fondo">
      <header className="sticky top-0 z-40 border-b border-borde bg-superficie/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link
            href={usuario ? rutaInicio(usuario) : "/"}
            className="flex min-w-0 items-center gap-2.5 rounded-lg py-1"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primario text-white">
              <IconoEscudo className="size-5" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-bold text-titulo">
                SGP Tuluá
              </span>
              <span className="block text-xs font-medium text-primario">
                {usuario ? nombreRol(usuario.rol) : "Gestión del espacio público"}
              </span>
            </span>
          </Link>

          <nav
            aria-label="Navegación principal"
            className="ml-4 hidden flex-1 items-center gap-1 lg:flex"
          >
            {enlaces.map((enlace) => {
              const activo =
                pathname === enlace.href ||
                pathname.startsWith(`${enlace.href}/`);
              return (
                <Link
                  key={enlace.href}
                  href={enlace.href}
                  aria-current={activo ? "page" : undefined}
                  className={
                    activo
                      ? "rounded-lg bg-primario-suave px-3 py-2 text-sm font-semibold text-primario"
                      : "rounded-lg px-3 py-2 text-sm font-medium text-texto hover:bg-slate-100 hover:text-titulo"
                  }
                >
                  {enlace.texto}
                  {enlace.href === "/notificaciones" && noLeidas > 0 ? (
                    <span className="ml-1.5 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {noLeidas}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {cargando || !usuario ? (
              <Spinner className="size-5 text-tenue" />
            ) : (
              <span className="hidden items-center gap-2 rounded-lg border border-borde bg-fondo px-3 py-1.5 sm:flex">
                <IconoPersona className="size-4 text-primario" />
                <span className="max-w-40 truncate text-sm font-medium text-titulo">
                  {usuario.nombre}
                </span>
                <span className="rounded-full bg-primario-suave px-2 py-0.5 text-[11px] font-semibold uppercase text-primario">
                  {usuario.rol === "gestor"
                    ? usuario.perfil ?? "gestor"
                    : usuario.rol}
                </span>
              </span>
            )}
            <Boton
              variante="contorno"
              tamano="sm"
              onClick={cerrarSesion}
              cargando={saliendo}
              aria-label="Cerrar sesión"
            >
              <IconoCerrar className="size-4" />
              <span className="hidden sm:inline">Salir</span>
            </Boton>
            <button
              type="button"
              onClick={() => setMenuAbierto((valor) => !valor)}
              aria-expanded={menuAbierto}
              aria-controls="menu-sesion"
              aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
              className="flex size-11 items-center justify-center rounded-lg text-titulo hover:bg-slate-100 lg:hidden"
            >
              {menuAbierto ? <IconoCerrar /> : <IconoMenu />}
            </button>
          </div>
        </div>

        <div
          id="menu-sesion"
          hidden={!menuAbierto}
          className="border-t border-borde bg-superficie lg:hidden"
        >
          <nav
            aria-label="Navegación móvil"
            className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6"
          >
            {enlaces.map((enlace) => (
              <Link
                key={`movil-${enlace.href}`}
                href={enlace.href}
                onClick={() => setMenuAbierto(false)}
                className="flex min-h-11 items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-texto hover:bg-slate-100"
              >
                {enlace.texto}
                {enlace.href === "/notificaciones" && noLeidas > 0 ? (
                  <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    {noLeidas}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main id="contenido" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-borde bg-superficie">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 text-xs text-tenue sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Alcaldía de Tuluá · Gestión del Espacio Público</p>
          <p>SGP Tuluá · Sprint 1</p>
        </div>
      </footer>
    </div>
  );
}
