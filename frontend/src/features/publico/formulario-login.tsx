"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { CampoPassword, Campo } from "@/components/ui/campo";
import { IconoCandado } from "@/components/ui/iconos";
import { comoApiError, iniciarSesion, type ApiError } from "@/lib/api-client";
import { esSesionPrimerAcceso, guardarCorreoPendiente } from "@/lib/sesion";
import { validarCorreo } from "@/lib/validaciones";

export function FormularioLogin() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [erroresCampo, setErroresCampo] = useState<{
    correo?: string | null;
    password?: string | null;
  }>({});
  const [error, setError] = useState<ApiError | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    if (espera <= 0) return;
    const temporizador = window.setInterval(() => {
      setEspera((valor) => (valor <= 1 ? 0 : valor - 1));
    }, 1000);
    return () => window.clearInterval(temporizador);
  }, [espera]);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando || espera > 0) return;

    const errorCorreo = validarCorreo(correo);
    const errorPassword =
      password === "" ? "Ingresa tu contraseña." : null;

    setErroresCampo({ correo: errorCorreo, password: errorPassword });
    if (errorCorreo || errorPassword) return;

    setEnviando(true);
    setError(null);

    try {
      const respuesta = await iniciarSesion({
        correo: correo.trim().toLowerCase(),
        password,
      });

      if (esSesionPrimerAcceso(respuesta)) {
        guardarCorreoPendiente(respuesta.correo);
        router.push("/primer-acceso");
        return;
      }

      router.replace("/");
    } catch (capturado) {
      const err = comoApiError(capturado);
      setError(err);
      if (err.status === 429 && err.segundosEspera) setEspera(err.segundosEspera);
      setEnviando(false);
    }
  }

  const bloqueado = error?.status === 423;
  const advertencia = error?.status === 423 || error?.status === 429;

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      <Campo
        etiqueta="Correo electrónico"
        type="email"
        name="correo"
        autoComplete="email"
        inputMode="email"
        placeholder="usuario@correo.com"
        requerido
        value={correo}
        onChange={(evento) => setCorreo(evento.target.value)}
        error={erroresCampo.correo ?? null}
      />

      <CampoPassword
        etiqueta="Contraseña"
        name="password"
        autoComplete="current-password"
        placeholder="••••••••"
        requerido
        value={password}
        onChange={(evento) => setPassword(evento.target.value)}
        error={erroresCampo.password ?? null}
        accionEtiqueta={
          <Link
            href="/recuperar"
            className="text-sm font-medium text-primario hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        }
      />

      {error ? (
        <Alerta tono={advertencia ? "advertencia" : "error"}>
          {bloqueado ? (
            <span className="flex gap-2">
              <IconoCandado className="mt-0.5 size-5 shrink-0" />
              <span>{error.mensaje}</span>
            </span>
          ) : (
            error.mensaje
          )}
          {error.status === 429 && espera > 0 ? (
            <span className="mt-1 block font-semibold">
              Espera {espera} {espera === 1 ? "segundo" : "segundos"} antes de
              reintentar.
            </span>
          ) : null}
          {error.status === 403 ? (
            <span className="mt-1 block">
              ¿Tu cuenta está pendiente de activación?{" "}
              <Link
                href="/activar"
                className="font-semibold underline"
              >
                Actívala aquí
              </Link>
              .
            </span>
          ) : null}
        </Alerta>
      ) : null}

      <Boton
        type="submit"
        anchoCompleto
        tamano="lg"
        cargando={enviando}
        disabled={espera > 0}
      >
        {espera > 0 ? `Reintentar en ${espera}s` : "Iniciar Sesión"}
      </Boton>

      <p className="text-center text-sm text-texto">
        ¿No tienes una cuenta aún?{" "}
        <Link href="/registro" className="font-semibold text-primario hover:underline">
          Regístrate aquí
        </Link>
      </p>
    </form>
  );
}
