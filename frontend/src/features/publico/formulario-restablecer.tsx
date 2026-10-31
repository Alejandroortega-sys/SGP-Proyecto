"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { IconoCheck } from "@/components/ui/iconos";
import { comoApiError, restablecerPassword, type ApiError } from "@/lib/api-client";
import { guardarCorreoPendiente, obtenerCorreoPendiente } from "@/lib/sesion";
import { CODIGO_6_RE, validarCodigo6, validarCorreo } from "@/lib/validaciones";
import {
  CamposSeguridadCuenta,
  hayErroresSeguridad,
  SEGURIDAD_VACIA,
  validarSeguridad,
  type ErroresSeguridad,
  type SeguridadCuenta,
} from "./campos-seguridad";

const VIGENCIA_CODIGO_MINUTOS = 2;

interface PropiedadesFormularioRestablecer {
  correoInicial?: string;
}

export function FormularioRestablecer({
  correoInicial = "",
}: PropiedadesFormularioRestablecer) {
  const router = useRouter();
  const [correo, setCorreo] = useState(
    () => correoInicial || obtenerCorreoPendiente() || "",
  );
  const [codigo, setCodigo] = useState("");
  const [seguridad, setSeguridad] = useState<SeguridadCuenta>(SEGURIDAD_VACIA);
  const [erroresSeguridad, setErroresSeguridad] = useState<ErroresSeguridad>({});
  const [errorCorreo, setErrorCorreo] = useState<string | null>(null);
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [exitoso, setExitoso] = useState(false);
  const correoEsEditable = correo === "";

  useEffect(() => {
    if (!exitoso) return;
    const temporizador = window.setTimeout(() => router.replace("/login"), 4000);
    return () => window.clearTimeout(temporizador);
  }, [exitoso, router]);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;

    const errorCorreoValido = correoEsEditable ? validarCorreo(correo) : null;
    const errorCodigoValido = validarCodigo6(codigo);
    const erroresClave = validarSeguridad(seguridad);

    setErrorCorreo(errorCorreoValido);
    setErrorCodigo(errorCodigoValido);
    setErroresSeguridad(erroresClave);

    if (
      errorCorreoValido ||
      errorCodigoValido ||
      hayErroresSeguridad(erroresClave)
    ) {
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      const correoNormalizado = correo.trim().toLowerCase();
      await restablecerPassword({
        correo: correoNormalizado,
        codigo,
        password: seguridad.password,
        confirmarPassword: seguridad.confirmarPassword,
      });
      guardarCorreoPendiente(correoNormalizado);
      setExitoso(true);
    } catch (capturado) {
      setError(comoApiError(capturado));
    } finally {
      setEnviando(false);
    }
  }

  if (exitoso) {
    return (
      <div className="flex flex-col gap-4">
        <Alerta tono="exito">
          <span className="flex gap-2">
            <IconoCheck className="mt-0.5 size-5 shrink-0" />
            <span>
              <strong>Contraseña actualizada correctamente.</strong>{" "}
              Ya puedes iniciar sesión con tu nueva contraseña. Te redirigimos
              en unos segundos.
            </span>
          </span>
        </Alerta>
        <Boton anchoCompleto onClick={() => router.replace("/login")}>
          Ir a iniciar sesión
        </Boton>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      <Alerta tono="informacion" conIcono={false}>
        El código de recuperación tiene una vigencia de{" "}
        {VIGENCIA_CODIGO_MINUTOS} minutos. Si expira, puedes solicitar uno nuevo
        desde el paso anterior.
      </Alerta>

      {correoEsEditable ? (
        <Campo
          etiqueta="Correo electrónico"
          type="email"
          name="correo"
          autoComplete="email"
          inputMode="email"
          placeholder="usuario@correo.com"
          requerido
          value={correo}
          onChange={(evento) => {
            setCorreo(evento.target.value);
            setErrorCorreo(null);
          }}
          error={errorCorreo}
        />
      ) : (
        <div className="rounded-lg border border-borde bg-fondo px-4 py-3 text-sm">
          <span className="block font-medium text-titulo">
            Correo electrónico
          </span>
          <span className="mt-0.5 block break-all text-texto">{correo}</span>
        </div>
      )}

      <Campo
        etiqueta="Código de verificación"
        name="codigo"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        maxLength={6}
        requerido
        value={codigo}
        onChange={(evento) => {
          setCodigo(evento.target.value.replace(/\D/g, "").slice(0, 6));
          setErrorCodigo(null);
        }}
        error={errorCodigo}
        ayuda="Son los 6 dígitos enviados a tu correo."
      />

      <CamposSeguridadCuenta
        seguridad={seguridad}
        errores={erroresSeguridad}
        onCambio={(actualizacion) => {
          setSeguridad((actual) => ({ ...actual, ...actualizacion }));
          setErroresSeguridad({});
        }}
      />

      {error ? (
        <Alerta tono={error.status === 429 ? "advertencia" : "error"}>
          {error.mensaje}
          {error.status === 429 && error.segundosEspera
            ? `\nEspera ${error.segundosEspera} segundos antes de reintentar.`
            : ""}
        </Alerta>
      ) : null}

      <Boton
        type="submit"
        anchoCompleto
        tamano="lg"
        cargando={enviando}
        disabled={!CODIGO_6_RE.test(codigo)}
      >
        Actualizar Contraseña e Iniciar Sesión
      </Boton>

      <p className="text-center text-sm text-texto">
        <Link
          href="/recuperar"
          className="font-medium text-primario hover:underline"
        >
          ← Solicitar otro código
        </Link>
      </p>
    </form>
  );
}
