"use client";

import Link from "next/link";
import { useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Cargando } from "@/components/ui/estado-vacio";
import { EtiquetaEstado } from "@/components/ui/etiqueta";
import { AccionesModal, Modal } from "@/components/ui/modal";
import { Tarjeta, TarjetaCuerpo, TarjetaEncabezado } from "@/components/ui/tarjeta";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import { useSesion } from "@/hooks/use-sesion";
import {
  ApiError,
  cambiarEstadoOrganizacion,
  comoApiError,
  obtenerOrganizacionGestor,
} from "@/lib/api-client";
import { formatearFecha, nombreCompleto } from "@/lib/formato";

type EstadoOrganizacionGestionable = "activa" | "suspendida";

export function DetalleOrganizacion({ id }: { id: string }) {
  const { usuario } = useSesion();
  const esAdministrador = usuario?.perfil === "administrador";

  const { datos, cargando, error, recargar } = useConsultaApi(
    () => obtenerOrganizacionGestor(id),
    [id],
  );

  const [modalAbierto, setModalAbierto] = useState(false);
  const [nuevoEstado, setNuevoEstado] =
    useState<EstadoOrganizacionGestionable>("activa");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<ApiError | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  if (cargando) return <Cargando texto="Cargando la organización…" />;
  if (error) return <BloqueError error={error} onReintentar={recargar} />;
  if (!datos) return null;

  const yaEnEstado = datos.estado === nuevoEstado;

  function abrir(estado: EstadoOrganizacionGestionable) {
    setNuevoEstado(estado);
    setMotivo("");
    setErrorAccion(null);
    setModalAbierto(true);
  }

  async function confirmar() {
    if (enviando) return;
    if (motivo.trim() !== "" && motivo.trim().length < 3) {
      setErrorAccion(new ApiError(400, "El motivo debe tener al menos 3 caracteres."));
      return;
    }

    setEnviando(true);
    setErrorAccion(null);
    setExito(null);
    try {
      const respuesta = await cambiarEstadoOrganizacion(id, {
        estado: nuevoEstado,
        ...(motivo.trim() === "" ? {} : { motivo: motivo.trim() }),
      });
      setExito(respuesta.mensaje ?? "Organización actualizada correctamente.");
      setModalAbierto(false);
      recargar();
    } catch (capturado) {
      setErrorAccion(comoApiError(capturado));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/gestor/organizaciones"
          className="text-sm font-semibold text-primario hover:underline"
        >
          ← Volver al listado
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
              {datos.nombreOrganizacion}
            </h1>
            <p className="mt-1 text-sm text-texto">NIT {datos.nit}</p>
          </div>
          <EtiquetaEstado estado={datos.estado} />
        </div>
      </div>

      {exito ? <Alerta tono="exito">{exito}</Alerta> : null}
      {errorAccion && !modalAbierto ? (
        <Alerta tono="error">{errorAccion.mensaje}</Alerta>
      ) : null}

      {esAdministrador ? (
        <Tarjeta>
          <TarjetaCuerpo className="flex flex-wrap items-center gap-2">
            <span className="mr-2 text-sm font-semibold text-titulo">
              Validación:
            </span>
            <Boton
              tamano="sm"
              onClick={() => abrir("activa")}
              disabled={datos.estado === "activa"}
            >
              Activar
            </Boton>
            <Boton
              tamano="sm"
              variante="peligro"
              onClick={() => abrir("suspendida")}
              disabled={datos.estado === "suspendida"}
            >
              Suspender
            </Boton>
          </TarjetaCuerpo>
        </Tarjeta>
      ) : (
        <Alerta tono="informacion" conIcono={false}>
          Como revisor puedes consultar la organización, pero solo un
          administrador puede activarla o suspenderla.
        </Alerta>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta>
          <TarjetaEncabezado>
            <h2 className="text-base font-bold text-titulo">
              Datos de la organización
            </h2>
          </TarjetaEncabezado>
          <TarjetaCuerpo className="grid gap-3 text-sm sm:grid-cols-2">
            <Dato etiqueta="Nombre" valor={datos.nombreOrganizacion} />
            <Dato etiqueta="NIT" valor={datos.nit} />
            <Dato etiqueta="Representante" valor={datos.representante} />
            <Dato etiqueta="Tipo de feria" valor={datos.tipoFeria} />
            <Dato etiqueta="Contacto" valor={datos.contacto} />
            <Dato
              etiqueta="Validada en"
              valor={datos.validadoEn ? formatearFecha(datos.validadoEn) : null}
            />
          </TarjetaCuerpo>
        </Tarjeta>

        <Tarjeta>
          <TarjetaEncabezado>
            <h2 className="text-base font-bold text-titulo">Organizador</h2>
          </TarjetaEncabezado>
          <TarjetaCuerpo className="grid gap-3 text-sm sm:grid-cols-2">
            <Dato
              etiqueta="Nombre"
              valor={nombreCompleto(datos.nombre, datos.apellido)}
            />
            <Dato etiqueta="Correo" valor={datos.correo} />
            <Dato etiqueta="Teléfono" valor={datos.telefono} />
            <Dato etiqueta="Registro" valor={formatearFecha(datos.creadoEn)} />
            <Link
              href={`/gestor/usuarios/${datos.usuarioId}`}
              className="font-semibold text-primario hover:underline sm:col-span-2"
            >
              Ver cuenta del organizador →
            </Link>
          </TarjetaCuerpo>
        </Tarjeta>
      </div>

      <Modal
        abierto={modalAbierto}
        titulo={nuevoEstado === "activa" ? "Activar organización" : "Suspender organización"}
        descripcion={
          nuevoEstado === "activa"
            ? "La organización quedará habilitada para operar en la plataforma."
            : "La organización quedará suspendida y se notificará al organizador."
        }
        onCerrar={() => setModalAbierto(false)}
      >
        <div className="flex flex-col gap-4">
          {nuevoEstado === "suspendida" ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="motivo-org" className="text-sm font-medium text-titulo">
                Motivo
              </label>
              <textarea
                id="motivo-org"
                value={motivo}
                onChange={(evento) => setMotivo(evento.target.value)}
                rows={3}
                maxLength={300}
                placeholder="Explica el motivo de la suspensión."
                className="w-full rounded-lg border border-borde bg-white px-3.5 py-2.5 text-base text-titulo focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primario"
              />
              <p className="text-xs text-tenue">
                Opcional. Entre 3 y 300 caracteres. Se notificará al organizador.
              </p>
            </div>
          ) : null}
          {errorAccion ? <Alerta tono="error">{errorAccion.mensaje}</Alerta> : null}
          <AccionesModal
            onCancelar={() => setModalAbierto(false)}
            onConfirmar={confirmar}
            textoConfirmar={nuevoEstado === "activa" ? "Activar" : "Suspender"}
            variante={nuevoEstado === "activa" ? "solido" : "peligro"}
            cargando={enviando}
            deshabilitado={yaEnEstado}
          />
        </div>
      </Modal>
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-tenue">
        {etiqueta}
      </p>
      <p className="mt-0.5 break-words font-medium text-titulo">{valor || "—"}</p>
    </div>
  );
}
