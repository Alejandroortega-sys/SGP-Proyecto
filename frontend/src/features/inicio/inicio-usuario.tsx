"use client";

import Link from "next/link";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Cargando } from "@/components/ui/estado-vacio";
import { EtiquetaEstado } from "@/components/ui/etiqueta";
import { Tarjeta, TarjetaCuerpo, TarjetaEncabezado } from "@/components/ui/tarjeta";
import { useSesion } from "@/hooks/use-sesion";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import { obtenerPerfil } from "@/lib/api-client";
import { formatearFecha, textoCategoria } from "@/lib/formato";

export function InicioUsuario({ rol }: { rol: "comerciante" | "organizador" }) {
  const { usuario } = useSesion();
  const { datos: perfil, cargando, error, recargar } = useConsultaApi(
    obtenerPerfil,
    [],
  );

  if (cargando) return <Cargando texto="Cargando tu resumen…" />;
  if (error) return <BloqueError error={error} onReintentar={recargar} />;
  if (!perfil) return null;

  const organizacion = perfil.organizacion;
  const esOrganizador = rol === "organizador";

  return (
    <div className="flex flex-col gap-6">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-primario">
          {esOrganizador ? "Portal del organizador" : "Portal del comerciante"}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-titulo sm:text-3xl">
          Hola, {usuario?.nombre ?? perfil.datosPersonales.nombre}
        </h1>
        <p className="mt-2 max-w-2xl text-base text-texto">
          {esOrganizador
            ? "Consulta el estado de tu cuenta y de tu organización, y mantén tus datos al día."
            : "Consulta el estado de tu cuenta, tu actividad comercial y mantén tus datos de contacto actualizados."}
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Tarjeta>
          <TarjetaEncabezado>
            <h2 className="text-base font-bold text-titulo">Estado de la cuenta</h2>
          </TarjetaEncabezado>
          <TarjetaCuerpo className="flex flex-col gap-3 text-sm text-texto">
            <div className="flex items-center justify-between gap-3">
              <span>Estado</span>
              <EtiquetaEstado estado={perfil.seguridad.estado} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Correo</span>
              <span className="max-w-[60%] break-all text-right font-medium text-titulo">
                {perfil.seguridad.correo}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Registro</span>
              <span className="font-medium text-titulo">
                {formatearFecha(perfil.seguridad.creadoEn)}
              </span>
            </div>
          </TarjetaCuerpo>
        </Tarjeta>

        <Tarjeta>
          <TarjetaEncabezado>
            <h2 className="text-base font-bold text-titulo">
              {esOrganizador ? "Mi organización" : "Actividad comercial"}
            </h2>
          </TarjetaEncabezado>
          <TarjetaCuerpo className="flex flex-col gap-3 text-sm text-texto">
            {esOrganizador ? (
              organizacion ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span>Estado</span>
                    <EtiquetaEstado estado={organizacion.estado} />
                  </div>
                  <p className="font-medium text-titulo">
                    {organizacion.nombreOrganizacion}
                  </p>
                  <p>NIT {organizacion.nit}</p>
                  <Link
                    href="/organizador/mi-organizacion"
                    className="font-semibold text-primario hover:underline"
                  >
                    Ver mi organización →
                  </Link>
                </>
              ) : (
                <Alerta tono="advertencia" conIcono={false}>
                  Aún no has registrado tu organización.{" "}
                  <Link
                    href="/organizador/mi-organizacion"
                    className="font-semibold underline"
                  >
                    Regístrala aquí
                  </Link>
                  .
                </Alerta>
              )
            ) : perfil.actividadComercial ? (
              <>
                <p className="font-medium text-titulo">
                  {perfil.actividadComercial.actividadComercial}
                </p>
                <p>Categoría: {textoCategoria(perfil.actividadComercial.categoria)}</p>
                <p className="text-xs text-tenue">
                  Para corregir estos datos, contacta a la Secretaría de Gobierno.
                </p>
              </>
            ) : (
              <p>No hay actividad comercial registrada.</p>
            )}
          </TarjetaCuerpo>
        </Tarjeta>

        <Tarjeta>
          <TarjetaEncabezado>
            <h2 className="text-base font-bold text-titulo">Accesos rápidos</h2>
          </TarjetaEncabezado>
          <TarjetaCuerpo className="flex flex-col gap-2 text-sm">
            <Link
              href={esOrganizador ? "/organizador/perfil" : "/comerciante/perfil"}
              className="rounded-lg border border-borde px-3 py-2 font-medium text-titulo hover:bg-fondo"
            >
              Editar mis datos personales
            </Link>
            <Link
              href={esOrganizador ? "/organizador/perfil" : "/comerciante/perfil"}
              className="rounded-lg border border-borde px-3 py-2 font-medium text-titulo hover:bg-fondo"
            >
              Cambiar mi contraseña
            </Link>
            <Link
              href="/notificaciones"
              className="rounded-lg border border-borde px-3 py-2 font-medium text-titulo hover:bg-fondo"
            >
              Revisar notificaciones
            </Link>
          </TarjetaCuerpo>
        </Tarjeta>
      </div>

      <Tarjeta>
        <TarjetaCuerpo className="flex flex-col gap-2 text-sm text-texto">
          <p className="font-semibold text-titulo">Próximamente</p>
          <p>
            La solicitud de espacios, el calendario de ferias, los permisos con QR
            y los cobros estarán disponibles en los siguientes sprints.
          </p>
        </TarjetaCuerpo>
      </Tarjeta>
    </div>
  );
}
