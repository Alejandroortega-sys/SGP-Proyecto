"use client";

import Link from "next/link";
import { BloqueError } from "@/components/ui/bloque-error";
import { Cargando } from "@/components/ui/estado-vacio";
import { Tarjeta, TarjetaCuerpo, TarjetaEncabezado } from "@/components/ui/tarjeta";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import { obtenerPanel } from "@/lib/api-client";
import { textoPerfil } from "@/lib/formato";

function Indicador({
  etiqueta,
  valor,
  tono = "neutro",
}: {
  etiqueta: string;
  valor: number;
  tono?: "neutro" | "exito" | "pendiente" | "peligro";
}) {
  const clases = {
    neutro: "border-borde bg-fondo text-titulo",
    exito: "border-emerald-200 bg-emerald-50 text-emerald-800",
    pendiente: "border-amber-200 bg-amber-50 text-amber-800",
    peligro: "border-rose-200 bg-rose-50 text-rose-800",
  }[tono];

  return (
    <div className={`rounded-lg border px-4 py-3 ${clases}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
        {etiqueta}
      </p>
      <p className="mt-1 text-2xl font-extrabold">{valor}</p>
    </div>
  );
}

export function PanelGestor() {
  const { datos, cargando, error, recargar } = useConsultaApi(obtenerPanel, []);

  if (cargando) return <Cargando texto="Cargando el panel…" />;
  if (error) return <BloqueError error={error} onReintentar={recargar} />;
  if (!datos) return null;

  const { gestor, indicadores } = datos;
  const estados = indicadores.usuarios.estados;
  const roles = indicadores.usuarios.roles;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-primario">
          Panel administrativo
        </p>
        <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
          Bienvenido, {gestor.nombre} {gestor.apellido ?? ""}
        </h1>
        <p className="text-base text-texto">
          Perfil de acceso:{" "}
          <span className="font-semibold text-titulo">
            {textoPerfil(gestor.perfil)}
          </span>
          . {gestor.perfil === "revisor"
            ? "Puedes consultar la información; las acciones de escritura están reservadas al administrador."
            : "Puedes administrar cuentas, validar organizaciones y consultar la auditoría."}
        </p>
      </section>

      <Tarjeta>
        <TarjetaEncabezado className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-titulo">Cuentas de usuario</h2>
            <p className="mt-1 text-sm text-texto">
              Total registrado: {estados.total}
            </p>
          </div>
          <Link
            href="/gestor/usuarios"
            className="text-sm font-semibold text-primario hover:underline"
          >
            Ver cuentas →
          </Link>
        </TarjetaEncabezado>
        <TarjetaCuerpo className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Indicador etiqueta="Total" valor={estados.total} />
          <Indicador etiqueta="Activas" valor={estados.activas} tono="exito" />
          <Indicador
            etiqueta="Pendientes"
            valor={estados.pendientesActivacion}
            tono="pendiente"
          />
          <Indicador
            etiqueta="Suspendidas"
            valor={estados.suspendidas}
            tono="peligro"
          />
          <Indicador etiqueta="Inactivas" valor={estados.inactivas} />
        </TarjetaCuerpo>
      </Tarjeta>

      <div className="grid gap-4 md:grid-cols-2">
        <Tarjeta>
          <TarjetaEncabezado>
            <h2 className="text-base font-bold text-titulo">Cuentas por rol</h2>
          </TarjetaEncabezado>
          <TarjetaCuerpo className="grid grid-cols-3 gap-3">
            <Indicador etiqueta="Comerciantes" valor={roles.comerciante} />
            <Indicador etiqueta="Organizadores" valor={roles.organizador} />
            <Indicador etiqueta="Gestores" valor={roles.gestor} />
          </TarjetaCuerpo>
        </Tarjeta>

        <Tarjeta>
          <TarjetaEncabezado>
            <h2 className="text-base font-bold text-titulo">Trámites</h2>
          </TarjetaEncabezado>
          <TarjetaCuerpo className="grid grid-cols-3 gap-3">
            <Indicador
              etiqueta="Solicitudes"
              valor={indicadores.solicitudes.total}
            />
            <Indicador etiqueta="Permisos" valor={indicadores.permisos.total} />
            <Indicador etiqueta="Ferias" valor={indicadores.ferias.total} />
          </TarjetaCuerpo>
        </Tarjeta>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Tarjeta>
          <TarjetaEncabezado>
            <h2 className="text-base font-bold text-titulo">
              Solicitudes por estado
            </h2>
          </TarjetaEncabezado>
          <TarjetaCuerpo className="flex flex-col gap-2 text-sm">
            {Object.entries(indicadores.solicitudes.porEstado).map(
              ([estado, total]) => (
                <div
                  key={estado}
                  className="flex items-center justify-between border-b border-borde pb-2 last:border-0 last:pb-0"
                >
                  <span className="capitalize">{estado.replaceAll("_", " ")}</span>
                  <span className="font-semibold text-titulo">{total}</span>
                </div>
              ),
            )}
          </TarjetaCuerpo>
        </Tarjeta>

        <Tarjeta>
          <TarjetaEncabezado>
            <h2 className="text-base font-bold text-titulo">
              Permisos y ferias
            </h2>
          </TarjetaEncabezado>
          <TarjetaCuerpo className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="mb-2 font-semibold text-titulo">Permisos</p>
              {Object.entries(indicadores.permisos.porEstado).map(
                ([estado, total]) => (
                  <div key={estado} className="flex justify-between py-0.5">
                    <span className="capitalize">{estado}</span>
                    <span className="font-semibold text-titulo">{total}</span>
                  </div>
                ),
              )}
            </div>
            <div>
              <p className="mb-2 font-semibold text-titulo">Ferias</p>
              {Object.entries(indicadores.ferias.porEstado).map(
                ([estado, total]) => (
                  <div key={estado} className="flex justify-between py-0.5">
                    <span className="capitalize">{estado}</span>
                    <span className="font-semibold text-titulo">{total}</span>
                  </div>
                ),
              )}
            </div>
          </TarjetaCuerpo>
        </Tarjeta>
      </div>

      <Tarjeta>
        <TarjetaCuerpo className="flex flex-wrap gap-3">
          <Link
            href="/gestor/usuarios"
            className="rounded-lg bg-primario px-4 py-2.5 text-sm font-semibold text-white hover:bg-primario-hover"
          >
            Gestionar usuarios
          </Link>
          <Link
            href="/gestor/comerciantes"
            className="rounded-lg border border-primario px-4 py-2.5 text-sm font-semibold text-primario hover:bg-primario-suave"
          >
            Ver comerciantes
          </Link>
          <Link
            href="/gestor/organizaciones"
            className="rounded-lg border border-primario px-4 py-2.5 text-sm font-semibold text-primario hover:bg-primario-suave"
          >
            Revisar organizaciones
          </Link>
          {gestor.perfil === "administrador" ? (
            <Link
              href="/gestor/auditoria"
              className="rounded-lg border border-borde px-4 py-2.5 text-sm font-semibold text-texto hover:bg-fondo"
            >
              Consultar auditoría
            </Link>
          ) : null}
        </TarjetaCuerpo>
      </Tarjeta>
    </div>
  );
}
