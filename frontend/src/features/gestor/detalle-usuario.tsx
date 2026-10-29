"use client";

/* eslint-disable react-hooks/set-state-in-effect -- la corrección se hidrata con el detalle consultado */
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Campo, Selector } from "@/components/ui/campo";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import { EtiquetaEstado, textoDeEstado } from "@/components/ui/etiqueta";
import { AccionesModal, Modal } from "@/components/ui/modal";
import { Tabla, Td, Th } from "@/components/ui/tabla";
import { Tarjeta, TarjetaCuerpo, TarjetaEncabezado } from "@/components/ui/tarjeta";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import { useSesion } from "@/hooks/use-sesion";
import {
  ApiError,
  cambiarEstadoUsuario,
  comoApiError,
  corregirComerciante,
  obtenerUsuarioDetalle,
  reenviarInvitacionGestor,
} from "@/lib/api-client";
import {
  formatearFecha,
  formatearFechaHora,
  nombreCompleto,
  textoCategoria,
  textoPerfil,
  textoRol,
} from "@/lib/formato";
import {
  validarActividadComercial,
  validarDocumento,
} from "@/lib/validaciones";
import type {
  CategoriaComercio,
  EstadoUsuario,
  TipoDocumento,
} from "@/types/api";

type Pestana = "datos" | "solicitudes" | "permisos";
type EstadoGestionable = "activa" | "suspendida" | "inactiva";

export function DetalleUsuario({ id }: { id: string }) {
  const { usuario: gestor } = useSesion();
  const esAdministrador = gestor?.perfil === "administrador";

  const { datos, cargando, error, recargar } = useConsultaApi(
    () => obtenerUsuarioDetalle(id),
    [id],
  );

  const [pestana, setPestana] = useState<Pestana>("datos");
  const [modalEstado, setModalEstado] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState<EstadoGestionable>("suspendida");
  const [motivo, setMotivo] = useState("");
  const [enviandoEstado, setEnviandoEstado] = useState(false);
  const [errorAccion, setErrorAccion] = useState<ApiError | null>(null);
  const [exitoAccion, setExitoAccion] = useState<string | null>(null);

  const [modalReenvio, setModalReenvio] = useState(false);
  const [enviandoReenvio, setEnviandoReenvio] = useState(false);

  const [documento, setDocumento] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>("CC");
  const [actividadComercial, setActividadComercial] = useState("");
  const [categoria, setCategoria] = useState<CategoriaComercio>("formal");
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [errorCorreccion, setErrorCorreccion] = useState<ApiError | null>(null);
  const [exitoCorreccion, setExitoCorreccion] = useState<string | null>(null);

  useEffect(() => {
    if (!datos || datos.usuario.rol !== "comerciante") return;
    setDocumento(datos.usuario.documento ?? "");
    setTipoDocumento(
      (datos.usuario.tipoDocumento as TipoDocumento | null) ?? "CC",
    );
    setActividadComercial(
      datos.usuario.perfilComercial?.actividadComercial ?? "",
    );
    setCategoria(datos.usuario.perfilComercial?.categoria ?? "formal");
  }, [datos]);

  if (cargando) return <Cargando texto="Cargando el detalle de la cuenta…" />;
  if (error) return <BloqueError error={error} onReintentar={recargar} />;
  if (!datos) return null;

  const cuenta = datos.usuario;
  const esPropiaCuenta = gestor?.id === cuenta.id;
  const esGestorPendiente =
    cuenta.rol === "gestor" && cuenta.estado === "pendiente_activacion";
  const puedeCambiarEstado =
    esAdministrador && !esGestorPendiente && !esPropiaCuenta;

  async function confirmarEstado() {
    if (enviandoEstado) return;
    if (
      (nuevoEstado === "suspendida" || nuevoEstado === "inactiva") &&
      motivo.trim() !== "" &&
      motivo.trim().length < 3
    ) {
      setErrorAccion(new ApiError(400, "El motivo debe tener al menos 3 caracteres."));
      return;
    }

    setEnviandoEstado(true);
    setErrorAccion(null);
    setExitoAccion(null);
    try {
      const respuesta = await cambiarEstadoUsuario(id, {
        estado: nuevoEstado,
        ...(motivo.trim() === "" ? {} : { motivo: motivo.trim() }),
      });
      setExitoAccion(respuesta.mensaje);
      setModalEstado(false);
      setMotivo("");
      recargar();
    } catch (capturado) {
      setErrorAccion(comoApiError(capturado));
    } finally {
      setEnviandoEstado(false);
    }
  }

  async function confirmarReenvio() {
    if (enviandoReenvio) return;
    setEnviandoReenvio(true);
    setErrorAccion(null);
    setExitoAccion(null);
    try {
      const respuesta = await reenviarInvitacionGestor(id);
      setExitoAccion(respuesta.mensaje);
      setModalReenvio(false);
    } catch (capturado) {
      setErrorAccion(comoApiError(capturado));
    } finally {
      setEnviandoReenvio(false);
    }
  }

  async function guardarCorreccion(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (corrigiendo) return;

    const errorDocumento =
      documento.trim() === "" ? null : validarDocumento(documento);
    const errorActividad =
      actividadComercial.trim() === ""
        ? "La actividad comercial es obligatoria."
        : validarActividadComercial(actividadComercial);

    if (errorDocumento || errorActividad) {
      setErrorCorreccion(
        new ApiError(400, errorDocumento ?? errorActividad ?? "Revisa los datos."),
      );
      return;
    }

    setCorrigiendo(true);
    setErrorCorreccion(null);
    setExitoCorreccion(null);
    try {
      const respuesta = await corregirComerciante(id, {
        ...(documento.trim() === "" ? {} : { documento: documento.trim() }),
        tipoDocumento,
        actividadComercial: actividadComercial.trim(),
        categoria,
      });
      setExitoCorreccion(respuesta.mensaje);
      recargar();
    } catch (capturado) {
      setErrorCorreccion(comoApiError(capturado));
    } finally {
      setCorrigiendo(false);
    }
  }

  function abrirCambioEstado(estado: EstadoGestionable) {
    setNuevoEstado(estado);
    setMotivo("");
    setErrorAccion(null);
    setModalEstado(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/gestor/usuarios"
          className="text-sm font-semibold text-primario hover:underline"
        >
          ← Volver al listado
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
              {nombreCompleto(cuenta.nombre, cuenta.apellido)}
            </h1>
            <p className="mt-1 text-sm text-texto">
              {textoRol(cuenta.rol)} · {cuenta.correo}
            </p>
          </div>
          <EtiquetaEstado estado={cuenta.estado} />
        </div>
      </div>

      {exitoAccion ? <Alerta tono="exito">{exitoAccion}</Alerta> : null}
      {errorAccion && !modalEstado && !modalReenvio ? (
        <Alerta tono="error">{errorAccion.mensaje}</Alerta>
      ) : null}

      {esAdministrador ? (
        <Tarjeta>
          <TarjetaCuerpo className="flex flex-wrap items-center gap-2">
            <span className="mr-2 text-sm font-semibold text-titulo">
              Acciones de administrador:
            </span>
            <Boton
              tamano="sm"
              variante="contorno"
              onClick={() => abrirCambioEstado("activa")}
              disabled={cuenta.estado === "activa" || !puedeCambiarEstado}
            >
              Activar
            </Boton>
            <Boton
              tamano="sm"
              variante="peligro"
              onClick={() => abrirCambioEstado("suspendida")}
              disabled={cuenta.estado === "suspendida" || !puedeCambiarEstado}
            >
              Suspender
            </Boton>
            <Boton
              tamano="sm"
              variante="peligro"
              onClick={() => abrirCambioEstado("inactiva")}
              disabled={cuenta.estado === "inactiva" || !puedeCambiarEstado}
            >
              Inactivar
            </Boton>
            {esGestorPendiente ? (
              <Boton
                tamano="sm"
                variante="contorno"
                onClick={() => {
                  setErrorAccion(null);
                  setModalReenvio(true);
                }}
              >
                Reenviar invitación
              </Boton>
            ) : null}
            {esPropiaCuenta ? (
              <span className="text-xs text-tenue">
                No puedes cambiar el estado de tu propia cuenta.
              </span>
            ) : null}
            {esGestorPendiente ? (
              <span className="text-xs text-tenue">
                El gestor debe completar el primer acceso antes de cambiar su
                estado.
              </span>
            ) : null}
          </TarjetaCuerpo>
        </Tarjeta>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-borde">
        {(
          [
            ["datos", "Datos"],
            ["solicitudes", `Solicitudes (${datos.totales.solicitudes})`],
            ["permisos", `Permisos (${datos.totales.permisos})`],
          ] as const
        ).map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setPestana(valor)}
            aria-current={pestana === valor ? "page" : undefined}
            className={
              pestana === valor
                ? "-mb-px border-b-2 border-primario px-4 py-2.5 text-sm font-semibold text-primario"
                : "-mb-px border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-texto hover:text-titulo"
            }
          >
            {texto}
          </button>
        ))}
      </div>

      {pestana === "datos" ? (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Tarjeta>
            <TarjetaEncabezado>
              <h2 className="text-base font-bold text-titulo">Datos de la cuenta</h2>
            </TarjetaEncabezado>
            <TarjetaCuerpo className="grid gap-3 text-sm sm:grid-cols-2">
              <Dato etiqueta="Nombres" valor={cuenta.nombre} />
              <Dato etiqueta="Apellidos" valor={cuenta.apellido} />
              <Dato etiqueta="Correo" valor={cuenta.correo} />
              <Dato etiqueta="Teléfono" valor={cuenta.telefono} />
              <Dato etiqueta="Tipo de documento" valor={cuenta.tipoDocumento} />
              <Dato etiqueta="Documento" valor={cuenta.documento} />
              <Dato etiqueta="Rol" valor={textoRol(cuenta.rol)} />
              <Dato etiqueta="Estado" valor={textoDeEstado(cuenta.estado)} />
              <Dato etiqueta="Registro" valor={formatearFecha(cuenta.creadoEn)} />
              <Dato
                etiqueta="Última actualización"
                valor={formatearFecha(cuenta.actualizadoEn)}
              />
              {cuenta.perfilGestor ? (
                <Dato
                  etiqueta="Perfil de gestor"
                  valor={textoPerfil(cuenta.perfilGestor.perfil)}
                />
              ) : null}
            </TarjetaCuerpo>
          </Tarjeta>

          <div className="flex flex-col gap-6">
            {cuenta.perfilComercial ? (
              <Tarjeta>
                <TarjetaEncabezado>
                  <h2 className="text-base font-bold text-titulo">
                    Perfil comercial
                  </h2>
                </TarjetaEncabezado>
                <TarjetaCuerpo className="grid gap-3 text-sm">
                  <Dato
                    etiqueta="Actividad"
                    valor={cuenta.perfilComercial.actividadComercial}
                  />
                  <Dato
                    etiqueta="Categoría"
                    valor={textoCategoria(cuenta.perfilComercial.categoria)}
                  />
                  <Dato
                    etiqueta="Actualizado"
                    valor={formatearFecha(cuenta.perfilComercial.actualizadoEn)}
                  />
                </TarjetaCuerpo>
              </Tarjeta>
            ) : null}

            {cuenta.organizacion ? (
              <Tarjeta>
                <TarjetaEncabezado className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-titulo">
                    Organización
                  </h2>
                  <EtiquetaEstado estado={cuenta.organizacion.estado} />
                </TarjetaEncabezado>
                <TarjetaCuerpo className="grid gap-3 text-sm">
                  <Dato
                    etiqueta="Nombre"
                    valor={cuenta.organizacion.nombreOrganizacion}
                  />
                  <Dato etiqueta="NIT" valor={cuenta.organizacion.nit} />
                  <Dato
                    etiqueta="Representante"
                    valor={cuenta.organizacion.representante}
                  />
                  <Dato etiqueta="Tipo de feria" valor={cuenta.organizacion.tipoFeria} />
                  <Dato etiqueta="Contacto" valor={cuenta.organizacion.contacto} />
                  <Link
                    href={`/gestor/organizaciones/${cuenta.id}`}
                    className="font-semibold text-primario hover:underline"
                  >
                    Ver organización completa →
                  </Link>
                </TarjetaCuerpo>
              </Tarjeta>
            ) : null}
          </div>
        </div>
      ) : null}

      {pestana === "solicitudes" ? (
        <Tarjeta>
          {datos.solicitudes.length === 0 ? (
            <EstadoVacio
              titulo="Sin solicitudes"
              descripcion="Esta cuenta aún no tiene solicitudes registradas."
            />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <Th>Radicado</Th>
                  <Th>Estado</Th>
                  <Th>Actividad</Th>
                  <Th>Periodo</Th>
                  <Th>Espacio</Th>
                  <Th>Radicada</Th>
                </tr>
              </thead>
              <tbody>
                {datos.solicitudes.map((solicitud) => (
                  <tr key={solicitud.id}>
                    <Td className="font-semibold text-titulo">
                      {solicitud.numeroRadicado}
                    </Td>
                    <Td className="capitalize">
                      {solicitud.estado.replaceAll("_", " ")}
                    </Td>
                    <Td>{solicitud.actividad}</Td>
                    <Td>
                      {formatearFecha(solicitud.fechaInicio)} –{" "}
                      {formatearFecha(solicitud.fechaFin)}
                      <span className="block text-xs text-tenue">
                        {solicitud.horaInicio}–{solicitud.horaFin}
                      </span>
                    </Td>
                    <Td>{solicitud.espacio ?? "—"}</Td>
                    <Td>{formatearFechaHora(solicitud.radicadaEn)}</Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
        </Tarjeta>
      ) : null}

      {pestana === "permisos" ? (
        <Tarjeta>
          {datos.permisos.length === 0 ? (
            <EstadoVacio
              titulo="Sin permisos"
              descripcion="Esta cuenta aún no tiene permisos emitidos."
            />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <Th>Número</Th>
                  <Th>Estado</Th>
                  <Th>Categoría</Th>
                  <Th>Vigencia</Th>
                  <Th>Espacio</Th>
                  <Th>Cobro</Th>
                </tr>
              </thead>
              <tbody>
                {datos.permisos.map((permiso) => (
                  <tr key={permiso.id}>
                    <Td className="font-semibold text-titulo">{permiso.numero}</Td>
                    <Td className="capitalize">{permiso.estado}</Td>
                    <Td>{permiso.categoriaAutorizada}</Td>
                    <Td>
                      {formatearFecha(permiso.fechaInicio)} –{" "}
                      {formatearFecha(permiso.fechaFin)}
                    </Td>
                    <Td>{permiso.espacio ?? "—"}</Td>
                    <Td>
                      {permiso.cobro
                        ? `${permiso.cobro.valor} · ${permiso.cobro.estado}`
                        : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
        </Tarjeta>
      ) : null}

      {cuenta.rol === "comerciante" && cuenta.perfilComercial ? (
        <Tarjeta>
          <TarjetaEncabezado>
            <h2 className="text-base font-bold text-titulo">
              Corregir datos sensibles del comerciante
            </h2>
            <p className="mt-1 text-sm text-texto">
              Documento, tipo de documento, actividad y categoría. El cambio queda
              registrado en la auditoría.
            </p>
          </TarjetaEncabezado>
          <TarjetaCuerpo>
            <form onSubmit={guardarCorreccion} noValidate className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                  etiqueta="Documento"
                  value={documento}
                  onChange={(evento) => setDocumento(evento.target.value)}
                />
                <Selector
                  etiqueta="Tipo de documento"
                  value={tipoDocumento}
                  onChange={(evento) =>
                    setTipoDocumento(evento.target.value as TipoDocumento)
                  }
                >
                  <option value="CC">CC</option>
                  <option value="CE">CE</option>
                  <option value="TI">TI</option>
                  <option value="PP">PP</option>
                  <option value="NIT">NIT</option>
                </Selector>
                <Campo
                  etiqueta="Actividad comercial"
                  value={actividadComercial}
                  onChange={(evento) => setActividadComercial(evento.target.value)}
                  requerido
                />
                <Selector
                  etiqueta="Categoría"
                  value={categoria}
                  onChange={(evento) =>
                    setCategoria(evento.target.value as CategoriaComercio)
                  }
                >
                  <option value="formal">Formal</option>
                  <option value="informal">Informal</option>
                </Selector>
              </div>

              {errorCorreccion ? (
                <Alerta tono="error">{errorCorreccion.mensaje}</Alerta>
              ) : null}
              {exitoCorreccion ? (
                <Alerta tono="exito">{exitoCorreccion}</Alerta>
              ) : null}

              <div className="flex justify-end">
                <Boton type="submit" cargando={corrigiendo}>
                  Guardar corrección
                </Boton>
              </div>
            </form>
          </TarjetaCuerpo>
        </Tarjeta>
      ) : null}

      <Modal
        abierto={modalEstado}
        titulo={`Cambiar estado a «${textoDeEstado(nuevoEstado as EstadoUsuario)}»`}
        descripcion="El titular recibirá un correo con el motivo. El cambio quedará en la auditoría."
        onCerrar={() => setModalEstado(false)}
      >
        <div className="flex flex-col gap-4">
          {(nuevoEstado === "suspendida" || nuevoEstado === "inactiva") && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="motivo" className="text-sm font-medium text-titulo">
                Motivo
              </label>
              <textarea
                id="motivo"
                value={motivo}
                onChange={(evento) => setMotivo(evento.target.value)}
                rows={3}
                maxLength={300}
                placeholder="Explica el motivo de la suspensión o inactivación."
                className="w-full rounded-lg border border-borde bg-white px-3.5 py-2.5 text-base text-titulo focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primario"
              />
              <p className="text-xs text-tenue">
                Opcional. Entre 3 y 300 caracteres. Se incluye en el correo al
                titular.
              </p>
            </div>
          )}
          {errorAccion ? <Alerta tono="error">{errorAccion.mensaje}</Alerta> : null}
          <AccionesModal
            onCancelar={() => setModalEstado(false)}
            onConfirmar={confirmarEstado}
            textoConfirmar="Confirmar cambio"
            variante={nuevoEstado === "activa" ? "solido" : "peligro"}
            cargando={enviandoEstado}
          />
        </div>
      </Modal>

      <Modal
        abierto={modalReenvio}
        titulo="Reenviar invitación"
        descripcion="Se generará una nueva contraseña temporal y se enviará al correo institucional del gestor."
        onCerrar={() => setModalReenvio(false)}
      >
        <div className="flex flex-col gap-4">
          {errorAccion ? <Alerta tono="error">{errorAccion.mensaje}</Alerta> : null}
          <AccionesModal
            onCancelar={() => setModalReenvio(false)}
            onConfirmar={confirmarReenvio}
            textoConfirmar="Reenviar invitación"
            cargando={enviandoReenvio}
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
