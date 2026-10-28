"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Campo, CampoPassword } from "@/components/ui/campo";
import { IconoEscudo } from "@/components/ui/iconos";
import {
  comoApiError,
  completarPrimerAcceso,
  type ApiError,
} from "@/lib/api-client";
import { guardarCorreoPendiente, obtenerCorreoPendiente } from "@/lib/sesion";
import { validarCorreo, validarPassword } from "@/lib/validaciones";

interface EstadoCampo {
  passwordActual: string | null;
  password: string | null;
  confirmarPassword: string | null;
}

export function FormularioPrimerAcceso({
  correoInicial = "",
}: {
  correoInicial?: string;
}) {
  const router = useRouter();
  const [correo, setCorreo] = useState(
    () => correoInicial || obtenerCorreoPendiente() || "",
  );
  const [passwordActual, setPasswordActual] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [errores, setErrores] = useState<EstadoCampo>({
    passwordActual: null,
    password: null,
    confirmarPassword: null,
  });
  const [errorCorreo, setErrorCorreo] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;

    const errorCorreoValido = validarCorreo(correo);
    const errorPasswordActual =
      passwordActual === "" ? "Ingresa tu contraseña temporal." : null;
    const errorPassword = validarPassword(password);
    const errorConfirmacion =
      confirmarPassword !== password
        ? "Las contraseñas no coinciden."
        : confirmarPassword === ""
          ? "Confirma tu nueva contraseña."
          : null;

    setErrorCorreo(errorCorreoValido);
    setErrores({
      passwordActual: errorPasswordActual,
      password: errorPassword,
      confirmarPassword: errorConfirmacion,
    });

    if (
      errorCorreoValido ||
      errorPasswordActual ||
      errorPassword ||
      errorConfirmacion
    ) {
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      const correoNormalizado = correo.trim().toLowerCase();
      await completarPrimerAcceso({
        correo: correoNormalizado,
        passwordActual,
        password,
        confirmarPassword,
      });
      guardarCorreoPendiente(correoNormalizado);
      router.replace("/");
    } catch (capturado) {
      setError(comoApiError(capturado));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-900">
        <IconoEscudo className="mt-0.5 size-5 shrink-0" />
        <p>
          Acceso institucional de la Alcaldía Municipal de Tuluá. Debes cambiar
          tu contraseña temporal para activar la cuenta y entrar al panel.
        </p>
      </div>

      <Campo
        etiqueta="Correo institucional"
        type="email"
        name="correo"
        autoComplete="username"
        inputMode="email"
        placeholder="nombre@tulua.gov.co"
        requerido
        value={correo}
        onChange={(evento) => {
          setCorreo(evento.target.value);
          setErrorCorreo(null);
        }}
        error={errorCorreo}
        ayuda={
          correoInicial
            ? "Datos recibidos desde tu inicio de sesión."
            : "Correo con el que fuiste invitado como gestor municipal."
        }
      />

      <CampoPassword
        etiqueta="Contraseña Temporal"
        name="passwordActual"
        autoComplete="current-password"
        placeholder="Recibida en tu correo de invitación"
        requerido
        value={passwordActual}
        onChange={(evento) => setPasswordActual(evento.target.value)}
        error={errores.passwordActual}
      />

      <CampoPassword
        etiqueta="Nueva Contraseña Definitiva"
        name="password"
        autoComplete="new-password"
        placeholder="Mínimo 8 caracteres"
        requerido
        value={password}
        onChange={(evento) => setPassword(evento.target.value)}
        error={errores.password}
        ayuda="Debe tener entre 8 y 128 caracteres e incluir al menos un número."
      />

      <CampoPassword
        etiqueta="Confirmar Nueva Contraseña"
        name="confirmarPassword"
        autoComplete="new-password"
        placeholder="Repite tu nueva contraseña"
        requerido
        value={confirmarPassword}
        onChange={(evento) => setConfirmarPassword(evento.target.value)}
        error={errores.confirmarPassword}
      />

      {error ? (
        <Alerta tono={error.status === 429 ? "advertencia" : "error"}>
          {error.mensaje}
          {error.status === 409 ? (
            <span className="mt-1 block">
              La cuenta ya está activa.{" "}
              <Link href="/login" className="font-semibold underline">
                Inicia sesión
              </Link>
              .
            </span>
          ) : null}
          {error.status === 429 && error.segundosEspera
            ? `\nEspera ${error.segundosEspera} segundos antes de reintentar.`
            : ""}
        </Alerta>
      ) : null}

      <Boton type="submit" anchoCompleto tamano="lg" cargando={enviando}>
        Confirmar Clave y Entrar al Panel Administrativo
      </Boton>

      <p className="text-center text-sm text-texto">
        <Link href="/login" className="font-medium text-primario hover:underline">
          ← Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
}
