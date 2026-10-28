"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { IconoInformacion } from "@/components/ui/iconos";
import { comoApiError, registrarOrganizador, type ApiError } from "@/lib/api-client";
import {
  AvisoCuentaCreada,
  AvisoCorreoNoEnviado,
} from "./avisos-cuenta";
import {
  CamposDatosPersonales,
  DATOS_PERSONALES_VACIOS,
  hayErroresPersonales,
  validarDatosPersonales,
  type DatosPersonales,
  type ErroresPersonales,
} from "./campos-datos-personales";
import {
  CamposSeguridadCuenta,
  hayErroresSeguridad,
  SEGURIDAD_VACIA,
  validarSeguridad,
  type ErroresSeguridad,
  type SeguridadCuenta,
} from "./campos-seguridad";

export function FormularioRegistroOrganizador() {
  const [personales, setPersonales] = useState<DatosPersonales>(
    DATOS_PERSONALES_VACIOS,
  );
  const [erroresPersonales, setErroresPersonales] = useState<ErroresPersonales>(
    {},
  );
  const [seguridad, setSeguridad] = useState<SeguridadCuenta>(SEGURIDAD_VACIA);
  const [erroresSeguridad, setErroresSeguridad] = useState<ErroresSeguridad>({});
  const [error, setError] = useState<ApiError | null>(null);
  const [hayErroresDeValidacion, setHayErroresDeValidacion] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [correoCreado, setCorreoCreado] = useState<string | null>(null);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;

    const erroresDatos = validarDatosPersonales(personales);
    const erroresClave = validarSeguridad(seguridad);

    setErroresPersonales(erroresDatos);
    setErroresSeguridad(erroresClave);

    const invalido =
      hayErroresPersonales(erroresDatos) || hayErroresSeguridad(erroresClave);

    setHayErroresDeValidacion(invalido);
    if (invalido) return;

    setEnviando(true);
    setError(null);

    try {
      const respuesta = await registrarOrganizador({
        nombre: personales.nombre.trim(),
        apellido: personales.apellido.trim() || undefined,
        tipoDocumento: personales.tipoDocumento,
        documento: personales.documento.trim(),
        telefono: personales.telefono.trim(),
        correo: personales.correo.trim().toLowerCase(),
        password: seguridad.password,
        confirmarPassword: seguridad.confirmarPassword,
      });
      setCorreoCreado(respuesta.correo);
    } catch (capturado) {
      setError(comoApiError(capturado));
    } finally {
      setEnviando(false);
    }
  }

  if (correoCreado) {
    return (
      <div className="flex flex-col gap-5">
        <AvisoCuentaCreada correo={correoCreado} />
        <p className="text-center text-sm text-texto">
          <Link
            href="/registro"
            className="font-medium text-primario hover:underline"
          >
            ← Volver a elegir tipo de registro
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-8">
      <div className="flex gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-relaxed text-sky-900">
        <IconoInformacion className="mt-0.5 size-5 shrink-0" />
        <p>
          Los datos de tu organización (NIT, personería jurídica, tipo de
          feria) los configurarás en el siguiente paso, tras activar tu cuenta
          e iniciar sesión.
        </p>
      </div>

      {hayErroresDeValidacion ? (
        <Alerta tono="error">
          Revisa los campos marcados con *: hay información incompleta o
          inválida.
        </Alerta>
      ) : null}

      {error && error.status === 503 ? (
        <AvisoCorreoNoEnviado correo={personales.correo.trim().toLowerCase()} />
      ) : error ? (
        <Alerta tono={error.status === 429 ? "advertencia" : "error"}>
          {error.mensaje}
          {error.status === 429 && error.segundosEspera
            ? `\nEspera ${error.segundosEspera} segundos antes de reintentar.`
            : ""}
        </Alerta>
      ) : null}

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-bold text-titulo">
            Datos del Representante
          </h2>
          <p className="mt-1 text-sm text-texto">
            Registra tus datos personales como representante de la organización.
          </p>
        </div>
        <CamposDatosPersonales
          datos={personales}
          errores={erroresPersonales}
          onCambio={(actualizacion) =>
            setPersonales((actual) => ({ ...actual, ...actualizacion }))
          }
        />
      </section>

      <section className="flex flex-col gap-4 border-t border-borde pt-6">
        <div>
          <h2 className="text-base font-bold text-titulo">Seguridad</h2>
          <p className="mt-1 text-sm text-texto">
            Define una contraseña para proteger tu cuenta.
          </p>
        </div>
        <CamposSeguridadCuenta
          seguridad={seguridad}
          errores={erroresSeguridad}
          onCambio={(actualizacion) => {
            setSeguridad((actual) => ({ ...actual, ...actualizacion }));
            setErroresSeguridad({});
          }}
        />
      </section>

      <div className="border-t border-borde pt-6">
        <Boton type="submit" anchoCompleto tamano="lg" cargando={enviando}>
          Registrar Representante
        </Boton>
        <p className="mt-4 text-center text-sm text-texto">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-semibold text-primario hover:underline"
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    </form>
  );
}
