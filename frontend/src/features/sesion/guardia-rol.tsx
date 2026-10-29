"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { useSesion } from "@/hooks/use-sesion";
import { rutaInicio } from "@/lib/rutas";
import type { RolUsuario } from "@/types/api";

export function GuardiaRol({
  roles,
  children,
}: {
  roles: RolUsuario[];
  children: ReactNode;
}) {
  const { usuario, cargando } = useSesion();
  const router = useRouter();

  useEffect(() => {
    if (cargando) return;
    if (!usuario) {
      router.replace("/login");
      return;
    }
    if (!roles.includes(usuario.rol)) {
      router.replace(rutaInicio(usuario));
    }
  }, [cargando, usuario, roles, router]);

  if (cargando || !usuario || !roles.includes(usuario.rol)) {
    return (
      <div className="flex min-h-dvh items-center justify-center gap-3 text-sm text-texto">
        <Spinner className="size-6 animate-spin text-primario" />
        <span>Verificando tu sesión…</span>
      </div>
    );
  }

  return <>{children}</>;
}
