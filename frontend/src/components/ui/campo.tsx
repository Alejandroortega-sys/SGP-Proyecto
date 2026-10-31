"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { combinarClases } from "@/lib/clases";
import { IconoOjo, IconoOjoOculto } from "./iconos";

const CLASE_BASE =
  "w-full rounded-lg border bg-white px-3.5 py-2.5 text-base text-titulo " +
  "placeholder:text-tenue disabled:cursor-not-allowed disabled:bg-slate-50 " +
  "disabled:text-tenue focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primario";

interface ComunesCampo {
  etiqueta: string;
  ayuda?: string;
  error?: string | null;
  requerido?: boolean;
}

interface PropiedadesCampo extends Omit<ComponentProps<"input">, "id">, ComunesCampo {}

interface PropiedadesSelector
  extends Omit<ComponentProps<"select">, "id">,
    ComunesCampo {
  children: ReactNode;
}

function CampoConEtiqueta({
  id,
  etiqueta,
  ayuda,
  error,
  requerido,
  children,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  error?: string | null;
  requerido?: boolean;
  children: ReactNode;
}) {
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-titulo">
        {etiqueta}
        {requerido ? (
          <span className="ml-1 text-rose-600" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={idError} className="text-sm text-rose-700">
          {error}
        </p>
      ) : ayuda ? (
        <p id={idAyuda} className="text-sm text-tenue">
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}

export function Campo({
  etiqueta,
  ayuda,
  error,
  requerido = false,
  className,
  type = "text",
  ...resto
}: PropiedadesCampo) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;

  return (
    <CampoConEtiqueta
      id={id}
      etiqueta={etiqueta}
      ayuda={ayuda}
      error={error}
      requerido={requerido}
    >
      <input
        id={id}
        type={type}
        required={requerido}
        aria-required={requerido}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? idError : ayuda ? idAyuda : undefined}
        className={combinarClases(
          CLASE_BASE,
          error ? "border-rose-400" : "border-borde",
          className,
        )}
        {...resto}
      />
    </CampoConEtiqueta>
  );
}

export function Selector({
  etiqueta,
  ayuda,
  error,
  requerido = false,
  className,
  children,
  ...resto
}: PropiedadesSelector) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-titulo">
        {etiqueta}
        {requerido ? (
          <span className="ml-1 text-rose-600" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      <select
        id={id}
        required={requerido}
        aria-required={requerido}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? idError : ayuda ? idAyuda : undefined}
        className={combinarClases(
          CLASE_BASE,
          "appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.875rem_center] bg-no-repeat pr-10",
          error ? "border-rose-400" : "border-borde",
          className,
        )}
        {...resto}
      >
        {children}
      </select>
      {error ? (
        <p id={idError} className="text-sm text-rose-700">
          {error}
        </p>
      ) : ayuda ? (
        <p id={idAyuda} className="text-sm text-tenue">
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}

export function CampoPassword({
  etiqueta,
  ayuda,
  error,
  requerido = false,
  className,
  accionEtiqueta,
  ...resto
}: PropiedadesCampo & { accionEtiqueta?: ReactNode }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const textoAlternativo = visible ? "Ocultar contraseña" : "Mostrar contraseña";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-titulo">
          {etiqueta}
          {requerido ? (
            <span className="ml-1 text-rose-600" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
        {accionEtiqueta}
      </div>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          required={requerido}
          aria-required={requerido}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? idError : ayuda ? idAyuda : undefined}
          className={combinarClases(
            CLASE_BASE,
            "pr-12",
            error ? "border-rose-400" : "border-borde",
            className,
          )}
          {...resto}
        />
        <button
          type="button"
          onClick={() => setVisible((actual) => !actual)}
          aria-pressed={visible}
          aria-label={textoAlternativo}
          title={textoAlternativo}
          className="absolute inset-y-0 right-0 flex min-h-11 w-11 items-center justify-center rounded-r-lg text-slate-500 hover:text-titulo"
        >
          {visible ? <IconoOjoOculto /> : <IconoOjo />}
        </button>
      </div>
      {error ? (
        <p id={idError} className="text-sm text-rose-700">
          {error}
        </p>
      ) : ayuda ? (
        <p id={idAyuda} className="text-sm text-tenue">
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}
