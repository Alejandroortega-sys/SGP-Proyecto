"use client";

/* eslint-disable react-hooks/set-state-in-effect -- el formulario se hidrata y consulta la disponibilidad de forma reactiva */
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { EnlaceBoton } from "@/components/ui/enlace-boton";
import { Cargando } from "@/components/ui/estado-vacio";
import { Tarjeta, TarjetaCuerpo, TarjetaEncabezado } from "@/components/ui/tarjeta";
import { formatearRangoFechas } from "@/features/espacios/estilos-espacio";
import { useConsultaApi } from "@/hooks/use-consulta-api";
import {
  ApiError,
  comoApiError,
  consultarDisponibilidadFeria,
  obtenerAgendaFeria,
  obtenerMiOrganizacion,
  obtenerOpcionesFeria,
  radicarFeria,
} from "@/lib/api-client";
import type {
  AgendaFeria,
  DisponibilidadFeria,
  ProductoFeria,
  ProgresoSubida,
  RangoFeria,
} from "@/types/api";
import { AdjuntosFeria, MAX_ADJUNTOS_FERIA } from "./adjuntos-feria";
import { SelectorZonaFechas } from "./selector-zona-fechas";
import {
  FORMULARIO_FERIA_VACIO,
  hoyISO,
  sinErrores,
  validarFormularioFeria,
  type ErroresFeria,
  type ValoresFeria,
} from "./validaciones-feria";

function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const base = new Date(Date.UTC(anio, mes - 1, dia));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** Formulario de solicitud de feria agroecológica (HU-21). */
export function FormularioFeria() {
  const router = useRouter();
  const opciones = useConsultaApi(obtenerOpcionesFeria, []);
  const organizacion = useConsultaApi(obtenerMiOrganizacion, []);

  const [valores, setValores] = useState<ValoresFeria>(FORMULARIO_FERIA_VACIO);
  const [errores, setErrores] = useState<ErroresFeria>({});
  const [archivos, setArchivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState<ProgresoSubida | null>(null);
  const [errorEnvio, setErrorEnvio] = useState<ApiError | null>(null);
  const [disponibilidad, setDisponibilidad] =
    useState<DisponibilidadFeria | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [errorConsulta, setErrorConsulta] = useState<string | null>(null);
  const [tipoFeriaInicializado, setTipoFeriaInicializado] = useState(false);

  const zonas = opciones.datos?.zonas ?? [];
  const productos = opciones.datos?.productos ?? [];
  const zona = zonas.find((item) => item.id === valores.zonaId) ?? null;

  const agenda = useConsultaApi<AgendaFeria | null>(
    () =>
      valores.zonaId
        ? obtenerAgendaFeria(
            valores.zonaId,
            hoyISO(),
            sumarDias(hoyISO(), 120),
          )
        : Promise.resolve(null),
    [valores.zonaId],
  );

  useEffect(() => {
    if (tipoFeriaInicializado || !organizacion.datos) return;
    setTipoFeriaInicializado(true);
    setValores((actual) =>
      actual.tipoFeria
        ? actual
        : { ...actual, tipoFeria: organizacion.datos?.tipoFeria ?? "" },
    );
  }, [organizacion.datos, tipoFeriaInicializado]);

  useEffect(() => {
    const puestos = Number(valores.numeroPuestos);
    if (
      !valores.zonaId ||
      !valores.fechaInicio ||
      !valores.fechaFin ||
      !Number.isInteger(puestos) ||
      puestos < 1
    ) {
      setDisponibilidad(null);
      setConsultando(false);
      setErrorConsulta(null);
      return;
    }

    let activo = true;
    setConsultando(true);
    setErrorConsulta(null);

    const temporizador = window.setTimeout(() => {
      consultarDisponibilidadFeria({
        zonaId: valores.zonaId,
        fechaInicio: valores.fechaInicio,
        fechaFin: valores.fechaFin,
        numeroPuestos: puestos,
      })
        .then((respuesta) => {
          if (activo) setDisponibilidad(respuesta);
        })
        .catch((capturado: unknown) => {
          if (!activo) return;
          setDisponibilidad(null);
          setErrorConsulta(comoApiError(capturado).message);
        })
        .finally(() => {
          if (activo) setConsultando(false);
        });
    }, 400);

    return () => {
      activo = false;
      window.clearTimeout(temporizador);
    };
  }, [
    valores.zonaId,
    valores.fechaInicio,
    valores.fechaFin,
    valores.numeroPuestos,
  ]);

  function cambiar(parcial: Partial<ValoresFeria>) {
    setValores((actual) => {
      const siguiente = { ...actual, ...parcial };
      if (parcial.zonaId !== undefined) {
        const nuevaZona = zonas.find((item) => item.id === parcial.zonaId);
        if (nuevaZona && nuevaZona.productosPermitidos.length > 0) {
          const permitidos = new Set(nuevaZona.productosPermitidos);
          siguiente.productoIds = siguiente.productoIds.filter((id) => {
            const producto = productos.find((item) => item.id === id);
            return producto ? permitidos.has(producto.nombre) : false;
          });
        }
      }
      return siguiente;
    });
    setErrores((actual) => {
      const siguiente = { ...actual };
      for (const clave of Object.keys(parcial) as (keyof ValoresFeria)[]) {
        delete siguiente[clave];
      }
      return siguiente;
    });
  }

  function alternarProducto(id: string, marcado: boolean) {
    setValores((actual) => ({
      ...actual,
      productoIds: marcado
        ? [...new Set([...actual.productoIds, id])]
        : actual.productoIds.filter((item) => item !== id),
    }));
    setErrores((actual) => {
      const siguiente = { ...actual };
      delete siguiente.productoIds;
      return siguiente;
    });
  }

  function aplicarSugerencia(rango: RangoFeria) {
    cambiar({
      fechaInicio: rango.fechaInicio,
      fechaFin: rango.fechaFin,
    });
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;

    const validacion = validarFormularioFeria(valores, zona);
    if (organizacion.datos?.estado !== "activa") {
      validacion.general =
        "Tu organización debe estar activa para radicar una feria.";
    }
    if (archivos.length > MAX_ADJUNTOS_FERIA) {
      validacion.adjuntos = `Puedes adjuntar como máximo ${MAX_ADJUNTOS_FERIA} archivos.`;
    }

    setErrores(validacion);
    if (!sinErrores(validacion)) return;

    setEnviando(true);
    setProgreso(null);
    setErrorEnvio(null);

    try {
      const respuesta = await radicarFeria(
        {
          nombre: valores.nombre.trim(),
          tipoFeria: valores.tipoFeria.trim(),
          zonaId: valores.zonaId,
          fechaInicio: valores.fechaInicio,
          fechaFin: valores.fechaFin,
          numeroPuestos: Number(valores.numeroPuestos),
          productoIds: valores.productoIds,
        },
        archivos,
        setProgreso,
      );
      router.push(`/organizador/ferias/${respuesta.id}?radicada=1`);
    } catch (capturado) {
      setErrorEnvio(comoApiError(capturado));
    } finally {
      setEnviando(false);
      setProgreso(null);
    }
  }

  if (opciones.cargando || organizacion.cargando) {
    return <Cargando texto="Cargando zonas y datos de la organización…" />;
  }

  if (opciones.error) {
    return (
      <BloqueError error={opciones.error} onReintentar={opciones.recargar} />
    );
  }

  const organizacionNoExiste = organizacion.error?.status === 404;
  if (organizacion.error && !organizacionNoExiste) {
    return (
      <BloqueError
        error={organizacion.error}
        onReintentar={organizacion.recargar}
      />
    );
  }

  const organizacionActiva = organizacion.datos?.estado === "activa";
  const permitidos = new Set(zona?.productosPermitidos ?? []);
  const hayRestriccionProductos = permitidos.size > 0;
  const puedeRadicar =
    organizacionActiva && !consultando && disponibilidad?.disponible !== false;

  return (
    <form onSubmit={enviar} className="flex flex-col gap-6" noValidate>
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-texto">
          Portal del organizador
        </p>
        <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
          Solicitar una feria
        </h1>
        <p className="max-w-2xl text-sm text-texto sm:text-base">
          Indica la zona, las fechas y el número de puestos. El sistema
          comprobará el aforo y la agenda para evitar cruces con otras ferias.
        </p>
      </header>

      {!organizacion.datos || !organizacionActiva ? (
        <Alerta tono="advertencia">
          <p className="font-semibold">
            {organizacionNoExiste
              ? "Aún no has registrado tu organización."
              : "Tu organización no está activa."}
          </p>
          <p className="mt-1">
            Para solicitar una feria, la organización debe estar registrada y
            validada por la Alcaldía.
          </p>
          <Link
            href="/organizador/mi-organizacion"
            className="mt-2 inline-flex min-h-11 items-center font-semibold underline"
          >
            Ir a Mi organización
          </Link>
        </Alerta>
      ) : null}

      <Tarjeta>
        <TarjetaEncabezado>
          <h2 className="text-base font-bold text-titulo">Datos de la feria</h2>
        </TarjetaEncabezado>
        <TarjetaCuerpo className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-titulo">
            Nombre de la feria
            <span className="sr-only">(obligatorio)</span>
            <input
              type="text"
              value={valores.nombre}
              maxLength={200}
              required
              className="w-full rounded-lg border border-borde bg-superficie px-3.5 py-2.5 text-base text-titulo focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primario"
              onChange={(evento) => cambiar({ nombre: evento.target.value })}
            />
            {errores.nombre ? (
              <span className="text-sm text-peligro-texto">{errores.nombre}</span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-titulo">
            Tipo de feria
            <input
              type="text"
              value={valores.tipoFeria}
              maxLength={100}
              required
              className="w-full rounded-lg border border-borde bg-white px-3.5 py-2.5 text-base text-titulo focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primario"
              onChange={(evento) => cambiar({ tipoFeria: evento.target.value })}
            />
            {errores.tipoFeria ? (
              <span className="text-sm text-peligro-texto">{errores.tipoFeria}</span>
            ) : null}
          </label>
        </TarjetaCuerpo>
      </Tarjeta>

      <Tarjeta>
        <TarjetaCuerpo>
          <SelectorZonaFechas
            valores={valores}
            errores={errores}
            zonas={zonas}
            zona={zona}
            agenda={agenda.datos}
            disponibilidad={disponibilidad}
            consultando={consultando}
            errorConsulta={
              errorConsulta ??
              (agenda.error
                ? "No pudimos consultar la agenda de la zona."
                : null)
            }
            onCambiar={cambiar}
            onAplicarSugerencia={aplicarSugerencia}
          />
        </TarjetaCuerpo>
      </Tarjeta>

      <Tarjeta>
        <TarjetaCuerpo>
          <fieldset className="flex flex-col gap-3">
            <legend className="text-lg font-bold text-titulo">
              Productos de la feria
            </legend>
            <p className="text-sm text-texto">
              Selecciona al menos un producto. Si la zona tiene restricciones,
              solo se habilitan los permitidos.
            </p>
            {errores.productoIds ? (
              <Alerta tono="error">{errores.productoIds}</Alerta>
            ) : null}
            {productos.length === 0 ? (
              <p className="text-sm text-tenue">
                No hay productos activos en el catálogo.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {productos.map((producto: ProductoFeria) => {
                  const permitido =
                    !hayRestriccionProductos || permitidos.has(producto.nombre);
                  const marcado = valores.productoIds.includes(producto.id);
                  return (
                    <li key={producto.id}>
                      <label
                        className={
                          permitido
                            ? "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-borde bg-white px-3 py-2 text-sm text-titulo"
                            : "flex min-h-11 cursor-not-allowed items-center gap-3 rounded-lg border border-borde bg-interaccion px-3 py-2 text-sm text-tenue"
                        }
                      >
                        <input
                          type="checkbox"
                          className="size-5 accent-primario"
                          checked={marcado}
                          disabled={!permitido}
                          onChange={(evento) =>
                            alternarProducto(
                              producto.id,
                              evento.target.checked,
                            )
                          }
                        />
                        <span>
                          {producto.nombre}
                          {!permitido ? (
                            <span className="ml-1 text-xs">
                              (no permitido en la zona)
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>
        </TarjetaCuerpo>
      </Tarjeta>

      <Tarjeta>
        <TarjetaCuerpo>
          <AdjuntosFeria
            archivos={archivos}
            error={errores.adjuntos}
            deshabilitado={enviando}
            onAgregar={(nuevos) =>
              setArchivos((actual) => [...actual, ...nuevos])
            }
            onQuitar={(indice) =>
              setArchivos((actual) =>
                actual.filter((_, posicion) => posicion !== indice),
              )
            }
          />
        </TarjetaCuerpo>
      </Tarjeta>

      <Tarjeta>
        <TarjetaEncabezado>
          <h2 className="text-base font-bold text-titulo">Resumen</h2>
        </TarjetaEncabezado>
        <TarjetaCuerpo className="grid gap-3 text-sm text-texto sm:grid-cols-2">
          <p>
            <span className="font-semibold text-titulo">Feria:</span>{" "}
            {valores.nombre || "Sin nombre"}
          </p>
          <p>
            <span className="font-semibold text-titulo">Tipo:</span>{" "}
            {valores.tipoFeria || "Sin tipo"}
          </p>
          <p>
            <span className="font-semibold text-titulo">Zona:</span>{" "}
            {zona?.nombre ?? "Sin zona"}
          </p>
          <p>
            <span className="font-semibold text-titulo">Fechas:</span>{" "}
            {valores.fechaInicio && valores.fechaFin
              ? formatearRangoFechas(valores.fechaInicio, valores.fechaFin)
              : "Sin fechas"}
          </p>
          <p>
            <span className="font-semibold text-titulo">Puestos:</span>{" "}
            {valores.numeroPuestos || "Sin definir"}
          </p>
          <p>
            <span className="font-semibold text-titulo">Productos:</span>{" "}
            {valores.productoIds.length > 0
              ? valores.productoIds
                  .map(
                    (id) =>
                      productos.find((producto) => producto.id === id)?.nombre,
                  )
                  .filter(Boolean)
                  .join(", ")
              : "Sin productos"}
          </p>
          <p>
            <span className="font-semibold text-titulo">Adjuntos:</span>{" "}
            {archivos.length > 0
              ? `${archivos.length} archivo(s)`
              : "Sin adjuntos"}
          </p>
        </TarjetaCuerpo>
      </Tarjeta>

      {enviando && progreso ? (
        <div className="flex flex-col gap-1">
          <div
            role="progressbar"
            aria-label="Progreso de la radicación"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progreso.porcentaje}
            className="h-2 w-full overflow-hidden rounded-full bg-interaccion-fuerte"
          >
            <div
              className="h-full rounded-full bg-primario transition-all"
              style={{ width: `${progreso.porcentaje}%` }}
            />
          </div>
          <p className="text-xs text-tenue" role="status">
            Enviando la feria y sus adjuntos… {progreso.porcentaje}%
          </p>
        </div>
      ) : null}

      {errores.general ? <Alerta tono="error">{errores.general}</Alerta> : null}
      {errorEnvio ? (
        <Alerta tono="error">
          <p className="font-semibold">No se pudo radicar la feria.</p>
          <p className="mt-1 whitespace-pre-line">{errorEnvio.message}</p>
        </Alerta>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <EnlaceBoton href="/organizador/ferias" variante="fantasma">
          Volver a mis ferias
        </EnlaceBoton>
        <Boton
          type="submit"
          tamano="lg"
          cargando={enviando}
          disabled={!puedeRadicar}
        >
          Radicar feria
        </Boton>
      </div>
    </form>
  );
}
