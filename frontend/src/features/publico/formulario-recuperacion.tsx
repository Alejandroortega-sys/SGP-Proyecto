"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { comoApiError, solicitarRecuperacion, type ApiError } from "@/lib/api-client";
import { validarCorreo } from "@/lib/validaciones";

export function FormularioRecuperacion() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [errorCampo, setErrorCampo] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;

    const errorValidacion = validarCorreo(correo);
    setErrorCampo(errorValidacion);
    if (errorValidacion) return;

    setEnviando(true);
    setError(null);

    try {
      const respuesta = await solicitarRecuperacion({
        correo: correo.trim().toLowerCase(),
      });
      setMensaje(respuesta.mensaje);
    } catch (capturado) {
      setError(comoApiError(capturado));
    } finally {
      setEnviando(false);
    }
  }

  if (mensaje) {
    const correoNormalizado = correo.trim().toLowerCase();
    return (
      <div className="flex flex-col gap-4">
        <Alerta tono="informacion">{mensaje}</Alerta>
        <Boton
          anchoCompleto
          onClick={() =>
            router.push(`/restablecer?correo=${encodeURIComponent(correoNormalizado)}`)
          }
        >
          Continuar con la nueva contraseña
        </Boton>
        <p className="text-center text-sm text-texto">
          <Link
            href="/login"
            className="font-medium text-primario hover:underline"
          >
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    );
  }

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
        onChange={(evento) => {
          setCorreo(evento.target.value);
          setErrorCampo(null);
        }}
        error={errorCampo}
        ayuda="Si el correo está registrado, recibirás un código de 6 dígitos válido por 2 minutos."
      />

      {error ? (
        <Alerta tono={error.status === 429 ? "advertencia" : "error"}>
          {error.mensaje}
          {error.status === 429 && error.segundosEspera
            ? `\nEspera ${error.segundosEspera} segundos antes de reintentar.`
            : ""}
        </Alerta>
      ) : null}

      <Boton type="submit" anchoCompleto tamano="lg" cargando={enviando}>
        Enviar código de recuperación
      </Boton>

      <p className="text-center text-sm text-texto">
        <Link href="/login" className="font-medium text-primario hover:underline">
          ← Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
}
