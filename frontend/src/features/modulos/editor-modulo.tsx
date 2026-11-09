"use client";

/* eslint-disable react-hooks/set-state-in-effect -- la carga se reinicia al cambiar de módulo o al reintentar */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import { Tarjeta, TarjetaCuerpo } from "@/components/ui/tarjeta";
import {
  actualizarModulo,
  ApiError,
  comoApiError,
  consultarZonaContenedora,
  crearModulo,
  obtenerModulo,
} from "@/lib/api-client";
import type {
  AdvertenciaModulo,
  GeometriaPunto,
  ModuloDetalle,
  TitularModulo,
  ZonaContenedoraModulo,
} from "@/types/api";
import { AdvertenciasModulo } from "./advertencias-modulo";
import { FormularioModulo } from "./formulario-modulo";
import { MapaCensoModuloCarga } from "./mapa-censo-modulo-carga";
import {
  construirSolicitudModulo,
  requiereAceptacionEfectiva,
  tieneErroresModulo,
  validarArchivoFoto,
  validarValoresModulo,
  valoresInicialesModulo,
  type ErroresModulo,
  type ValoresModulo,
} from "./validaciones-modulo";

interface EditorModuloProps {
  id?: string;
  mensajeInicial?: string;
}

function valoresDesdeModulo(modulo: ModuloDetalle): ValoresModulo {
  return {
    categoria: modulo.categoria,
    actividad: modulo.actividad,
    titularModo: modulo.titular ? "registrado" : "libre",
    titularId: modulo.titular?.id ?? "",
    titularNombre: modulo.titularNombre ?? "",
    punto: modulo.ubicacion,
  };
}

export function EditorModulo({ id, mensajeInicial }: EditorModuloProps) {
  const router = useRouter();
  const [cargando, setCargando] = useState(Boolean(id));
  const [errorCarga, setErrorCarga] = useState<ApiError | null>(null);
  const [versionCarga, setVersionCarga] = useState(0);

  const [modulo, setModulo] = useState<ModuloDetalle | null>(null);
  const [valores, setValores] = useState<ValoresModulo>(valoresInicialesModulo);
  const [puntoInicial, setPuntoInicial] = useState<GeometriaPunto | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoActualUrl, setFotoActualUrl] = useState<string | null>(null);
  const [titularSeleccionado, setTitularSeleccionado] =
    useState<TitularModulo | null>(null);

  const [zona, setZona] = useState<ZonaContenedoraModulo | null>(null);
  const [advertencias, setAdvertencias] = useState<AdvertenciaModulo[]>([]);
  const [requiereConfirmacion, setRequiereConfirmacion] = useState(false);
  const [aceptaAdvertencia, setAceptaAdvertencia] = useState(false);
  const [cargandoZona, setCargandoZona] = useState(false);
  const [errorZona, setErrorZona] = useState<ApiError | null>(null);
  const solicitudZona = useRef(0);

  const [errores, setErrores] = useState<ErroresModulo>({});
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<ApiError | null>(null);
  const [exito, setExito] = useState<string | null>(mensajeInicial ?? null);

  useEffect(() => {
    let activo = true;
    setErrorCarga(null);

    if (!id) {
      setCargando(false);
      setModulo(null);
      setValores(valoresInicialesModulo());
      setPuntoInicial(null);
      setFoto(null);
      setFotoActualUrl(null);
      setTitularSeleccionado(null);
      setZona(null);
      setAdvertencias([]);
      setRequiereConfirmacion(false);
      return;
    }

    setCargando(true);
    obtenerModulo(id)
      .then((detalle) => {
        if (!activo) return;
        setModulo(detalle);
        setValores(valoresDesdeModulo(detalle));
        setPuntoInicial(detalle.ubicacion);
        setFotoActualUrl(detalle.fotoUrl);
        setTitularSeleccionado(detalle.titular);
        setZona(detalle.zonaContenedora);
        setAdvertencias(detalle.advertencias);
        setRequiereConfirmacion(
          detalle.advertencias.some(
            (advertencia) => advertencia.requiereConfirmacion,
          ),
        );
      })
      .catch((error) => {
        if (activo) setErrorCarga(comoApiError(error));
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [id, versionCarga]);

  function limpiarAvisos(): void {
    setExito(null);
    setErrorGuardado(null);
  }

  function actualizarValores(nuevos: ValoresModulo): void {
    setValores(nuevos);
    setErrores({});
    if (nuevos.titularModo === "libre" || nuevos.titularId === "") {
      setTitularSeleccionado(null);
    }
    limpiarAvisos();
  }

  function seleccionarTitular(titular: TitularModulo): void {
    setTitularSeleccionado(titular);
    setValores((actuales) => ({
      ...actuales,
      titularModo: "registrado",
      titularId: titular.id,
      titularNombre: "",
    }));
    setErrores({});
    limpiarAvisos();
  }

  function cambiarFoto(nueva: File | null): void {
    setFoto(nueva);
    setErrores((actuales) => ({
      ...actuales,
      foto: validarArchivoFoto(nueva) ?? undefined,
    }));
    limpiarAvisos();
  }

  function cambiarPunto(punto: GeometriaPunto): void {
    const numero = solicitudZona.current + 1;
    solicitudZona.current = numero;

    setValores((actuales) => ({ ...actuales, punto }));
    setAceptaAdvertencia(false);
    setErrores({});
    setErrorZona(null);
    setCargandoZona(true);
    limpiarAvisos();

    consultarZonaContenedora(punto.coordinates[1], punto.coordinates[0])
      .then((respuesta) => {
        if (solicitudZona.current !== numero) return;
        setZona(respuesta.zona);
        setAdvertencias(respuesta.advertencias);
        setRequiereConfirmacion(respuesta.requiereConfirmacion);
      })
      .catch((error) => {
        if (solicitudZona.current !== numero) return;
        setZona(null);
        setAdvertencias([]);
        setRequiereConfirmacion(false);
        setErrorZona(comoApiError(error));
      })
      .finally(() => {
        if (solicitudZona.current === numero) setCargandoZona(false);
      });
  }

  const requiereAceptacion = requiereAceptacionEfectiva(
    requiereConfirmacion,
    Boolean(id),
    puntoInicial,
    valores.punto,
  );

  const validacionActual = validarValoresModulo(valores, {
    foto,
    requiereConfirmacion,
    aceptaAdvertencia,
    esEdicion: Boolean(id),
    puntoInicial,
  });

  const puedeGuardar =
    !guardando &&
    !cargandoZona &&
    !errorZona &&
    !tieneErroresModulo(validacionActual);

  async function guardar(): Promise<void> {
    if (guardando || !puedeGuardar) return;

    limpiarAvisos();
    const erroresValidacion = validarValoresModulo(valores, {
      foto,
      requiereConfirmacion,
      aceptaAdvertencia,
      esEdicion: Boolean(id),
      puntoInicial,
    });
    setErrores(erroresValidacion);
    if (tieneErroresModulo(erroresValidacion)) return;

    setGuardando(true);
    try {
      const solicitud = construirSolicitudModulo(
        valores,
        requiereAceptacion && aceptaAdvertencia,
      );

      if (!id) {
        const creado = await crearModulo(solicitud, foto);
        router.replace(`/gestor/modulos/${creado.id}?guardado=1`);
        return;
      }

      const actualizado = await actualizarModulo(id, solicitud, foto);
      setModulo(actualizado);
      setValores(valoresDesdeModulo(actualizado));
      setPuntoInicial(actualizado.ubicacion);
      setFoto(null);
      setFotoActualUrl(actualizado.fotoUrl);
      setTitularSeleccionado(actualizado.titular);
      setZona(actualizado.zonaContenedora);
      setAdvertencias(actualizado.advertencias);
      setRequiereConfirmacion(
        actualizado.advertencias.some(
          (advertencia) => advertencia.requiereConfirmacion,
        ),
      );
      setAceptaAdvertencia(false);
      setErrores({});
      setExito("Los cambios se guardaron correctamente.");
    } catch (error) {
      setErrorGuardado(comoApiError(error));
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <Cargando
        texto={id ? "Cargando el módulo…" : "Preparando el censo de módulos…"}
      />
    );
  }

  if (errorCarga) {
    if (errorCarga.status === 404) {
      return (
        <EstadoVacio
          titulo="El módulo solicitado no existe"
          descripcion="Puede que el identificador no sea válido o que el registro haya sido eliminado."
          accion={
            <Link
              href="/gestor/modulos"
              className="font-semibold text-primario hover:underline"
            >
              Volver al listado de módulos
            </Link>
          }
        />
      );
    }

    return (
      <BloqueError
        error={errorCarga}
        onReintentar={() => setVersionCarga((valor) => valor + 1)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/gestor/modulos"
          className="text-sm font-semibold text-primario hover:underline"
        >
          ← Volver al listado de módulos
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primario">
              Censo del espacio público
            </p>
            <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
              {id ? "Editar módulo" : "Censar un módulo o puesto"}
            </h1>
            <p className="mt-2 max-w-3xl text-base text-texto">
              Ubica el punto en el mapa, registra la categoría, el titular y la
              actividad. Si el punto cae en una zona restringida, el sistema te
              pedirá confirmarlo.
            </p>
          </div>
          {modulo ? (
            <span className="rounded-full border border-borde bg-fondo px-3 py-1 text-xs font-semibold text-tenue">
              {modulo.codigo}
            </span>
          ) : null}
        </div>
      </div>

      {exito ? <Alerta tono="exito">{exito}</Alerta> : null}

      {modulo?.estado === "baja" ? (
        <Alerta tono="informacion">
          Este módulo está dado de baja. Puedes editarlo, pero seguirá fuera del
          censo activo hasta que lo reactives desde la ficha.
        </Alerta>
      ) : null}

      {errorGuardado ? (
        <Alerta tono="error">
          <span className="flex flex-col gap-1">
            <span className="font-semibold">
              No se pudo guardar el censo
            </span>
            <span>{errorGuardado.mensaje}</span>
          </span>
        </Alerta>
      ) : null}

      {Object.values(errores).some(Boolean) ? (
        <Alerta tono="error">
          <span className="flex flex-col gap-1">
            <span className="font-semibold">
              Revisa los campos del formulario
            </span>
            {Object.values(errores)
              .filter((error): error is string => Boolean(error))
              .map((error) => (
                <span key={error}>• {error}</span>
              ))}
          </span>
        </Alerta>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="flex min-w-0 flex-col gap-4">
          <MapaCensoModuloCarga
            punto={valores.punto}
            onCambiarPunto={cambiarPunto}
          />

          {valores.punto ? (
            <Tarjeta>
              <TarjetaCuerpo>
                {cargandoZona ? (
                  <Cargando texto="Consultando la zona contenedora…" />
                ) : errorZona ? (
                  <Alerta tono="error">
                    No se pudo consultar la zona contenedora:{" "}
                    {errorZona.mensaje}. Vuelve a seleccionar el punto.
                  </Alerta>
                ) : (
                  <AdvertenciasModulo
                    zona={zona}
                    advertencias={advertencias}
                    requiereConfirmacion={requiereAceptacion}
                    aceptaAdvertencia={aceptaAdvertencia}
                    onAceptar={setAceptaAdvertencia}
                  />
                )}
              </TarjetaCuerpo>
            </Tarjeta>
          ) : (
            <Tarjeta>
              <TarjetaCuerpo>
                <Alerta tono="informacion">
                  Selecciona el punto del módulo en el mapa para consultar la
                  zona contenedora y sus restricciones.
                </Alerta>
              </TarjetaCuerpo>
            </Tarjeta>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link
              href={id ? `/gestor/modulos/${id}` : "/gestor/modulos"}
              className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-texto hover:bg-slate-100"
            >
              Cancelar
            </Link>
            <Boton
              onClick={() => void guardar()}
              cargando={guardando}
              disabled={!puedeGuardar}
            >
              {id ? "Guardar cambios" : "Censar módulo"}
            </Boton>
          </div>
        </div>

        <Tarjeta>
          <TarjetaCuerpo>
            <FormularioModulo
              valores={valores}
              errores={errores}
              foto={foto}
              fotoActualUrl={fotoActualUrl}
              titularSeleccionado={titularSeleccionado}
              onCambiar={actualizarValores}
              onCambiarFoto={cambiarFoto}
              onSeleccionarTitular={seleccionarTitular}
            />
          </TarjetaCuerpo>
        </Tarjeta>
      </div>
    </div>
  );
}
