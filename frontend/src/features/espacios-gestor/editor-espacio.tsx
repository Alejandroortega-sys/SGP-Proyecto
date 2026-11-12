"use client";

/* eslint-disable react-hooks/set-state-in-effect -- la carga se reinicia al cambiar de espacio */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BloqueError } from "@/components/ui/bloque-error";
import { Boton } from "@/components/ui/boton";
import { Cargando, EstadoVacio } from "@/components/ui/estado-vacio";
import { Tarjeta, TarjetaCuerpo } from "@/components/ui/tarjeta";
import {
  actualizarEspacioGestor,
  ApiError,
  comoApiError,
  consultarZonaEspacio,
  crearEspacioGestor,
  obtenerEspacioGestor,
} from "@/lib/api-client";
import type {
  GeometriaPunto,
  SolicitudEspacioGestor,
  ZonaOpcionEspacio,
} from "@/types/api";
import { FormularioEspacio } from "./formulario-espacio";
import { MapaEspacioCarga } from "./mapa-espacio-carga";
import {
  construirSolicitudEspacio,
  espacioDesdeDetalle,
  tieneErroresEspacio,
  validarValoresEspacio,
  valoresInicialesEspacio,
  type ErroresEspacio,
  type EstadoManualEspacio,
  type ValoresEspacio,
} from "./validaciones-espacio";

interface EditorEspacioProps {
  id?: string;
  mensajeInicial?: string;
}

export function EditorEspacio({ id, mensajeInicial }: EditorEspacioProps) {
  const router = useRouter();
  const [cargando, setCargando] = useState(Boolean(id));
  const [errorCarga, setErrorCarga] = useState<ApiError | null>(null);
  const [versionCarga, setVersionCarga] = useState(0);

  const [valores, setValores] = useState<ValoresEspacio>(
    valoresInicialesEspacio,
  );
  const [estadoInicial, setEstadoInicial] =
    useState<EstadoManualEspacio>("disponible");
  const [errores, setErrores] = useState<ErroresEspacio>({});
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<ApiError | null>(null);
  const [exito, setExito] = useState<string | null>(mensajeInicial ?? null);

  const [zona, setZona] = useState<ZonaOpcionEspacio | null>(null);
  const [cargandoZona, setCargandoZona] = useState(false);
  const [errorZona, setErrorZona] = useState<ApiError | null>(null);
  const solicitudZona = useRef(0);

  useEffect(() => {
    let activo = true;
    setErrorCarga(null);
    setErrorGuardado(null);

    if (!id) {
      setCargando(false);
      setValores(valoresInicialesEspacio());
      setEstadoInicial("disponible");
      setZona(null);
      setErrores({});
      return;
    }

    setCargando(true);
    obtenerEspacioGestor(id)
      .then((detalle) => {
        if (!activo) return;
        const iniciales = espacioDesdeDetalle(detalle);
        setValores(iniciales);
        setEstadoInicial(iniciales.estado);
        setZona(
          detalle.zona
            ? {
                id: detalle.zona.id,
                nombre: detalle.zona.nombre,
                tipo: detalle.zona.tipo,
              }
            : null,
        );
      })
      .catch((capturado) => {
        if (activo) setErrorCarga(comoApiError(capturado));
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

  function actualizarValores(nuevos: ValoresEspacio): void {
    setValores(nuevos);
    setErrores({});
    limpiarAvisos();
  }

  function cambiarPunto(punto: GeometriaPunto): void {
    const numero = solicitudZona.current + 1;
    solicitudZona.current = numero;
    setValores((actuales) => ({ ...actuales, punto }));
    setErrores({});
    setErrorZona(null);
    setCargandoZona(true);
    limpiarAvisos();

    consultarZonaEspacio(punto.coordinates[1], punto.coordinates[0])
      .then((respuesta) => {
        if (solicitudZona.current !== numero) return;
        setZona(respuesta.zona);
        setValores((actuales) => {
          if (actuales.sector.trim().length > 0) return actuales;
          return { ...actuales, sector: respuesta.sector ?? "" };
        });
      })
      .catch((capturado) => {
        if (solicitudZona.current !== numero) return;
        setZona(null);
        setErrorZona(comoApiError(capturado));
      })
      .finally(() => {
        if (solicitudZona.current === numero) setCargandoZona(false);
      });
  }

  const validacion = validarValoresEspacio(valores);
  const puedeGuardar = !guardando && !tieneErroresEspacio(validacion);

  async function guardar(): Promise<void> {
    if (guardando) return;
    const erroresValidacion = validarValoresEspacio(valores);
    setErrores(erroresValidacion);
    if (tieneErroresEspacio(erroresValidacion)) return;

    setGuardando(true);
    limpiarAvisos();
    try {
      const solicitud = construirSolicitudEspacio(valores);
      if (!id) {
        const creado = await crearEspacioGestor(solicitud);
        router.replace(`/gestor/espacios/${creado.id}?guardado=1`);
        return;
      }

      const datos: Partial<SolicitudEspacioGestor> = { ...solicitud };
      if (valores.estado === estadoInicial) delete datos.estado;
      const actualizado = await actualizarEspacioGestor(id, datos);
      const iniciales = espacioDesdeDetalle(actualizado);
      setValores(iniciales);
      setEstadoInicial(iniciales.estado);
      setZona(
        actualizado.zona
          ? {
              id: actualizado.zona.id,
              nombre: actualizado.zona.nombre,
              tipo: actualizado.zona.tipo,
            }
          : null,
      );
      setErrores({});
      setExito("Los cambios se guardaron correctamente.");
    } catch (capturado) {
      setErrorGuardado(comoApiError(capturado));
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <Cargando
        texto={
          id ? "Cargando el espacio…" : "Preparando el nuevo espacio temporal…"
        }
      />
    );
  }

  if (errorCarga) {
    if (errorCarga.status === 404) {
      return (
        <EstadoVacio
          titulo="El espacio solicitado no existe"
          descripcion="Puede que el identificador no sea válido."
          accion={
            <Link
              href="/gestor/espacios"
              className="font-semibold text-primario hover:underline"
            >
              Volver al catálogo de espacios
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
          href="/gestor/espacios"
          className="text-sm font-semibold text-primario hover:underline"
        >
          ← Volver al catálogo de espacios
        </Link>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primario">
            Espacio público · Administración
          </p>
          <h1 className="text-2xl font-extrabold text-titulo sm:text-3xl">
            {id ? "Editar espacio temporal" : "Crear espacio temporal"}
          </h1>
          <p className="mt-2 max-w-3xl text-base text-texto">
            Registra la ubicación, el tipo, las dimensiones y el horario. La zona
            activa se detecta automáticamente desde el punto.
          </p>
        </div>
      </div>

      {exito ? <Alerta tono="exito">{exito}</Alerta> : null}
      {errorGuardado ? (
        <Alerta tono="error">
          <span className="flex flex-col gap-1">
            <span className="font-semibold">No se pudo guardar el espacio</span>
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
          <MapaEspacioCarga
            punto={valores.punto}
            onCambiarPunto={cambiarPunto}
          />
          {errorZona ? (
            <Alerta tono="informacion">
              No se pudo consultar la zona activa. Puedes guardar el espacio con
              el sector manual.
            </Alerta>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link
              href={id ? `/gestor/espacios/${id}` : "/gestor/espacios"}
              className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-texto hover:bg-slate-100"
            >
              Cancelar
            </Link>
            <Boton
              onClick={() => void guardar()}
              cargando={guardando}
              disabled={!puedeGuardar}
            >
              {id ? "Guardar cambios" : "Crear espacio"}
            </Boton>
          </div>
        </div>

        <Tarjeta>
          <TarjetaCuerpo>
            <FormularioEspacio
              valores={valores}
              errores={errores}
              zona={zona}
              cargandoZona={cargandoZona}
              onCambiar={actualizarValores}
            />
          </TarjetaCuerpo>
        </Tarjeta>
      </div>
    </div>
  );
}
