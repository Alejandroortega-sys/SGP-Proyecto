"use client";

/* eslint-disable react-hooks/set-state-in-effect -- el formulario se hidrata con los datos del gestor */
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
  actualizarPerfilGestor,
  ApiError,
  cambiarPasswordGestor,
  comoApiError,
  obtenerPerfilGestor,
} from "@/lib/api-client";
import { formatearFecha, textoPerfil } from "@/lib/formato";
import { validarNombre, validarPassword, validarTelefono } from "@/lib/validaciones";

export function PerfilGestor() {
  const { datos, cargando, error, recargar } = useConsultaApi(
    obtenerPerfilGestor,
    [],
  );

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorDatos, setErrorDatos] = useState<ApiError | null>(null);
  const [exitoDatos, setExitoDatos] = useState<string | null>(null);

  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [errorPassword, setErrorPassword] = useState<ApiError | null>(null);
  const [exitoPassword, setExitoPassword] = useState<string | null>(null);

  useEffect(() => {
    if (!datos) return;
    setNombre(datos.nombre);
    setApellido(datos.apellido ?? "");
    setTelefono(datos.telefono ?? "");
  }, [datos]);

  async function guardarDatos(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    const errorNombre = validarNombre(nombre);
    const errorTelefono =
      telefono.trim() === "" ? null : validarTelefono(telefono);
    if (errorNombre || errorTelefono) {
      setErrorDatos(
        new ApiError(400, errorNombre ?? errorTelefono ?? "Revisa los datos."),
      );
      return;
    }

    setGuardando(true);
    setErrorDatos(null);
    setExitoDatos(null);
    try {
      await actualizarPerfilGestor({
        nombre: nombre.trim(),
        apellido: apellido.trim() === "" ? null : apellido.trim(),
        ...(telefono.trim() === "" ? {} : { telefono: telefono.trim() }),
      });
      setExitoDatos("Perfil actualizado correctamente.");
      recargar();
    } catch (capturado) {
      setErrorDatos(comoApiError(capturado));
    } finally {
      setGuardando(false);
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
      const respuesta = await cambiarPasswordGestor({
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

  if (cargando) return <Cargando texto="Cargando tu perfil de gestor…" />;
  if (error) return <BloqueError error={error} onReintentar={recargar} />;
  if (!datos) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
          Mi perfil de gestor
        </h1>
        <p className="mt-2 text-base text-texto">
          Actualiza tus datos de contacto y cambia tu contraseña institucional.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <Tarjeta>
            <TarjetaEncabezado>
              <h2 className="text-base font-bold text-titulo">Datos personales</h2>
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
                  />
                  <Campo
                    etiqueta="Correo institucional"
                    value={datos.correo}
                    disabled
                    ayuda="El correo institucional no se modifica desde este formulario."
                  />
                </div>

                {errorDatos ? <Alerta tono="error">{errorDatos.mensaje}</Alerta> : null}
                {exitoDatos ? <Alerta tono="exito">{exitoDatos}</Alerta> : null}

                <div className="flex justify-end">
                  <Boton type="submit" cargando={guardando}>
                    Guardar cambios
                  </Boton>
                </div>
              </form>
            </TarjetaCuerpo>
          </Tarjeta>

          <Tarjeta>
            <TarjetaEncabezado>
              <h2 className="text-base font-bold text-titulo">Cambiar contraseña</h2>
              <p className="mt-1 text-sm text-texto">
                Se enviará un aviso al correo institucional.
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
                {exitoPassword ? <Alerta tono="exito">{exitoPassword}</Alerta> : null}

                <div className="flex justify-end">
                  <Boton type="submit" variante="contorno" cargando={guardandoPassword}>
                    Cambiar contraseña
                  </Boton>
                </div>
              </form>
            </TarjetaCuerpo>
          </Tarjeta>
        </div>

        <Tarjeta>
          <TarjetaEncabezado>
            <h2 className="text-base font-bold text-titulo">Cuenta</h2>
          </TarjetaEncabezado>
          <TarjetaCuerpo className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>Perfil</span>
              <span className="font-semibold text-titulo">
                {textoPerfil(datos.perfil)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Estado</span>
              <EtiquetaEstado estado={datos.estado} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Creada</span>
              <span className="font-medium text-titulo">
                {formatearFecha(datos.creadoEn)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Actualizada</span>
              <span className="font-medium text-titulo">
                {formatearFecha(datos.actualizadoEn)}
              </span>
            </div>
          </TarjetaCuerpo>
        </Tarjeta>
      </div>
    </div>
  );
}
