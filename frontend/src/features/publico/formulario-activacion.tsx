"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { IconoCheck, IconoCorreo } from "@/components/ui/iconos";
import {
  activarCuenta,
  comoApiError,
  reenviarActivacion,
  type ApiError,
} from "@/lib/api-client";
import { guardarCorreoPendiente, obtenerCorreoPendiente } from "@/lib/sesion";
import { CODIGO_6_RE, CORREO_RE } from "@/lib/validaciones";

const TOTAL_DIGITOS = 6;
const VIGENCIA_CODIGO_SEGUNDOS = 15 * 60;
const ENFRIAMIENTO_REENVIO_SEGUNDOS = 60;

function formatearTiempo(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return `${minutos}:${String(resto).padStart(2, "0")}`;
}

interface PropiedadesFormularioActivacion {
  correoInicial?: string;
}

export function FormularioActivacion({
  correoInicial = "",
}: PropiedadesFormularioActivacion) {
  const router = useRouter();
  const [correo, setCorreo] = useState(
    () => correoInicial || obtenerCorreoPendiente() || "",
  );
  const [digitos, setDigitos] = useState<string[]>(() =>
    Array<string>(TOTAL_DIGITOS).fill(""),
  );
  const [errorCorreo, setErrorCorreo] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [avisoReenvio, setAvisoReenvio] = useState<string | null>(null);
  const [vigencia, setVigencia] = useState(VIGENCIA_CODIGO_SEGUNDOS);
  const [enfriamiento, setEnfriamiento] = useState(ENFRIAMIENTO_REENVIO_SEGUNDOS);
  const entradas = useRef<Array<HTMLInputElement | null>>([]);
  const correoEsEditable = correo === "";

  useEffect(() => {
    if (vigencia <= 0) return;
    const temporizador = window.setInterval(() => {
      setVigencia((valor) => (valor <= 1 ? 0 : valor - 1));
    }, 1000);
    return () => window.clearInterval(temporizador);
  }, [vigencia]);

  useEffect(() => {
    if (enfriamiento <= 0) return;
    const temporizador = window.setInterval(() => {
      setEnfriamiento((valor) => (valor <= 1 ? 0 : valor - 1));
    }, 1000);
    return () => window.clearInterval(temporizador);
  }, [enfriamiento]);

  useEffect(() => {
    if (!mensajeExito) return;
    const temporizador = window.setTimeout(() => router.replace("/login"), 4000);
    return () => window.clearTimeout(temporizador);
  }, [mensajeExito, router]);

  const codigo = digitos.join("");
  const listo = CODIGO_6_RE.test(codigo) && CORREO_RE.test(correo.trim());

  function enfocar(indice: number): void {
    entradas.current[indice]?.focus();
    entradas.current[indice]?.select();
  }

  function cambiarDigito(indice: number, valorBruto: string): void {
    const limpio = valorBruto.replace(/\D/g, "");
    const nuevos = [...digitos];

    if (limpio.length <= 1) {
      nuevos[indice] = limpio;
      setDigitos(nuevos);
      if (limpio.length === 1 && indice < TOTAL_DIGITOS - 1) enfocar(indice + 1);
      return;
    }

    const segmento = limpio.slice(0, TOTAL_DIGITOS - indice);
    segmento.split("").forEach((caracter, posicion) => {
      nuevos[indice + posicion] = caracter;
    });
    setDigitos(nuevos);
    enfocar(Math.min(indice + segmento.length, TOTAL_DIGITOS - 1));
  }

  function manejarRetroceso(indice: number, evento: KeyboardEvent<HTMLInputElement>): void {
    if (evento.key !== "Backspace") return;
    if (digitos[indice] === "" && indice > 0) {
      evento.preventDefault();
      const nuevos = [...digitos];
      nuevos[indice - 1] = "";
      setDigitos(nuevos);
      enfocar(indice - 1);
    }
  }

  function manejarFlechas(indice: number, evento: KeyboardEvent<HTMLInputElement>): void {
    if (evento.key === "ArrowLeft" && indice > 0) {
      evento.preventDefault();
      enfocar(indice - 1);
    }
    if (evento.key === "ArrowRight" && indice < TOTAL_DIGITOS - 1) {
      evento.preventDefault();
      enfocar(indice + 1);
    }
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando || !listo) return;

    const correoNormalizado = correo.trim().toLowerCase();
    setError(null);
    setEnviando(true);

    try {
      const respuesta = await activarCuenta({
        correo: correoNormalizado,
        codigo,
      });
      guardarCorreoPendiente(correoNormalizado);
      setMensajeExito(respuesta.mensaje);
    } catch (capturado) {
      setError(comoApiError(capturado));
      setDigitos(Array<string>(TOTAL_DIGITOS).fill(""));
      entradas.current[0]?.focus();
    } finally {
      setEnviando(false);
    }
  }

  async function reenviar() {
    if (reenviando || enfriamiento > 0) return;
    const correoNormalizado = correo.trim().toLowerCase();
    if (!CORREO_RE.test(correoNormalizado)) {
      setErrorCorreo("Ingresa un correo electrónico válido.");
      return;
    }

    setReenviando(true);
    setError(null);
    setAvisoReenvio(null);

    try {
      const respuesta = await reenviarActivacion({ correo: correoNormalizado });
      setAvisoReenvio(respuesta.mensaje);
      setVigencia(VIGENCIA_CODIGO_SEGUNDOS);
      setEnfriamiento(ENFRIAMIENTO_REENVIO_SEGUNDOS);
      setDigitos(Array<string>(TOTAL_DIGITOS).fill(""));
      entradas.current[0]?.focus();
    } catch (capturado) {
      setError(comoApiError(capturado));
    } finally {
      setReenviando(false);
    }
  }

  if (mensajeExito) {
    return (
      <div className="flex flex-col gap-4">
        <Alerta tono="exito">
          <span className="flex gap-2">
            <IconoCheck className="mt-0.5 size-5 shrink-0" />
            <span>
              <strong>Cuenta activada correctamente.</strong>
              {" "}
              {mensajeExito} Te redirigimos al inicio de sesión en unos
              segundos.
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
      <div className="flex items-start gap-3 rounded-lg border border-borde bg-fondo px-4 py-3">
        <IconoCorreo className="mt-0.5 size-5 shrink-0 text-primario" />
        <p className="text-sm leading-relaxed text-texto">
          {correoEsEditable ? (
            "Ingresa el correo con el que te registraste y el código de 6 dígitos que enviamos."
          ) : (
            <>
              Ingresa el código de 6 dígitos enviado a{" "}
              <strong className="break-all text-titulo">{correo}</strong>
            </>
          )}
        </p>
      </div>

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
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-titulo">
          Código de activación
          <span className="ml-1 text-rose-600" aria-hidden="true">
            *
          </span>
        </legend>
        <div className="grid grid-cols-6 gap-2">
          {digitos.map((digito, indice) => (
            <input
              key={indice}
              ref={(elemento) => {
                entradas.current[indice] = elemento;
              }}
              id={`codigo-${indice}`}
              type="text"
              inputMode="numeric"
              autoComplete={indice === 0 ? "one-time-code" : "off"}
              aria-label={`Dígito ${indice + 1} de ${TOTAL_DIGITOS}`}
              value={digito}
              onChange={(evento) => cambiarDigito(indice, evento.target.value)}
              onKeyDown={(evento) => {
                manejarRetroceso(indice, evento);
                manejarFlechas(indice, evento);
              }}
              onFocus={(evento) => evento.target.select()}
              maxLength={TOTAL_DIGITOS}
              className="h-12 min-h-12 w-full rounded-lg border border-borde bg-white text-center text-xl font-bold text-titulo focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primario"
            />
          ))}
        </div>
      </fieldset>

      <p
        aria-live="polite"
        className={`text-sm font-medium ${vigencia === 0 ? "text-rose-700" : "text-texto"}`}
      >
        {vigencia === 0
          ? "El código ha expirado. Solicita uno nuevo."
          : `El código expira en ${formatearTiempo(vigencia)} min`}
      </p>

      {error ? (
        <Alerta tono={error.status === 429 ? "advertencia" : "error"}>
          {error.mensaje}
          {error.status === 409 ? (
            <span className="mt-1 block">
              <Link
                href="/login"
                className="font-semibold underline"
              >
                Inicia sesión aquí
              </Link>
              .
            </span>
          ) : null}
          {error.status === 429 && error.segundosEspera
            ? `\nEspera ${error.segundosEspera} segundos antes de reintentar.`
            : ""}
        </Alerta>
      ) : null}

      {avisoReenvio ? <Alerta tono="informacion">{avisoReenvio}</Alerta> : null}

      <Boton type="submit" anchoCompleto tamano="lg" cargando={enviando} disabled={!listo}>
        Activar Cuenta
      </Boton>

      <div className="text-center text-sm text-texto">
        ¿No recibiste el código?{" "}
        <button
          type="button"
          onClick={reenviar}
          disabled={reenviando || enfriamiento > 0}
          className="min-h-11 font-semibold text-primario underline hover:text-primario-hover disabled:cursor-not-allowed disabled:text-tenue disabled:no-underline"
        >
          {reenviando
            ? "Enviando…"
            : enfriamiento > 0
              ? `Reenviar en ${enfriamiento}s`
              : "Reenviar código"}
        </button>
      </div>
    </form>
  );
}
