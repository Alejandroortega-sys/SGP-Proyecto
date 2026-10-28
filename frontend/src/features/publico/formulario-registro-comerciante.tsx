"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { combinarClases } from "@/lib/clases";
import { comoApiError, registrarComerciante, type ApiError } from "@/lib/api-client";
import { validarActividadComercial } from "@/lib/validaciones";
import type { CategoriaComercio } from "@/types/api";
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

const OPCIONES_CATEGORIA: Array<{
  valor: CategoriaComercio;
  texto: string;
  descripcion: string;
}> = [
  {
    valor: "formal",
    texto: "Formal",
    descripcion: "Comercio con registro mercantil o de actividad económica",
  },
  {
    valor: "informal",
    texto: "Informal",
    descripcion: "Puestos fijos, casetas o ventas ambulantes",
  },
];

export function FormularioRegistroComerciante() {
  const [personales, setPersonales] = useState<DatosPersonales>(
    DATOS_PERSONALES_VACIOS,
  );
  const [erroresPersonales, setErroresPersonales] = useState<ErroresPersonales>(
    {},
  );
  const [categoria, setCategoria] = useState<CategoriaComercio>("formal");
  const [actividad, setActividad] = useState("");
  const [errorActividad, setErrorActividad] = useState<string | null>(null);
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
    const erroresActividad = {
      actividad: validarActividadComercial(actividad),
    };
    const erroresClave = validarSeguridad(seguridad);

    setErroresPersonales(erroresDatos);
    setErrorActividad(erroresActividad.actividad);
    setErroresSeguridad(erroresClave);

    const invalido =
      hayErroresPersonales(erroresDatos) ||
      Boolean(erroresActividad.actividad) ||
      hayErroresSeguridad(erroresClave);

    setHayErroresDeValidacion(invalido);
    if (invalido) return;

    setEnviando(true);
    setError(null);

    try {
      const respuesta = await registrarComerciante({
        nombre: personales.nombre.trim(),
        apellido: personales.apellido.trim() || undefined,
        tipoDocumento: personales.tipoDocumento,
        documento: personales.documento.trim(),
        telefono: personales.telefono.trim(),
        correo: personales.correo.trim().toLowerCase(),
        password: seguridad.password,
        confirmarPassword: seguridad.confirmarPassword,
        actividadComercial: actividad.trim(),
        categoria,
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
            1. Datos Personales
          </h2>
          <p className="mt-1 text-sm text-texto">
            Información que identifica a quien solicita el espacio.
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
          <h2 className="text-base font-bold text-titulo">
            2. Actividad Comercial
          </h2>
          <p className="mt-1 text-sm text-texto">
            Define el tipo de comercio que ejerces en el espacio público.
          </p>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-titulo">
            Categoría de Comercio
            <span className="ml-1 text-rose-600" aria-hidden="true">
              *
            </span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {OPCIONES_CATEGORIA.map((opcion) => (
              <div key={opcion.valor}>
                <input
                  type="radio"
                  id={`categoria-${opcion.valor}`}
                  name="categoria"
                  value={opcion.valor}
                  checked={categoria === opcion.valor}
                  onChange={() => setCategoria(opcion.valor)}
                  className="peer sr-only"
                />
                <label
                  htmlFor={`categoria-${opcion.valor}`}
                  className={combinarClases(
                    "flex min-h-11 cursor-pointer flex-col justify-center rounded-lg border px-4 py-2.5 text-sm",
                    "border-borde bg-white text-texto transition-colors",
                    "peer-checked:border-primario peer-checked:bg-primario-suave peer-checked:text-primario-activo",
                    "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primario",
                    "hover:bg-slate-50",
                  )}
                >
                  <span className="font-semibold">{opcion.texto}</span>
                  <span className="text-xs opacity-90">
                    {opcion.descripcion}
                  </span>
                </label>
              </div>
            ))}
          </div>
        </fieldset>

        <Campo
          etiqueta="Actividad Comercial"
          name="actividadComercial"
          placeholder="Ej. Venta de jugos naturales y frutas"
          requerido
          maxLength={200}
          value={actividad}
          onChange={(evento) => {
            setActividad(evento.target.value);
            if (errorActividad) setErrorActividad(null);
          }}
          error={errorActividad}
          ayuda="Describe en una línea qué vendes o prestas. Entre 3 y 200 caracteres."
        />
      </section>

      <section className="flex flex-col gap-4 border-t border-borde pt-6">
        <div>
          <h2 className="text-base font-bold text-titulo">3. Seguridad</h2>
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
          Crear mi Cuenta
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
