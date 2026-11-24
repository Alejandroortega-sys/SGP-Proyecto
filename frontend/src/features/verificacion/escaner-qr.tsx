"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { extraerTokenQr, esTokenValido } from "./lector-qr";

const ID_LECTOR = "lector-qr-camara";

type EstadoCamara = "inactiva" | "iniciando" | "escaneando" | "error";

/**
 * Consulta pública por QR (HU-33, tareas 1226 y 1227): escáner con la
 * cámara del dispositivo y entrada manual del código como alternativa
 * accesible. No requiere sesión.
 */
export function EscanerQr() {
  const router = useRouter();
  const escanerRef = useRef<Html5Qrcode | null>(null);
  const [codigo, setCodigo] = useState("");
  const [errorManual, setErrorManual] = useState<string | null>(null);
  const [estadoCamara, setEstadoCamara] = useState<EstadoCamara>("inactiva");
  const [errorCamara, setErrorCamara] = useState<string | null>(null);

  // Detiene la cámara al desmontar el componente.
  useEffect(() => {
    return () => {
      const escaner = escanerRef.current;
      if (escaner && escaner.isScanning) {
        void escaner
          .stop()
          .then(() => escaner.clear())
          .catch(() => undefined);
      }
    };
  }, []);

  function irAVerificacion(token: string): void {
    router.push(`/verificar/${encodeURIComponent(token)}`);
  }

  function consultarManual(): void {
    const token = extraerTokenQr(codigo);
    if (!token) {
      setErrorManual("Escribe el código del carné (o su URL de verificación).");
      return;
    }
    if (!esTokenValido(token)) {
      // El token mal formado también navega: la página de resultado
      // mostrará «Permiso no encontrado» (HU-33-CA3).
      irAVerificacion(token.toLowerCase());
      return;
    }
    irAVerificacion(token);
  }

  async function iniciarCamara(): Promise<void> {
    setErrorCamara(null);
    setEstadoCamara("iniciando");
    try {
      const escaner = escanerRef.current ?? new Html5Qrcode(ID_LECTOR);
      escanerRef.current = escaner;
      await escaner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (textoDecodificado) => {
          const token = extraerTokenQr(textoDecodificado);
          if (token) {
            void detenerCamara();
            irAVerificacion(token.toLowerCase());
          }
        },
        () => undefined,
      );
      setEstadoCamara("escaneando");
    } catch (capturado) {
      setEstadoCamara("error");
      setErrorCamara(
        "No pudimos acceder a la cámara. Verifica el permiso del navegador " +
          "o escribe el código a mano.",
      );
      // El fallo de cámara no debe ser silencioso, pero tampoco bloquea la
      // consulta manual: se registra la causa probable.
      if (capturado instanceof Error && capturado.message) {
        setErrorCamara((actual) => `${actual} (${capturado.message})`);
      }
    }
  }

  async function detenerCamara(): Promise<void> {
    const escaner = escanerRef.current;
    if (escaner && escaner.isScanning) {
      try {
        await escaner.stop();
        escaner.clear();
      } catch {
        // La cámara ya estaba detenida: no hay nada que limpiar.
      }
    }
    setEstadoCamara("inactiva");
  }

  const camaraActiva = estadoCamara === "iniciando" || estadoCamara === "escaneando";

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <header className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-texto">
          Veeduría ciudadana
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-titulo sm:text-3xl">
          Verificar un permiso
        </h1>
        <p className="mt-1 text-sm text-texto">
          Escanea el código QR del puesto o escribe el código del carné para
          confirmar que el permiso es legal, su vigencia y su categoría. No
          necesitas cuenta.
        </p>
      </header>

      <Tarjeta className="p-4 sm:p-5">
        <h2 className="text-lg font-bold text-titulo">Escanear con la cámara</h2>
        <p className="mt-1 text-sm text-texto">
          Apunta la cámara al QR impreso en el carné del comerciante.
        </p>

        {camaraActiva ? (
          <div className="mt-3 flex flex-col gap-3">
            <div
              id={ID_LECTOR}
              aria-label="Vista de la cámara para escanear el QR"
              className="overflow-hidden rounded-xl border border-borde"
            />
            {estadoCamara === "iniciando" ? (
              <p className="text-sm text-tenue" aria-live="polite">
                Solicitando acceso a la cámara…
              </p>
            ) : (
              <p className="text-sm text-tenue" aria-live="polite">
                Escaneando… acerca el código al cuadro.
              </p>
            )}
            <Boton variante="contorno" onClick={() => void detenerCamara()}>
              Detener cámara
            </Boton>
          </div>
        ) : (
          <div className="mt-3">
            <Boton onClick={() => void iniciarCamara()} anchoCompleto>
              Encender cámara
            </Boton>
            {errorCamara ? (
              <Alerta tono="error" className="mt-3">
                {errorCamara}
              </Alerta>
            ) : null}
          </div>
        )}
      </Tarjeta>

      <Tarjeta className="p-4 sm:p-5">
        <h2 className="text-lg font-bold text-titulo">
          Escribir el código a mano
        </h2>
        <form
          className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(evento) => {
            evento.preventDefault();
            consultarManual();
          }}
        >
          <div className="flex-1">
            <Campo
              etiqueta="Código del carné"
              ayuda="Los 48 caracteres impresos bajo el QR o la URL de verificación."
              error={errorManual}
              placeholder="p. ej. a3f0c44298fc1c149afbf4c8996fb924…"
              value={codigo}
              onChange={(evento) => {
                setCodigo(evento.target.value);
                setErrorManual(null);
              }}
            />
          </div>
          <Boton type="submit">Verificar</Boton>
        </form>
      </Tarjeta>

      <p className="text-center text-xs text-tenue">
        La consulta muestra validez, vigencia, categoría y titular comercial:
        sin datos personales sensibles. Cada verificación queda registrada con
        la fecha y la dirección IP, sin identificar a quien consulta.
      </p>
    </div>
  );
}
