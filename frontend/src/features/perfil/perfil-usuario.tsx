"use client";

/* eslint-disable react-hooks/set-state-in-effect -- el formulario se hidrata con los datos del perfil */
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Campo, CampoPassword } from "@/components/ui/campo";
import { Cargando } from "@/components/ui/estado-vacio";
import { EtiquetaEstado } from "@/components/ui/etiqueta";
import { Tarjeta, TarjetaCuerpo, TarjetaEncabezado } from "@/components/ui/tarjeta";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import {
  actualizarPerfil,
  ApiError,
  cambiarPasswordPerfil,
  comoApiError,
  obtenerPerfil,
} from "@/lib/api-client";
import { formatearFecha, textoCategoria } from "@/lib/formato";
import { validarNombre, validarPassword, validarTelefono } from "@/lib/validaciones";

export function PerfilUsuario({ rol }: { rol: "comerciante" | "organizador" }) {
  const { datos: perfil, cargando, error, recargar } = useConsultaApi(
    obtenerPerfil,
    [],
  );

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [errorDatos, setErrorDatos] = useState<ApiError | null>(null);
  const [exitoDatos, setExitoDatos] = useState<string | null>(null);

  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [errorPassword, setErrorPassword] = useState<ApiError | null>(null);
  const [exitoPassword, setExitoPassword] = useState<string | null>(null);

  useEffect(() => {
    if (!perfil) return;
    setNombre(perfil.datosPersonales.nombre);
    setApellido(perfil.datosPersonales.apellido ?? "");
    setTelefono(perfil.datosPersonales.telefono ?? "");
  }, [perfil]);

  async function guardarDatos(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardandoDatos) return;

    const errorNombre = validarNombre(nombre);
    const errorTelefono =
      telefono.trim() === "" ? null : validarTelefono(telefono);
    if (errorNombre || errorTelefono) {
      setErrorDatos(
        new ApiError(400, errorNombre ?? errorTelefono ?? "Revisa los datos."),
      );
      return;
    }

    setGuardandoDatos(true);
    setErrorDatos(null);
    setExitoDatos(null);
    try {
      await actualizarPerfil({
        nombre: nombre.trim(),
        apellido: apellido.trim() === "" ? null : apellido.trim(),
        ...(telefono.trim() === "" ? {} : { telefono: telefono.trim() }),
      });
      setExitoDatos("Datos personales actualizados correctamente.");
      recargar();
    } catch (capturado) {
      setErrorDatos(comoApiError(capturado));
    } finally {
      setGuardandoDatos(false);
    }
  }

  async function guardarPassword(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardandoPassword) return;

    const errorActual =
      passwordActual === "" ? "Ingresa tu contraseña actual." : null;
    const errorNueva = validarPassword(passwordNueva);
    const errorConfirmacion =
      confirmarPassword !== passwordNueva
        ? "Las contraseñas no coinciden."
        : confirmarPassword === ""
          ? "Confirma tu nueva contraseña."
          : null;

    if (errorActual || errorNueva || errorConfirmacion) {
      setErrorPassword(
        new ApiError(
          400,
          errorActual ?? errorNueva ?? errorConfirmacion ?? "Revisa los datos.",
        ),
      );
      return;
    }

    setGuardandoPassword(true);
    setErrorPassword(null);
    setExitoPassword(null);
    try {
      const respuesta = await cambiarPasswordPerfil({
        passwordActual,
        passwordNueva,
        confirmarPassword,
      });
      setExitoPassword(respuesta.mensaje);
      setPasswordActual("");
      setPasswordNueva("");
      setConfirmarPassword("");
    } catch (capturado) {
      setErrorPassword(comoApiError(capturado));
    } finally {
      setGuardandoPassword(false);
    }
  }

  if (cargando) return <Cargando texto="Cargando tu perfil…" />;
  if (error) return <BloqueError error={error} onReintentar={recargar} />;
  if (!perfil) return null;

  const esOrganizador = rol === "organizador";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">Mi perfil</h1>
        <p className="mt-2 text-base text-texto">
          Consulta y actualiza tus datos personales, revisa el estado de tu cuenta
          y cambia tu contraseña.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <Tarjeta>
            <TarjetaEncabezado>
              <h2 className="text-base font-bold text-titulo">Datos personales</h2>
              <p className="mt-1 text-sm text-texto">
                Puedes editar tu nombre, apellido y teléfono.
              </p>
            </TarjetaEncabezado>
            <TarjetaCuerpo>
              <form onSubmit={guardarDatos} noValidate className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo
                    etiqueta="Nombres"
                    value={nombre}
                    onChange={(evento) => setNombre(evento.target.value)}
                    requerido
                  />
                  <Campo
                    etiqueta="Apellidos"
                    value={apellido}
                    onChange={(evento) => setApellido(evento.target.value)}
                  />
                  <Campo
                    etiqueta="Teléfono"
                    type="tel"
                    value={telefono}
                    onChange={(evento) => setTelefono(evento.target.value)}
                    ayuda="Formato: +57 300 123 4567"
                  />
                  <Campo
                    etiqueta="Correo electrónico"
                    value={perfil.seguridad.correo}
                    disabled
                    ayuda="El cambio de correo requiere verificación y aún no está disponible."
                  />
                  <Campo
                    etiqueta="Tipo de documento"
                    value={perfil.datosPersonales.tipoDocumento ?? "—"}
                    disabled
                  />
                  <Campo
                    etiqueta="Número de documento"
                    value={perfil.datosPersonales.documento ?? "—"}
                    disabled
                    ayuda="Solo un gestor municipal puede corregir el documento."
                  />
                </div>

                {errorDatos ? <Alerta tono="error">{errorDatos.mensaje}</Alerta> : null}
                {exitoDatos ? <Alerta tono="exito">{exitoDatos}</Alerta> : null}

                <div className="flex justify-end">
                  <Boton type="submit" cargando={guardandoDatos}>
                    Guardar cambios
                  </Boton>
                </div>
              </form>
            </TarjetaCuerpo>
          </Tarjeta>

          <Tarjeta>
            <TarjetaEncabezado>
              <h2 className="text-base font-bold text-titulo">Seguridad</h2>
              <p className="mt-1 text-sm text-texto">
                La nueva contraseña debe tener entre 8 y 128 caracteres e incluir
                al menos un número.
              </p>
            </TarjetaEncabezado>
            <TarjetaCuerpo>
              <form onSubmit={guardarPassword} noValidate className="flex flex-col gap-4">
                <CampoPassword
                  etiqueta="Contraseña actual"
                  autoComplete="current-password"
                  value={passwordActual}
                  onChange={(evento) => setPasswordActual(evento.target.value)}
                  requerido
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <CampoPassword
                    etiqueta="Nueva contraseña"
                    autoComplete="new-password"
                    value={passwordNueva}
                    onChange={(evento) => setPasswordNueva(evento.target.value)}
                    requerido
                  />
                  <CampoPassword
                    etiqueta="Confirmar nueva contraseña"
                    autoComplete="new-password"
                    value={confirmarPassword}
                    onChange={(evento) => setConfirmarPassword(evento.target.value)}
                    requerido
                  />
                </div>

                {errorPassword ? (
                  <Alerta tono="error">{errorPassword.mensaje}</Alerta>
                ) : null}
                {exitoPassword ? (
                  <Alerta tono="exito">{exitoPassword}</Alerta>
                ) : null}

                <div className="flex justify-end">
                  <Boton type="submit" variante="contorno" cargando={guardandoPassword}>
                    Cambiar contraseña
                  </Boton>
                </div>
              </form>
            </TarjetaCuerpo>
          </Tarjeta>
        </div>

        <div className="flex flex-col gap-6">
          <Tarjeta>
            <TarjetaEncabezado>
              <h2 className="text-base font-bold text-titulo">Estado de la cuenta</h2>
            </TarjetaEncabezado>
            <TarjetaCuerpo className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>Estado</span>
                <EtiquetaEstado estado={perfil.seguridad.estado} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Creada</span>
                <span className="font-medium text-titulo">
                  {formatearFecha(perfil.seguridad.creadoEn)}
                </span>
              </div>
            </TarjetaCuerpo>
          </Tarjeta>

          {esOrganizador ? (
            <Tarjeta>
              <TarjetaEncabezado>
                <h2 className="text-base font-bold text-titulo">Mi organización</h2>
                <p className="mt-1 text-sm text-texto">
                  Los datos de la organización se editan en su propia sección.
                </p>
              </TarjetaEncabezado>
              <TarjetaCuerpo className="flex flex-col gap-3 text-sm">
                {perfil.organizacion ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span>Estado</span>
                      <EtiquetaEstado estado={perfil.organizacion.estado} />
                    </div>
                    <p className="font-medium text-titulo">
                      {perfil.organizacion.nombreOrganizacion}
                    </p>
                    <p>NIT {perfil.organizacion.nit}</p>
                    <p>Representante: {perfil.organizacion.representante}</p>
                    <p>Tipo de feria: {perfil.organizacion.tipoFeria}</p>
                    {perfil.organizacion.contacto ? (
                      <p>Contacto: {perfil.organizacion.contacto}</p>
                    ) : null}
                  </>
                ) : (
                  <Alerta tono="advertencia" conIcono={false}>
                    Aún no has registrado tu organización.
                  </Alerta>
                )}
                <Link
                  href="/organizador/mi-organizacion"
                  className="font-semibold text-primario hover:underline"
                >
                  Gestionar mi organización →
                </Link>
              </TarjetaCuerpo>
            </Tarjeta>
          ) : (
            <Tarjeta>
              <TarjetaEncabezado>
                <h2 className="text-base font-bold text-titulo">
                  Actividad comercial
                </h2>
              </TarjetaEncabezado>
              <TarjetaCuerpo className="flex flex-col gap-3 text-sm">
                {perfil.actividadComercial ? (
                  <>
                    <p className="font-medium text-titulo">
                      {perfil.actividadComercial.actividadComercial}
                    </p>
                    <p>
                      Categoría:{" "}
                      {textoCategoria(perfil.actividadComercial.categoria)}
                    </p>
                    <p className="text-xs text-tenue">
                      Estos campos son de solo lectura. Para corregirlos, contacta a
                      la Secretaría de Gobierno.
                    </p>
                  </>
                ) : (
                  <p>No hay actividad comercial registrada.</p>
                )}
              </TarjetaCuerpo>
            </Tarjeta>
          )}
        </div>
      </div>
    </div>
  );
}
