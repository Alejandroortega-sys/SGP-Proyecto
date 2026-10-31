"use client";

import { CampoPassword } from "@/components/ui/campo";
import { evaluarFortalezaPassword, validarCoincidencia, validarPassword } from "@/lib/validaciones";

export interface SeguridadCuenta {
  password: string;
  confirmarPassword: string;
}

export type ErroresSeguridad = Partial<Record<keyof SeguridadCuenta, string | null>>;

export const SEGURIDAD_VACIA: SeguridadCuenta = {
  password: "",
  confirmarPassword: "",
};

export function validarSeguridad(seguridad: SeguridadCuenta): ErroresSeguridad {
  return {
    password: validarPassword(seguridad.password),
    confirmarPassword: seguridad.confirmarPassword
      ? validarCoincidencia(seguridad.password, seguridad.confirmarPassword)
      : "Confirma tu contraseña.",
  };
}

export function hayErroresSeguridad(errores: ErroresSeguridad): boolean {
  return Object.values(errores).some((error) => Boolean(error));
}

interface PropiedadesSeguridad {
  seguridad: SeguridadCuenta;
  errores: ErroresSeguridad;
  onCambio: (actualizacion: Partial<SeguridadCuenta>) => void;
}

export function CamposSeguridadCuenta({
  seguridad,
  errores,
  onCambio,
}: PropiedadesSeguridad) {
  const fortaleza = evaluarFortalezaPassword(seguridad.password);

  return (
    <div className="grid gap-4">
      <CampoPassword
        etiqueta="Contraseña"
        name="password"
        autoComplete="new-password"
        placeholder="Mínimo 8 caracteres"
        requerido
        value={seguridad.password}
        onChange={(evento) => onCambio({ password: evento.target.value })}
        error={errores.password ?? null}
        ayuda="Debe tener entre 8 y 128 caracteres e incluir al menos un número."
      />

      <div aria-live="polite">
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-all ${fortaleza.claseBarra}`}
              style={{ width: `${(fortaleza.nivel / 4) * 100}%` }}
            />
          </div>
          <span className="w-24 shrink-0 text-right text-xs font-medium text-texto">
            {seguridad.password ? fortaleza.etiqueta : "—"}
          </span>
        </div>
      </div>

      <CampoPassword
        etiqueta="Confirmar Contraseña"
        name="confirmarPassword"
        autoComplete="new-password"
        placeholder="Repite tu contraseña"
        requerido
        value={seguridad.confirmarPassword}
        onChange={(evento) =>
          onCambio({ confirmarPassword: evento.target.value })
        }
        error={errores.confirmarPassword ?? null}
      />
    </div>
  );
}
