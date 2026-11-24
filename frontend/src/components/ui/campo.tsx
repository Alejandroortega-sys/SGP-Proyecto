"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { combinarClases } from "@/lib/clases";
import {
  IconoChevronAbajo,
  IconoOjo,
  IconoOjoOculto,
} from "./iconos";

const CLASE_BASE =
  "w-full min-h-10 rounded-lg border bg-superficie px-3 py-2 text-base text-titulo " +
  "placeholder:text-tenue disabled:cursor-not-allowed disabled:bg-interaccion " +
  "disabled:text-tenue focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent";

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
          <span className="ml-1 text-peligro" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={idError} className="text-sm text-peligro-texto">
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
          error ? "border-peligro" : "border-borde",
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
          <span className="ml-1 text-peligro" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      <div className="relative">
        <select
          id={id}
          required={requerido}
          aria-required={requerido}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? idError : ayuda ? idAyuda : undefined}
          className={combinarClases(
            CLASE_BASE,
            "appearance-none pr-9",
            error ? "border-peligro" : "border-borde",
            className,
          )}
          {...resto}
        >
          {children}
        </select>
        <IconoChevronAbajo className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-tenue" />
      </div>
      {error ? (
        <p id={idError} className="text-sm text-peligro-texto">
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
            <span className="ml-1 text-peligro" aria-hidden="true">
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
            "pr-10",
            error ? "border-peligro" : "border-borde",
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
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-tenue transition-colors duration-150 hover:bg-interaccion hover:text-titulo focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          {visible ? <IconoOjoOculto /> : <IconoOjo />}
        </button>
      </div>
      {error ? (
        <p id={idError} className="text-sm text-peligro-texto">
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
