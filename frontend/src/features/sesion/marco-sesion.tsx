'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Boton } from '@/components/ui/boton';
import {
  IconoCampana,
  IconoCasita,
  IconoCerrar,
  IconoDocumento,
  IconoEscudo,
  IconoFeria,
  IconoMapa,
  IconoPersona,
  IconoTienda,
} from '@/components/ui/iconos';
import { Spinner } from '@/components/ui/spinner';
import { useSesion } from '@/hooks/use-sesion';
import { combinarClases } from '@/lib/clases';
import { listarNotificaciones, obtenerPanel } from '@/lib/api-client';
import { EVENTO_NOTIFICACIONES_ACTUALIZADAS } from '@/lib/notificaciones';
import { nombreRol, rutaInicio } from '@/lib/rutas';
import type { Panel, RolUsuario } from '@/types/api';
import type { UsuarioSesion } from '@/types/api';

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
  {
    href: '/comerciante/permisos',
    texto: 'Mis permisos',
    roles: ['comerciante'],
  },
  { href: '/comerciante/pagos', texto: 'Pagos', roles: ['comerciante'] },
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
  { href: '/gestor/permisos', texto: 'Permisos', roles: ['gestor'] },
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

/**
 * Accesos rápidos del panel derecho (docs/DESIGN.md §8.4 y §12).
 * Los textos se eligieron para no duplicar nombres accesibles que
 * usan la navegación lateral ni las páginas (pruebas e2e incluidas).
 */
interface EnlaceRapido {
  href: string;
  texto: string;
  soloAdministrador?: boolean;
}

const ACCESOS_RAPIDOS: Record<RolUsuario, EnlaceRapido[]> = {
  comerciante: [
    {
      href: '/comerciante/solicitudes/nueva',
      texto: 'Solicitar un espacio',
    },
    {
      href: '/comerciante/espacios',
      texto: 'Explorar espacios disponibles',
    },
    {
      href: '/comerciante/permisos',
      texto: 'Consultar mis permisos',
    },
    { href: '/comerciante/pagos', texto: 'Estado de pagos' },
  ],
  organizador: [
    { href: '/organizador/ferias/nueva', texto: 'Registrar una feria' },
    { href: '/organizador/ferias', texto: 'Consultar mis ferias' },
    {
      href: '/organizador/mi-organizacion',
      texto: 'Datos de la organización',
    },
  ],
  gestor: [
    {
      href: '/gestor/solicitudes',
      texto: 'Solicitudes por revisar',
    },
    { href: '/gestor/ferias', texto: 'Agenda de ferias' },
    {
      href: '/gestor/importaciones',
      texto: 'Cargar información geográfica',
    },
    {
      href: '/gestor/auditoria',
      texto: 'Registro de auditoría',
      soloAdministrador: true,
    },
  ],
};

type IconoNav = typeof IconoCampana;

interface EnlaceNavMovil {
  href: string;
  texto: string;
  icono: IconoNav;
}

/** Navegación inferior móvil (docs/DESIGN.md §8.6): 5 accesos por rol. */
const NAV_MOVIL: Record<RolUsuario, EnlaceNavMovil[]> = {
  comerciante: [
    { href: '/comerciante/inicio', texto: 'Inicio', icono: IconoCasita },
    { href: '/comerciante/espacios', texto: 'Espacios', icono: IconoMapa },
    {
      href: '/comerciante/solicitudes',
      texto: 'Solicitudes',
      icono: IconoDocumento,
    },
    { href: '/notificaciones', texto: 'Avisos', icono: IconoCampana },
    { href: '/comerciante/perfil', texto: 'Perfil', icono: IconoPersona },
  ],
  organizador: [
    { href: '/organizador/inicio', texto: 'Inicio', icono: IconoCasita },
    { href: '/organizador/ferias', texto: 'Ferias', icono: IconoFeria },
    {
      href: '/organizador/mi-organizacion',
      texto: 'Organización',
      icono: IconoTienda,
    },
    { href: '/notificaciones', texto: 'Avisos', icono: IconoCampana },
    { href: '/organizador/perfil', texto: 'Perfil', icono: IconoPersona },
  ],
  gestor: [
    { href: '/gestor/panel', texto: 'Panel', icono: IconoCasita },
    {
      href: '/gestor/solicitudes',
      texto: 'Solicitudes',
      icono: IconoDocumento,
    },
    { href: '/gestor/zonas', texto: 'Zonas', icono: IconoMapa },
    { href: '/notificaciones', texto: 'Avisos', icono: IconoCampana },
    { href: '/gestor/perfil', texto: 'Perfil', icono: IconoPersona },
  ],
};

function rutaPerfil(rol: RolUsuario): string {
  return `/${rol}/perfil`;
}

/** Iniciales para el avatar circular (p. ej. «María Gómez» → «MG»). */
function inicialesDe(nombre: string, apellido: string | null): string {
  const partes = `${nombre} ${apellido ?? ''}`.trim().split(/\s+/);
  if (partes.length === 0 || partes[0] === '') return '?';
  const primera = partes[0][0] ?? '?';
  const segunda = partes.length > 1 ? (partes[partes.length - 1][0] ?? '') : '';
  return `${primera}${segunda}`.toUpperCase();
}

export function MarcoSesion({ children }: { children: ReactNode }) {
  const { usuario, cargando, salir } = useSesion();
  const pathname = usePathname();
  const router = useRouter();
  const [noLeidas, setNoLeidas] = useState(0);
  const [saliendo, setSaliendo] = useState(false);
  const [menuCuentaAbierto, setMenuCuentaAbierto] = useState(false);
  const [indicadores, setIndicadores] = useState<Panel['indicadores'] | null>(
    null,
  );

  /* Contador de notificaciones: al navegar y cuando la bandeja marca
     una como leída (evento global). */
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

  /* Resumen de indicadores del panel derecho (solo gestor, §12.1).
     El render ya condiciona el widget a rol === 'gestor', así que no
     hace falta restablecer el estado al cambiar de rol. */
  const rol = usuario?.rol;
  useEffect(() => {
    if (rol !== 'gestor') return;
    let activo = true;
    obtenerPanel()
      .then((panel) => {
        if (activo) setIndicadores(panel.indicadores);
      })
      .catch(() => {
        if (activo) setIndicadores(null);
      });
    return () => {
      activo = false;
    };
  }, [rol]);

  /* El menú de cuenta se cierra al navegar. Se ajusta durante el
     render (patrón recomendado) en lugar de dentro de un efecto. */
  const [rutaAnterior, setRutaAnterior] = useState(pathname);
  if (rutaAnterior !== pathname) {
    setRutaAnterior(pathname);
    setMenuCuentaAbierto(false);
  }

  const esAdministrador = usuario?.perfil === 'administrador';
  const enlaces = ENLACES.filter(
    (enlace) =>
      usuario !== null &&
      enlace.roles.includes(usuario.rol) &&
      (!enlace.soloAdministrador || esAdministrador),
  );
  const accesos =
    usuario !== null
      ? ACCESOS_RAPIDOS[usuario.rol].filter(
          (acceso) => !acceso.soloAdministrador || esAdministrador,
        )
      : [];
  const navMovil = usuario !== null ? NAV_MOVIL[usuario.rol] : [];
  const iniciales = usuario
    ? inicialesDe(usuario.nombre, usuario.apellido)
    : '';
  const nombreCorto = usuario
    ? `${usuario.nombre}${usuario.apellido ? ` ${usuario.apellido}` : ''}`
    : '';
  const etiquetaRol = (persona: UsuarioSesion) =>
    persona.rol === 'gestor'
      ? (persona.perfil ?? 'gestor')
      : nombreRol(persona.rol);

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
    <div className="flex min-h-dvh flex-col bg-fondo pb-14 lg:pb-0">
      {/* ============================================================
          Header global (56 px, sticky) — docs/DESIGN.md §8.5
          ============================================================ */}
      <header className="sticky top-0 z-50 shrink-0 border-b border-borde bg-superficie/95 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-5">
          <Link
            href={usuario ? rutaInicio(usuario) : '/'}
            className="flex min-w-0 items-center gap-2.5 rounded-lg py-1"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primario text-primario-contraste">
              <IconoEscudo className="size-4.5" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-bold text-titulo">
                SGP Tuluá
              </span>
              <span className="block text-2xs font-medium text-primario-texto">
                {usuario
                  ? nombreRol(usuario.rol)
                  : 'Gestión del espacio público'}
              </span>
            </span>
          </Link>

          <div className="flex-1" />

          {/* Campana de notificaciones. El nombre accesible empieza por
              «Bandeja» a propósito: las pruebas e2e leen el contador del
              enlace «Notificaciones» del menú lateral, que debe seguir
              siendo el primero con ese nombre. */}
          <Link
            href="/notificaciones"
            aria-label={
              noLeidas > 0
                ? `Bandeja de notificaciones, ${noLeidas} sin leer`
                : 'Bandeja de notificaciones'
            }
            className="relative flex size-9 items-center justify-center rounded-lg text-texto transition-colors duration-150 hover:bg-interaccion hover:text-titulo"
          >
            <IconoCampana className="size-5" />
            {noLeidas > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-peligro px-1 text-[10px] font-bold text-white">
                {noLeidas > 99 ? '99+' : noLeidas}
              </span>
            ) : null}
          </Link>

          {/* Menú de la cuenta (avatar con iniciales). */}
          {cargando || !usuario ? (
            <Spinner className="size-5 text-tenue" />
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuCuentaAbierto((valor) => !valor)}
                aria-expanded={menuCuentaAbierto}
                aria-haspopup="menu"
                aria-label="Menú de la cuenta"
                className="flex size-9 items-center justify-center rounded-full bg-primario-suave text-sm font-bold text-primario-texto transition-colors duration-150 hover:bg-primario-borde/60"
              >
                {iniciales}
              </button>

              {menuCuentaAbierto ? (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    aria-hidden="true"
                    onClick={() => setMenuCuentaAbierto(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 top-11 z-20 w-56 rounded-lg border border-borde bg-elevada p-1.5 shadow-md"
                  >
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-semibold text-titulo">
                        {nombreCorto}
                      </p>
                      <p className="text-2xs text-tenue">
                        {etiquetaRol(usuario)}
                      </p>
                    </div>
                    <div className="my-1 border-t border-borde" />
                    <Link
                      href={rutaPerfil(usuario.rol)}
                      role="menuitem"
                      onClick={() => setMenuCuentaAbierto(false)}
                      className="flex min-h-9 items-center rounded-md px-3 text-sm font-medium text-texto transition-colors duration-150 hover:bg-interaccion hover:text-titulo"
                    >
                      Ver mi perfil
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={cerrarSesion}
                      disabled={saliendo}
                      className="flex min-h-9 w-full items-center gap-2 rounded-md px-3 text-sm font-medium text-peligro-texto transition-colors duration-150 hover:bg-peligro-suave"
                    >
                      <IconoCerrar className="size-4" />
                      Cerrar sesión
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      </header>

      {/* ============================================================
          Fila de 3 columnas — docs/DESIGN.md §8
          ============================================================ */}
      <div className="flex min-h-0 flex-1">
        {/* Columna 1: navegación (264 px, sticky) — escritorio. */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-56px)] w-[264px] shrink-0 flex-col overflow-y-auto border-r border-borde bg-superficie lg:flex">
          <nav
            aria-label="Navegación principal"
            className="flex-1 space-y-0.5 px-3 py-4"
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
                      ? 'flex min-h-10 items-center justify-between gap-2 rounded-lg bg-primario-suave px-4 text-sm font-semibold text-primario-texto'
                      : 'flex min-h-10 items-center justify-between gap-2 rounded-lg px-4 text-sm font-medium text-texto transition-colors duration-150 hover:bg-interaccion hover:text-titulo'
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

          {cargando || !usuario ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-tenue">
              <Spinner className="size-4" />
              Cargando…
            </div>
          ) : (
            <div className="shrink-0 border-t border-borde p-3">
              <div className="flex items-center gap-2.5 px-1 py-1">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primario-suave text-sm font-bold text-primario-texto">
                  {iniciales}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-semibold text-titulo">
                    {usuario.nombre}
                  </span>
                  <span className="block truncate text-xs text-tenue">
                    {etiquetaRol(usuario)}
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
                className="mt-2"
              >
                <IconoCerrar className="size-4" />
                Salir
              </Boton>
            </div>
          )}
        </aside>

        {/* Columna 2: contenido (fluido — llena el espacio disponible
            entre las dos columnas fijas; las tablas y rejillas se
            expanden con la pantalla). */}
        <main
          id="contenido"
          className="w-full min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>

        {/* Columna 3: panel de contexto (320 px, sticky) — pantallas
            anchas (≥ xl): en portátiles medianos el contenido gana
            todo el ancho disponible para las tablas. */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-56px)] w-[320px] shrink-0 flex-col gap-5 overflow-y-auto border-l border-borde bg-superficie p-5 xl:flex">
          {/* Resumen del día (solo gestor) — indicadores en vivo. */}
          {usuario?.rol === 'gestor' && indicadores ? (
            <section className="rounded-lg border border-borde bg-fondo-sutil p-4">
              <h2 className="text-2xs font-semibold uppercase tracking-wide text-tenue">
                Resumen del día
              </h2>
              <div className="mt-3 flex flex-col gap-1">
                <Link
                  href="/gestor/solicitudes"
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-texto transition-colors duration-150 hover:bg-superficie hover:text-titulo"
                >
                  <span>Solicitudes radicadas</span>
                  <span className="font-bold text-titulo">
                    {indicadores.solicitudes.porEstado['radicada'] ?? 0}
                  </span>
                </Link>
                <Link
                  href="/gestor/permisos"
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-texto transition-colors duration-150 hover:bg-superficie hover:text-titulo"
                >
                  <span>Permisos vigentes</span>
                  <span className="font-bold text-titulo">
                    {indicadores.permisos.porEstado['vigente'] ?? 0}
                  </span>
                </Link>
                <Link
                  href="/gestor/ferias"
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-texto transition-colors duration-150 hover:bg-superficie hover:text-titulo"
                >
                  <span>Ferias aprobadas</span>
                  <span className="font-bold text-titulo">
                    {indicadores.ferias.porEstado['aprobada'] ?? 0}
                  </span>
                </Link>
              </div>
            </section>
          ) : null}

          {/* Accesos rápidos por rol. */}
          {accesos.length > 0 ? (
            <section className="rounded-lg border border-borde bg-fondo-sutil p-4">
              <h2 className="text-2xs font-semibold uppercase tracking-wide text-tenue">
                Accesos rápidos
              </h2>
              <div className="mt-3 flex flex-col gap-1">
                {accesos.map((acceso) => (
                  <Link
                    key={acceso.href}
                    href={acceso.href}
                    className="flex min-h-9 items-center rounded-md px-2 text-sm font-medium text-primario-texto transition-colors duration-150 hover:bg-superficie hover:text-primario"
                  >
                    {acceso.texto}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* Avisos: resumen de notificaciones sin leer. */}
          <section className="rounded-lg border border-borde bg-fondo-sutil p-4">
            <h2 className="text-2xs font-semibold uppercase tracking-wide text-tenue">
              Avisos
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-texto">
              {noLeidas > 0 ? (
                <>
                  Tienes{' '}
                  <span className="font-bold text-titulo">{noLeidas}</span>{' '}
                  notificaciones sin leer.
                </>
              ) : (
                'Estás al día: no tienes notificaciones sin leer.'
              )}
            </p>
            <Link
              href="/notificaciones"
              className="mt-3 inline-flex text-sm font-semibold text-primario-texto hover:underline"
            >
              Abrir la bandeja →
            </Link>
          </section>
        </aside>
      </div>

      <footer className="border-t border-borde bg-superficie">
        <div className="flex flex-col gap-1 px-4 py-3 text-xs text-tenue sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Alcaldía de Tuluá · Gestión del Espacio Público</p>
          <p>SGP Tuluá · Sistema de diseño Terraza</p>
        </div>
      </footer>

      {/* ============================================================
          Navegación inferior móvil (56 px, fija) — §8.6
          ============================================================ */}
      <nav
        aria-label="Navegación móvil"
        className="fixed inset-x-0 bottom-0 z-50 flex h-14 border-t border-borde bg-superficie px-2 lg:hidden"
      >
        {navMovil.map((item) => {
          const activo =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icono = item.icono;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={activo ? 'page' : undefined}
              className={combinarClases(
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 transition-colors duration-150',
                activo
                  ? 'text-primario-texto'
                  : 'text-tenue hover:text-texto',
              )}
            >
              <span className="relative">
                <Icono className="size-5" />
                {item.href === '/notificaciones' && noLeidas > 0 ? (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-peligro px-1 text-[9px] font-bold text-white">
                    {noLeidas > 99 ? '99+' : noLeidas}
                  </span>
                ) : null}
              </span>
              <span
                className={combinarClases(
                  'truncate text-[10px]',
                  activo ? 'font-semibold' : 'font-medium',
                )}
              >
                {item.texto}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
