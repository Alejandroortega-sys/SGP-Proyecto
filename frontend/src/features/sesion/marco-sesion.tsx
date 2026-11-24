'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Boton } from '@/components/ui/boton';
import {
  IconoCerrar,
  IconoEscudo,
  IconoMenu,
  IconoPersona,
} from '@/components/ui/iconos';
import { Spinner } from '@/components/ui/spinner';
import { useSesion } from '@/hooks/use-sesion';
import { listarNotificaciones } from '@/lib/api-client';
import { EVENTO_NOTIFICACIONES_ACTUALIZADAS } from '@/lib/notificaciones';
import { nombreRol, rutaInicio } from '@/lib/rutas';
import type { RolUsuario } from '@/types/api';

interface EnlaceSesion {
  href: string;
  texto: string;
  roles: RolUsuario[];
  soloAdministrador?: boolean;
}

const ENLACES: EnlaceSesion[] = [
  { href: '/comerciante/inicio', texto: 'Inicio', roles: ['comerciante'] },
  {
    href: '/comerciante/espacios',
    texto: 'Espacios',
    roles: ['comerciante'],
  },
  {
    href: '/comerciante/solicitudes',
    texto: 'Mis solicitudes',
    roles: ['comerciante'],
  },
  { href: '/comerciante/perfil', texto: 'Mi perfil', roles: ['comerciante'] },
  { href: '/organizador/inicio', texto: 'Inicio', roles: ['organizador'] },
  { href: '/organizador/ferias', texto: 'Ferias', roles: ['organizador'] },
  { href: '/organizador/perfil', texto: 'Mi perfil', roles: ['organizador'] },
  {
    href: '/organizador/mi-organizacion',
    texto: 'Mi organización',
    roles: ['organizador'],
  },
  { href: '/gestor/panel', texto: 'Panel', roles: ['gestor'] },
  {
    href: '/gestor/solicitudes',
    texto: 'Solicitudes',
    roles: ['gestor'],
  },
  { href: '/gestor/zonas', texto: 'Zonas', roles: ['gestor'] },
  { href: '/gestor/ferias', texto: 'Ferias', roles: ['gestor'] },
  { href: '/gestor/modulos', texto: 'Módulos', roles: ['gestor'] },
  { href: '/gestor/espacios', texto: 'Espacios', roles: ['gestor'] },
  {
    href: '/gestor/importaciones',
    texto: 'Importar',
    roles: ['gestor'],
  },
  { href: '/gestor/usuarios', texto: 'Usuarios', roles: ['gestor'] },
  { href: '/gestor/comerciantes', texto: 'Comerciantes', roles: ['gestor'] },
  {
    href: '/gestor/organizaciones',
    texto: 'Organizaciones',
    roles: ['gestor'],
  },
  {
    href: '/gestor/auditoria',
    texto: 'Auditoría',
    roles: ['gestor'],
    soloAdministrador: true,
  },
  { href: '/gestor/perfil', texto: 'Mi perfil', roles: ['gestor'] },
  {
    href: '/notificaciones',
    texto: 'Notificaciones',
    roles: ['comerciante', 'organizador', 'gestor'],
  },
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

    const actualizarContador = () => {
      listarNotificaciones({ leida: false, pagina: 1, limite: 1 })
        .then((respuesta) => {
          if (activo) setNoLeidas(respuesta.noLeidas);
        })
        .catch(() => {
          if (activo) setNoLeidas(0);
        });
    };

    actualizarContador();
    window.addEventListener(
      EVENTO_NOTIFICACIONES_ACTUALIZADAS,
      actualizarContador,
    );

    return () => {
      activo = false;
      window.removeEventListener(
        EVENTO_NOTIFICACIONES_ACTUALIZADAS,
        actualizarContador,
      );
    };
  }, [pathname]);

  const esAdministrador = usuario?.perfil === 'administrador';
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
      router.replace('/login');
    } finally {
      setSaliendo(false);
    }
  }

  return (
    <div className="flex min-h-dvh bg-fondo">
      {/* Barra lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-borde bg-superficie lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-borde px-4">
          <Link
            href={usuario ? rutaInicio(usuario) : '/'}
            className="flex min-w-0 items-center gap-2.5 rounded-lg py-1"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
              <IconoEscudo className="size-5" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-bold text-titulo">
                SGP Tuluá
              </span>
              <span className="block text-xs font-medium text-accent-texto">
                {usuario
                  ? nombreRol(usuario.rol)
                  : 'Gestión del espacio público'}
              </span>
            </span>
          </Link>
        </div>

        <nav
          aria-label="Navegación principal"
          className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4"
        >
          {enlaces.map((enlace) => {
            const activo =
              pathname === enlace.href ||
              pathname.startsWith(`${enlace.href}/`);
            return (
              <Link
                key={enlace.href}
                href={enlace.href}
                aria-current={activo ? 'page' : undefined}
                className={
                  activo
                    ? 'flex min-h-9 items-center justify-between gap-2 rounded-lg bg-accent-suave px-3 text-sm font-semibold text-accent-texto'
                    : 'flex min-h-9 items-center justify-between gap-2 rounded-lg px-3 text-sm font-medium text-texto transition-colors duration-150 hover:bg-interaccion hover:text-titulo'
                }
              >
                {enlace.texto}
                {enlace.href === '/notificaciones' && noLeidas > 0 ? (
                  <span className="rounded-full bg-peligro px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {noLeidas}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-borde p-3">
          {cargando || !usuario ? (
            <div className="flex items-center gap-2 px-1 py-2 text-sm text-tenue">
              <Spinner className="size-4" />
              Cargando…
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5 px-1 py-1">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-interaccion text-tenue">
                  <IconoPersona className="size-4" />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-semibold text-titulo">
                    {usuario.nombre}
                  </span>
                  <span className="block truncate text-xs text-tenue">
                    {usuario.rol === 'gestor'
                      ? (usuario.perfil ?? 'gestor')
                      : nombreRol(usuario.rol)}
                  </span>
                </span>
              </div>
              <Boton
                variante="fantasma"
                tamano="sm"
                anchoCompleto
                onClick={cerrarSesion}
                cargando={saliendo}
                aria-label="Cerrar sesión"
              >
                <IconoCerrar className="size-4" />
                Salir
              </Boton>
            </div>
          )}
        </div>
      </aside>

      {/* Columna principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-borde bg-superficie/95 backdrop-blur lg:hidden">
          <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
            <Link
              href={usuario ? rutaInicio(usuario) : '/'}
              className="flex min-w-0 items-center gap-2.5 rounded-lg py-1"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
                <IconoEscudo className="size-5" />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-bold text-titulo">
                  SGP Tuluá
                </span>
                <span className="block text-xs font-medium text-accent-texto">
                  {usuario
                    ? nombreRol(usuario.rol)
                    : 'Gestión del espacio público'}
                </span>
              </span>
            </Link>

            <div className="ml-auto flex items-center gap-2">
              {cargando || !usuario ? (
                <Spinner className="size-5 text-tenue" />
              ) : (
                <span className="hidden items-center gap-2 rounded-lg border border-borde bg-fondo px-3 py-1.5 sm:flex">
                  <IconoPersona className="size-4 text-accent-texto" />
                  <span className="max-w-40 truncate text-sm font-medium text-titulo">
                    {usuario.nombre}
                  </span>
                  <span className="rounded-full bg-accent-suave px-2 py-0.5 text-[11px] font-semibold uppercase text-accent-texto">
                    {usuario.rol === 'gestor'
                      ? (usuario.perfil ?? 'gestor')
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
                aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
                className="flex size-10 items-center justify-center rounded-lg text-titulo transition-colors duration-150 hover:bg-interaccion focus-visible:outline-2 focus-visible:outline-accent"
              >
                {menuAbierto ? <IconoCerrar /> : <IconoMenu />}
              </button>
            </div>
          </div>

          <div
            id="menu-sesion"
            hidden={!menuAbierto}
            className="border-t border-borde bg-superficie"
          >
            <nav
              aria-label="Navegación móvil"
              className="flex flex-col gap-0.5 px-3 py-3"
            >
              {enlaces.map((enlace) => {
                const activo =
                  pathname === enlace.href ||
                  pathname.startsWith(`${enlace.href}/`);
                return (
                  <Link
                    key={`movil-${enlace.href}`}
                    href={enlace.href}
                    aria-current={activo ? 'page' : undefined}
                    onClick={() => setMenuAbierto(false)}
                    className={
                      activo
                        ? 'flex min-h-11 items-center justify-between rounded-lg bg-accent-suave px-3 py-2 text-sm font-semibold text-accent-texto'
                        : 'flex min-h-11 items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-texto transition-colors duration-150 hover:bg-interaccion hover:text-titulo'
                    }
                  >
                    {enlace.texto}
                    {enlace.href === '/notificaciones' && noLeidas > 0 ? (
                      <span className="rounded-full bg-peligro px-2 py-0.5 text-[10px] font-bold text-white">
                        {noLeidas}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        <main
          id="contenido"
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>

        <footer className="border-t border-borde bg-superficie">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-xs text-tenue sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>Alcaldía de Tuluá · Gestión del Espacio Público</p>
            <p>SGP Tuluá · Sprint 1</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
