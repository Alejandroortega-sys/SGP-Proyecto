"use client";

import Link from "next/link";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import { Cargando } from "@/components/ui/estado-vacio";
import { Alerta } from "@/components/ui/alerta";
import { Tarjeta } from "@/components/ui/tarjeta";
import { comoApiError, verificarPermisoQr } from "@/lib/api-client";
import { formatearRangoFechas } from "@/features/espacios/estilos-espacio";
import { EtiquetaEstadoPermiso } from "@/features/permisos/etiqueta-estado-permiso";

/**
 * Resultado de la verificación pública (HU-33-CA1/CA2/CA3): «Permiso
 * válido», «Permiso no vigente» con su estado, o «Permiso no encontrado».
 * El color va acompañado siempre de texto e ícono (WCAG AA).
 */
export function ResultadoVerificacion({ codigo }: { codigo: string }) {
  const { datos, cargando, error } = useConsultaApi(
    () => verificarPermisoQr(codigo),
    [codigo],
  );

  if (cargando) {
    return <Cargando texto="Verificando el permiso…" />;
  }

  // Sin datos + error: token inexistente, mal formado o límite por IP.
  if (!datos) {
    const api = error ? comoApiError(error) : null;
    const limitado = api?.status === 429;
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-texto">
            Veeduría ciudadana
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-titulo sm:text-3xl">
            Verificación de permiso
          </h1>
        </header>
        <Alerta tono={limitado ? "advertencia" : "error"}>
          <p className="text-base font-semibold">
            {limitado
              ? "Demasiadas verificaciones seguidas."
              : "Permiso no encontrado"}
          </p>
          <p className="mt-1 text-sm">
            {limitado
              ? api?.mensaje ??
                "Espera un momento antes de volver a consultar."
              : "El código consultado no corresponde a un permiso emitido. Pide al comerciante el carné oficial o repórtalo a la gestión municipal."}
          </p>
        </Alerta>
        <p className="text-center">
          <Link
            href="/verificar"
            className="text-sm font-semibold text-accent-texto hover:underline"
          >
            ← Volver a consultar otro código
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <header className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-texto">
          Veeduría ciudadana
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-titulo sm:text-3xl">
          Verificación de permiso
        </h1>
      </header>

      {datos.valido ? (
        <Alerta tono="exito" className="border-2">
          <p className="flex items-center gap-2 text-lg font-bold">
            ✔ Permiso válido
          </p>
          <p className="mt-1 text-sm">
            El permiso está vigente y autoriza el uso del espacio público.
          </p>
        </Alerta>
      ) : (
        <Alerta tono="error" className="border-2">
          <p className="flex items-center gap-2 text-lg font-bold">
            ✕ Permiso no vigente
          </p>
          <p className="mt-1 text-sm">
            Este permiso no habilita el puesto en este momento.
          </p>
        </Alerta>
      )}

      <Tarjeta className="p-4 sm:p-5">
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="font-semibold text-titulo">Estado</dt>
            <dd>
              <EtiquetaEstadoPermiso estado={datos.estado} />
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-semibold text-titulo">Titular comercial</dt>
            <dd className="text-right">{datos.titular}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-semibold text-titulo">Categoría autorizada</dt>
            <dd className="text-right">{datos.categoria}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-semibold text-titulo">Vigencia</dt>
            <dd className="text-right">
              {formatearRangoFechas(datos.vigenciaInicio, datos.vigenciaFin)}{" "}
              <span className="text-tenue">(inclusive)</span>
            </dd>
          </div>
        </dl>
        {datos.valido ? null : (
          <p className="mt-4 rounded-lg bg-fondo p-3 text-xs text-texto">
            Si el permiso figura como vencido, suspendido o revocado, el puesto
            no está habilitado. Cualquier cambio queda registrado en la
            trazabilidad municipal.
          </p>
        )}
      </Tarjeta>

      <p className="text-center">
        <Link
          href="/verificar"
          className="text-sm font-semibold text-accent-texto hover:underline"
        >
          ← Verificar otro permiso
        </Link>
      </p>
    </div>
  );
}
